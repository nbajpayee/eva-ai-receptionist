"""
Database models and session management for the Med Spa Voice AI application.
"""
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    Text, ForeignKey, Boolean, JSON, CheckConstraint, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
try:  # Prefer package-style import when available
    from backend.config import get_settings
except ModuleNotFoundError:  # Fallback for direct execution contexts
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
    conversations = relationship("Conversation", back_populates="customer")


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


class Provider(Base):
    """Provider/practitioner model for med spa staff."""
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))

    # Specialties as array
    specialties = Column(ARRAY(Text), nullable=True)

    # Profile info
    hire_date = Column(DateTime, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    consultations = relationship("InPersonConsultation", back_populates="provider")
    insights = relationship("AIInsight", back_populates="provider", foreign_keys="AIInsight.provider_id")
    performance_metrics = relationship("ProviderPerformanceMetric", back_populates="provider")


class InPersonConsultation(Base):
    """In-person consultation recordings and transcripts."""
    __tablename__ = "in_person_consultations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)

    # Consultation details
    service_type = Column(String(100), index=True)
    duration_seconds = Column(Integer, nullable=True)

    # Recording and transcript
    recording_url = Column(String(500), nullable=True)
    transcript = Column(Text, nullable=True)

    # Outcome
    outcome = Column(String(50), index=True)  # 'booked', 'declined', 'thinking', 'follow_up_needed'
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)

    # AI analytics
    satisfaction_score = Column(Float, nullable=True)  # 0-10
    sentiment = Column(String(50), nullable=True)  # positive, neutral, negative, mixed
    ai_summary = Column(Text, nullable=True)

    # Manual notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    provider = relationship("Provider", back_populates="consultations")
    customer = relationship("Customer")
    appointment = relationship("Appointment")
    insights = relationship("AIInsight", back_populates="consultation", foreign_keys="AIInsight.consultation_id")

    __table_args__ = (
        CheckConstraint("outcome IS NULL OR outcome IN ('booked', 'declined', 'thinking', 'follow_up_needed')", name='check_consultation_outcome'),
        CheckConstraint("satisfaction_score IS NULL OR (satisfaction_score >= 0 AND satisfaction_score <= 10)", name='check_consultation_satisfaction'),
        CheckConstraint("sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed')", name='check_consultation_sentiment'),
    )


class AIInsight(Base):
    """AI-generated insights from consultation analysis."""
    __tablename__ = "ai_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Type of insight
    insight_type = Column(String(50), nullable=False, index=True)
    # Types: 'best_practice', 'objection_handling', 'coaching_opportunity', 'comparison', 'strength', 'weakness'

    # Associated entities
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True, index=True)
    consultation_id = Column(UUID(as_uuid=True), ForeignKey("in_person_consultations.id"), nullable=True, index=True)
    reference_consultation_id = Column(UUID(as_uuid=True), ForeignKey("in_person_consultations.id"), nullable=True)

    # Insight content
    title = Column(String(500), nullable=False)
    insight_text = Column(Text, nullable=False)
    supporting_quote = Column(Text, nullable=True)  # Exact transcript excerpt
    recommendation = Column(Text, nullable=True)  # Actionable coaching tip

    # Metadata
    confidence_score = Column(Float, nullable=True)  # 0-1
    is_positive = Column(Boolean, default=True)  # true = strength, false = opportunity

    # Status
    is_reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    provider = relationship("Provider", back_populates="insights", foreign_keys=[provider_id])
    consultation = relationship("InPersonConsultation", back_populates="insights", foreign_keys=[consultation_id])

    __table_args__ = (
        CheckConstraint("confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)", name='check_insight_confidence'),
    )


class ProviderPerformanceMetric(Base):
    """Aggregated performance metrics for providers."""
    __tablename__ = "provider_performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False, index=True)

    # Time period
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False, index=True)
    period_type = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly'

    # Consultation metrics
    total_consultations = Column(Integer, default=0)
    successful_bookings = Column(Integer, default=0)
    conversion_rate = Column(Float, nullable=True)  # successful_bookings / total_consultations

    # Financial metrics
    total_revenue = Column(Float, default=0.0)

    # Quality metrics
    avg_consultation_duration_seconds = Column(Integer, nullable=True)
    avg_satisfaction_score = Column(Float, nullable=True)
    avg_nps_score = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    provider = relationship("Provider", back_populates="performance_metrics")

    __table_args__ = (
        CheckConstraint("period_type IN ('daily', 'weekly', 'monthly')", name='check_period_type'),
    )


