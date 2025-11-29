# Omnichannel Communications Migration Plan

**Status**: In Progress
**Started**: November 10, 2025
**Goal**: Expand backend to support voice, SMS, and email communications with multi-message threading, unified customer timelines, and cross-channel satisfaction scoring.

## Table of Contents
1. [Overview](#overview)
2. [Schema Design](#schema-design)
3. [Migration Strategy](#migration-strategy)
4. [Code Changes](#code-changes)
5. [Implementation Phases](#implementation-phases)
6. [Testing Strategy](#testing-strategy)

---

## Overview

### Current State
- Backend only persists voice interactions via `call_sessions` table
- Voice-specific fields: transcript, recording URL, satisfaction score
- Analytics assume `channel: "voice"`
- No support for SMS/email threading or multi-message conversations

### Target State
- Unified communications model supporting voice, SMS, email (and future channels)
- Multi-message threading for SMS/email conversations
- Cross-channel customer timeline view in dashboard
- AI satisfaction scoring for all channels
- Generalized event tracking across channels

### Architecture Decision
**Hybrid approach**: `conversations` parent table + channel-specific detail tables
- **conversations**: Shared metadata (customer, channel, status, satisfaction, outcome)
- **communication_messages**: Individual messages within conversations (1 for voice, N for SMS/email)
- **voice_call_details**, **email_details**, **sms_details**: Channel-specific payloads
- **communication_events**: Generalized event tracking (intents, function calls, escalations)

**Why this approach?**
- ✅ Single query for omnichannel timeline
- ✅ Type-safe channel data with proper columns
- ✅ Supports multi-message threading
- ✅ Easy to add new channels
- ✅ Normalized and extensible

---

## Schema Design

### 1. conversations (Parent Table)

Top-level container for any communication thread (voice call, SMS thread, email thread).

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('voice', 'sms', 'email')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed', 'failed')),

    -- Timestamps
    initiated_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,

    -- AI-generated insights (computed after completion)
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 10),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    outcome VARCHAR(50) CHECK (outcome IN (
        'appointment_scheduled', 'appointment_rescheduled',
        'appointment_cancelled', 'info_request', 'complaint', 'unresolved'
    )),

    -- Human-readable summary
    subject VARCHAR(255),  -- "Botox consultation booking" or "Rescheduling request"
    ai_summary TEXT,       -- GPT-4 generated conversation summary

    -- Flexible metadata
    metadata JSONB DEFAULT '{}',  -- Channel-specific config, custom flags, etc.

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_customer ON conversations(customer_id, initiated_at DESC);
CREATE INDEX idx_conversations_channel_status ON conversations(channel, status);
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at DESC);
```

**Key Fields:**
- `channel`: Which communication method (voice/sms/email)
- `status`: active (ongoing), completed (finished), failed (error)
- `satisfaction_score`: 1-10 AI score (same as current voice calls)
- `outcome`: What happened in the conversation (booking, complaint, etc.)
- `metadata`: JSON for channel-specific config or future extensibility

---

### 2. communication_messages (Child Table)

Individual messages within a conversation. Voice calls have 1 message (the entire call), SMS/email threads have N messages.

```sql
CREATE TABLE communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,  -- Message body, transcript, email body text
    sent_at TIMESTAMP NOT NULL,

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,

    metadata JSONB DEFAULT '{}',  -- Delivery status, read receipts, etc.

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON communication_messages(conversation_id, sent_at ASC);
CREATE INDEX idx_messages_direction ON communication_messages(direction, sent_at DESC);
```

**Key Fields:**
- `direction`: inbound (customer → Ava), outbound (Ava → customer)
- `content`: Plain text content (transcript for voice, message body for SMS/email)
- `processed`: Has AI processed this message?

---

### 3. voice_call_details (Channel Detail Table)

Rich metadata for voice calls. 1:1 relationship with communication_messages.

```sql
CREATE TABLE voice_call_details (
    message_id UUID PRIMARY KEY REFERENCES communication_messages(id) ON DELETE CASCADE,

    recording_url VARCHAR(500),
    duration_seconds INTEGER NOT NULL,

    -- Structured transcript with timestamps
    transcript_segments JSONB,
    -- Example: [{"speaker": "customer", "text": "Hello", "timestamp": 1.2}, ...]

    -- Function calls made during call
    function_calls JSONB,
    -- Example: [{"name": "book_appointment", "args": {...}, "result": {...}}]

    -- Audio quality metrics
    audio_quality_score FLOAT,
    interruption_count INTEGER DEFAULT 0
);
```

**Key Fields:**
- `transcript_segments`: Structured transcript with timestamps and speaker labels
- `function_calls`: Array of tool calls (book_appointment, check_availability, etc.)
- `interruption_count`: Number of times customer interrupted Ava

---

### 4. email_details (Channel Detail Table)

Email-specific metadata. 1:1 relationship with communication_messages.

```sql
CREATE TABLE email_details (
    message_id UUID PRIMARY KEY REFERENCES communication_messages(id) ON DELETE CASCADE,

    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    body_text TEXT NOT NULL,  -- Plain text version

    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    cc_addresses TEXT[],
    bcc_addresses TEXT[],

    -- Email threading
    in_reply_to VARCHAR(500),  -- Email Message-ID header
    references TEXT[],         -- Email References header

    -- Attachments
    attachments JSONB,
    -- Example: [{"filename": "invoice.pdf", "size": 12345, "url": "..."}]

    -- Provider metadata (SendGrid, Mailgun, etc.)
    provider_message_id VARCHAR(255),
    delivery_status VARCHAR(50),
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP
);
```

**Key Fields:**
- `in_reply_to`, `references`: Email threading headers
- `provider_message_id`: SendGrid/Mailgun message ID for tracking
- `opened_at`, `clicked_at`: Email engagement tracking

---

### 5. sms_details (Channel Detail Table)

SMS-specific metadata. 1:1 relationship with communication_messages.

```sql
CREATE TABLE sms_details (
    message_id UUID PRIMARY KEY REFERENCES communication_messages(id) ON DELETE CASCADE,

    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,

    -- Twilio metadata
    provider_message_id VARCHAR(255) NOT NULL,  -- Twilio SID
    delivery_status VARCHAR(20) CHECK (delivery_status IN (
        'queued', 'sent', 'delivered', 'failed', 'undelivered'
    )),
    error_code VARCHAR(10),
    error_message TEXT,

    -- SMS properties
    segments INTEGER DEFAULT 1,  -- Number of SMS segments
    media_urls TEXT[],           -- MMS attachments

    delivered_at TIMESTAMP,
    failed_at TIMESTAMP
);

CREATE INDEX idx_sms_provider_id ON sms_details(provider_message_id);
CREATE INDEX idx_sms_delivery_status ON sms_details(delivery_status);
```

**Key Fields:**
- `provider_message_id`: Twilio message SID for webhook matching
- `delivery_status`: Twilio delivery status (updated via webhooks)
- `segments`: SMS segment count (for billing/analytics)

---

### 6. communication_events (Generalized Event Tracking)

Replaces `call_events` with support for all channels.

```sql
CREATE TABLE communication_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES communication_messages(id) ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'intent_detected', 'function_called', 'escalation_requested',
        'error', 'customer_sentiment_shift', 'appointment_action'
    )),

    timestamp TIMESTAMP NOT NULL,

    details JSONB DEFAULT '{}',
    -- Example for intent_detected: {"intent": "book_appointment", "confidence": 0.95}
    -- Example for function_called: {"function": "book_appointment", "success": true}

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_conversation ON communication_events(conversation_id, timestamp ASC);
CREATE INDEX idx_events_type ON communication_events(event_type, timestamp DESC);
```

**Key Fields:**
- `message_id`: Optional link to specific message (null for conversation-level events)
- `event_type`: Intent detection, function calls, escalations, errors, etc.
- `details`: JSON for event-specific data

---

## Data Model Examples

### Example 1: Voice Call (Single Message)

```
conversation #c1a2b3c4:
  channel = 'voice'
  status = 'completed'
  customer_id = #cust123
  initiated_at = 2025-11-10 14:30:00
  completed_at = 2025-11-10 14:33:00
  satisfaction_score = 8
  sentiment = 'positive'
  outcome = 'appointment_scheduled'
  subject = "Botox consultation booking"

  └── message #m1:
      conversation_id = #c1a2b3c4
      direction = 'inbound'
      content = "Customer: Hello, I'd like to book a Botox appointment...\nAva: I'd be happy to help..."
      sent_at = 2025-11-10 14:30:00

      └── voice_call_details:
          message_id = #m1
          duration_seconds = 180
          recording_url = "https://storage.example.com/recordings/..."
          transcript_segments = [
            {"speaker": "customer", "text": "Hello", "timestamp": 0.5},
            {"speaker": "assistant", "text": "Hi! I'm Ava...", "timestamp": 2.1},
            ...
          ]
          function_calls = [
            {"name": "book_appointment", "args": {...}, "result": "success"}
          ]

  └── events:
      - event #e1: {type: 'intent_detected', details: {intent: 'book_appointment', confidence: 0.95}}
      - event #e2: {type: 'function_called', details: {function: 'book_appointment', success: true}}
```

---

### Example 2: SMS Thread (Multi-Message)

```
conversation #c2d3e4f5:
  channel = 'sms'
  status = 'completed'
  customer_id = #cust456
  initiated_at = 2025-11-10 09:00:00
  last_activity_at = 2025-11-10 09:05:00
  completed_at = 2025-11-10 09:05:00
  satisfaction_score = 9
  outcome = 'appointment_rescheduled'
  subject = "Appointment rescheduling request"

  └── message #m2:
      direction = 'outbound'
      content = "Hi Sarah! This is Ava from LuxeMedSpa. Your Botox appointment is tomorrow at 2pm. Reply YES to confirm."
      sent_at = 2025-11-10 09:00:00
      └── sms_details: {from_number: "+15551234567", to_number: "+15559876543", delivery_status: 'delivered'}

  └── message #m3:
      direction = 'inbound'
      content = "Can I reschedule to Thursday?"
      sent_at = 2025-11-10 09:02:00
      └── sms_details: {from_number: "+15559876543", to_number: "+15551234567", segments: 1}

  └── message #m4:
      direction = 'outbound'
      content = "Of course! I have openings Thursday at 2pm and 4pm. Which works better?"
      sent_at = 2025-11-10 09:03:00
      └── sms_details: {delivery_status: 'delivered'}

  └── message #m5:
      direction = 'inbound'
      content = "2pm please!"
      sent_at = 2025-11-10 09:04:00

  └── message #m6:
      direction = 'outbound'
      content = "Perfect! I've rescheduled your Botox appointment to Thursday, Nov 14 at 2pm. See you then!"
      sent_at = 2025-11-10 09:05:00

  └── events:
      - event #e3: {type: 'intent_detected', message_id: #m3, details: {intent: 'reschedule_appointment'}}
      - event #e4: {type: 'function_called', message_id: #m6, details: {function: 'reschedule_appointment', success: true}}
```

---

### Example 3: Email Thread

```
conversation #c3e4f5g6:
  channel = 'email'
  status = 'completed'
  customer_id = #cust789
  initiated_at = 2025-11-09 15:20:00
  completed_at = 2025-11-09 16:45:00
  satisfaction_score = 7
  sentiment = 'neutral'
  outcome = 'info_request'
  subject = "Microneedling aftercare questions"

  └── message #m7:
      direction = 'inbound'
      content = "Hi, I had a microneedling treatment yesterday and have questions about redness..."
      sent_at = 2025-11-09 15:20:00
      └── email_details: {
          subject: "Question about aftercare",
          from_address: "customer@example.com",
          to_address: "info@luxemedspa.com",
          body_html: "<p>Hi, I had a microneedling...</p>"
         }

  └── message #m8:
      direction = 'outbound'
      content = "Thank you for reaching out! Redness for 24-48 hours is completely normal..."
      sent_at = 2025-11-09 16:45:00
      └── email_details: {
          subject: "Re: Question about aftercare",
          in_reply_to: "<msgid-m7@example.com>",
          opened_at: 2025-11-09 17:30:00
         }
```

---

## Migration Strategy

### Phase 1: Schema Creation (No Data Loss)

**Goal**: Create new tables alongside existing `call_sessions` with no disruption.

**Script**: `backend/scripts/create_omnichannel_schema.py`

```python
def create_omnichannel_schema():
    """Create new conversations tables in Supabase"""
    # 1. Create conversations table
    # 2. Create communication_messages table
    # 3. Create voice_call_details table
    # 4. Create email_details table
    # 5. Create sms_details table
    # 6. Create communication_events table
    # 7. Add all indexes
    # 8. Keep call_sessions table intact
```

**Validation**:
- Run against Supabase staging environment first
- Verify all tables created successfully
- Check indexes are in place
- Ensure no foreign key errors

---

### Phase 2: Backfill Migration

**Goal**: Migrate existing `call_sessions` data to new schema.

**Script**: `backend/scripts/migrate_call_sessions_to_conversations.py`

```python
def migrate_call_sessions():
    """
    For each call_session:
      1. Create conversation (channel='voice', map status/timestamps)
      2. Create communication_message (content=full transcript)
      3. Create voice_call_details (recording_url, function_calls, etc.)
      4. Migrate call_events → communication_events
      5. Store legacy call_session.id in conversation.metadata for reference
    """

    for session in db.query(CallSession).all():
        # Create conversation
        conversation = Conversation(
            id=uuid.uuid4(),
            customer_id=session.customer_id,
            channel='voice',
            status=map_status(session.status),
            initiated_at=session.started_at,
            last_activity_at=session.ended_at or session.started_at,
            completed_at=session.ended_at,
            satisfaction_score=session.satisfaction_score,
            sentiment=session.sentiment,
            outcome=infer_outcome(session),
            subject=generate_subject(session),
            metadata={'legacy_call_session_id': str(session.id)}
        )
        db.add(conversation)

        # Create message (entire call is one message)
        message = CommunicationMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            direction='inbound',  # Customer called in
            content=format_transcript(session.transcript),
            sent_at=session.started_at,
            processed=True
        )
        db.add(message)

        # Create voice details
        voice_details = VoiceCallDetails(
            message_id=message.id,
            duration_seconds=session.duration_seconds,
            recording_url=session.recording_url,
            transcript_segments=parse_transcript_to_segments(session.transcript),
            function_calls=session.function_calls or [],
            interruption_count=0  # Not tracked in legacy
        )
        db.add(voice_details)

        # Migrate events
        for event in session.events:
            comm_event = CommunicationEvent(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                message_id=message.id,
                event_type=event.event_type,
                timestamp=event.timestamp,
                details=event.details or {}
            )
            db.add(comm_event)

        db.commit()

def infer_outcome(session):
    """Infer outcome from function calls and transcript"""
    if session.function_calls:
        for call in session.function_calls:
            if 'book_appointment' in call.get('name', ''):
                return 'appointment_scheduled'
            elif 'reschedule' in call.get('name', ''):
                return 'appointment_rescheduled'
            elif 'cancel' in call.get('name', ''):
                return 'appointment_cancelled'
    return 'info_request'

def generate_subject(session):
    """Generate human-readable subject from transcript"""
    # Use first 50 chars of transcript or extract intent
    if session.transcript:
        return session.transcript[:50] + "..."
    return "Voice call"
```

**Validation**:
- Count records: ensure conversations count matches call_sessions count
- Spot-check 10 random conversations for data integrity
- Verify all relationships (conversation → message → voice_details)
- Check events migrated correctly

---

### Phase 3: Dual-Write Period

**Goal**: Write to both schemas during transition (backwards compatibility).

**Update**: `backend/analytics.py`

```python
class AnalyticsService:
    def create_voice_session(self, customer_id: UUID, session_id: str):
        """
        Create both:
        1. CallSession (legacy - for backwards compatibility)
        2. Conversation + Message (new schema)
        """
        # Legacy write
        call_session = CallSession(
            id=session_id,
            customer_id=customer_id,
            started_at=datetime.utcnow(),
            status='in_progress'
        )
        self.db.add(call_session)

        # New schema write
        conversation = Conversation(
            customer_id=customer_id,
            channel='voice',
            status='active',
            initiated_at=datetime.utcnow(),
            last_activity_at=datetime.utcnow(),
            metadata={'legacy_session_id': session_id}
        )
        self.db.add(conversation)

        self.db.commit()
        return conversation

    def end_voice_session(self, conversation_id: UUID, transcript, function_calls, recording_url):
        """
        Update both schemas
        Run satisfaction scoring on conversation
        """
        # Update legacy
        # Update new schema
        # Score satisfaction
```

**Duration**: 1-2 weeks to ensure stability

---

### Phase 4: Cutover

**Goal**: Switch all reads to new schema, deprecate `call_sessions`.

**Changes**:
- Update all API routes to query `conversations` instead of `call_sessions`
- Dashboard switches to new schema
- Analytics queries use new tables
- Stop dual-writes (only write to conversations)

**Keep `call_sessions`**: Keep table for archival/rollback safety (can drop after 30 days)

---

### Phase 5: Cleanup (Optional)

**Goal**: Remove legacy tables after validation period.

**Timeline**: 30 days after cutover

```sql
-- After validating new schema works in production
DROP TABLE call_events;
DROP TABLE call_sessions;
```

---

## Code Changes

### 1. New Models (`backend/database.py`)

Add new SQLAlchemy models:

```python
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, TIMESTAMP, ForeignKey, Enum, CheckConstraint, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

# Enums
class ChannelType(str, Enum):
    VOICE = 'voice'
    SMS = 'sms'
    EMAIL = 'email'

class ConversationStatus(str, Enum):
    ACTIVE = 'active'
    COMPLETED = 'completed'
    FAILED = 'failed'

class MessageDirection(str, Enum):
    INBOUND = 'inbound'
    OUTBOUND = 'outbound'

class Sentiment(str, Enum):
    POSITIVE = 'positive'
    NEUTRAL = 'neutral'
    NEGATIVE = 'negative'
    MIXED = 'mixed'

class Outcome(str, Enum):
    APPOINTMENT_SCHEDULED = 'appointment_scheduled'
    APPOINTMENT_RESCHEDULED = 'appointment_rescheduled'
    APPOINTMENT_CANCELLED = 'appointment_cancelled'
    INFO_REQUEST = 'info_request'
    COMPLAINT = 'complaint'
    UNRESOLVED = 'unresolved'


class Conversation(Base):
    __tablename__ = 'conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey('customers.id'), nullable=False)
    channel = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)

    initiated_at = Column(TIMESTAMP, nullable=False)
    last_activity_at = Column(TIMESTAMP, nullable=False)
    completed_at = Column(TIMESTAMP)

    satisfaction_score = Column(Integer)
    sentiment = Column(String(20))
    outcome = Column(String(50))

    subject = Column(String(255))
    ai_summary = Column(Text)

    metadata = Column(JSONB, default={})

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="conversations")
    messages = relationship("CommunicationMessage", back_populates="conversation", cascade="all, delete-orphan")
    events = relationship("CommunicationEvent", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("channel IN ('voice', 'sms', 'email')"),
        CheckConstraint("status IN ('active', 'completed', 'failed')"),
        CheckConstraint("satisfaction_score BETWEEN 1 AND 10"),
    )


