"""
Admin API endpoints for dashboard and monitoring.

These endpoints provide administrative access to:
- Metrics and analytics
- Call/conversation history
- Appointments
- Customer data
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService
from config import get_settings
from database import (
    Appointment,
    CommunicationMessage,
    Conversation,
    Customer,
    get_db,
)
from timezone_utils import get_period_range_utc, get_med_spa_timezone, utc_to_local_iso

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ==================== Metrics Endpoints ====================


@router.get("/metrics/overview")
async def get_metrics_overview(
    period: str = Query("today", description="Period: today, week, month, custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get overview metrics for the specified period.

    All date filtering uses the med spa's configured timezone (MED_SPA_TIMEZONE).
    "Today" means today in the med spa's local time, not UTC.

    Returns:
    - Total calls/conversations
    - Bookings made
    - Satisfaction scores
    - Conversion rate
    - Channel breakdown
    """
    # Calculate date range using med spa timezone
    start, end = get_period_range_utc(period, start_date, end_date)

    # Query metrics
    total_conversations = (
        db.query(Conversation)
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
        )
        .count()
    )

    total_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.created_at >= start,
            Appointment.created_at <= end,
            Appointment.status == "scheduled",
        )
        .count()
    )

    # Average satisfaction score
    avg_satisfaction = (
        db.query(func.avg(Conversation.satisfaction_score))
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            Conversation.satisfaction_score.isnot(None),
        )
        .scalar()
        or 0.0
    )

    # Channel breakdown
    channel_stats = (
        db.query(Conversation.channel, func.count(Conversation.id).label("count"))
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
        )
        .group_by(Conversation.channel)
        .all()
    )

    # Sentiment breakdown
    sentiment_stats = (
        db.query(Conversation.sentiment, func.count(Conversation.id).label("count"))
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            Conversation.sentiment.isnot(None),
        )
        .group_by(Conversation.sentiment)
        .all()
    )

    # Outcome breakdown
    outcome_stats = (
        db.query(Conversation.outcome, func.count(Conversation.id).label("count"))
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            Conversation.outcome.isnot(None),
        )
        .group_by(Conversation.outcome)
        .all()
    )

    # Count unique customers engaged
    customers_engaged = (
        db.query(func.count(func.distinct(Conversation.customer_id)))
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            Conversation.customer_id.isnot(None),
        )
        .scalar()
        or 0
    )

    # Count total messages sent (outbound)
    total_messages_sent = (
        db.query(func.count(CommunicationMessage.id))
        .join(Conversation, CommunicationMessage.conversation_id == Conversation.id)
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            CommunicationMessage.direction == "outbound",
        )
        .scalar()
        or 0
    )

    # Calculate total talk time (sum of voice call durations)
    voice_conversations = (
        db.query(Conversation)
        .filter(
            Conversation.initiated_at >= start,
            Conversation.initiated_at <= end,
            Conversation.channel == "voice",
            Conversation.completed_at.isnot(None),
        )
        .all()
    )
    total_talk_time_seconds = sum(
        (c.completed_at - c.initiated_at).total_seconds()
        for c in voice_conversations
        if c.completed_at and c.initiated_at
    )

    settings = get_settings()
    return {
        "period": period,
        "timezone": settings.MED_SPA_TIMEZONE,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        # Fields expected by frontend
        "total_calls": total_conversations,
        "total_conversations": total_conversations,
        "appointments_booked": total_appointments,
        "total_appointments": total_appointments,
        "conversion_rate": (
            round(total_appointments / total_conversations * 100, 1)
            if total_conversations > 0
            else 0
        ),
        "avg_satisfaction_score": round(avg_satisfaction, 1),
        "average_satisfaction": round(avg_satisfaction, 1),
        "customers_engaged": customers_engaged,
        "total_messages_sent": total_messages_sent,
        "total_talk_time_hours": round(total_talk_time_seconds / 3600, 2),
        "total_talk_time_minutes": int(total_talk_time_seconds / 60),
        "avg_call_duration_minutes": (
            round(total_talk_time_seconds / len(voice_conversations) / 60, 2)
            if voice_conversations
            else 0
        ),
        "calls_escalated": 0,  # TODO: Track escalations
        "escalation_rate": 0,
        "channel_breakdown": {channel: count for channel, count in channel_stats},
        "sentiment_breakdown": {
            sentiment: count for sentiment, count in sentiment_stats if sentiment
        },
        "outcome_breakdown": {
            outcome: count for outcome, count in outcome_stats if outcome
        },
    }