# ==================== Omnichannel Communications Models (Phase 2) ====================

class Conversation(Base):
    """
    Omnichannel conversation model supporting voice, SMS, and email.
    Top-level container for any communication thread.
    """
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)  # Nullable - some calls may not identify customer

    channel = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)

    # Research/Outbound campaigns support
    conversation_type = Column(String(50), nullable=False, default="inbound_service", index=True)  # inbound_service, research, outbound_sales
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("research_campaigns.id", ondelete="SET NULL"), nullable=True, index=True)

    # Timestamps
    initiated_at = Column(DateTime, nullable=False, index=True)
    last_activity_at = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)

    # AI-generated insights (computed after completion)
    satisfaction_score = Column(Integer, nullable=True)
    sentiment = Column(String(20), nullable=True)
    outcome = Column(String(50), nullable=True)

    # Human-readable summary
    subject = Column(String(255), nullable=True)
    ai_summary = Column(Text, nullable=True)

    # Flexible metadata (use custom_metadata to avoid SQLAlchemy reserved name)
    custom_metadata = Column('metadata', JSONB, nullable=True, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="conversations")
    messages = relationship("CommunicationMessage", back_populates="conversation", cascade="all, delete-orphan")
    events = relationship("CommunicationEvent", back_populates="conversation", cascade="all, delete-orphan")
    campaign = relationship("ResearchCampaign", back_populates="conversations")
    manual_call_log = relationship("ManualCallLog", uselist=False, back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("channel IN ('voice', 'sms', 'email')", name='check_channel'),
        CheckConstraint("status IN ('active', 'completed', 'failed')", name='check_status'),
        CheckConstraint("satisfaction_score IS NULL OR (satisfaction_score >= 1 AND satisfaction_score <= 10)", name='check_satisfaction_score'),
        CheckConstraint("sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed')", name='check_sentiment'),
        CheckConstraint("conversation_type IN ('inbound_service', 'research', 'outbound_sales')", name='check_conversation_type'),
    )


class CommunicationMessage(Base):
    """
    Individual messages within a conversation.
    Voice calls have 1 message (entire call), SMS/email have N messages (threading).
    """
    __tablename__ = "communication_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    direction = Column(String(20), nullable=False, index=True)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime, nullable=False, index=True)

    # Processing status
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)

    custom_metadata = Column('metadata', JSONB, nullable=True, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    voice_details = relationship("VoiceCallDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")
    email_details = relationship("EmailDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")
    sms_details = relationship("SMSDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("direction IN ('inbound', 'outbound')", name='check_direction'),
    )


class VoiceCallDetails(Base):
    """Voice-specific metadata for call messages."""
    __tablename__ = "voice_call_details"

    message_id = Column(UUID(as_uuid=True), ForeignKey("communication_messages.id", ondelete="CASCADE"), primary_key=True)

    recording_url = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, nullable=False)

    # Structured transcript with timestamps
    transcript_segments = Column(JSONB, nullable=True)
    # Example: [{"speaker": "customer", "text": "Hello", "timestamp": 1.2}, ...]

    # Function calls made during call
    function_calls = Column(JSONB, nullable=True)
    # Example: [{"name": "book_appointment", "args": {...}, "result": {...}}]

    # Audio quality metrics
    audio_quality_score = Column(Float, nullable=True)
    interruption_count = Column(Integer, default=0)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="voice_details")


class EmailDetails(Base):
    """Email-specific metadata for email messages."""
    __tablename__ = "email_details"

    message_id = Column(UUID(as_uuid=True), ForeignKey("communication_messages.id", ondelete="CASCADE"), primary_key=True)

    subject = Column(String(500), nullable=False)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=False)

    from_address = Column(String(255), nullable=False)
    to_address = Column(String(255), nullable=False)
    cc_addresses = Column(ARRAY(Text), nullable=True)
    bcc_addresses = Column(ARRAY(Text), nullable=True)

    # Email threading
    in_reply_to = Column(String(500), nullable=True)
    references = Column(ARRAY(Text), nullable=True)

    # Attachments
    attachments = Column(JSONB, nullable=True)
    # Example: [{"filename": "invoice.pdf", "size": 12345, "url": "..."}]

    # Provider metadata (SendGrid, Mailgun, etc.)
    provider_message_id = Column(String(255), nullable=True)
    delivery_status = Column(String(50), nullable=True)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="email_details")


