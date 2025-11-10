"""
Database models and session management for the Med Spa Voice AI application.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    Text, ForeignKey, Boolean, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
from config import get_settings

settings = get_settings()

# Create database engine
engine_kwargs = {
    "pool_pre_ping": True,
    "echo": settings.DEBUG,
}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Dependency for FastAPI
def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Models
class Customer(Base):
    """Customer model for storing patient information."""
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True)
    is_new_client = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Medical screening flags (for future HIPAA compliance)
    has_allergies = Column(Boolean, default=False)
    is_pregnant = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    # Relationships
    appointments = relationship("Appointment", back_populates="customer")
    call_sessions = relationship("CallSession", back_populates="customer")


class Appointment(Base):
    """Appointment model for tracking bookings."""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    calendar_event_id = Column(String(255), unique=True, index=True)  # Google Calendar ID

    # Appointment details
    appointment_datetime = Column(DateTime, nullable=False, index=True)
    service_type = Column(String(100), nullable=False)
    provider = Column(String(100), nullable=True)
    duration_minutes = Column(Integer, default=60)

    # Status tracking
    status = Column(
        String(50),
        default="scheduled",  # scheduled, completed, cancelled, no_show, rescheduled
        index=True
    )

    # Booking metadata
    booked_by = Column(String(50), default="ai")  # ai, staff, online
    special_requests = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cancelled_at = Column(DateTime, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="appointments")


class CallSession(Base):
    """Call session model for tracking voice interactions."""
    __tablename__ = "call_sessions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)  # Null if not identified

    # Call metadata
    session_id = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), index=True)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Content
    transcript = Column(Text, nullable=True)
    recording_url = Column(String(500), nullable=True)

    # Analytics
    satisfaction_score = Column(Float, nullable=True)  # 0-10 score
    sentiment = Column(String(50), nullable=True)  # positive, neutral, negative, mixed
    outcome = Column(
        String(50),
        nullable=True  # booked, rescheduled, cancelled, info_only, escalated, abandoned
    )

    # Engagement metrics
    customer_interruptions = Column(Integer, default=0)
    ai_clarifications_needed = Column(Integer, default=0)
    function_calls_made = Column(Integer, default=0)

    # Escalation
    escalated = Column(Boolean, default=False)
    escalation_reason = Column(Text, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="call_sessions")
    events = relationship("CallEvent", back_populates="call_session", cascade="all, delete-orphan")


class CallEvent(Base):
    """Individual events within a call session."""
    __tablename__ = "call_events"

    id = Column(Integer, primary_key=True, index=True)
    call_session_id = Column(Integer, ForeignKey("call_sessions.id"), nullable=False)

    # Event details
    event_type = Column(
        String(100),
        nullable=False,
        index=True
        # Types: intent_detected, function_called, appointment_booked,
        # escalation_triggered, sentiment_change, error_occurred
    )
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    data = Column(JSON, nullable=True)  # Flexible JSON storage for event-specific data

    # Relationships
    call_session = relationship("CallSession", back_populates="events")


class DailyMetric(Base):
    """Aggregated daily metrics for dashboard analytics."""
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, unique=True, index=True, nullable=False)

    # Call metrics
    total_calls = Column(Integer, default=0)
    total_talk_time_seconds = Column(Integer, default=0)
    avg_call_duration_seconds = Column(Integer, default=0)

    # Appointment metrics
    appointments_booked = Column(Integer, default=0)
    appointments_rescheduled = Column(Integer, default=0)
    appointments_cancelled = Column(Integer, default=0)

    # Quality metrics
    avg_satisfaction_score = Column(Float, default=0.0)
    calls_escalated = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)  # Percentage of calls that resulted in booking

    # Updated timestamp
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Database initialization
def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()
