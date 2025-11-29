"""Tests for messaging service customer update behavior."""

from __future__ import annotations

from typing import Callable, Tuple

import pytest

from booking import BookingChannel
from database import Customer, SessionLocal, Conversation
from messaging_service import MessagingService


@pytest.fixture
def db_session() -> Tuple[SessionLocal, Callable[..., Customer]]:
    session = SessionLocal()
    created_ids = []

    def create_customer(**kwargs) -> Customer:
        customer = Customer(**kwargs)
        session.add(customer)
        session.commit()
        created_ids.append(customer.id)
        return customer

    yield session, create_customer

    try:
        for customer_id in created_ids:
            customer_obj = session.query(Customer).get(customer_id)
            if customer_obj is not None:
                session.delete(customer_obj)
        session.commit()
    finally:
        session.close()


def test_update_customer_preserves_existing_owner_phone(db_session):
    session, create_customer = db_session

    other_customer = create_customer(
        name="Existing Owner",
        phone="+19990005678",
        email="owner@example.com",
        is_new_client=False,
    )
    conversation_customer = create_customer(
        name="Messaging Guest",
        phone="+19990001234",
        email=None,
        is_new_client=True,
    )

    MessagingService._update_customer_from_arguments(
        session,
        conversation_customer,
        {"customer_phone": other_customer.phone},
    )

    session.refresh(conversation_customer)
    assert conversation_customer.phone == "+19990001234"


def test_update_customer_updates_when_phone_unique(db_session):
    session, create_customer = db_session

    conversation_customer = create_customer(
        name="Messaging Guest",
        phone="+19990002222",
        email=None,
        is_new_client=True,
    )

    MessagingService._update_customer_from_arguments(
        session,
        conversation_customer,
        {"customer_phone": " +19990003333 "},
    )

    session.refresh(conversation_customer)
    assert conversation_customer.phone == "+19990003333"


def test_conversation_booking_channel_maps_channel_values(db_session):
    session, create_customer = db_session

    customer = create_customer(
        name="Test",
        phone="+19990004444",
        email=None,
        is_new_client=True,
    )

    conversation = Conversation(
        customer_id=customer.id,
        channel="sms",
        status="active",
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)

    channel_enum = MessagingService._conversation_booking_channel(conversation)
    assert channel_enum == BookingChannel.SMS


def test_build_booking_context_and_orchestrator_uses_conversation_channel(db_session):
    session, create_customer = db_session

    customer = create_customer(
        name="Test",
        phone="+19990005555",
        email=None,
        is_new_client=True,
    )

    conversation = Conversation(
        customer_id=customer.id,
        channel="email",
        status="active",
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)

    context, orchestrator = MessagingService._build_booking_context_and_orchestrator(
        session,
        conversation,
        customer,
        calendar_service=None,
    )

    assert context.channel == BookingChannel.EMAIL
    assert orchestrator is not None