@router.get("/health/booking")
async def get_booking_health(
    minutes: int = Query(60, ge=5, le=1440),
    db: Session = Depends(get_db),
):
    """Lightweight health snapshot for recent AI bookings.

    Intended for pilot monitoring and simple watchdog checks. Returns a small
    set of metrics computed over the last N minutes.
    """

    return AnalyticsService.get_booking_health_window(db, minutes=minutes)


# ==================== Calls/Conversations Endpoints ====================


@router.get("/calls")
async def get_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    channel: Optional[str] = None,
    status: Optional[str] = None,
    outcome: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get paginated list of calls/conversations.

    Filters:
    - channel: voice, sms, email
    - status: active, completed, abandoned
    - outcome: booked, info_only, escalated, etc.
    - start_date/end_date: Date range filter
    """
    query = db.query(Conversation)

    # Apply filters
    if channel:
        query = query.filter(Conversation.channel == channel)

    if status:
        query = query.filter(Conversation.status == status)

    if outcome:
        query = query.filter(Conversation.outcome == outcome)

    if start_date:
        query = query.filter(
            Conversation.initiated_at >= datetime.fromisoformat(start_date)
        )

    if end_date:
        query = query.filter(
            Conversation.initiated_at <= datetime.fromisoformat(end_date)
        )

    # Count total
    total = query.count()

    # Paginate with eager loading of customer
    conversations = (
        query.options(joinedload(Conversation.customer))
        .order_by(Conversation.initiated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    settings = get_settings()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "timezone": settings.MED_SPA_TIMEZONE,
        "conversations": [
            {
                "id": conv.id,
                "customer_id": conv.customer_id,
                "customer_name": conv.customer.name if conv.customer else None,
                "customer_phone": conv.customer.phone if conv.customer else None,
                "channel": conv.channel,
                "status": conv.status,
                "initiated_at": utc_to_local_iso(conv.initiated_at),
                "completed_at": utc_to_local_iso(conv.completed_at),
                "last_activity_at": utc_to_local_iso(conv.last_activity_at),
                "satisfaction_score": conv.satisfaction_score,
                "sentiment": conv.sentiment,
                "outcome": conv.outcome,
                "ai_summary": conv.ai_summary,
            }
            for conv in conversations
        ],
    }


@router.get("/calls/{call_id}")
async def get_call_detail(
    call_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed information about a specific call/conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == call_id).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    messages = (
        db.query(CommunicationMessage)
        .filter(CommunicationMessage.conversation_id == call_id)
        .order_by(CommunicationMessage.sent_at)
        .all()
    )

    # Get customer
    customer = None
    if conversation.customer_id:
        customer = (
            db.query(Customer).filter(Customer.id == conversation.customer_id).first()
        )

    return {
        "id": conversation.id,
        "customer": (
            {
                "id": customer.id,
                "name": customer.name,
                "phone": customer.phone,
                "email": customer.email,
            }
            if customer
            else None
        ),
        "channel": conversation.channel,
        "status": conversation.status,
        "initiated_at": utc_to_local_iso(conversation.initiated_at),
        "completed_at": utc_to_local_iso(conversation.completed_at),
        "last_activity_at": utc_to_local_iso(conversation.last_activity_at),
        "satisfaction_score": conversation.satisfaction_score,
        "sentiment": conversation.sentiment,
        "outcome": conversation.outcome,
        "ai_summary": conversation.ai_summary,
        "metadata": conversation.custom_metadata,
        "messages": [
            {
                "id": msg.id,
                "direction": msg.direction,
                "content": msg.content,
                "sent_at": utc_to_local_iso(msg.sent_at),
                "metadata": msg.custom_metadata,
            }
            for msg in messages
        ],
    }


# ==================== Communications Endpoints ====================


SESSION_INACTIVITY_MINUTES = 45
RESET_PHRASES = [
    "new question",
    "another question",
    "new topic",
    "another topic",
    "start over",
    "new conversation",
]


def _build_sessions_for_conversation(
    conversation: Conversation,
    *,
    inactivity_minutes: int = SESSION_INACTIVITY_MINUTES,
) -> list:
    """Split a Conversation into logical sessions based on inactivity and reset phrases.

    This is used for the dashboard's "recent sessions" view without changing the
    underlying Conversation write model. A single Conversation may emit multiple
    session rows if there are large gaps between messages or explicit resets.
    """
    # Sort messages chronologically
    messages = sorted(
        conversation.messages,
        key=lambda m: m.sent_at or conversation.last_activity_at or conversation.initiated_at,
    )

    sessions: list = []
    inactivity_delta = timedelta(minutes=inactivity_minutes)

    # No messages – treat the whole conversation as a single session
    if not messages:
        start_dt = conversation.initiated_at
        end_dt = conversation.completed_at or conversation.last_activity_at or conversation.initiated_at
        sessions.append(
            {
                "conversation": conversation,
                "started_at": start_dt,
                "ended_at": end_dt,
                "last_activity_at": end_dt,
                "message_count": 0,
            }
        )
        return sessions

    current_session = {
        "conversation": conversation,
        "started_at": None,
        "ended_at": None,
        "last_activity_at": None,
        "message_count": 0,
    }

    for msg in messages:
        ts = msg.sent_at or conversation.last_activity_at or conversation.initiated_at
        content_lower = (msg.content or "").lower()
        is_reset = msg.direction == "inbound" and any(
            phrase in content_lower for phrase in RESET_PHRASES
        )

        if current_session["started_at"] is None:
            # First message starts the session
            current_session["started_at"] = ts
            current_session["last_activity_at"] = ts
            current_session["message_count"] = 1
            continue

        gap = ts - current_session["last_activity_at"]

        if gap > inactivity_delta or is_reset:
            # Close previous session
            current_session["ended_at"] = current_session["last_activity_at"]
            sessions.append(current_session)

            # Start a new session
            current_session = {
                "conversation": conversation,
                "started_at": ts,
                "ended_at": None,
                "last_activity_at": ts,
                "message_count": 1,
            }
        else:
            # Continue current session
            current_session["last_activity_at"] = ts
            current_session["message_count"] += 1

    # Finalize last session
    if current_session["started_at"] is not None:
        current_session["ended_at"] = current_session["last_activity_at"]
        sessions.append(current_session)

    return sessions


@router.get("/communications")
async def get_communications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    channel: Optional[str] = None,
    customer_id: Optional[int] = None,
    mode: str = Query(
        "conversations",
        description="Return mode: 'conversations' (default) or 'sessions' for derived session rows",
    ),
    db: Session = Depends(get_db),
):
    """Get communications across channels.

    Modes:
    - conversations (default): direct Conversation rows via get_calls
    - sessions: derived "session" rows based on inactivity and reset phrases,
      suitable for the dashboard's Recent Communications table.
    """

    # Default behavior: preserve existing conversations API
    if mode == "conversations":
        return await get_calls(
            page=page,
            page_size=page_size,
            channel=channel,
            db=db,
        )

    # Sessions mode: build logical sessions from conversations + messages
    settings = get_settings()

    base_query = (
        db.query(Conversation)
        .options(joinedload(Conversation.customer), joinedload(Conversation.messages))
    )

    if channel:
        base_query = base_query.filter(Conversation.channel == channel)
    if customer_id:
        base_query = base_query.filter(Conversation.customer_id == customer_id)

    # Fetch a window of recent conversations to derive sessions from.
    # We over-fetch a bit to have enough sessions for the requested page_size.
    conversations = (
        base_query.order_by(Conversation.last_activity_at.desc())
        .limit(page_size * 5)
        .all()
    )

    raw_sessions: list = []
    for conv in conversations:
        # Voice calls are already one coherent session; still run through the
        # helper so resets/inactivity rules apply uniformly.
        raw_sessions.extend(_build_sessions_for_conversation(conv))

    # Sort sessions by most recent activity
    raw_sessions.sort(key=lambda s: s["last_activity_at"], reverse=True)

    # Paginate sessions
    paged_sessions = raw_sessions[(page - 1) * page_size : page * page_size]

    return {
        "total": len(raw_sessions),
        "page": page,
        "page_size": page_size,
        "total_pages": (len(raw_sessions) + page_size - 1) // page_size or 1,
        "timezone": settings.MED_SPA_TIMEZONE,
        # Reuse the conversations field name so existing dashboard mapping works.
        "conversations": [
            {
                "id": session["conversation"].id,
                "customer_id": session["conversation"].customer_id,
                "customer_name": (
                    session["conversation"].customer.name
                    if session["conversation"].customer
                    else None
                ),
                "customer_phone": (
                    session["conversation"].customer.phone
                    if session["conversation"].customer
                    else None
                ),
                "channel": session["conversation"].channel,
                "status": session["conversation"].status,
                # Session start/end instead of original initiated_at/completed_at
                "initiated_at": utc_to_local_iso(session["started_at"]),
                "completed_at": utc_to_local_iso(session["ended_at"]),
                "last_activity_at": utc_to_local_iso(session["last_activity_at"]),
                "satisfaction_score": session["conversation"].satisfaction_score,
                "sentiment": session["conversation"].sentiment,
                "outcome": session["conversation"].outcome,
                "ai_summary": session["conversation"].ai_summary,
                "metadata": session["conversation"].custom_metadata,
            }
            for session in paged_sessions
        ],
    }


@router.get("/legacy/communications/{comm_id}")
async def get_communication_detail(
    comm_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed information about a specific communication."""
    return await get_call_detail(call_id=comm_id, db=db)