class CommunicationMessage(Base):
    __tablename__ = 'communication_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)

    direction = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    sent_at = Column(TIMESTAMP, nullable=False)

    processed = Column(Boolean, default=False)
    processing_error = Column(Text)

    metadata = Column(JSONB, default={})
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    voice_details = relationship("VoiceCallDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")
    email_details = relationship("EmailDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")
    sms_details = relationship("SMSDetails", uselist=False, back_populates="message", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("direction IN ('inbound', 'outbound')"),
    )


class VoiceCallDetails(Base):
    __tablename__ = 'voice_call_details'

    message_id = Column(UUID(as_uuid=True), ForeignKey('communication_messages.id', ondelete='CASCADE'), primary_key=True)

    recording_url = Column(String(500))
    duration_seconds = Column(Integer, nullable=False)

    transcript_segments = Column(JSONB)
    function_calls = Column(JSONB)

    audio_quality_score = Column(Float)
    interruption_count = Column(Integer, default=0)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="voice_details")


class EmailDetails(Base):
    __tablename__ = 'email_details'

    message_id = Column(UUID(as_uuid=True), ForeignKey('communication_messages.id', ondelete='CASCADE'), primary_key=True)

    subject = Column(String(500), nullable=False)
    body_html = Column(Text)
    body_text = Column(Text, nullable=False)

    from_address = Column(String(255), nullable=False)
    to_address = Column(String(255), nullable=False)
    cc_addresses = Column(ARRAY(Text))
    bcc_addresses = Column(ARRAY(Text))

    in_reply_to = Column(String(500))
    references = Column(ARRAY(Text))

    attachments = Column(JSONB)

    provider_message_id = Column(String(255))
    delivery_status = Column(String(50))
    opened_at = Column(TIMESTAMP)
    clicked_at = Column(TIMESTAMP)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="email_details")


