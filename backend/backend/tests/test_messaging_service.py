"""Tests for messaging service customer update behavior."""
from __future__ import annotations

from typing import Callable, Tuple

from datetime import datetime
import uuid

import pytest

from database import Customer, SessionLocal, Conversation
from messaging_service import MessagingService, SlotSelectionError


@pytest.fixture
def db_session() -> Tuple[SessionLocal, Callable[..., Customer]]:
    session = SessionLocal()
    created_ids = []
    created_conversation_ids = []

    def create_customer(**kwargs) -> Customer:
        customer = Customer(**kwargs)
        session.add(customer)
        session.commit()
        created_ids.append(customer.id)
        return customer

    yield session, create_customer

    try:
        for conversation_id in created_conversation_ids:
            conversation_obj = session.query(Conversation).get(conversation_id)
            if conversation_obj is not None:
                session.delete(conversation_obj)
        session.commit()
        for customer_id in created_ids:
            customer_obj = session.query(Customer).get(customer_id)
            if customer_obj is not None:
                session.delete(customer_obj)
        session.commit()
    finally:
        session.close()


@pytest.fixture
def conversation_factory(db_session, request):
    session, create_customer = db_session
    created_conversation_ids = []
    counter = [0]  # Use list to allow mutation in nested function

    def _create_conversation(*, customer: Customer | None = None, channel: str = "sms") -> Tuple[Conversation, Customer]:
        counter[0] += 1
        unique_id = str(uuid.uuid4())[:8]  # Use UUID for true uniqueness
        guest = customer or create_customer(
            name="Messaging Guest",
            phone=f"+1999555{unique_id}",  # Unique phone per conversation
            email=f"guest-{unique_id}@example.com",  # Unique email per conversation
            is_new_client=True,
        )
        now = datetime.utcnow()
        conversation = Conversation(
            customer_id=guest.id,
            channel=channel,
            status="active",
            initiated_at=now,
            last_activity_at=now,
            custom_metadata={},
        )
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        created_conversation_ids.append(conversation.id)
        return conversation, guest

    def _cleanup() -> None:
        for conversation_id in created_conversation_ids:
            conversation_obj = session.query(Conversation).get(conversation_id)
            if conversation_obj is not None:
                session.delete(conversation_obj)
        session.commit()

    request.addfinalizer(_cleanup)
    return _create_conversation


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


def _sample_slots():
    return [
        {
            "start": "2025-11-16T19:00:00-08:00",
            "end": "2025-11-16T20:00:00-08:00",
            "start_time": "07:00 PM",
            "end_time": "08:00 PM",
        },
        {
            "start": "2025-11-16T19:30:00-08:00",
            "end": "2025-11-16T20:30:00-08:00",
            "start_time": "07:30 PM",
            "end_time": "08:30 PM",
        },
        {
            "start": "2025-11-16T20:00:00-08:00",
            "end": "2025-11-16T21:00:00-08:00",
            "start_time": "08:00 PM",
            "end_time": "09:00 PM",
        },
    ]


def _record_sample_offers(session, conversation, service_type="botox") -> None:
    MessagingService._record_slot_offers(
        db=session,
        conversation=conversation,
        tool_call_id="test-call",
        arguments={"service_type": service_type, "date": "2025-11-16"},
        output={
            "success": True,
            "available_slots": _sample_slots(),
            "date": "2025-11-16",
            "service": "Botox",
            "service_type": service_type,
        },
    )


def test_capture_slot_selection_records_choice(db_session, conversation_factory):
    session, _ = db_session
    conversation, customer = conversation_factory()
    _record_sample_offers(session, conversation)

    MessagingService.add_customer_message(
        session,
        conversation=conversation,
        content="3",
        metadata={"source": "test"},
    )
    session.refresh(conversation)
    metadata = MessagingService._conversation_metadata(conversation)
    pending = metadata.get("pending_slot_offers")
    assert pending is not None
    assert pending.get("selected_option_index") == 3
    assert pending.get("selected_slot", {}).get("start") == "2025-11-16T20:00:00-08:00"


def test_enforce_slot_selection_uses_selected_slot(db_session, conversation_factory):
    session, _ = db_session
    conversation, customer = conversation_factory()
    _record_sample_offers(session, conversation)

    MessagingService.add_customer_message(
        session,
        conversation=conversation,
        content="Option 3 sounds great",
        metadata={"source": "test"},
    )

    arguments = {
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        "customer_email": customer.email,
        "service_type": "botox",
        "start_time": "2025-11-16T19:00:00-08:00",
    }

    normalized_args, adjustments = MessagingService._enforce_slot_selection_for_booking(
        db=session,
        conversation=conversation,
        arguments=arguments,
    )

    assert normalized_args["start_time"] == "2025-11-16T20:00:00-08:00"
    assert normalized_args["start"] == "2025-11-16T20:00:00-08:00"
    assert adjustments.get("start_time", {}).get("normalized") == "2025-11-16T20:00:00-08:00"


def test_enforce_slot_selection_rejects_unknown_slot(db_session, conversation_factory):
    session, _ = db_session
    conversation, _ = conversation_factory()
    _record_sample_offers(session, conversation)

    with pytest.raises(SlotSelectionError):
        MessagingService._enforce_slot_selection_for_booking(
            db=session,
            conversation=conversation,
            arguments={
                "service_type": "botox",
                "start_time": "2025-11-16T18:00:00-08:00",
            },
        )


def test_recheck_availability_preserves_user_selection(db_session, conversation_factory):
    """Test that if AI calls check_availability again after user chose, selection is preserved."""
    session, _ = db_session
    conversation, customer = conversation_factory()

    # First availability check
    _record_sample_offers(session, conversation)

    # User selects option 2
    MessagingService.add_customer_message(
        session,
        conversation=conversation,
        content="2",
        metadata={"source": "test"},
    )

    session.refresh(conversation)
    metadata = MessagingService._conversation_metadata(conversation)
    pending = metadata.get("pending_slot_offers")
    assert pending.get("selected_option_index") == 2
    original_selection_time = pending.get("selected_at")

    # AI re-checks availability (simulating "slot no longer available" scenario)
    MessagingService._record_slot_offers(
        db=session,
        conversation=conversation,
        tool_call_id="second-check",
        arguments={"service_type": "botox", "date": "2025-11-16"},
        output={
            "success": True,
            "available_slots": _sample_slots(),
            "date": "2025-11-16",
            "service": "Botox",
            "service_type": "botox",
        },
    )

    # Verify selection was PRESERVED even though new slots were offered
    session.refresh(conversation)
    metadata = MessagingService._conversation_metadata(conversation)
    pending = metadata.get("pending_slot_offers")
    assert pending is not None
    assert pending.get("selected_option_index") == 2, "Selection should be preserved after re-check"
    assert pending.get("selected_at") == original_selection_time, "Selection timestamp should be preserved"
    assert pending.get("selected_slot", {}).get("start") == "2025-11-16T19:30:00-08:00"
