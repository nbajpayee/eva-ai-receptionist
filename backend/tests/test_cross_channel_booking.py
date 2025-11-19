from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from booking.manager import SlotSelectionManager
from booking.time_utils import to_eastern
from database import CommunicationMessage, Conversation, SessionLocal


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_conversation(session, *, channel: str = "sms") -> Conversation:
    now = datetime.utcnow()
    conversation = Conversation(
        channel=channel,
        status="active",
        initiated_at=now,
        last_activity_at=now,
        custom_metadata={},
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


def _log_message(
    session, conversation: Conversation, content: str, *, source: str
) -> CommunicationMessage:
    message = CommunicationMessage(
        conversation_id=conversation.id,
        direction="inbound",
        content=content,
        sent_at=datetime.utcnow(),
        processed=False,
        custom_metadata={"source": source},
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


def _sample_slots(base: datetime) -> list[dict[str, str]]:
    eastern_base = to_eastern(base)
    first_end = eastern_base + timedelta(minutes=60)
    second_start = eastern_base + timedelta(hours=2)
    second_end = second_start + timedelta(minutes=60)
    return [
        {
            "index": 1,
            "start": eastern_base.isoformat(),
            "end": first_end.isoformat(),
            "start_time": eastern_base.strftime("%I:%M %p"),
            "end_time": first_end.strftime("%I:%M %p"),
        },
        {
            "index": 2,
            "start": second_start.isoformat(),
            "end": second_end.isoformat(),
            "start_time": second_start.strftime("%I:%M %p"),
            "end_time": second_end.strftime("%I:%M %p"),
        },
    ]


def test_sms_offers_consumed_by_voice_selection(db_session):
    conversation = _make_conversation(db_session, channel="sms")

    # Step 1: SMS flow records slot offers via shared manager
    slots = _sample_slots(datetime(2025, 11, 16, 15, 30))
    SlotSelectionManager.record_offers(
        db_session,
        conversation,
        tool_call_id="sms-tool-call",
        arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
        output={
            "success": True,
            "all_slots": slots,  # Full slot list for validation
            "available_slots": slots,  # Display slots (same for this test)
            "date": "2025-11-16",
            "service": "Hydrafacial",
            "service_type": "hydrafacial",
        },
    )

    db_session.refresh(conversation)
    pending = conversation.custom_metadata.get("pending_slot_offers")
    assert pending is not None
    assert pending["service_type"] == "hydrafacial"

    # Step 2: Voice transcript selects the second option using the same metadata
    message = _log_message(
        db_session,
        conversation,
        "Let's take option 2 this afternoon",
        source="voice_transcript",
    )

    captured = SlotSelectionManager.capture_selection(db_session, conversation, message)
    assert captured is True

    db_session.refresh(conversation)
    pending = conversation.custom_metadata["pending_slot_offers"]
    assert pending["selected_option_index"] == 2
    assert pending["selected_slot"]["start"] == slots[1]["start"]

    # Step 3: Voice booking enforcement honors the shared selection
    normalized, adjustments = SlotSelectionManager.enforce_booking(
        db_session,
        conversation,
        {
            "customer_name": "Cross Channel Caller",
            "customer_phone": "+15555551234",
            "start_time": "2025-11-16T14:30:00-05:00",
            "service_type": "hydrafacial",
        },
    )

    assert normalized["start_time"] == slots[1]["start"]
    assert normalized["service_type"] == "hydrafacial"
    assert "customer_name" in normalized
    # Adjustments should reflect the normalized start time derived from the selected slot.
    assert "start_time" in adjustments
    assert adjustments["start_time"]["normalized"] == slots[1]["start"]