class SMSDetails(Base):
    __tablename__ = 'sms_details'

    message_id = Column(UUID(as_uuid=True), ForeignKey('communication_messages.id', ondelete='CASCADE'), primary_key=True)

    from_number = Column(String(20), nullable=False)
    to_number = Column(String(20), nullable=False)

    provider_message_id = Column(String(255), nullable=False)
    delivery_status = Column(String(20))
    error_code = Column(String(10))
    error_message = Column(Text)

    segments = Column(Integer, default=1)
    media_urls = Column(ARRAY(Text))

    delivered_at = Column(TIMESTAMP)
    failed_at = Column(TIMESTAMP)

    # Relationship
    message = relationship("CommunicationMessage", back_populates="sms_details")


class CommunicationEvent(Base):
    __tablename__ = 'communication_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey('communication_messages.id', ondelete='CASCADE'))

    event_type = Column(String(50), nullable=False)
    timestamp = Column(TIMESTAMP, nullable=False)

    details = Column(JSONB, default={})
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    # Relationship
    conversation = relationship("Conversation", back_populates="events")


# Update Customer model to include conversations relationship
# Add to existing Customer class:
# conversations = relationship("Conversation", back_populates="customer")
```

---

### 2. Updated Analytics Service (`backend/analytics.py`)

```python
from typing import Optional, List, Dict, Any
from uuid import UUID
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    # ==================== Conversation Management ====================

    def create_conversation(
        self,
        customer_id: UUID,
        channel: str,
        metadata: Optional[Dict] = None
    ) -> Conversation:
        """Start a new communication thread"""
        conversation = Conversation(
            id=uuid.uuid4(),
            customer_id=customer_id,
            channel=channel,
            status='active',
            initiated_at=datetime.utcnow(),
            last_activity_at=datetime.utcnow(),
            metadata=metadata or {}
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def add_message(
        self,
        conversation_id: UUID,
        direction: str,
        content: str,
        sent_at: Optional[datetime] = None,
        **channel_details
    ) -> CommunicationMessage:
        """Add a message to existing conversation"""
        message = CommunicationMessage(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            direction=direction,
            content=content,
            sent_at=sent_at or datetime.utcnow()
        )
        self.db.add(message)

        # Update conversation last_activity_at
        conversation = self.db.query(Conversation).filter_by(id=conversation_id).first()
        conversation.last_activity_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(message)
        return message

    def add_voice_details(
        self,
        message_id: UUID,
        duration_seconds: int,
        recording_url: Optional[str] = None,
        transcript_segments: Optional[List] = None,
        function_calls: Optional[List] = None
    ) -> VoiceCallDetails:
        """Add voice call details to a message"""
        voice_details = VoiceCallDetails(
            message_id=message_id,
            duration_seconds=duration_seconds,
            recording_url=recording_url,
            transcript_segments=transcript_segments or [],
            function_calls=function_calls or [],
            interruption_count=0
        )
        self.db.add(voice_details)
        self.db.commit()
        return voice_details

    def add_sms_details(
        self,
        message_id: UUID,
        from_number: str,
        to_number: str,
        provider_message_id: str,
        **kwargs
    ) -> SMSDetails:
        """Add SMS details to a message"""
        sms_details = SMSDetails(
            message_id=message_id,
            from_number=from_number,
            to_number=to_number,
            provider_message_id=provider_message_id,
            **kwargs
        )
        self.db.add(sms_details)
        self.db.commit()
        return sms_details

    def add_email_details(
        self,
        message_id: UUID,
        subject: str,
        from_address: str,
        to_address: str,
        body_text: str,
        **kwargs
    ) -> EmailDetails:
        """Add email details to a message"""
        email_details = EmailDetails(
            message_id=message_id,
            subject=subject,
            from_address=from_address,
            to_address=to_address,
            body_text=body_text,
            **kwargs
        )
        self.db.add(email_details)
        self.db.commit()
        return email_details

    def complete_conversation(
        self,
        conversation_id: UUID,
        outcome: Optional[str] = None
    ):
        """Mark conversation as completed"""
        conversation = self.db.query(Conversation).filter_by(id=conversation_id).first()
        conversation.status = 'completed'
        conversation.completed_at = datetime.utcnow()
        if outcome:
            conversation.outcome = outcome
        self.db.commit()

    # ==================== AI Satisfaction Scoring ====================

    def score_conversation_satisfaction(self, conversation_id: UUID):
        """
        Use GPT-4 to analyze conversation and generate:
        - Satisfaction score (1-10)
        - Sentiment (positive/neutral/negative/mixed)
        - Outcome (appointment_scheduled, complaint, etc.)
        - AI summary

        Works for single-message (voice) or multi-message (SMS/email) conversations
        """
        conversation = self.db.query(Conversation).filter_by(id=conversation_id).first()
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        # Get all messages in conversation
        messages = self.db.query(CommunicationMessage)\
            .filter_by(conversation_id=conversation_id)\
            .order_by(CommunicationMessage.sent_at)\
            .all()

        if not messages:
            return

        # Build context for GPT-4
        context = self._format_conversation_for_scoring(conversation, messages)

        # Call GPT-4
        score, sentiment, outcome, summary = self._analyze_satisfaction(context, conversation.channel)

        # Update conversation
        conversation.satisfaction_score = score
        conversation.sentiment = sentiment
        conversation.outcome = outcome
        conversation.ai_summary = summary
        self.db.commit()

        return {
            'satisfaction_score': score,
            'sentiment': sentiment,
            'outcome': outcome,
            'summary': summary
        }

    def _format_conversation_for_scoring(
        self,
        conversation: Conversation,
        messages: List[CommunicationMessage]
    ) -> str:
        """Format conversation messages into text for GPT-4 analysis"""
        lines = [f"Channel: {conversation.channel}"]

        for msg in messages:
            speaker = "Customer" if msg.direction == 'inbound' else "Ava"
            lines.append(f"{speaker}: {msg.content}")

        return "\n".join(lines)

    def _analyze_satisfaction(self, context: str, channel: str) -> tuple:
        """
        Call GPT-4 to analyze conversation satisfaction
        Returns: (score, sentiment, outcome, summary)
        """
        # Import OpenAI (same as existing implementation)
        from openai import OpenAI
        import os

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        prompt = f"""Analyze this {channel} conversation between a customer and Ava, an AI receptionist for a medical spa.

{context}

Provide:
1. Satisfaction score (1-10): How satisfied was the customer?
2. Sentiment (positive/neutral/negative/mixed): Overall emotional tone
3. Outcome: What happened? Options: appointment_scheduled, appointment_rescheduled, appointment_cancelled, info_request, complaint, unresolved
4. Summary (1-2 sentences): Brief description of the conversation

Respond in JSON format:
{{
  "satisfaction_score": 8,
  "sentiment": "positive",
  "outcome": "appointment_scheduled",
  "summary": "Customer successfully booked a Botox consultation for next Tuesday."
}}"""

        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return (
                result.get('satisfaction_score', 5),
                result.get('sentiment', 'neutral'),
                result.get('outcome', 'unresolved'),
                result.get('summary', '')
            )
        except Exception as e:
            print(f"Error analyzing satisfaction: {e}")
            return (5, 'neutral', 'unresolved', '')

    # ==================== Event Tracking ====================

    def add_event(
        self,
        conversation_id: UUID,
        event_type: str,
        details: Dict[str, Any],
        message_id: Optional[UUID] = None,
        timestamp: Optional[datetime] = None
    ):
        """Add an event to a conversation"""
        event = CommunicationEvent(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            message_id=message_id,
            event_type=event_type,
            timestamp=timestamp or datetime.utcnow(),
            details=details
        )
        self.db.add(event)
        self.db.commit()
```

---

### 3. WebSocket Handler Updates (`backend/main.py`)

Update voice WebSocket endpoint to use new schema:

```python
@app.websocket("/ws/voice/{session_id}")
async def voice_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    db = SessionLocal()
    analytics_service = AnalyticsService(db)

    try:
        # Create customer if needed
        customer = get_or_create_customer(db, phone="+1234567890")  # Get from auth

        # Create conversation
        conversation = analytics_service.create_conversation(
            customer_id=customer.id,
            channel='voice',
            metadata={'session_id': session_id}
        )

        # Create initial message placeholder
        message = analytics_service.add_message(
            conversation_id=conversation.id,
            direction='inbound',
            content='',  # Will be updated with transcript
            sent_at=datetime.utcnow()
        )

        # Connect to OpenAI Realtime API
        realtime_client = RealtimeClient(...)

        # ... existing voice call logic ...

        # During call: accumulate transcript in memory
        transcript_segments = []
        function_calls = []

    finally:
        # On disconnect: finalize conversation

        # Update message content with full transcript
        message.content = format_transcript(transcript_segments)
        message.processed = True
        db.commit()

        # Add voice call details
        analytics_service.add_voice_details(
            message_id=message.id,
            duration_seconds=int((datetime.utcnow() - conversation.initiated_at).total_seconds()),
            recording_url=recording_url,  # If available
            transcript_segments=transcript_segments,
            function_calls=function_calls
        )

        # Complete conversation
        analytics_service.complete_conversation(conversation.id)

        # Score satisfaction
        analytics_service.score_conversation_satisfaction(conversation.id)

        db.close()
```

---

### 4. New SMS/Email Handlers

Add webhook endpoints for Twilio (SMS) and SendGrid (Email):

```python
# backend/main.py

@app.post("/api/webhooks/twilio/sms")
async def handle_incoming_sms(request: Request, db: Session = Depends(get_db)):
    """
    Twilio webhook for incoming SMS
    1. Find or create conversation for this phone number
    2. Add inbound message
    3. Generate AI response
    4. Send outbound message via Twilio
    5. If conversation complete, score satisfaction
    """
    from twilio.twiml.messaging_response import MessagingResponse

    form = await request.form()
    from_number = form.get('From')
    to_number = form.get('To')
    body = form.get('Body')
    message_sid = form.get('MessageSid')

    analytics_service = AnalyticsService(db)

    # Find or create customer by phone
    customer = get_or_create_customer_by_phone(db, from_number)

    # Find active SMS conversation or create new one
    conversation = find_active_sms_conversation(db, customer.id)
    if not conversation:
        conversation = analytics_service.create_conversation(
            customer_id=customer.id,
            channel='sms'
        )

    # Add inbound message
    message = analytics_service.add_message(
        conversation_id=conversation.id,
        direction='inbound',
        content=body,
        sent_at=datetime.utcnow()
    )

    analytics_service.add_sms_details(
        message_id=message.id,
        from_number=from_number,
        to_number=to_number,
        provider_message_id=message_sid,
        delivery_status='delivered'
    )

    # Generate AI response (placeholder - implement AI logic)
    ai_response = generate_sms_response(conversation, body)

    # Send response via Twilio
    send_sms(to=from_number, body=ai_response)

    # Add outbound message
    outbound_message = analytics_service.add_message(
        conversation_id=conversation.id,
        direction='outbound',
        content=ai_response,
        sent_at=datetime.utcnow()
    )

    # Check if conversation should be marked complete
    if should_end_conversation(ai_response):
        analytics_service.complete_conversation(conversation.id)
        analytics_service.score_conversation_satisfaction(conversation.id)

    # Respond to Twilio (required)
    resp = MessagingResponse()
    return Response(content=str(resp), media_type="application/xml")


@app.post("/api/webhooks/sendgrid/email")
async def handle_incoming_email(request: Request, db: Session = Depends(get_db)):
    """
    SendGrid inbound parse webhook
    Similar flow to SMS
    """
    # Parse email from SendGrid
    # Find or create conversation
    # Add message
    # Generate AI response
    # Send email
    pass
```

---

### 5. Dashboard API Updates

Replace `/api/admin/calls` with `/api/admin/communications`:

```python
# backend/main.py

@app.get("/api/admin/communications")
async def get_communications(
    customer_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get conversations with filtering
    Returns paginated list with customer info
    """
    query = db.query(Conversation).join(Customer)

    if customer_id:
        query = query.filter(Conversation.customer_id == customer_id)
    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)

    total = query.count()
    conversations = query.order_by(Conversation.last_activity_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()

    return {
        'conversations': [format_conversation_summary(c) for c in conversations],
        'total': total,
        'page': page,
        'page_size': page_size
    }


@app.get("/api/admin/communications/{conversation_id}")
async def get_conversation_detail(conversation_id: UUID, db: Session = Depends(get_db)):
    """
    Get full conversation with all messages and events
    Include channel-specific details
    """
    conversation = db.query(Conversation)\
        .options(
            joinedload(Conversation.messages),
            joinedload(Conversation.events),
            joinedload(Conversation.customer)
        )\
        .filter(Conversation.id == conversation_id)\
        .first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Format messages with channel details
    formatted_messages = []
    for msg in conversation.messages:
        msg_data = {
            'id': str(msg.id),
            'direction': msg.direction,
            'content': msg.content,
            'sent_at': msg.sent_at.isoformat()
        }

        # Add channel-specific details
        if conversation.channel == 'voice' and msg.voice_details:
            msg_data['voice'] = {
                'duration_seconds': msg.voice_details.duration_seconds,
                'recording_url': msg.voice_details.recording_url,
                'function_calls': msg.voice_details.function_calls
            }
        elif conversation.channel == 'sms' and msg.sms_details:
            msg_data['sms'] = {
                'from_number': msg.sms_details.from_number,
                'to_number': msg.sms_details.to_number,
                'delivery_status': msg.sms_details.delivery_status
            }
        elif conversation.channel == 'email' and msg.email_details:
            msg_data['email'] = {
                'subject': msg.email_details.subject,
                'from_address': msg.email_details.from_address,
                'to_address': msg.email_details.to_address
            }

        formatted_messages.append(msg_data)

    return {
        'conversation': {
            'id': str(conversation.id),
            'customer': {
                'id': str(conversation.customer.id),
                'name': conversation.customer.name,
                'phone': conversation.customer.phone,
                'email': conversation.customer.email
            },
            'channel': conversation.channel,
            'status': conversation.status,
            'satisfaction_score': conversation.satisfaction_score,
            'sentiment': conversation.sentiment,
            'outcome': conversation.outcome,
            'subject': conversation.subject,
            'ai_summary': conversation.ai_summary,
            'initiated_at': conversation.initiated_at.isoformat(),
            'completed_at': conversation.completed_at.isoformat() if conversation.completed_at else None
        },
        'messages': formatted_messages,
        'events': [format_event(e) for e in conversation.events]
    }
```

---

## Implementation Phases

### Phase 1: Schema & Models (Week 1)
- [x] Create OMNICHANNEL_MIGRATION.md
- [ ] Add SQLAlchemy models to `backend/database.py`
- [ ] Create `backend/scripts/create_omnichannel_schema.py`
- [ ] Test schema creation on Supabase staging
- [ ] Verify indexes and constraints

### Phase 2: Data Migration (Week 1-2)
- [ ] Create `backend/scripts/migrate_call_sessions_to_conversations.py`
- [ ] Test migration on subset of data
- [ ] Run full migration on staging
- [ ] Validate data integrity (counts, relationships)

### Phase 3: Analytics Update (Week 2)
- [ ] Update `backend/analytics.py` with new methods
- [ ] Implement dual-write for voice calls
- [ ] Test satisfaction scoring on conversations
- [ ] Update daily metrics aggregation

### Phase 4: Voice Integration (Week 2-3)
- [ ] Update WebSocket handler in `backend/main.py`
- [ ] Test voice calls create conversations correctly
- [ ] Verify transcript storage and voice details
- [ ] Test event tracking

### Phase 5: Dashboard API (Week 3)
- [ ] Create `/api/admin/communications` endpoints
- [ ] Update Next.js proxy routes
- [ ] Test filtering and pagination
- [ ] Update frontend components to use new API

### Phase 6: SMS/Email Foundations (Week 4)
- [ ] Implement Twilio webhook handler
- [ ] Implement SendGrid webhook handler
- [ ] Create SMS/email response generation logic
- [ ] Test end-to-end SMS/email flow

### Phase 7: Cutover & Cleanup (Week 5)
- [ ] Switch all reads to conversations schema
- [ ] Stop dual-writes
- [ ] Monitor for issues (1 week)
- [ ] Archive/drop call_sessions table

---

## Testing Strategy

### Unit Tests
- [ ] Test conversation creation for each channel
- [ ] Test message addition and threading
- [ ] Test satisfaction scoring with mock GPT-4 responses
- [ ] Test event tracking
- [ ] Test query performance with large datasets

### Integration Tests
- [ ] Test voice call end-to-end (WebSocket → conversation → scoring)
- [ ] Test SMS thread (inbound → AI response → outbound)
- [ ] Test email thread
- [ ] Test migration script on sample data
- [ ] Test dashboard API responses

### Manual Testing Checklist
- [ ] Create voice call → verify in dashboard with all details
- [ ] Send test SMS → verify conversation created and AI responds
- [ ] Send test email → verify threading works
- [ ] Filter dashboard by channel
- [ ] View customer timeline across all channels
- [ ] Verify satisfaction scores are accurate
- [ ] Check daily metrics include all channels

### Performance Testing
- [ ] Query performance: fetch 100 conversations
- [ ] Query performance: fetch conversation with 50 messages
- [ ] Index effectiveness: EXPLAIN ANALYZE on key queries
- [ ] Webhook response time (Twilio/SendGrid)

---

## Rollback Plan

If issues arise during cutover:

1. **Immediate rollback**: Revert API routes to query `call_sessions`
2. **Data preservation**: Both schemas exist during dual-write, no data loss
3. **Fix forward**: Debug issues in new schema while old schema serves production
4. **Re-cutover**: Switch back to new schema once fixed

**Critical metrics to monitor:**
- API response times
- Conversation creation success rate
- Satisfaction scoring completion rate
- Dashboard load times
- Database query performance

---

## Future Enhancements

After successful migration:

- **Multi-channel conversations**: Link SMS/email follow-ups to original voice call
- **Real-time dashboard updates**: WebSocket push for live conversation monitoring
- **Advanced analytics**: Cross-channel funnel analysis, channel effectiveness
- **Conversation search**: Full-text search across all message content
- **AI conversation summaries**: Automatic subject line generation for all channels
- **Conversation tagging**: Custom labels (VIP, urgent, follow-up needed)
- **WhatsApp support**: Add new channel to existing infrastructure

---

## Success Criteria

✅ **Migration successful if:**
1. All existing call_sessions migrated to conversations with 100% data integrity
2. Voice calls continue working with no regressions
3. Dashboard displays conversations from all channels
4. Satisfaction scoring works for voice, SMS, and email
5. API response times remain < 500ms for conversation queries
6. No data loss during cutover

✅ **Omnichannel feature successful if:**
1. SMS conversations support multi-message threading
2. Email conversations support threading with proper reply-to handling
3. Customer timeline view shows all channels chronologically
4. AI satisfaction scoring achieves >80% accuracy across channels
5. Webhook response times < 2 seconds (Twilio/SendGrid SLA)

---

## Contact & Support

**Migration Lead**: [TBD]
**Database Admin**: [TBD]
**Timeline**: 5 weeks (Nov 10 - Dec 15, 2025)
**Status Updates**: Weekly on Mondays

---

**Last Updated**: November 10, 2025