class SMSDetails(Base):
    """SMS-specific metadata for text messages."""
    __tablename__ = "sms_details"

    message_id = Column(UUID(as_uuid=True), ForeignKey("communication_messages.id", ondelete="CASCADE"), primary_key=True)

    from_number = Column(String(20), nullable=False)
    to_number = Column(String(20), nullable=False)

    # Twilio metadata
    provider_message_id = Column(String(255), nullable=False, index=True)
    delivery_status = Column(String(20), nullable=True, index=True)
    error_code = Column(String(10), nullable=True)
    error_message = Column(Text, nullable=True)

    # SMS properties
    segments = Column(Integer, default=1)
    media_urls = Column(ARRAY(Text), nullable=True)

    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="sms_details")

    __table_args__ = (
        CheckConstraint("delivery_status IS NULL OR delivery_status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered')", name='check_delivery_status'),
    )


class CommunicationEvent(Base):
    """
    Generalized event tracking for all communication channels.
    Replaces CallEvent with support for voice, SMS, and email.
    """
    __tablename__ = "communication_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("communication_messages.id", ondelete="CASCADE"), nullable=True, index=True)

    event_type = Column(String(50), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)

    details = Column(JSONB, nullable=True, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    conversation = relationship("Conversation", back_populates="events")

    # Note: We don't use a check constraint on event_type to allow flexibility for legacy and future event types
    # Common types: intent_detected, function_called, escalation_requested, error, customer_sentiment_shift,
    # appointment_action, appointment_booked, appointment_rescheduled, appointment_cancelled


# ==================== Research & Outbound Campaign Models ====================

class ResearchCampaign(Base):
    """
    Research and outbound sales campaign model.
    Defines customer segments and agent configurations for outbound communications.
    """
    __tablename__ = "research_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    campaign_type = Column(String(50), nullable=False, index=True)  # research, outbound_sales

    # Segment criteria (stores filter conditions as JSON)
    segment_criteria = Column(JSONB, nullable=False, default={})

    # Agent configuration (prompt, questions, voice settings)
    agent_config = Column(JSONB, nullable=False, default={})

    # Channel selection
    channel = Column(String(20), nullable=False)  # sms, email, voice, multi

    # Campaign status
    status = Column(String(50), nullable=False, default="draft", index=True)  # draft, active, paused, completed

    # Execution tracking
    total_targeted = Column(Integer, default=0)
    total_contacted = Column(Integer, default=0)
    total_responded = Column(Integer, default=0)

    # Timestamps
    launched_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Future: admin user who created this
    created_by = Column(String(255), nullable=True)

    # Relationships
    conversations = relationship("Conversation", back_populates="campaign")

    __table_args__ = (
        CheckConstraint("campaign_type IN ('research', 'outbound_sales')", name='check_campaign_type'),
        CheckConstraint("channel IN ('sms', 'email', 'voice', 'multi')", name='check_campaign_channel'),
        CheckConstraint("status IN ('draft', 'active', 'paused', 'completed')", name='check_campaign_status'),
    )


class CustomerSegment(Base):
    """
    Reusable customer segment definitions.
    Allows saving and reusing segment criteria across multiple campaigns.
    """
    __tablename__ = "customer_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Segment criteria (same structure as campaign segment_criteria)
    criteria = Column(JSONB, nullable=False, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ManualCallLog(Base):
    """
    Manual call logs for staff-initiated calls.
    Links to conversation for transcription and AI analysis.
    """
    __tablename__ = "manual_call_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Staff info
    staff_name = Column(String(255), nullable=True)

    # Pre-transcription notes
    call_notes = Column(Text, nullable=True)

    # Transcription status
    transcription_status = Column(String(50), nullable=False, default="pending", index=True)  # pending, completed, failed

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    conversation = relationship("Conversation", back_populates="manual_call_log")

    __table_args__ = (
        CheckConstraint("transcription_status IN ('pending', 'completed', 'failed')", name='check_transcription_status'),
    )


# Database initialization
def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()
