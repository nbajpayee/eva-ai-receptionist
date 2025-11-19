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


def _make_conversation(session, *, channel: str) -> Conversation:
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


def _build_slots(base: datetime) -> list[dict[str, str]]:
    eastern_base = to_eastern(base)
    second_start = eastern_base + timedelta(hours=2)
    return [
        {
            "start": eastern_base.isoformat(),
            "end": (eastern_base + timedelta(minutes=60)).isoformat(),
            "start_time": eastern_base.strftime("%I:%M %p"),
            "end_time": (eastern_base + timedelta(minutes=60)).strftime("%I:%M %p"),
        },
        {
            "start": second_start.isoformat(),
            "end": (second_start + timedelta(minutes=60)).isoformat(),
            "start_time": second_start.strftime("%I:%M %p"),
            "end_time": (second_start + timedelta(minutes=60)).strftime("%I:%M %p"),
        },
    ]


def _cleanup(session, conversation: Conversation) -> None:
    session.query(CommunicationMessage).filter(
        CommunicationMessage.conversation_id == conversation.id
    ).delete()
    session.query(Conversation).filter(Conversation.id == conversation.id).delete()
    session.commit()


def test_sms_booking_smoke(db_session):
    conversation = _make_conversation(db_session, channel="sms")

    try:
        slots = _build_slots(datetime(2025, 11, 16, 14, 30))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="sms-tool-call",
            arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-16",
                "service": "Hydrafacial",
                "service_type": "hydrafacial",
            },
        )

        message = _log_message(
            db_session, conversation, "Option 2 works great", source="sms_message"
        )
        assert (
            SlotSelectionManager.capture_selection(db_session, conversation, message)
            is True
        )

        normalized, adjustments = SlotSelectionManager.enforce_booking(
            db_session,
            conversation,
            {
                "customer_name": "SMS Tester",
                "customer_phone": "+15555550001",
                "start_time": slots[1]["start"],
                "service_type": "hydrafacial",
            },
        )

        assert normalized["start_time"] == slots[1]["start"]
        assert normalized["service_type"] == "hydrafacial"
        assert adjustments == {}

        SlotSelectionManager.clear_offers(db_session, conversation)
        db_session.refresh(conversation)
        assert not (conversation.custom_metadata or {}).get("pending_slot_offers")
    finally:
        _cleanup(db_session, conversation)


def test_email_booking_smoke(db_session):
    conversation = _make_conversation(db_session, channel="email")

    try:
        slots = _build_slots(datetime(2025, 11, 17, 11, 0))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="email-tool-call",
            arguments={"date": "2025-11-17", "service_type": "laser"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-17",
                "service": "Laser Treatment",
                "service_type": "laser",
            },
        )

        selection_phrase = slots[0]["start_time"].lstrip("0")
        message = _log_message(
            db_session,
            conversation,
            f"Hi there, I can do {selection_phrase} on the 17th.",
            source="email_body",
        )
        assert (
            SlotSelectionManager.capture_selection(db_session, conversation, message)
            is True
        )

        normalized, adjustments = SlotSelectionManager.enforce_booking(
            db_session,
            conversation,
            {
                "customer_name": "Email Tester",
                "customer_email": "tester@example.com",
                "start_time": slots[0]["start"],
                "service_type": "laser",
            },
        )

        assert normalized["start_time"] == slots[0]["start"]
        assert normalized["service_type"] == "laser"
        assert adjustments == {}

        SlotSelectionManager.clear_offers(db_session, conversation)
        db_session.refresh(conversation)
        assert not (conversation.custom_metadata or {}).get("pending_slot_offers")
    finally:
        _cleanup(db_session, conversation)


def test_voice_booking_smoke(db_session):
    conversation = _make_conversation(db_session, channel="voice")

    try:
        slots = _build_slots(datetime(2025, 11, 18, 9, 30))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="voice-tool-call",
            arguments={"date": "2025-11-18", "service_type": "facial"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-18",
                "service": "Signature Facial",
                "service_type": "facial",
            },
        )

        message = _log_message(
            db_session,
            conversation,
            "I'll take option 1 please",
            source="voice_transcript",
        )
        assert (
            SlotSelectionManager.capture_selection(db_session, conversation, message)
            is True
        )

        normalized, adjustments = SlotSelectionManager.enforce_booking(
            db_session,
            conversation,
            {
                "customer_name": "Voice Tester",
                "customer_phone": "+15555550002",
                "start_time": slots[0]["start"],
                "service_type": "facial",
            },
        )

        assert normalized["start_time"] == slots[0]["start"]
        assert normalized["service_type"] == "facial"
        assert adjustments == {}

        SlotSelectionManager.clear_offers(db_session, conversation)
        db_session.refresh(conversation)
        assert not (conversation.custom_metadata or {}).get("pending_slot_offers")
    finally:
        _cleanup(db_session, conversation)
