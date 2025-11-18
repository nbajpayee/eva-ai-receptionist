"""
Main FastAPI application for Med Spa Voice AI.
"""
import uuid
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, Request
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional, Dict, List
from datetime import datetime
from config import get_settings
from database import get_db, init_db, Customer, Appointment, CallSession, Conversation
from realtime_client import RealtimeClient
from analytics import AnalyticsService
from api_messaging import messaging_router
from api_research import router as research_router
from calendar_service import check_calendar_credentials

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