# ==================== Appointments Endpoints ====================


@router.get("/appointments")
async def get_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get paginated list of appointments.

    Filters:
    - status: scheduled, completed, cancelled, no_show
    - service_type: botox, fillers, hydrafacial, etc.
    - start_date/end_date: Appointment date range
    """
    query = db.query(Appointment)

    # Apply filters
    if status:
        query = query.filter(Appointment.status == status)

    if service_type:
        query = query.filter(Appointment.service_type == service_type)

    if start_date:
        query = query.filter(
            Appointment.appointment_datetime >= datetime.fromisoformat(start_date)
        )

    if end_date:
        query = query.filter(
            Appointment.appointment_datetime <= datetime.fromisoformat(end_date)
        )

    # Count total
    total = query.count()

    # Paginate
    appointments = (
        query.order_by(Appointment.appointment_datetime.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "appointments": [
            {
                "id": appt.id,
                "customer_id": appt.customer_id,
                "calendar_event_id": appt.calendar_event_id,
                "appointment_datetime": (
                    appt.appointment_datetime.isoformat()
                    if appt.appointment_datetime
                    else None
                ),
                "service_type": appt.service_type,
                "provider": appt.provider,
                "duration_minutes": appt.duration_minutes,
                "status": appt.status,
                "special_requests": appt.special_requests,
                "created_at": appt.created_at.isoformat() if appt.created_at else None,
            }
            for appt in appointments
        ],
    }


@router.get("/appointments/detail/{appointment_id}")
async def get_appointment_detail(
    appointment_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed information about a specific appointment."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Get customer
    customer = db.query(Customer).filter(Customer.id == appointment.customer_id).first()

    return {
        "id": appointment.id,
        "customer": (
            {
                "id": customer.id,
                "name": customer.name,
                "phone": customer.phone,
                "email": customer.email,
            }
            if customer
            else None
        ),
        "calendar_event_id": appointment.calendar_event_id,
        "appointment_datetime": (
            appointment.appointment_datetime.isoformat()
            if appointment.appointment_datetime
            else None
        ),
        "service_type": appointment.service_type,
        "provider": appointment.provider,
        "duration_minutes": appointment.duration_minutes,
        "status": appointment.status,
        "booked_by": appointment.booked_by,
        "special_requests": appointment.special_requests,
        "cancellation_reason": appointment.cancellation_reason,
        "created_at": (
            appointment.created_at.isoformat() if appointment.created_at else None
        ),
        "updated_at": (
            appointment.updated_at.isoformat() if appointment.updated_at else None
        ),
        "cancelled_at": (
            appointment.cancelled_at.isoformat() if appointment.cancelled_at else None
        ),
    }


# ==================== Customers Endpoints ====================


@router.get("/customers")
async def get_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get paginated list of customers.

    Filters:
    - search: Search by name, phone, or email
    """
    query = db.query(Customer)

    # Apply search
    if search:
        query = query.filter(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
            )
        )

    # Count total
    total = query.count()

    # Paginate
    customers = (
        query.order_by(Customer.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "customers": [
            {
                "id": cust.id,
                "name": cust.name,
                "phone": cust.phone,
                "email": cust.email,
                "is_new_client": cust.is_new_client,
                "created_at": cust.created_at.isoformat() if cust.created_at else None,
            }
            for cust in customers
        ],
    }


@router.get("/customers/{customer_id}")
async def get_customer_detail(
    customer_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed customer information including history."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get appointments
    appointments = (
        db.query(Appointment)
        .filter(Appointment.customer_id == customer_id)
        .order_by(Appointment.appointment_datetime.desc())
        .all()
    )

    # Get conversations
    conversations = (
        db.query(Conversation)
        .filter(Conversation.customer_id == customer_id)
        .order_by(Conversation.initiated_at.desc())
        .all()
    )

    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "is_new_client": customer.is_new_client,
        "has_allergies": customer.has_allergies,
        "is_pregnant": customer.is_pregnant,
        "notes": customer.notes,
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "updated_at": customer.updated_at.isoformat() if customer.updated_at else None,
        "appointments": [
            {
                "id": appt.id,
                "appointment_datetime": (
                    appt.appointment_datetime.isoformat()
                    if appt.appointment_datetime
                    else None
                ),
                "service_type": appt.service_type,
                "status": appt.status,
            }
            for appt in appointments
        ],
        "conversations": [
            {
                "id": conv.id,
                "channel": conv.channel,
                "initiated_at": (
                    conv.initiated_at.isoformat() if conv.initiated_at else None
                ),
                "satisfaction_score": conv.satisfaction_score,
                "outcome": conv.outcome,
            }
            for conv in conversations
        ],
    }


def _group_conversations_into_sessions(
    conversations: list,
    max_gap_hours: int = 4,
) -> list:
    """
    Group conversations into logical sessions based on time proximity and intent.
    
    A session is a cluster of conversations that are:
    - Within max_gap_hours of each other, OR
    - Share the same outcome/intent
    
    Returns list of session dicts, each containing grouped conversations.
    """
    from datetime import timedelta
    
    if not conversations:
        return []
    
    sessions = []
    current_session = {
        "conversations": [],
        "channels": set(),
        "started_at": None,
        "ended_at": None,
        "outcome": None,
    }
    
    for conv in conversations:
        conv_time = conv.initiated_at
        
        # Determine if this starts a new session
        start_new_session = False
        
        if not current_session["conversations"]:
            start_new_session = False
        elif current_session["ended_at"]:
            gap = conv_time - current_session["ended_at"]
            if gap > timedelta(hours=max_gap_hours):
                start_new_session = True
        
        # Different core intents suggest new session
        if not start_new_session and current_session["conversations"]:
            last_outcome = current_session.get("outcome", "")
            booking_outcomes = {"appointment_scheduled", "booked"}
            if last_outcome in booking_outcomes and conv.outcome not in booking_outcomes:
                start_new_session = True
        
        if start_new_session and current_session["conversations"]:
            # Finalize current session
            current_session["channels"] = list(current_session["channels"])
            current_session["conversation_count"] = len(current_session["conversations"])
            current_session["is_multimodal"] = len(current_session["channels"]) > 1
            current_session["started_at"] = utc_to_local_iso(current_session["started_at"])
            current_session["ended_at"] = utc_to_local_iso(current_session["ended_at"])
            sessions.append(current_session)
            current_session = {
                "conversations": [],
                "channels": set(),
                "started_at": None,
                "ended_at": None,
                "outcome": None,
            }
        
        # Add to current session
        conv_dict = {
            "id": str(conv.id),
            "channel": conv.channel,
            "status": conv.status,
            "initiated_at": utc_to_local_iso(conv.initiated_at),
            "completed_at": utc_to_local_iso(conv.completed_at),
            "outcome": conv.outcome,
            "sentiment": conv.sentiment,
            "satisfaction_score": conv.satisfaction_score,
            "ai_summary": conv.ai_summary,
            "message_count": len(conv.messages) if conv.messages else 0,
        }
        
        current_session["conversations"].append(conv_dict)
        current_session["channels"].add(conv.channel)
        
        if not current_session["started_at"]:
            current_session["started_at"] = conv.initiated_at
        current_session["ended_at"] = conv.completed_at or conv.last_activity_at
        
        if conv.outcome:
            current_session["outcome"] = conv.outcome
    
    # Add final session
    if current_session["conversations"]:
        current_session["channels"] = list(current_session["channels"])
        current_session["conversation_count"] = len(current_session["conversations"])
        current_session["is_multimodal"] = len(current_session["channels"]) > 1
        current_session["started_at"] = utc_to_local_iso(current_session["started_at"])
        current_session["ended_at"] = utc_to_local_iso(current_session["ended_at"])
        sessions.append(current_session)
    
    return sessions


def _build_timeline_sessions_for_customer(conversations: list[Conversation]) -> list[dict]:
    """Build per-session timeline entries for a customer.

    Uses _build_sessions_for_conversation so that:
    - New conversations (already 1 logical session) produce 1 session each.
    - Legacy multi-session conversations are split by inactivity/reset rules.
    """
    all_sessions: list[dict] = []

    for conv in conversations:
        per_conv_sessions = _build_sessions_for_conversation(conv)
        for sess in per_conv_sessions:
            c = sess["conversation"]
            started_at = sess["started_at"]
            ended_at = sess["ended_at"]

            conv_dict = {
                "id": str(c.id),
                "channel": c.channel,
                "status": c.status,
                "initiated_at": utc_to_local_iso(started_at),
                "completed_at": utc_to_local_iso(ended_at),
                "outcome": c.outcome,
                "sentiment": c.sentiment,
                "satisfaction_score": c.satisfaction_score,
                "ai_summary": c.ai_summary,
                "message_count": sess.get("message_count", 0),
            }

            session_entry = {
                "conversations": [conv_dict],
                "channels": [c.channel],
                "conversation_count": 1,
                "is_multimodal": False,
                "started_at": utc_to_local_iso(started_at),
                "ended_at": utc_to_local_iso(ended_at),
                "outcome": c.outcome,
            }

            # Keep a private datetime key for correct chronological sorting
            session_entry["_started_at_dt"] = started_at
            all_sessions.append(session_entry)

    # Sort chronologically by session start
    all_sessions.sort(key=lambda s: s["_started_at_dt"])

    # Drop private sort key before returning
    for session in all_sessions:
        session.pop("_started_at_dt", None)

    return all_sessions


@router.get("/customers/{customer_id}/timeline")
async def get_customer_timeline(
    customer_id: int,
    include_sessions: bool = Query(False, description="Group conversations into sessions"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Get a unified timeline for a customer.
    
    Returns all customer interactions in chronological order,
    optionally grouped into logical sessions based on time proximity and intent.
    
    Backward-compatible: Returns calls, conversations, and stats for existing frontend.
    Enhanced: When include_sessions=true, adds session grouping for multimodal view.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all conversations with messages
    conversations = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.customer_id == customer_id)
        .order_by(Conversation.initiated_at.desc())
        .limit(limit)
        .all()
    )
    
    # Get appointments
    appointments = (
        db.query(Appointment)
        .filter(Appointment.customer_id == customer_id)
        .order_by(Appointment.appointment_datetime.desc())
        .limit(20)
        .all()
    )
    
    # Separate voice calls from other conversations (for backward compat)
    voice_calls = [c for c in conversations if c.channel == "voice"]
    non_voice = [c for c in conversations if c.channel != "voice"]
    
    # Calculate stats
    completed_appts = sum(1 for a in appointments if a.status == "confirmed")
    cancelled_appts = sum(1 for a in appointments if a.status in ("cancelled", "canceled"))
    satisfaction_scores = [c.satisfaction_score for c in voice_calls if c.satisfaction_score is not None]
    avg_satisfaction = sum(satisfaction_scores) / len(satisfaction_scores) if satisfaction_scores else None
    no_show_rate = (cancelled_appts / len(appointments) * 100) if appointments else 0
    
    # Build response - backward compatible with existing frontend
    response = {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "notes": customer.notes,
            "created_at": utc_to_local_iso(customer.created_at),
            "updated_at": utc_to_local_iso(customer.updated_at),
        },
        "appointments": [
            {
                "id": a.id,
                "service_type": a.service_type,
                "appointment_datetime": utc_to_local_iso(a.appointment_datetime),
                "status": a.status,
                "provider": a.provider,
                "booked_by": "eva" if a.calendar_event_id else "manual",
                "special_requests": a.special_requests,
                "created_at": utc_to_local_iso(a.created_at),
            }
            for a in appointments
        ],
        # Legacy: separate calls array for existing frontend
        "calls": [
            {
                "id": str(c.id),
                "session_id": str(c.id),
                "started_at": utc_to_local_iso(c.initiated_at),
                "duration_seconds": (
                    c.messages[0].voice_details.duration_seconds 
                    if c.messages and c.messages[0].voice_details 
                    else None
                ),
                "satisfaction_score": c.satisfaction_score,
                "sentiment": c.sentiment,
                "outcome": c.outcome,
                "escalated": c.outcome == "escalated",
            }
            for c in voice_calls
        ],
        # All conversations (including voice) for timeline
        "conversations": [
            {
                "id": str(c.id),
                "channel": c.channel,
                "initiated_at": utc_to_local_iso(c.initiated_at),
                "status": c.status,
                "outcome": c.outcome,
                "satisfaction_score": c.satisfaction_score,
            }
            for c in non_voice
        ],
        # Stats for the stats cards
        "stats": {
            "customer_id": customer.id,
            "total_appointments": len(appointments),
            "completed_appointments": completed_appts,
            "cancelled_appointments": cancelled_appts,
            "no_show_rate": no_show_rate,
            "total_calls": len(voice_calls),
            "total_conversations": len(non_voice),
            "avg_satisfaction_score": avg_satisfaction,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
        },
    }
    
    # Enhanced: Add session grouping if requested
    if include_sessions:
        # Build per-session timeline entries using per-conversation sessions.
        # New conversations (already single-session) will produce one entry each,
        # while legacy multi-session conversations are split based on inactivity/reset rules.
        sessions = _build_timeline_sessions_for_customer(conversations)
        response["sessions"] = sessions
        response["session_count"] = len(sessions)
        
        channels_used = set()
        for session in sessions:
            channels_used.update(session["channels"])
        response["channels_used"] = list(channels_used)
        response["is_multimodal_customer"] = len(channels_used) > 1
    
    return response
