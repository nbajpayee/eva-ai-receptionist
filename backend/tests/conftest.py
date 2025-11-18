"""
Shared pytest fixtures for all tests.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timedelta
from typing import Generator
from unittest.mock import Mock, patch

import pytest
from faker import Faker
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_settings
from database import (Appointment, Base, CommunicationMessage, Conversation,
                      Customer)

fake = Faker()


# ==================== Database Fixtures ====================


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine."""
    # Use SQLite for testing to avoid Supabase dependencies
    test_db_url = "sqlite:///test.db"
    engine = create_engine(
        test_db_url, connect_args={"check_same_thread": False}, echo=False
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    Base.metadata.drop_all(bind=engine)
    engine.dispose()

    # Remove test database file
    try:
        os.remove("test.db")
    except:
        pass


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a database session for each test."""
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ==================== Customer Fixtures ====================


@pytest.fixture
def customer(db_session) -> Customer:
    """Create a test customer."""
    customer = Customer(
        name=fake.name(),
        phone=f"+1555{fake.random_int(1000000, 9999999)}",
        email=fake.email(),
        is_new_client=True,
        has_allergies=False,
        is_pregnant=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    yield customer

    # Cleanup
    try:
        db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id
        ).delete()
        db_session.query(CommunicationMessage).filter(
            CommunicationMessage.conversation_id.in_(
                db_session.query(Conversation.id).filter(
                    Conversation.customer_id == customer.id
                )
            )
        ).delete()
        db_session.query(Conversation).filter(
            Conversation.customer_id == customer.id
        ).delete()
        db_session.delete(customer)
        db_session.commit()
    except:
        db_session.rollback()


@pytest.fixture
def returning_customer(db_session) -> Customer:
    """Create a returning customer with history."""
    customer = Customer(
        name=fake.name(),
        phone=f"+1555{fake.random_int(1000000, 9999999)}",
        email=fake.email(),
        is_new_client=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    # Add past appointment
    past_appointment = Appointment(
        customer_id=customer.id,
        appointment_datetime=datetime.utcnow() - timedelta(days=30),
        service_type="botox",
        status="completed",
        calendar_event_id=f"evt-past-{uuid.uuid4().hex[:8]}",
    )
    db_session.add(past_appointment)
    db_session.commit()

    yield customer

    # Cleanup
    try:
        db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id
        ).delete()
        db_session.query(CommunicationMessage).filter(
            CommunicationMessage.conversation_id.in_(
                db_session.query(Conversation.id).filter(
                    Conversation.customer_id == customer.id
                )
            )
        ).delete()
        db_session.query(Conversation).filter(
            Conversation.customer_id == customer.id
        ).delete()
        db_session.delete(customer)
        db_session.commit()
    except:
        db_session.rollback()


# ==================== Conversation Fixtures ====================


@pytest.fixture
def voice_conversation(db_session, customer) -> Conversation:
    """Create a voice conversation."""
    conversation = Conversation(
        customer_id=customer.id,
        channel="voice",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"session_id": str(uuid.uuid4())},
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    yield conversation

    # Cleanup handled by customer fixture


@pytest.fixture
def sms_conversation(db_session, customer) -> Conversation:
    """Create an SMS conversation."""
    conversation = Conversation(
        customer_id=customer.id,
        channel="sms",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"phone_number": customer.phone},
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    yield conversation

    # Cleanup handled by customer fixture


@pytest.fixture
def email_conversation(db_session, customer) -> Conversation:
    """Create an email conversation."""
    conversation = Conversation(
        customer_id=customer.id,
        channel="email",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"email": customer.email},
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    yield conversation

    # Cleanup handled by customer fixture


# ==================== Mock Fixtures ====================


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client."""
    with patch("messaging_service.openai_client") as mock_client:
        yield mock_client


@pytest.fixture
def mock_calendar_service():
    """Mock Google Calendar service."""
    with patch("messaging_service.MessagingService._get_calendar_service") as mock:
        mock_service = Mock()
        mock_service.check_availability.return_value = {
            "success": True,
            "available_slots": [],
            "all_slots": [],
            "date": "2025-11-20",
        }
        mock_service.book_appointment.return_value = {
            "success": True,
            "event_id": "evt-123",
            "start_time": "2025-11-20T10:00:00-05:00",
        }
        mock.return_value = mock_service
        yield mock_service


@pytest.fixture
def mock_twilio_client():
    """Mock Twilio client for SMS testing."""
    with patch("api_messaging.twilio_client") as mock:
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = f"SM{uuid.uuid4().hex[:32]}"
        mock_client.messages.create.return_value = mock_message
        mock.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_sendgrid_client():
    """Mock SendGrid client for email testing."""
    with patch("api_messaging.sendgrid_client") as mock:
        mock_client = Mock()
        mock_client.send.return_value.status_code = 202
        mock.return_value = mock_client
        yield mock_client


# ==================== Test Data Builders ====================


def build_availability_response(
    date: str = "2025-11-20", num_slots: int = 10, service_type: str = "botox"
):
    """Build a realistic availability response."""
    from booking.time_utils import to_eastern

    base_time = to_eastern(datetime(2025, 11, 20, 10, 0))
    slots = []

    for i in range(num_slots):
        start = base_time + timedelta(hours=i)
        end = start + timedelta(minutes=60)
        slots.append(
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "start_time": start.strftime("%I:%M %p"),
                "end_time": end.strftime("%I:%M %p"),
            }
        )

    return {
        "success": True,
        "available_slots": slots[:num_slots],
        "all_slots": slots,
        "date": date,
        "service": service_type.replace("_", " ").title(),
        "service_type": service_type,
        "availability_summary": f"We have {num_slots} available slots.",
    }


def build_booking_response(slot: dict, customer: Customer, service_type: str = "botox"):
    """Build a realistic booking response."""
    return {
        "success": True,
        "event_id": f"evt-{uuid.uuid4().hex[:8]}",
        "start_time": slot["start"],
        "original_start_time": slot["start"],
        "service_type": service_type,
        "service": service_type.replace("_", " ").title(),
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        "customer_email": customer.email,
    }


def mock_ai_response_with_text(text: str) -> Mock:
    """Create a mock AI response with only text content."""
    message = Mock()
    message.content = text
    message.tool_calls = []

    choice = Mock()
    choice.message = message

    response = Mock()
    response.choices = [choice]
    return response


def mock_ai_response_with_tool_call(tool_name: str, arguments: dict) -> Mock:
    """Create a mock AI response that includes a tool call."""
    import json

    tool_call = Mock()
    tool_call.id = f"call_{uuid.uuid4()}"
    tool_call.type = "function"
    tool_call.function = Mock()
    tool_call.function.name = tool_name
    tool_call.function.arguments = json.dumps(arguments)

    message = Mock()
    message.content = ""  # No text content, just tool call
    message.tool_calls = [tool_call]

    choice = Mock()
    choice.message = message

    response = Mock()
    response.choices = [choice]
    return response


# ==================== Event Loop Fixture ====================


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ==================== Parametrize Helpers ====================

# Export test data builders for use in tests
__all__ = [
    "build_availability_response",
    "build_booking_response",
    "mock_ai_response_with_text",
    "mock_ai_response_with_tool_call",
]
