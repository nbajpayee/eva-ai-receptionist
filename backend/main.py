"""
Main FastAPI application for Med Spa Voice AI.
"""
import uuid
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, Request, UploadFile, File, Form
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from typing import Optional, Dict, List
from datetime import datetime
from pydantic import BaseModel
from config import get_settings
from database import get_db, init_db, Customer, Appointment, CallSession, Conversation, Provider, InPersonConsultation, AIInsight
from realtime_client import RealtimeClient
from analytics import AnalyticsService
from api_messaging import messaging_router
from api_research import router as research_router
from calendar_service import check_calendar_credentials
from consultation_service import ConsultationService
from ai_insights_service import AIInsightsService
from provider_analytics_service import ProviderAnalyticsService
from auth import get_current_user, get_current_admin, get_current_provider, verify_provider_access, AuthUser

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered voice receptionist for medical spas"
)

# Register routers
app.include_router(messaging_router)
app.include_router(research_router)

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


# ==================== Request/Response Models ====================

class ConsultationCreateRequest(BaseModel):
    provider_id: str
    customer_id: Optional[int] = None
    service_type: Optional[str] = None


class ConsultationEndRequest(BaseModel):
    outcome: str
    appointment_id: Optional[int] = None
    notes: Optional[str] = None


class ProviderCreateRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    specialties: Optional[List[str]] = None
    bio: Optional[str] = None


# ==================== App Events ====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    credential_status = check_calendar_credentials()
    app.state.calendar_credentials = credential_status
    if credential_status.get("ok"):
        logger.info("Google Calendar credentials validated at startup")
    else:
        logger.warning(
            "Google Calendar credentials require attention: %s", credential_status
        )
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

    # DUAL-WRITE: Create both legacy call_session and new conversation
    # Legacy schema (for backward compatibility during migration)
    call_session = AnalyticsService.create_call_session(
        db=db,
        session_id=session_id,
        phone_number=None  # Will be updated if collected
    )

    # New omnichannel schema
    conversation = AnalyticsService.create_conversation(
        db=db,
        customer_id=None,  # Will be updated if identified
        channel='voice',
        metadata={'session_id': session_id, 'legacy_call_session_id': str(call_session.id)}
    )

    # Initialize OpenAI Realtime client
    realtime_client = RealtimeClient(db=db, conversation=conversation)

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
                # DUAL-WRITE: Update both legacy and new schemas

                # Extract customer data once for reuse
                customer_data = session_data.get('customer_data', {})

                # 1. Update legacy call_session (this also looks up/links customer)
                updated_call_session = AnalyticsService.end_call_session(
                    db=db,
                    session_id=session_id,
                    transcript=session_data.get('transcript', []),
                    function_calls=session_data.get('function_calls', []),
                    customer_data=customer_data
                )

                # 2. Update new conversation schema
                # Extract customer ID from the updated call_session
                # (end_call_session already looked up customer by phone)
                customer_id = updated_call_session.customer_id if updated_call_session else None

                # Update conversation with customer ID if identified
                if customer_id:
                    conversation.customer_id = customer_id
                    print(f"🔗 Linked conversation {conversation.id} to customer {customer_id}")
                    db.commit()
                else:
                    print(f"⚠️  No customer linked for session {session_id}")

                # Add message with human-readable summary (not raw JSON)
                # The actual transcript goes in voice_details.transcript_segments
                import json
                summary_text = f"Voice call - {len(transcript_entries)} transcript segments"
                if transcript_entries:
                    # Include first and last message for context
                    first_msg = transcript_entries[0].get('text', '') if transcript_entries else ''
                    summary_text = f"Voice call starting with: {first_msg[:100]}..."

                message = AnalyticsService.add_message(
                    db=db,
                    conversation_id=conversation.id,
                    direction='inbound',
                    content=summary_text,  # Human-readable summary, not JSON dump
                    sent_at=conversation.initiated_at,
                    metadata={
                        'customer_interruptions': customer_data.get('interruptions', 0),
                        'ai_clarifications_needed': 0,
                        'transcript_entry_count': len(transcript_entries)
                    }
                )

                # Add voice call details
                duration = int((datetime.utcnow() - conversation.initiated_at.replace(tzinfo=None)).total_seconds()) if conversation.initiated_at else 0
                AnalyticsService.add_voice_details(
                    db=db,
                    message_id=message.id,
                    duration_seconds=duration,
                    transcript_segments=transcript_entries,
                    function_calls=session_data.get('function_calls', []),
                    interruption_count=session_data.get('customer_data', {}).get('interruptions', 0)
                )

                # Complete conversation
                AnalyticsService.complete_conversation(db, conversation.id)

                # Score conversation satisfaction (AI analysis)
                AnalyticsService.score_conversation_satisfaction(db, conversation.id)

                print(f"✅ Dual-write complete for session {session_id}")

            except Exception as e:
                print(f"Error ending call session: {e}")
            finally:
                if not disconnect_performed:
                    disconnect_performed = True
                    try:
                        await realtime_client.disconnect()
                    except Exception as disconnect_exc:  # noqa: BLE001
                        logger.warning("Failed to disconnect realtime client: %s", disconnect_exc)
                realtime_client.close()

    try:
        # Connect to OpenAI Realtime API
        await realtime_client.connect()
        # Send greeting to kick off conversation
        await realtime_client.send_greeting()

        # DUAL-WRITE: Log session start to both schemas
        # Legacy schema
        AnalyticsService.log_call_event(
            db=db,
            call_session_id=call_session.id,
            event_type="session_started",
            data={"session_id": session_id}
        )
        # New schema
        AnalyticsService.add_communication_event(
            db=db,
            conversation_id=conversation.id,
            event_type="session_started",
            details={"session_id": session_id}
        )
        print("✅ Session logged to both schemas, about to define audio_callback")

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
        except Exception as orchestration_error:
            print(f"❌ Error orchestrating realtime handlers: {orchestration_error}")
            import traceback
            traceback.print_exc()
            raise
    except Exception as orchestration_error:
        print(f"❌ Unhandled error in voice_websocket: {orchestration_error}")
        import traceback
        traceback.print_exc()
        await finalize_session("exception")
        raise
    finally:
        await finalize_session("closed")
        print(f"🧹 Cleaning up session {session_id}")
        try:
            await realtime_client.disconnect()
        except Exception as cleanup_err:
            print(f"⚠️  Error during realtime client cleanup: {cleanup_err}")

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


