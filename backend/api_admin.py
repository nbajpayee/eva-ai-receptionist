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


@router.get("/communications")
async def get_communications(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    channel: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Get all communications across channels.
    Similar to /calls but includes all channels.
    """
    return await get_calls(
        page=page,
        page_size=page_size,
        channel=channel,
        db=db,
    )


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
