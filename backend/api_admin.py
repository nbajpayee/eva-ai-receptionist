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
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from database import (
    get_db,
    Customer,
    Appointment,
    CallSession,
    Conversation,
    CommunicationMessage,
)
from analytics import AnalyticsService


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

    Returns:
    - Total calls/conversations
    - Bookings made
    - Satisfaction scores
    - Conversion rate
    - Channel breakdown
    """
    # Calculate date range
    now = datetime.utcnow()
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    else:
        start = now - timedelta(days=1)
        end = now

    # Query metrics
    total_conversations = db.query(Conversation).filter(
        Conversation.initiated_at >= start,
        Conversation.initiated_at <= end,
    ).count()

    total_appointments = db.query(Appointment).filter(
        Appointment.created_at >= start,
        Appointment.created_at <= end,
        Appointment.status == "scheduled",
    ).count()

    # Average satisfaction score
    avg_satisfaction = db.query(
        func.avg(Conversation.satisfaction_score)
    ).filter(
        Conversation.initiated_at >= start,
        Conversation.initiated_at <= end,
        Conversation.satisfaction_score.isnot(None),
    ).scalar() or 0.0

    # Channel breakdown
    channel_stats = db.query(
        Conversation.channel,
        func.count(Conversation.id).label("count")
    ).filter(
        Conversation.initiated_at >= start,
        Conversation.initiated_at <= end,
    ).group_by(Conversation.channel).all()

    # Sentiment breakdown
    sentiment_stats = db.query(
        Conversation.sentiment,
        func.count(Conversation.id).label("count")
    ).filter(
        Conversation.initiated_at >= start,
        Conversation.initiated_at <= end,
        Conversation.sentiment.isnot(None),
    ).group_by(Conversation.sentiment).all()

    # Outcome breakdown
    outcome_stats = db.query(
        Conversation.outcome,
        func.count(Conversation.id).label("count")
    ).filter(
        Conversation.initiated_at >= start,
        Conversation.initiated_at <= end,
        Conversation.outcome.isnot(None),
    ).group_by(Conversation.outcome).all()

    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_conversations": total_conversations,
        "total_appointments": total_appointments,
        "conversion_rate": round(total_appointments / total_conversations * 100, 1) if total_conversations > 0 else 0,
        "average_satisfaction": round(avg_satisfaction, 1),
        "channel_breakdown": {
            channel: count for channel, count in channel_stats
        },
        "sentiment_breakdown": {
            sentiment: count for sentiment, count in sentiment_stats if sentiment
        },
        "outcome_breakdown": {
            outcome: count for outcome, count in outcome_stats if outcome
        },
    }


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
        query = query.filter(Conversation.initiated_at >= datetime.fromisoformat(start_date))

    if end_date:
        query = query.filter(Conversation.initiated_at <= datetime.fromisoformat(end_date))

    # Count total
    total = query.count()

    # Paginate
    conversations = query.order_by(
        Conversation.initiated_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "conversations": [
            {
                "id": conv.id,
                "customer_id": conv.customer_id,
                "channel": conv.channel,
                "status": conv.status,
                "initiated_at": conv.initiated_at.isoformat() if conv.initiated_at else None,
                "last_activity_at": conv.last_activity_at.isoformat() if conv.last_activity_at else None,
                "satisfaction_score": conv.satisfaction_score,
                "sentiment": conv.sentiment,
                "outcome": conv.outcome,
                "ai_summary": conv.ai_summary,
            }
            for conv in conversations
        ]
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
    messages = db.query(CommunicationMessage).filter(
        CommunicationMessage.conversation_id == call_id
    ).order_by(CommunicationMessage.sent_at).all()

    # Get customer
    customer = None
    if conversation.customer_id:
        customer = db.query(Customer).filter(Customer.id == conversation.customer_id).first()

    return {
        "id": conversation.id,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
        } if customer else None,
        "channel": conversation.channel,
        "status": conversation.status,
        "initiated_at": conversation.initiated_at.isoformat() if conversation.initiated_at else None,
        "last_activity_at": conversation.last_activity_at.isoformat() if conversation.last_activity_at else None,
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
                "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
                "metadata": msg.custom_metadata,
            }
            for msg in messages
        ]
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


@router.get("/communications/{comm_id}")
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
        query = query.filter(Appointment.appointment_datetime >= datetime.fromisoformat(start_date))

    if end_date:
        query = query.filter(Appointment.appointment_datetime <= datetime.fromisoformat(end_date))

    # Count total
    total = query.count()

    # Paginate
    appointments = query.order_by(
        Appointment.appointment_datetime.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

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
                "appointment_datetime": appt.appointment_datetime.isoformat() if appt.appointment_datetime else None,
                "service_type": appt.service_type,
                "provider": appt.provider,
                "duration_minutes": appt.duration_minutes,
                "status": appt.status,
                "special_requests": appt.special_requests,
                "created_at": appt.created_at.isoformat() if appt.created_at else None,
            }
            for appt in appointments
        ]
    }


@router.get("/appointments/{appointment_id}")
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
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
        } if customer else None,
        "calendar_event_id": appointment.calendar_event_id,
        "appointment_datetime": appointment.appointment_datetime.isoformat() if appointment.appointment_datetime else None,
        "service_type": appointment.service_type,
        "provider": appointment.provider,
        "duration_minutes": appointment.duration_minutes,
        "status": appointment.status,
        "booked_by": appointment.booked_by,
        "special_requests": appointment.special_requests,
        "cancellation_reason": appointment.cancellation_reason,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
        "updated_at": appointment.updated_at.isoformat() if appointment.updated_at else None,
        "cancelled_at": appointment.cancelled_at.isoformat() if appointment.cancelled_at else None,
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
    customers = query.order_by(
        Customer.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()

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
        ]
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
    appointments = db.query(Appointment).filter(
        Appointment.customer_id == customer_id
    ).order_by(Appointment.appointment_datetime.desc()).all()

    # Get conversations
    conversations = db.query(Conversation).filter(
        Conversation.customer_id == customer_id
    ).order_by(Conversation.initiated_at.desc()).all()

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
                "appointment_datetime": appt.appointment_datetime.isoformat() if appt.appointment_datetime else None,
                "service_type": appt.service_type,
                "status": appt.status,
            }
            for appt in appointments
        ],
        "conversations": [
            {
                "id": conv.id,
                "channel": conv.channel,
                "initiated_at": conv.initiated_at.isoformat() if conv.initiated_at else None,
                "satisfaction_score": conv.satisfaction_score,
                "outcome": conv.outcome,
            }
            for conv in conversations
        ],
    }
