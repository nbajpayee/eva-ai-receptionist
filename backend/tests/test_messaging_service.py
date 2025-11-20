"""Tests for messaging service customer update behavior."""

from __future__ import annotations

from typing import Callable, Tuple

import pytest

from database import Customer, SessionLocal
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