@app.put("/api/admin/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    is_new_client: Optional[bool] = None,
    has_allergies: Optional[bool] = None,
    is_pregnant: Optional[bool] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update customer information."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check if phone is being changed and if it's already in use
    if phone and phone != customer.phone:
        existing = db.query(Customer).filter(
            Customer.phone == phone,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already in use by another customer")

    # Check if email is being changed and if it's already in use
    if email and email != customer.email:
        existing = db.query(Customer).filter(
            Customer.email == email,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another customer")

    # Update fields that were provided
    if name is not None:
        customer.name = name
    if phone is not None:
        customer.phone = phone
    if email is not None:
        customer.email = email
    if is_new_client is not None:
        customer.is_new_client = is_new_client
    if has_allergies is not None:
        customer.has_allergies = has_allergies
    if is_pregnant is not None:
        customer.is_pregnant = is_pregnant
    if notes is not None:
        customer.notes = notes

    customer.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(customer)

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "notes": customer.notes,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "updated_at": customer.updated_at.isoformat() if customer.updated_at else None
        }
    }


# ==================== Configuration Endpoints ====================

@app.get("/api/config/services")
async def get_services():
    """Get available med spa services."""
    from config import SERVICES
    return {"services": SERVICES}


@app.get("/api/config/providers")
async def get_providers():
    """Get available providers."""
    from config import PROVIDERS
    return {"providers": PROVIDERS}


# ==================== Appointment Booking Endpoint ====================

@app.post("/api/admin/appointments")
async def create_appointment(
    customer_id: int,
    service_type: str,
    appointment_datetime: str,
    provider: Optional[str] = None,
    special_requests: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a new appointment for a customer."""
    from calendar_service import CalendarService
    from config import SERVICES

    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Verify service exists
    if service_type not in SERVICES:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")

    # Parse datetime
    try:
        appt_dt = datetime.fromisoformat(appointment_datetime.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    # Get service duration
    service_info = SERVICES[service_type]
    duration = service_info.get("duration_minutes", 60)

    # Create calendar event
    calendar_service = CalendarService()
    try:
        calendar_event = calendar_service.create_event(
            summary=f"{service_info['name']} - {customer.name}",
            description=f"Service: {service_info['name']}\nCustomer: {customer.name}\nPhone: {customer.phone}\nProvider: {provider or 'TBD'}\n{special_requests or ''}",
            start_time=appt_dt,
            duration_minutes=duration
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")

    # Create appointment in database
    appointment = Appointment(
        customer_id=customer_id,
        calendar_event_id=calendar_event.get("id"),
        appointment_datetime=appt_dt,
        service_type=service_type,
        provider=provider,
        duration_minutes=duration,
        status="scheduled",
        booked_by="staff",
        special_requests=special_requests
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return {
        "appointment": {
            "id": appointment.id,
            "customer_id": appointment.customer_id,
            "service_type": appointment.service_type,
            "appointment_datetime": appointment.appointment_datetime.isoformat(),
            "provider": appointment.provider,
            "duration_minutes": appointment.duration_minutes,
            "status": appointment.status,
            "special_requests": appointment.special_requests
        }
    }


# ==================== Export Endpoints ====================

@app.get("/api/admin/customers/export/csv")
async def export_customers_csv(db: Session = Depends(get_db)):
    """Export customers to CSV format."""
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse

    # Fetch all customers with their stats
    customers = db.query(
        Customer,
        func.count(Appointment.id).label('total_appointments'),
        func.count(Conversation.id).label('total_conversations'),
        func.avg(Conversation.satisfaction_score).label('avg_satisfaction_score')
    ).outerjoin(Appointment, Customer.id == Appointment.customer_id)\
     .outerjoin(Conversation, Customer.id == Conversation.customer_id)\
     .group_by(Customer.id)\
     .all()

    # Create CSV in memory
    output = StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        'ID',
        'Name',
        'Phone',
        'Email',
        'Is New Client',
        'Has Allergies',
        'Is Pregnant',
        'Total Appointments',
        'Total Conversations',
        'Avg Satisfaction Score',
        'Created At',
        'Notes'
    ])

    # Write data
    for customer, total_appts, total_convs, avg_satisfaction in customers:
        writer.writerow([
            customer.id,
            customer.name,
            customer.phone,
            customer.email or '',
            'Yes' if customer.is_new_client else 'No',
            'Yes' if customer.has_allergies else 'No',
            'Yes' if customer.is_pregnant else 'No',
            total_appts or 0,
            total_convs or 0,
            round(avg_satisfaction, 1) if avg_satisfaction else '',
            customer.created_at.strftime('%Y-%m-%d %H:%M:%S') if customer.created_at else '',
            customer.notes or ''
        ])

    # Return CSV as download
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=customers_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


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


@app.get("/api/admin/analytics/timeseries")
async def get_timeseries_analytics(
    period: str = Query("week", regex="^(today|week|month)$"),
    interval: str = Query("hour", regex="^(hour|day)$"),
    db: Session = Depends(get_db)
):
    """Get time-series metrics for charting."""
    return AnalyticsService.get_timeseries_metrics(
        db=db,
        period=period,
        interval=interval
    )


@app.get("/api/admin/analytics/funnel")
async def get_conversion_funnel(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get conversion funnel metrics."""
    return AnalyticsService.get_conversion_funnel(db=db, period=period)


@app.get("/api/admin/analytics/peak-hours")
async def get_peak_hours(
    period: str = Query("week", regex="^(week|month)$"),
    db: Session = Depends(get_db)
):
    """Get peak hours heatmap data."""
    return AnalyticsService.get_peak_hours(db=db, period=period)


@app.get("/api/admin/analytics/channel-distribution")
async def get_channel_distribution(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get channel distribution data."""
    return AnalyticsService.get_channel_distribution(db=db, period=period)


@app.get("/api/admin/analytics/outcome-distribution")
async def get_outcome_distribution(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get outcome distribution data."""
    return AnalyticsService.get_outcome_distribution(db=db, period=period)


@app.get("/api/admin/customers")
async def get_customers_list(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get customers list with search and pagination."""
    query = db.query(Customer)

    # Apply search filter
    if search:
        query = query.filter(
            (Customer.name.ilike(f"%{search}%")) |
            (Customer.phone.ilike(f"%{search}%")) |
            (Customer.email.ilike(f"%{search}%"))
        )

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    customers = query.order_by(Customer.created_at.desc())\
        .offset(offset)\
        .limit(page_size)\
        .all()

    # Get conversation counts for each customer
    serialized = []
    for customer in customers:
        conversation_count = db.query(func.count(Conversation.id))\
            .filter(Conversation.customer_id == customer.id)\
            .scalar() or 0

        booking_count = db.query(func.count(Conversation.id))\
            .filter(
                Conversation.customer_id == customer.id,
                Conversation.outcome == 'appointment_scheduled'
            )\
            .scalar() or 0

        serialized.append({
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "conversation_count": conversation_count,
            "booking_count": booking_count,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "customers": serialized
    }


@app.get("/api/admin/customers/{customer_id}/timeline")
async def get_customer_timeline(
    customer_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get conversation timeline for a specific customer."""
    try:
        return AnalyticsService.get_customer_timeline(
            db=db,
            customer_id=customer_id,
            limit=limit
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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


# ==================== Admin Customer Endpoints ====================

@app.get("/api/admin/customers")
async def get_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(name|created_at|last_activity)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    is_new_client: Optional[bool] = None,
    has_medical_flags: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get paginated customer list with aggregations."""
    from sqlalchemy import case, desc, asc
    from datetime import datetime

    # Base query with aggregations
    query = db.query(
        Customer,
        func.count(Appointment.id).label('total_appointments'),
        func.count(Conversation.id).label('total_conversations'),
        func.max(
            case(
                (Conversation.last_activity_at > Appointment.updated_at, Conversation.last_activity_at),
                else_=Appointment.updated_at
            )
        ).label('last_activity_at'),
        func.avg(Conversation.satisfaction_score).label('avg_satisfaction_score')
    ).outerjoin(Appointment, Customer.id == Appointment.customer_id)\
     .outerjoin(Conversation, Customer.id == Conversation.customer_id)\
     .group_by(Customer.id)

    # Apply filters
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_pattern)) |
            (Customer.phone.ilike(search_pattern)) |
            (Customer.email.ilike(search_pattern))
        )

    if is_new_client is not None:
        query = query.filter(Customer.is_new_client == is_new_client)

    if has_medical_flags:
        query = query.filter(
            (Customer.has_allergies == True) |
            (Customer.is_pregnant == True)
        )

    # Get total count
    total = query.count()

    # Apply sorting
    if sort_by == "name":
        query = query.order_by(desc(Customer.name) if sort_order == "desc" else asc(Customer.name))
    elif sort_by == "last_activity":
        query = query.order_by(desc('last_activity_at') if sort_order == "desc" else asc('last_activity_at'))
    else:  # created_at
        query = query.order_by(desc(Customer.created_at) if sort_order == "desc" else asc(Customer.created_at))

    # Apply pagination
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    # Calculate preferred channel for each customer
    customers_data = []
    for customer, total_appointments, total_conversations, last_activity, avg_satisfaction in results:
        # Get channel distribution
        channel_counts = db.query(
            Conversation.channel,
            func.count(Conversation.id)
        ).filter(
            Conversation.customer_id == customer.id
        ).group_by(Conversation.channel).all()

        preferred_channel = "voice"  # default
        if channel_counts:
            preferred_channel = max(channel_counts, key=lambda x: x[1])[0]

        customers_data.append({
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "total_appointments": total_appointments or 0,
            "total_conversations": total_conversations or 0,
            "last_activity_at": last_activity.isoformat() if last_activity else None,
            "avg_satisfaction_score": round(avg_satisfaction, 1) if avg_satisfaction else None,
            "preferred_channel": preferred_channel
        })

    return {
        "customers": customers_data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@app.get("/api/admin/customers/analytics")
async def get_customers_analytics(db: Session = Depends(get_db)):
    """Get customer analytics for overview page."""
    from datetime import timedelta

    # Total customers
    total_customers = db.query(func.count(Customer.id)).scalar() or 0

    # New customers this month
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_this_month = db.query(func.count(Customer.id)).filter(
        Customer.created_at >= thirty_days_ago
    ).scalar() or 0

    # New vs returning split
    new_clients = db.query(func.count(Customer.id)).filter(
        Customer.is_new_client == True
    ).scalar() or 0

    # Top customers by appointments
    top_customers = db.query(
        Customer,
        func.count(Appointment.id).label('appointment_count')
    ).join(Appointment, Customer.id == Appointment.customer_id)\
     .group_by(Customer.id)\
     .order_by(desc('appointment_count'))\
     .limit(10)\
     .all()

    top_customers_data = [
        {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "appointment_count": count
        }
        for customer, count in top_customers
    ]

    # At-risk customers (no activity in 90+ days)
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    at_risk = db.query(Customer).outerjoin(Conversation).outerjoin(Appointment)\
        .group_by(Customer.id)\
        .having(
            func.max(
                case(
                    (Conversation.last_activity_at > Appointment.updated_at, Conversation.last_activity_at),
                    else_=Appointment.updated_at
                )
            ) < ninety_days_ago
        ).limit(10).all()

    at_risk_data = [
        {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email
        }
        for customer in at_risk
    ]

    # Channel distribution
    channel_distribution = db.query(
        Conversation.channel,
        func.count(Conversation.id)
    ).group_by(Conversation.channel).all()

    channel_data = {channel: count for channel, count in channel_distribution}

    # Medical screening stats
    has_allergies_count = db.query(func.count(Customer.id)).filter(
        Customer.has_allergies == True
    ).scalar() or 0

    is_pregnant_count = db.query(func.count(Customer.id)).filter(
        Customer.is_pregnant == True
    ).scalar() or 0

    return {
        "total_customers": total_customers,
        "new_this_month": new_this_month,
        "new_clients_count": new_clients,
        "returning_clients_count": total_customers - new_clients,
        "top_customers": top_customers_data,
        "at_risk_customers": at_risk_data,
        "channel_distribution": channel_data,
        "medical_screening": {
            "has_allergies": has_allergies_count,
            "is_pregnant": is_pregnant_count
        }
    }


@app.get("/api/admin/customers/{customer_id}")
async def get_customer_detail(customer_id: int, db: Session = Depends(get_db)):
    """Get detailed customer information."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get aggregated stats
    total_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.customer_id == customer_id
    ).scalar() or 0

    total_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.customer_id == customer_id
    ).scalar() or 0

    avg_satisfaction = db.query(func.avg(Conversation.satisfaction_score)).filter(
        Conversation.customer_id == customer_id
    ).scalar()

    # Get last activity
    last_conversation = db.query(func.max(Conversation.last_activity_at)).filter(
        Conversation.customer_id == customer_id
    ).scalar()

    last_appointment = db.query(func.max(Appointment.updated_at)).filter(
        Appointment.customer_id == customer_id
    ).scalar()

    last_activity = None
    if last_conversation and last_appointment:
        last_activity = max(last_conversation, last_appointment)
    elif last_conversation:
        last_activity = last_conversation
    elif last_appointment:
        last_activity = last_appointment

    # Get channel distribution
    channel_counts = db.query(
        Conversation.channel,
        func.count(Conversation.id)
    ).filter(
        Conversation.customer_id == customer_id
    ).group_by(Conversation.channel).all()

    preferred_channel = "voice"  # default
    if channel_counts:
        preferred_channel = max(channel_counts, key=lambda x: x[1])[0]

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "notes": customer.notes,
            "created_at": customer.created_at.isoformat() if customer.created_at else None,
            "updated_at": customer.updated_at.isoformat() if customer.updated_at else None
        },
        "stats": {
            "total_appointments": total_appointments,
            "total_conversations": total_conversations,
            "avg_satisfaction_score": round(avg_satisfaction, 1) if avg_satisfaction else None,
            "last_activity_at": last_activity.isoformat() if last_activity else None,
            "preferred_channel": preferred_channel
        }
    }


@app.get("/api/admin/customers/{customer_id}/timeline")
async def get_customer_timeline(
    customer_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get unified timeline of customer interactions."""
    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    timeline_items = []

    # Get conversations
    conv_query = db.query(Conversation).filter(Conversation.customer_id == customer_id)
    if channel:
        conv_query = conv_query.filter(Conversation.channel == channel)

    conversations = conv_query.all()

    for conv in conversations:
        # Get first message for content preview
        first_message = db.query(CommunicationMessage).filter(
            CommunicationMessage.conversation_id == conv.id
        ).order_by(CommunicationMessage.sent_at.asc()).first()

        content_preview = ""
        if first_message:
            content_preview = first_message.content[:200] if first_message.content else ""

        timeline_items.append({
            "id": str(conv.id),
            "type": "conversation",
            "channel": conv.channel,
            "timestamp": conv.initiated_at.isoformat() if conv.initiated_at else None,
            "status": conv.status,
            "summary": conv.ai_summary or conv.subject or "Conversation",
            "satisfaction_score": conv.satisfaction_score,
            "outcome": conv.outcome,
            "sentiment": conv.sentiment,
            "content_preview": content_preview,
            "duration": None  # Will be calculated from messages if needed
        })

    # Get appointments
    appt_query = db.query(Appointment).filter(Appointment.customer_id == customer_id)
    if channel == "appointment":  # Special filter for appointments
        pass  # Include all appointments
    elif channel:
        pass  # Skip appointments if filtering by communication channel
    else:
        # Include appointments when no filter
        appointments = appt_query.all()

        for appt in appointments:
            timeline_items.append({
                "id": appt.id,
                "type": "appointment",
                "channel": None,
                "timestamp": appt.appointment_datetime.isoformat() if appt.appointment_datetime else None,
                "status": appt.status,
                "summary": appt.service_type,
                "provider": appt.provider,
                "duration_minutes": appt.duration_minutes,
                "special_requests": appt.special_requests,
                "booked_by": appt.booked_by,
                "cancellation_reason": appt.cancellation_reason if appt.status == "cancelled" else None
            })

    # Sort by timestamp descending
    timeline_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # Paginate
    total = len(timeline_items)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = timeline_items[start:end]

    return {
        "timeline": paginated_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@app.get("/api/admin/customers/{customer_id}/stats")
async def get_customer_stats(customer_id: int, db: Session = Depends(get_db)):
    """Get detailed statistics for a customer."""
    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Appointment statistics
    appts = db.query(Appointment).filter(Appointment.customer_id == customer_id).all()

    appointment_stats = {
        "total": len(appts),
        "scheduled": len([a for a in appts if a.status == "scheduled"]),
        "completed": len([a for a in appts if a.status == "completed"]),
        "cancelled": len([a for a in appts if a.status == "cancelled"]),
        "no_show": len([a for a in appts if a.status == "no_show"]),
        "rescheduled": len([a for a in appts if a.status == "rescheduled"])
    }

    # Favorite services
    service_counts = {}
    for appt in appts:
        service = appt.service_type
        service_counts[service] = service_counts.get(service, 0) + 1

    favorite_services = sorted(
        [{"service": k, "count": v} for k, v in service_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:3]

    # Communication statistics
    conversations = db.query(Conversation).filter(
        Conversation.customer_id == customer_id
    ).all()

    channel_stats = {}
    satisfaction_by_channel = {}

    for conv in conversations:
        channel = conv.channel
        channel_stats[channel] = channel_stats.get(channel, 0) + 1

        if conv.satisfaction_score:
            if channel not in satisfaction_by_channel:
                satisfaction_by_channel[channel] = []
            satisfaction_by_channel[channel].append(conv.satisfaction_score)

    avg_satisfaction_by_channel = {
        channel: round(sum(scores) / len(scores), 1)
        for channel, scores in satisfaction_by_channel.items()
    }

    # Outcome distribution
    outcome_counts = {}
    for conv in conversations:
        if conv.outcome:
            outcome_counts[conv.outcome] = outcome_counts.get(conv.outcome, 0) + 1

    return {
        "appointment_stats": appointment_stats,
        "favorite_services": favorite_services,
        "communication_stats": {
            "total_conversations": len(conversations),
            "by_channel": channel_stats,
            "avg_satisfaction_by_channel": avg_satisfaction_by_channel,
            "outcomes": outcome_counts
        }
    }


# ==================== Omnichannel Communications Endpoints (Phase 2) ====================

@app.get("/api/admin/communications")
async def get_communications(
    customer_id: Optional[int] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get conversations with filtering and pagination.
    Replaces /api/admin/calls for omnichannel support.
    """
    from sqlalchemy.orm import joinedload
    from database import Conversation, Customer

    query = db.query(Conversation).options(joinedload(Conversation.customer))

    # Apply filters
    if customer_id:
        query = query.filter(Conversation.customer_id == customer_id)
    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)

    # Get total count
    total = query.count()

    # Apply pagination and sorting
    offset = (page - 1) * page_size
    conversations = query.order_by(Conversation.last_activity_at.desc())\
        .offset(offset)\
        .limit(page_size)\
        .all()

    # Serialize conversations
    serialized = []
    for conv in conversations:
        serialized.append({
            "id": str(conv.id),
            "customer_id": conv.customer_id,
            "customer_name": conv.customer.name if conv.customer else None,
            "customer_phone": conv.customer.phone if conv.customer else None,
            "channel": conv.channel,
            "status": conv.status,
            "initiated_at": conv.initiated_at.isoformat() if conv.initiated_at else None,
            "last_activity_at": conv.last_activity_at.isoformat() if conv.last_activity_at else None,
            "completed_at": conv.completed_at.isoformat() if conv.completed_at else None,
            "satisfaction_score": conv.satisfaction_score,
            "sentiment": conv.sentiment,
            "outcome": conv.outcome,
            "subject": conv.subject,
            "ai_summary": conv.ai_summary,
            "metadata": conv.custom_metadata,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "conversations": serialized
    }


@app.get("/api/admin/communications/{conversation_id}")
async def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """
    Get full conversation with all messages, events, and channel-specific details.
    """
    from sqlalchemy.orm import joinedload
    from database import Conversation
    from uuid import UUID

    try:
        conv_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID format")

    conversation = db.query(Conversation)\
        .options(
            joinedload(Conversation.messages),
            joinedload(Conversation.events),
            joinedload(Conversation.customer)
        )\
        .filter(Conversation.id == conv_uuid)\
        .first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Serialize messages with channel-specific details
    messages = []
    for msg in sorted(conversation.messages, key=lambda m: m.sent_at):
        msg_data = {
            "id": str(msg.id),
            "direction": msg.direction,
            "content": msg.content,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "processed": msg.processed,
            "metadata": msg.custom_metadata,
        }

        # Add channel-specific details
        if conversation.channel == 'voice' and msg.voice_details:
            msg_data['voice'] = {
                'duration_seconds': msg.voice_details.duration_seconds,
                'recording_url': msg.voice_details.recording_url,
                'transcript_segments': msg.voice_details.transcript_segments,
                'function_calls': msg.voice_details.function_calls,
                'interruption_count': msg.voice_details.interruption_count,
            }
        elif conversation.channel == 'sms' and msg.sms_details:
            msg_data['sms'] = {
                'from_number': msg.sms_details.from_number,
                'to_number': msg.sms_details.to_number,
                'provider_message_id': msg.sms_details.provider_message_id,
                'delivery_status': msg.sms_details.delivery_status,
                'segments': msg.sms_details.segments,
                'delivered_at': msg.sms_details.delivered_at.isoformat() if msg.sms_details.delivered_at else None,
            }
        elif conversation.channel == 'email' and msg.email_details:
            msg_data['email'] = {
                'subject': msg.email_details.subject,
                'from_address': msg.email_details.from_address,
                'to_address': msg.email_details.to_address,
                'body_html': msg.email_details.body_html,
                'attachments': msg.email_details.attachments,
                'opened_at': msg.email_details.opened_at.isoformat() if msg.email_details.opened_at else None,
            }

        messages.append(msg_data)

    # Serialize events
    events = []
    for event in sorted(conversation.events, key=lambda e: e.timestamp):
        events.append({
            "id": str(event.id),
            "event_type": event.event_type,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "details": event.details,
            "message_id": str(event.message_id) if event.message_id else None,
        })

    return {
        "conversation": {
            "id": str(conversation.id),
            "customer": {
                "id": conversation.customer.id,
                "name": conversation.customer.name,
                "phone": conversation.customer.phone,
                "email": conversation.customer.email,
            } if conversation.customer else None,
            "channel": conversation.channel,
            "status": conversation.status,
            "initiated_at": conversation.initiated_at.isoformat() if conversation.initiated_at else None,
            "last_activity_at": conversation.last_activity_at.isoformat() if conversation.last_activity_at else None,
            "completed_at": conversation.completed_at.isoformat() if conversation.completed_at else None,
            "satisfaction_score": conversation.satisfaction_score,
            "sentiment": conversation.sentiment,
            "outcome": conversation.outcome,
            "subject": conversation.subject,
            "ai_summary": conversation.ai_summary,
            "metadata": conversation.custom_metadata,
        },
        "messages": messages,
        "events": events
    }


# ==================== Webhook Endpoints (Phase 2) ====================

@app.post("/api/webhooks/twilio/sms")
async def handle_twilio_sms(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Twilio SMS webhook handler.
    Receives incoming SMS, finds or creates conversation, generates AI response.
    """
    # TODO: Implement Twilio SMS handling
    # 1. Parse incoming SMS from Twilio webhook
    # 2. Find or create customer by phone number
    # 3. Find active SMS conversation or create new one
    # 4. Add inbound message
    # 5. Generate AI response (use GPT-4 or similar)
    # 6. Send outbound SMS via Twilio
    # 7. Add outbound message to conversation
    # 8. If conversation complete, score satisfaction

    from twilio.twiml.messaging_response import MessagingResponse

    # Placeholder response
    resp = MessagingResponse()
    resp.message("Thank you for contacting us! This feature is coming soon.")

    return Response(content=str(resp), media_type="application/xml")


@app.post("/api/webhooks/sendgrid/email")
async def handle_sendgrid_email(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    SendGrid inbound email webhook handler.
    Receives incoming emails, finds or creates conversation, generates AI response.
    """
    # TODO: Implement SendGrid email handling
    # 1. Parse incoming email from SendGrid webhook
    # 2. Find or create customer by email address
    # 3. Find email thread or create new conversation
    # 4. Add inbound message
    # 5. Generate AI response
    # 6. Send outbound email via SendGrid
    # 7. Add outbound message to conversation
    # 8. If conversation complete, score satisfaction

    return {"status": "received", "message": "Email webhook handler coming soon"}


# ==================== Provider Analytics Endpoints ====================

# ===== Consultation Endpoints =====

@app.post("/api/consultations")
async def create_consultation(
    request: ConsultationCreateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new consultation session. Requires authentication."""
    # Verify provider can create consultation for themselves
    verify_provider_access(current_user, request.provider_id, "consultations")

    service = ConsultationService(db)
    consultation = service.create_consultation(
        provider_id=request.provider_id,
        customer_id=request.customer_id,
        service_type=request.service_type
    )
    return {
        "id": str(consultation.id),
        "provider_id": str(consultation.provider_id),
        "customer_id": consultation.customer_id,
        "service_type": consultation.service_type,
        "created_at": consultation.created_at.isoformat()
    }


@app.post("/api/consultations/{consultation_id}/upload-audio")
async def upload_consultation_audio(
    consultation_id: str,
    audio: UploadFile = File(...),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload audio recording for a consultation. Requires authentication."""
    service = ConsultationService(db)

    # Get consultation to verify ownership
    consultation = service.get_consultation(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Verify provider can access this consultation
    verify_provider_access(current_user, str(consultation.provider_id), "consultation")

    # Upload file
    file_path = service.upload_audio(
        consultation_id=consultation_id,
        audio_file=audio.file,
        filename=audio.filename or "recording.wav"
    )

    consultation.recording_url = file_path
    db.commit()

    return {
        "consultation_id": consultation_id,
        "recording_url": file_path,
        "status": "uploaded"
    }


@app.post("/api/consultations/{consultation_id}/end")
async def end_consultation(
    consultation_id: str,
    request: ConsultationEndRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End a consultation and trigger AI analysis. Requires authentication."""
    service = ConsultationService(db)

    # Verify ownership before ending
    consultation_check = service.get_consultation(consultation_id)
    if not consultation_check:
        raise HTTPException(status_code=404, detail="Consultation not found")
    verify_provider_access(current_user, str(consultation_check.provider_id), "consultation")

    consultation = service.end_consultation(
        consultation_id=consultation_id,
        outcome=request.outcome,
        appointment_id=request.appointment_id,
        notes=request.notes
    )

    # Trigger AI analysis
    insights_service = AIInsightsService(db)
    insights = insights_service.analyze_consultation(consultation_id)

    return {
        "id": str(consultation.id),
        "ended_at": consultation.ended_at.isoformat() if consultation.ended_at else None,
        "duration_seconds": consultation.duration_seconds,
        "outcome": consultation.outcome,
        "transcript_length": len(consultation.transcript) if consultation.transcript else 0,
        "insights_generated": len(insights),
        "satisfaction_score": consultation.satisfaction_score,
        "sentiment": consultation.sentiment
    }


@app.get("/api/consultations")
async def list_consultations(
    provider_id: Optional[str] = None,
    customer_id: Optional[int] = None,
    outcome: Optional[str] = None,
    service_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List consultations with filters. Requires authentication. Providers see only their own consultations."""
    # If user is a provider (not admin), force filter to their own consultations
    if not current_user.is_admin:
        provider_id = current_user.provider_id
    elif provider_id:
        # Admin requesting specific provider - verify they have access
        verify_provider_access(current_user, provider_id, "consultations")

    service = ConsultationService(db)
    offset = (page - 1) * page_size

    consultations, total = service.list_consultations(
        provider_id=provider_id,
        customer_id=customer_id,
        outcome=outcome,
        service_type=service_type,
        limit=page_size,
        offset=offset
    )

    return {
        "consultations": [
            {
                "id": str(c.id),
                "provider_id": str(c.provider_id),
                "customer_id": c.customer_id,
                "service_type": c.service_type,
                "outcome": c.outcome,
                "duration_seconds": c.duration_seconds,
                "satisfaction_score": c.satisfaction_score,
                "sentiment": c.sentiment,
                "created_at": c.created_at.isoformat(),
                "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            }
            for c in consultations
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@app.get("/api/consultations/{consultation_id}")
async def get_consultation_details(
    consultation_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed consultation information."""
    consultation = db.query(InPersonConsultation).filter(
        InPersonConsultation.id == uuid.UUID(consultation_id)
    ).first()

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Get provider
    provider = db.query(Provider).filter(
        Provider.id == consultation.provider_id
    ).first()

    # Get customer
    customer = None
    if consultation.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == consultation.customer_id
        ).first()

    # Get insights
    insights = db.query(AIInsight).filter(
        AIInsight.consultation_id == consultation.id
    ).all()

    return {
        "id": str(consultation.id),
        "provider": {
            "id": str(provider.id),
            "name": provider.name,
            "email": provider.email
        } if provider else None,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone
        } if customer else None,
        "service_type": consultation.service_type,
        "outcome": consultation.outcome,
        "duration_seconds": consultation.duration_seconds,
        "transcript": consultation.transcript,
        "notes": consultation.notes,
        "satisfaction_score": consultation.satisfaction_score,
        "sentiment": consultation.sentiment,
        "ai_summary": consultation.ai_summary,
        "created_at": consultation.created_at.isoformat(),
        "ended_at": consultation.ended_at.isoformat() if consultation.ended_at else None,
        "insights": [
            {
                "id": str(i.id),
                "type": i.insight_type,
                "title": i.title,
                "insight_text": i.insight_text,
                "supporting_quote": i.supporting_quote,
                "recommendation": i.recommendation,
                "confidence_score": i.confidence_score,
                "is_positive": i.is_positive
            }
            for i in insights
        ]
    }


# ===== Provider Endpoints =====

@app.post("/api/providers")
async def create_provider(
    request: ProviderCreateRequest,
    current_user: AuthUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new provider. Requires admin access."""
    provider = Provider(
        id=uuid.uuid4(),
        name=request.name,
        email=request.email,
        phone=request.phone,
        specialties=request.specialties,
        bio=request.bio,
        is_active=True
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    return {
        "id": str(provider.id),
        "name": provider.name,
        "email": provider.email,
        "specialties": provider.specialties or []
    }


@app.get("/api/providers")
async def list_providers(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all providers."""
    query = db.query(Provider)
    if active_only:
        query = query.filter(Provider.is_active == True)

    providers = query.order_by(Provider.name).all()

    return {
        "providers": [
            {
                "id": str(p.id),
                "name": p.name,
                "email": p.email,
                "phone": p.phone,
                "specialties": p.specialties or [],
                "avatar_url": p.avatar_url,
                "is_active": p.is_active
            }
            for p in providers
        ]
    }


@app.get("/api/providers/summary")
async def get_providers_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get performance summary for all providers. Requires authentication. Providers see only their own summary."""
    from datetime import timedelta
    service = ProviderAnalyticsService(db)

    start_date = datetime.utcnow() - timedelta(days=days)
    summaries = service.get_all_providers_summary(
        start_date=start_date,
        end_date=datetime.utcnow()
    )

    # If user is a provider (not admin), filter to show only their summary
    if not current_user.is_admin:
        summaries = [s for s in summaries if s["provider_id"] == current_user.provider_id]

    return {"providers": summaries, "period_days": days}


@app.get("/api/providers/{provider_id}")
async def get_provider_details(
    provider_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed provider information. Requires authentication. Providers can only access their own details."""
    # Verify provider can access this data
    verify_provider_access(current_user, provider_id, "provider details")

    provider = db.query(Provider).filter(
        Provider.id == uuid.UUID(provider_id)
    ).first()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    return {
        "id": str(provider.id),
        "name": provider.name,
        "email": provider.email,
        "phone": provider.phone,
        "specialties": provider.specialties or [],
        "hire_date": provider.hire_date.isoformat() if provider.hire_date else None,
        "avatar_url": provider.avatar_url,
        "bio": provider.bio,
        "is_active": provider.is_active,
        "created_at": provider.created_at.isoformat(),
        "updated_at": provider.updated_at.isoformat()
    }


@app.get("/api/providers/{provider_id}/metrics")
async def get_provider_metrics(
    provider_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get performance metrics for a provider. Requires authentication. Providers can only access their own metrics."""
    # Verify provider can access this data
    verify_provider_access(current_user, provider_id, "provider metrics")

    from datetime import timedelta
    service = ProviderAnalyticsService(db)

    # Get summary metrics
    start_date = datetime.utcnow() - timedelta(days=days)
    summaries = service.get_all_providers_summary(
        start_date=start_date,
        end_date=datetime.utcnow()
    )

    provider_summary = next(
        (s for s in summaries if s["provider_id"] == provider_id),
        None
    )

    if not provider_summary:
        raise HTTPException(status_code=404, detail="Provider not found or no data")

    # Get trend data
    conversion_trend = service.get_provider_performance_trend(
        provider_id=provider_id,
        metric="conversion_rate",
        days=days
    )

    revenue_trend = service.get_provider_performance_trend(
        provider_id=provider_id,
        metric="revenue",
        days=days
    )

    # Get outcomes breakdown
    outcomes = service.get_consultation_outcomes_breakdown(
        provider_id=provider_id,
        days=days
    )

    # Get service performance
    service_performance = service.get_service_performance(
        provider_id=provider_id,
        days=days
    )

    return {
        "summary": provider_summary,
        "trends": {
            "conversion_rate": conversion_trend,
            "revenue": revenue_trend
        },
        "outcomes": outcomes,
        "service_performance": service_performance,
        "period_days": days
    }


@app.get("/api/providers/{provider_id}/insights")
async def get_provider_insights(
    provider_id: str,
    insight_type: Optional[str] = None,
    is_positive: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get AI insights for a provider."""
    service = AIInsightsService(db)

    insights = service.get_provider_insights(
        provider_id=provider_id,
        insight_type=insight_type,
        is_positive=is_positive,
        limit=limit
    )

    return {
        "provider_id": provider_id,
        "insights": [
            {
                "id": str(i.id),
                "type": i.insight_type,
                "title": i.title,
                "insight_text": i.insight_text,
                "supporting_quote": i.supporting_quote,
                "recommendation": i.recommendation,
                "confidence_score": i.confidence_score,
                "is_positive": i.is_positive,
                "is_reviewed": i.is_reviewed,
                "created_at": i.created_at.isoformat()
            }
            for i in insights
        ]
    }


@app.get("/api/providers/{provider_id}/consultations")
async def get_provider_consultations(
    provider_id: str,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recent consultations for a provider."""
    service = ConsultationService(db)

    consultations = service.get_provider_consultations(
        provider_id=provider_id,
        limit=limit
    )

    return {
        "provider_id": provider_id,
        "consultations": [
            {
                "id": str(c.id),
                "customer_id": c.customer_id,
                "service_type": c.service_type,
                "outcome": c.outcome,
                "duration_seconds": c.duration_seconds,
                "satisfaction_score": c.satisfaction_score,
                "sentiment": c.sentiment,
                "ai_summary": c.ai_summary,
                "created_at": c.created_at.isoformat(),
                "ended_at": c.ended_at.isoformat() if c.ended_at else None
            }
            for c in consultations
        ]
    }


# ===== AI Insights Endpoints =====

@app.post("/api/insights/analyze/{consultation_id}")
async def analyze_consultation_endpoint(
    consultation_id: str,
    db: Session = Depends(get_db)
):
    """Trigger AI analysis for a consultation."""
    service = AIInsightsService(db)
    insights = service.analyze_consultation(consultation_id)

    return {
        "consultation_id": consultation_id,
        "insights_generated": len(insights),
        "insights": [
            {
                "id": str(i.id),
                "type": i.insight_type,
                "title": i.title,
                "is_positive": i.is_positive,
                "confidence_score": i.confidence_score
            }
            for i in insights
        ]
    }


@app.post("/api/insights/compare-providers")
async def compare_providers_endpoint(
    target_provider_id: str = Query(...),
    reference_provider_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Compare two providers and generate insights."""
    service = AIInsightsService(db)

    insights = service.compare_providers(
        target_provider_id=target_provider_id,
        reference_provider_id=reference_provider_id,
        days=days
    )

    return {
        "target_provider_id": target_provider_id,
        "reference_provider_id": reference_provider_id,
        "insights_generated": len(insights),
        "insights": [
            {
                "id": str(i.id),
                "title": i.title,
                "insight_text": i.insight_text,
                "recommendation": i.recommendation,
                "confidence_score": i.confidence_score
            }
            for i in insights
        ]
    }


@app.post("/api/insights/best-practices")
async def extract_best_practices_endpoint(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Extract best practices from successful consultations."""
    service = AIInsightsService(db)

    insights = service.extract_best_practices(days=days, limit=limit)

    return {
        "best_practices_count": len(insights),
        "period_days": days,
        "best_practices": [
            {
                "id": str(i.id),
                "title": i.title,
                "insight_text": i.insight_text,
                "supporting_quote": i.supporting_quote,
                "recommendation": i.recommendation,
                "confidence_score": i.confidence_score
            }
            for i in insights
        ]
    }


@app.put("/api/insights/{insight_id}/review")
async def mark_insight_reviewed(
    insight_id: str,
    db: Session = Depends(get_db)
):
    """Mark an insight as reviewed."""
    service = AIInsightsService(db)
    insight = service.mark_insight_reviewed(insight_id)

    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    return {
        "id": str(insight.id),
        "is_reviewed": insight.is_reviewed,
        "reviewed_at": insight.reviewed_at.isoformat() if insight.reviewed_at else None
    }


@app.get("/api/insights/best-practices")
async def get_best_practices(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all best practice insights."""
    insights = db.query(AIInsight).filter(
        AIInsight.insight_type == 'best_practice'
    ).order_by(
        desc(AIInsight.confidence_score),
        desc(AIInsight.created_at)
    ).limit(limit).all()

    return {
        "best_practices": [
            {
                "id": str(i.id),
                "title": i.title,
                "insight_text": i.insight_text,
                "supporting_quote": i.supporting_quote,
                "recommendation": i.recommendation,
                "confidence_score": i.confidence_score,
                "created_at": i.created_at.isoformat()
            }
            for i in insights
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
