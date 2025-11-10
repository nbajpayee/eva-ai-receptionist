"""
Main FastAPI application for Med Spa Voice AI.
"""
import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import Optional, Dict
from datetime import datetime

from config import get_settings
from database import get_db, init_db, Customer, Appointment, CallSession
from realtime_client import RealtimeClient
from analytics import AnalyticsService

settings = get_settings()

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered voice receptionist for medical spas"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    print(f"{settings.APP_NAME} started successfully!")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ==================== Voice WebSocket Endpoint ====================

@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for voice communication with OpenAI Realtime API.

    Args:
        websocket: WebSocket connection
        session_id: Unique session identifier
        db: Database session
    """
    await websocket.accept()
    active_connections[session_id] = websocket

    # Create call session in database
    call_session = AnalyticsService.create_call_session(
        db=db,
        session_id=session_id,
        phone_number=None  # Will be updated if collected
    )

    # Initialize OpenAI Realtime client
    realtime_client = RealtimeClient()

    session_finalized = False
    finalize_lock = asyncio.Lock()
    disconnect_performed = False

    async def finalize_session(reason: str) -> None:
        nonlocal session_finalized, disconnect_performed

        async with finalize_lock:
            if session_finalized:
                return

            session_finalized = True
            print(f"🔚 Finalizing session {session_id} ({reason})")

            # Remove active connection reference if present
            active_connections.pop(session_id, None)

            session_data = realtime_client.get_session_data()
            transcript_entries = session_data.get('transcript', [])
            print(f"🧾 Transcript entries captured for {session_id}: {len(transcript_entries)}")
            if not transcript_entries:
                print("🧾 Transcript data (empty or missing)")
            else:
                preview = transcript_entries[-3:]
                print(f"🧾 Transcript preview: {preview}")

            try:
                AnalyticsService.end_call_session(
                    db=db,
                    session_id=session_id,
                    transcript=session_data.get('transcript', []),
                    function_calls=session_data.get('function_calls', []),
                    customer_data=session_data.get('customer_data', {})
                )
            except Exception as e:
                print(f"Error ending call session: {e}")

            if not disconnect_performed:
                try:
                    await realtime_client.disconnect()
                except Exception as disconnect_err:
                    print(f"Error disconnecting realtime client during finalize: {disconnect_err}")
                else:
                    disconnect_performed = True

    try:
        # Connect to OpenAI Realtime API
        await realtime_client.connect()

        # Send greeting to kick off conversation
        await realtime_client.send_greeting()

        # Log session start
        AnalyticsService.log_call_event(
            db=db,
            call_session_id=call_session.id,
            event_type="session_started",
            data={"session_id": session_id}
        )
        print("✅ Session logged, about to define audio_callback")

        # Define callback for audio output
        print("✅ Defining audio_callback function")
        async def audio_callback(audio_b64: str):
            """Send audio from OpenAI back to client."""
            if websocket.client_state != WebSocketState.CONNECTED:
                print("📤 Skipping audio send; websocket no longer connected")
                return

            print(f"📤 Audio callback called, sending {len(audio_b64)} chars to browser")
            await websocket.send_json({
                "type": "audio",
                "data": audio_b64
            })
            print("📤 Audio sent to browser")

        print("✅ audio_callback defined, about to define handle_client_messages")

        # Handle messages from both client and OpenAI
        async def handle_client_messages():
            """Handle incoming messages from client."""
            print("📱 Starting client message handler...")
            try:
                while True:
                    message = await websocket.receive_json()
                    msg_type = message.get("type")
                    print(f"📱 Received from client: {msg_type}")

                    if msg_type == "audio":
                        # Forward audio to OpenAI
                        audio_b64 = message.get("data")
                        await realtime_client.send_audio(audio_b64, commit=False)

                    elif msg_type == "commit":
                        print("📱 Client requested audio buffer commit")
                        await realtime_client.commit_audio_buffer()

                    elif msg_type == "interrupt":
                        print("✋ Client interrupted assistant")
                        await realtime_client.cancel_response()

                    elif msg_type == "end_session":
                        print("📱 Client requested end session")
                        try:
                            await websocket.close(code=1000)
                        except Exception as close_err:
                            print(f"📱 Error closing client websocket after end_session: {close_err}")
                        break

                    elif msg_type == "ping":
                        payload = message.get("data") or {}
                        await websocket.send_json(
                            {
                                "type": "pong",
                                "data": {
                                    "client_sent_at": payload.get("client_sent_at"),
                                    "server_received_at": datetime.utcnow().isoformat(),
                                },
                            }
                        )

            except WebSocketDisconnect:
                print("📱 Client WebSocket disconnected")
            except Exception as e:
                print(f"📱 Error in client handler: {e}")
                import traceback
                traceback.print_exc()
            finally:
                print("📱 Client handler exiting; realtime client will be closed during finalization")

        print("✅ handle_client_messages defined, about to define handle_openai_messages")

        async def handle_openai_messages():
            """Handle incoming messages from OpenAI."""
            print("🤖 Starting OpenAI message handler...")
            try:
                await realtime_client.handle_messages(audio_callback)
            except asyncio.CancelledError:
                print("🤖 OpenAI handler task cancelled")
                raise
            except Exception as e:
                print(f"🤖 Error in OpenAI handler: {e}")
                import traceback
                traceback.print_exc()

        print("✅ handle_openai_messages defined, about to import asyncio and start handlers")

        try:
            client_task = asyncio.create_task(handle_client_messages())
            openai_task = asyncio.create_task(handle_openai_messages())

            done, pending = await asyncio.wait(
                {client_task, openai_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            done_tasks = set(done)
            pending_tasks = set(pending)

            if pending_tasks:
                # Give pending tasks (typically the OpenAI handler) a grace period to flush events
                grace_start = asyncio.get_event_loop().time()
                grace_timeout = 3.0
                while pending_tasks:
                    remaining = grace_timeout - (asyncio.get_event_loop().time() - grace_start)
                    if remaining <= 0:
                        break
                    done_extra, pending_tasks = await asyncio.wait(pending_tasks, timeout=min(0.5, remaining))
                    done_tasks.update(done_extra)

            # Ensure OpenAI connection is torn down once either side completes
            results = []
            for task in done_tasks:
                try:
                    results.append(task.result())
                except Exception as task_err:
                    results.append(task_err)

            for task in pending_tasks:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    results.append("cancelled")
                except Exception as task_err:
                    results.append(task_err)

            print(f"✅ Handlers completed with results: {results}")
        except Exception as e:
            print(f"❌ Error running handlers: {e}")
            import traceback
            traceback.print_exc()

        await finalize_session("handler loop complete")

    except WebSocketDisconnect:
        print(f"Client disconnected: {session_id}")

    except Exception as e:
        print(f"Error in voice_websocket for session {session_id}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await finalize_session("websocket scope exit")


# ==================== Customer Management Endpoints ====================

@app.post("/api/customers")
async def create_customer(
    name: str,
    phone: str,
    email: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a new customer."""
    # Check if customer exists
    existing = db.query(Customer).filter(Customer.phone == phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this phone already exists")

    customer = Customer(
        name=name,
        phone=phone,
        email=email
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get customer details."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


@app.get("/api/customers/{customer_id}/history")
async def get_customer_history(customer_id: int, db: Session = Depends(get_db)):
    """Get customer's appointment and call history."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    appointments = db.query(Appointment).filter(
        Appointment.customer_id == customer_id
    ).order_by(Appointment.appointment_datetime.desc()).all()

    calls = db.query(CallSession).filter(
        CallSession.customer_id == customer_id
    ).order_by(CallSession.started_at.desc()).all()

    return {
        "customer": customer,
        "appointments": appointments,
        "calls": calls
    }


# ==================== Admin Dashboard Endpoints ====================

@app.get("/api/admin/metrics/overview")
async def get_metrics_overview(
    period: str = Query("today", regex="^(today|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get overview metrics for dashboard."""
    return AnalyticsService.get_dashboard_overview(db, period)


@app.get("/api/admin/calls")
async def get_call_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: str = Query("started_at", regex="^(started_at|duration_seconds|satisfaction_score)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """Get paginated call history."""
    return AnalyticsService.get_call_history(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order
    )


@app.get("/api/admin/calls/{call_id}")
async def get_call_details(call_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific call."""
    call = db.query(CallSession).filter(CallSession.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Get associated customer
    customer = None
    if call.customer_id:
        customer = db.query(Customer).filter(Customer.id == call.customer_id).first()

    # Get call events
    from database import CallEvent
    events = db.query(CallEvent).filter(
        CallEvent.call_session_id == call_id
    ).order_by(CallEvent.timestamp.asc()).all()

    import json
    transcript = json.loads(call.transcript) if call.transcript else []

    return {
        "call": {
            "id": call.id,
            "session_id": call.session_id,
            "started_at": call.started_at,
            "ended_at": call.ended_at,
            "duration_seconds": call.duration_seconds,
            "phone_number": call.phone_number,
            "satisfaction_score": call.satisfaction_score,
            "sentiment": call.sentiment,
            "outcome": call.outcome,
            "escalated": call.escalated,
            "escalation_reason": call.escalation_reason
        },
        "customer": customer,
        "transcript": transcript,
        "events": events
    }


@app.get("/api/admin/calls/{call_id}/transcript")
async def get_call_transcript(call_id: int, db: Session = Depends(get_db)):
    """Get call transcript."""
    call = db.query(CallSession).filter(CallSession.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    import json
    transcript = json.loads(call.transcript) if call.transcript else []

    return {
        "call_id": call_id,
        "transcript": transcript
    }


@app.get("/api/admin/analytics/daily")
async def get_daily_analytics(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """Get daily analytics for the specified number of days."""
    from database import DailyMetric
    from datetime import timedelta

    start_date = datetime.utcnow().date() - timedelta(days=days)

    metrics = db.query(DailyMetric).filter(
        DailyMetric.date >= start_date
    ).order_by(DailyMetric.date.asc()).all()

    return {
        "metrics": [
            {
                "date": m.date.isoformat(),
                "total_calls": m.total_calls,
                "appointments_booked": m.appointments_booked,
                "avg_satisfaction_score": m.avg_satisfaction_score,
                "conversion_rate": m.conversion_rate,
                "avg_call_duration_minutes": round(m.avg_call_duration_seconds / 60, 2)
            }
            for m in metrics
        ]
    }


# ==================== Appointments Endpoints ====================

@app.get("/api/appointments")
async def get_appointments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get appointments with optional filters."""
    query = db.query(Appointment)

    if start_date:
        # Replace 'Z' with '+00:00' for Python 3.8 compatibility
        start_date_normalized = start_date.replace('Z', '+00:00')
        start = datetime.fromisoformat(start_date_normalized)
        query = query.filter(Appointment.appointment_datetime >= start)

    if end_date:
        # Replace 'Z' with '+00:00' for Python 3.8 compatibility
        end_date_normalized = end_date.replace('Z', '+00:00')
        end = datetime.fromisoformat(end_date_normalized)
        query = query.filter(Appointment.appointment_datetime <= end)

    if status:
        query = query.filter(Appointment.status == status)

    appointments = query.order_by(Appointment.appointment_datetime.desc()).all()
    return {"appointments": appointments}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
