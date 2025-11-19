"""FastAPI router for customer management operations."""
from __future__ import annotations

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from database import Customer, Appointment, CallSession, Conversation, get_db

logger = logging.getLogger(__name__)

customers_router = APIRouter(prefix="/api/admin/customers", tags=["customers"])


class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    has_allergies: bool = False
    is_pregnant: bool = False
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    has_allergies: Optional[bool] = None
    is_pregnant: Optional[bool] = None
    is_new_client: Optional[bool] = None
    notes: Optional[str] = None


def _serialize_customer(customer: Customer, include_stats: bool = False) -> dict:
    """Serialize customer to dict with optional stats."""
    data = {
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
    }

    if include_stats:
        data["appointment_count"] = len(customer.appointments) if customer.appointments else 0
        data["call_count"] = len(customer.call_sessions) if customer.call_sessions else 0
        data["conversation_count"] = len(customer.conversations) if customer.conversations else 0

    return data


@customers_router.get("")
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_new_client: Optional[bool] = Query(None),
    has_allergies: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """List customers with pagination and filtering."""
    query = db.query(Customer)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(search_pattern),
                Customer.phone.ilike(search_pattern),
                Customer.email.ilike(search_pattern),
            )
        )

    # Apply filters
    if is_new_client is not None:
        query = query.filter(Customer.is_new_client == is_new_client)

    if has_allergies is not None:
        query = query.filter(Customer.has_allergies == has_allergies)

    # Get total count
    total = query.count()

    # Apply pagination
    customers = (
        query
        .order_by(Customer.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "customers": [_serialize_customer(c, include_stats=True) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@customers_router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get customer details by ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return _serialize_customer(customer, include_stats=True)


@customers_router.post("")
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer."""
    # Check if customer with same phone exists
    existing = db.query(Customer).filter(Customer.phone == data.phone).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Customer with phone {data.phone} already exists"
        )

    # Check if customer with same email exists (if email provided)
    if data.email:
        existing_email = db.query(Customer).filter(Customer.email == data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail=f"Customer with email {data.email} already exists"
            )

    customer = Customer(
        name=data.name,
        phone=data.phone,
        email=data.email,
        has_allergies=data.has_allergies,
        is_pregnant=data.is_pregnant,
        notes=data.notes,
        is_new_client=True,
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    logger.info(f"Created customer {customer.id}: {customer.name}")

    return _serialize_customer(customer)


@customers_router.put("/{customer_id}")
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db)
):
    """Update customer details."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check for phone conflicts
    if data.phone and data.phone != customer.phone:
        existing = db.query(Customer).filter(
            Customer.phone == data.phone,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Customer with phone {data.phone} already exists"
            )

    # Check for email conflicts
    if data.email and data.email != customer.email:
        existing = db.query(Customer).filter(
            Customer.email == data.email,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Customer with email {data.email} already exists"
            )

    # Update fields
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    customer.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(customer)

    logger.info(f"Updated customer {customer.id}: {customer.name}")

    return _serialize_customer(customer)


@customers_router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """Delete a customer."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check for dependencies
    appointment_count = db.query(func.count(Appointment.id)).filter(
        Appointment.customer_id == customer_id
    ).scalar()

    if appointment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete customer with {appointment_count} appointments. " +
                   "Please delete or reassign appointments first."
        )

    db.delete(customer)
    db.commit()

    logger.info(f"Deleted customer {customer.id}: {customer.name}")

    return {"success": True, "message": "Customer deleted successfully"}


@customers_router.get("/{customer_id}/history")
def get_customer_history(customer_id: int, db: Session = Depends(get_db)):
    """Get customer's full history: appointments, calls, and conversations."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get appointments
    appointments = db.query(Appointment).filter(
        Appointment.customer_id == customer_id
    ).order_by(Appointment.appointment_datetime.desc()).all()

    # Get call sessions
    calls = db.query(CallSession).filter(
        CallSession.customer_id == customer_id
    ).order_by(CallSession.started_at.desc()).all()

    # Get conversations (SMS/email)
    conversations = db.query(Conversation).filter(
        Conversation.customer_id == customer_id
    ).order_by(Conversation.initiated_at.desc()).all()

    return {
        "customer": _serialize_customer(customer),
        "appointments": [
            {
                "id": apt.id,
                "appointment_datetime": apt.appointment_datetime.isoformat(),
                "service_type": apt.service_type,
                "provider": apt.provider,
                "status": apt.status,
                "booked_by": apt.booked_by,
                "special_requests": apt.special_requests,
                "created_at": apt.created_at.isoformat() if apt.created_at else None,
            }
            for apt in appointments
        ],
        "calls": [
            {
                "id": call.id,
                "session_id": call.session_id,
                "started_at": call.started_at.isoformat() if call.started_at else None,
                "duration_seconds": call.duration_seconds,
                "satisfaction_score": call.satisfaction_score,
                "sentiment": call.sentiment,
                "outcome": call.outcome,
                "escalated": call.escalated,
            }
            for call in calls
        ],
        "conversations": [
            {
                "id": str(conv.id),
                "channel": conv.channel,
                "initiated_at": conv.initiated_at.isoformat() if conv.initiated_at else None,
                "status": conv.status,
                "outcome": conv.outcome,
                "satisfaction_score": conv.satisfaction_score,
            }
            for conv in conversations
        ],
    }


@customers_router.get("/{customer_id}/stats")
def get_customer_stats(customer_id: int, db: Session = Depends(get_db)):
    """Get customer statistics and metrics."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Calculate stats
    total_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.customer_id == customer_id
    ).scalar()

    completed_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.customer_id == customer_id,
        Appointment.status == "completed"
    ).scalar()

    cancelled_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.customer_id == customer_id,
        Appointment.status == "cancelled"
    ).scalar()

    total_calls = db.query(func.count(CallSession.id)).filter(
        CallSession.customer_id == customer_id
    ).scalar()

    avg_satisfaction = db.query(func.avg(CallSession.satisfaction_score)).filter(
        CallSession.customer_id == customer_id,
        CallSession.satisfaction_score.isnot(None)
    ).scalar()

    total_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.customer_id == customer_id
    ).scalar()

    return {
        "customer_id": customer_id,
        "total_appointments": total_appointments or 0,
        "completed_appointments": completed_appointments or 0,
        "cancelled_appointments": cancelled_appointments or 0,
        "no_show_rate": (
            (cancelled_appointments / total_appointments * 100)
            if total_appointments > 0 else 0
        ),
        "total_calls": total_calls or 0,
        "total_conversations": total_conversations or 0,
        "avg_satisfaction_score": float(avg_satisfaction) if avg_satisfaction else None,
        "is_new_client": customer.is_new_client,
        "has_allergies": customer.has_allergies,
        "is_pregnant": customer.is_pregnant,
    }
