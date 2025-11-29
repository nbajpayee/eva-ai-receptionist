"""Tests for messaging service customer update behavior."""

from __future__ import annotations

from typing import Callable, Tuple

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from booking import BookingChannel
from database import Customer, Conversation
from messaging_service import MessagingService


def _create_customer(db: Session, **kwargs) -> Customer:
    customer = Customer(**kwargs)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def test_update_customer_preserves_existing_owner_phone(db_session: Session):
    other_customer = _create_customer(
        db_session,
        name="Existing Owner",
        phone="+19990005678",
        email="owner@example.com",
        is_new_client=False,
    )
    conversation_customer = _create_customer(
        db_session,
        name="Messaging Guest",
        phone="+19990001234",
        email=None,
        is_new_client=True,
    )

    MessagingService._update_customer_from_arguments(
        db_session,
        conversation_customer,
        {"customer_phone": other_customer.phone},
    )

    db_session.refresh(conversation_customer)
    assert conversation_customer.phone == "+19990001234"


def test_update_customer_updates_when_phone_unique(db_session: Session):
    conversation_customer = _create_customer(
        db_session,
        name="Messaging Guest",
        phone="+19990002222",
        email=None,
        is_new_client=True,
    )

    MessagingService._update_customer_from_arguments(
        db_session,
        conversation_customer,
        {"customer_phone": " +19990003333 "},
    )

    db_session.refresh(conversation_customer)
    assert conversation_customer.phone == "+19990003333"


def test_conversation_booking_channel_maps_channel_values(db_session: Session):
    customer = _create_customer(
        db_session,
        name="Test",
        phone="+19990004444",
        email=None,
        is_new_client=True,
    )

    conversation = Conversation(
        customer_id=customer.id,
        channel="sms",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    channel_enum = MessagingService._conversation_booking_channel(conversation)
    assert channel_enum == BookingChannel.SMS


def test_build_booking_context_and_orchestrator_uses_conversation_channel(
    db_session: Session,
):
    customer = _create_customer(
        db_session,
        name="Test",
        phone="+19990005555",
        email=None,
        is_new_client=True,
    )

    conversation = Conversation(
        customer_id=customer.id,
        channel="email",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    context, orchestrator = MessagingService._build_booking_context_and_orchestrator(
        db_session,
        conversation,
        customer,
        calendar_service=None,
    )

    assert context.channel == BookingChannel.EMAIL
    assert orchestrator is not None
