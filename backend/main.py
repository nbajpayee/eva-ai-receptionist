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
    from twilio.twiml.messaging_response import MessagingResponse
    from research.outbound_service import OutboundService
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Parse Twilio webhook data
        form_data = await request.form()
        from_number = form_data.get("From")
        to_number = form_data.get("To")
        message_body = form_data.get("Body")
        message_sid = form_data.get("MessageSid")

        if not from_number or not message_body:
            logger.error("Missing required Twilio webhook fields")
            resp = MessagingResponse()
            return Response(content=str(resp), media_type="application/xml")

        logger.info(f"Received SMS from {from_number}: {message_body[:100]}")

        # Find or create customer by phone
        customer = db.query(Customer).filter(Customer.phone == from_number).first()
        if not customer:
            # Create new customer
            customer = Customer(
                name=f"Customer {from_number[-4:]}",  # Temp name
                phone=from_number,
                created_at=datetime.utcnow()
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
            logger.info(f"Created new customer {customer.id} for {from_number}")

        # Find active SMS conversation (non-campaign) or create new
        conversation = MessagingService.find_active_conversation(
            db=db,
            customer_id=customer.id,
            channel="sms"
        )

        # If no active conversation, create one
        if not conversation:
            conversation = MessagingService.create_conversation(
                db=db,
                customer_id=customer.id,
                channel="sms",
                metadata={"twilio_from": to_number}
            )
            logger.info(f"Created new SMS conversation {conversation.id}")

        # Add inbound message
        inbound_msg = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="inbound",
            content=message_body,
            metadata={"message_sid": message_sid}
        )

        # Add SMS details
        AnalyticsService.add_sms_details(
            db=db,
            message_id=inbound_msg.id,
            from_number=from_number,
            to_number=to_number,
            provider_message_id=message_sid,
            delivery_status="received"
        )

        # Update conversation last activity
        conversation.last_activity_at = datetime.utcnow()
        db.commit()

        # Check if this is a response to a campaign
        if conversation.campaign_id:
            outbound_service = OutboundService(db_session_factory=SessionLocal)
            outbound_service.check_customer_response(db, conversation.id)
            logger.info(f"Tracked campaign response for conversation {conversation.id}")

        # Generate AI response
        ai_response_text = MessagingService.generate_ai_response(
            db=db,
            conversation_id=conversation.id,
            user_message=message_body
        )

        # Add outbound message to database
        outbound_msg = MessagingService.add_assistant_message(
            db=db,
            conversation=conversation,
            content=ai_response_text,
            metadata={}
        )

        # TODO: In production, send SMS via Twilio:
        # from twilio.rest import Client
        # client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        # sent_message = client.messages.create(
        #     body=ai_response_text,
        #     from_=to_number,
        #     to=from_number
        # )
        # # Update SMS details with sent message SID
        # AnalyticsService.add_sms_details(
        #     db=db,
        #     message_id=outbound_msg.id,
        #     from_number=to_number,
        #     to_number=from_number,
        #     provider_message_id=sent_message.sid,
        #     delivery_status="sent"
        # )

        logger.info(f"Generated AI response for conversation {conversation.id}")

        # Return TwiML response with AI-generated text
        resp = MessagingResponse()
        resp.message(ai_response_text)
        return Response(content=str(resp), media_type="application/xml")

    except Exception as e:
        logger.error(f"Error handling SMS webhook: {str(e)}", exc_info=True)
        # Return generic error response
        resp = MessagingResponse()
        resp.message(f"We're experiencing technical difficulties. Please call us at {settings.MED_SPA_PHONE}")
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
    from research.outbound_service import OutboundService
    import logging

    logger = logging.getLogger(__name__)

    try:
        # Parse SendGrid webhook data (multipart form data)
        form_data = await request.form()
        from_email = form_data.get("from")
        to_email = form_data.get("to")
        subject = form_data.get("subject", "")
        text_body = form_data.get("text", "")
        html_body = form_data.get("html", "")

        if not from_email or not (text_body or html_body):
            logger.error("Missing required SendGrid webhook fields")
            return {"status": "error", "message": "Missing required fields"}

        logger.info(f"Received email from {from_email}: {subject}")

        # Extract plain email address (remove name if present)
        import re
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_email)
        from_email_clean = email_match.group(0) if email_match else from_email

        # Find or create customer by email
        customer = db.query(Customer).filter(Customer.email == from_email_clean).first()
        if not customer:
            # Create new customer
            customer = Customer(
                name=f"Customer ({from_email_clean})",  # Temp name
                email=from_email_clean,
                created_at=datetime.utcnow()
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
            logger.info(f"Created new customer {customer.id} for {from_email_clean}")

        # Find active email conversation or create new
        conversation = MessagingService.find_active_conversation(
            db=db,
            customer_id=customer.id,
            channel="email"
        )

        # If no active conversation, create one
        if not conversation:
            conversation = MessagingService.create_conversation(
                db=db,
                customer_id=customer.id,
                channel="email",
                subject=subject,
                metadata={"original_subject": subject}
            )
            logger.info(f"Created new email conversation {conversation.id}")

        # Add inbound message (prefer text over HTML for AI processing)
        message_content = text_body if text_body else html_body
        inbound_msg = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="inbound",
            content=message_content,
            metadata={"subject": subject}
        )

        # Add email details
        AnalyticsService.add_email_details(
            db=db,
            message_id=inbound_msg.id,
            subject=subject,
            from_address=from_email_clean,
            to_address=to_email or settings.MED_SPA_EMAIL,
            body_text=text_body,
            body_html=html_body,
            provider_message_id=form_data.get("message-id", f"sg_{inbound_msg.id}"),
            delivery_status="received"
        )

        # Update conversation last activity
        conversation.last_activity_at = datetime.utcnow()
        db.commit()

        # Check if this is a response to a campaign
        if conversation.campaign_id:
            outbound_service = OutboundService(db_session_factory=SessionLocal)
            outbound_service.check_customer_response(db, conversation.id)
            logger.info(f"Tracked campaign response for conversation {conversation.id}")

        # Generate AI response
        ai_response_text = MessagingService.generate_ai_response(
            db=db,
            conversation_id=conversation.id,
            user_message=message_content
        )

        # Add outbound message to database
        reply_subject = f"Re: {subject}" if not subject.startswith("Re:") else subject
        outbound_msg = MessagingService.add_assistant_message(
            db=db,
            conversation=conversation,
            content=ai_response_text,
            metadata={"subject": reply_subject}
        )

        # TODO: In production, send email via SendGrid:
        # from sendgrid import SendGridAPIClient
        # from sendgrid.helpers.mail import Mail
        # sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        # message = Mail(
        #     from_email=to_email or settings.MED_SPA_EMAIL,
        #     to_emails=from_email_clean,
        #     subject=reply_subject,
        #     html_content=f"<p>{ai_response_text.replace(chr(10), '<br>')}</p>"
        # )
        # response = sg.send(message)
        # # Update email details with sent message ID
        # AnalyticsService.add_email_details(
        #     db=db,
        #     message_id=outbound_msg.id,
        #     subject=reply_subject,
        #     from_address=to_email or settings.MED_SPA_EMAIL,
        #     to_address=from_email_clean,
        #     body_text=ai_response_text,
        #     body_html=f"<p>{ai_response_text.replace(chr(10), '<br>')}</p>",
        #     provider_message_id=response.headers.get('X-Message-Id'),
        #     delivery_status="sent"
        # )

        logger.info(f"Generated AI email response for conversation {conversation.id}")

        return {
            "status": "success",
            "conversation_id": str(conversation.id),
            "message": "Email received and response generated"
        }

    except Exception as e:
        logger.error(f"Error handling email webhook: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
