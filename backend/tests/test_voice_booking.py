from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from analytics import AnalyticsService
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


def _create_voice_conversation(session, session_id: str) -> Conversation:
    conversation = AnalyticsService.create_conversation(
        db=session,
        customer_id=None,
        channel="voice",
        metadata={"session_id": session_id},
    )
    return conversation


def _cleanup_entities(
    session, conversation: Conversation, messages: list[CommunicationMessage]
) -> None:
    for message in messages:
        refreshed = session.query(CommunicationMessage).get(message.id)
        if refreshed:
            session.delete(refreshed)
    refreshed_conversation = session.query(Conversation).get(conversation.id)
    if refreshed_conversation:
        session.delete(refreshed_conversation)
    session.commit()


def _sample_slots(base: datetime) -> list[dict[str, str]]:
    eastern_base = to_eastern(base)
    first_start = eastern_base.isoformat()
    first_end = (eastern_base + timedelta(minutes=60)).isoformat()
    second_start = (eastern_base + timedelta(hours=2)).isoformat()
    second_end = (eastern_base + timedelta(hours=3)).isoformat()
    return [
        {
            "start": first_start,
            "end": first_end,
            "start_time": eastern_base.strftime("%I:%M %p"),
            "end_time": (eastern_base + timedelta(minutes=60)).strftime("%I:%M %p"),
        },
        {
            "start": second_start,
            "end": second_end,
            "start_time": (eastern_base + timedelta(hours=2)).strftime("%I:%M %p"),
            "end_time": (eastern_base + timedelta(hours=3)).strftime("%I:%M %p"),
        },
    ]


def test_record_offers_persists_pending_metadata(db_session):
    conversation = _create_voice_conversation(db_session, "session-record-offers")
    messages: list[CommunicationMessage] = []

    try:
        slots = _sample_slots(datetime(2025, 11, 16, 15, 30))
        output = {
            "success": True,
            "available_slots": slots,
            "date": "2025-11-16",
            "service": "Hydrafacial",
            "service_type": "hydrafacial",
        }

        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id=None,
            arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
            output=output,
        )

        db_session.refresh(conversation)
        metadata = conversation.custom_metadata or {}
        pending = metadata.get("pending_slot_offers")
        assert pending is not None
        assert pending["service_type"] == "hydrafacial"
        assert len(pending["slots"]) == 2
        assert pending["slots"][0]["index"] == 1
    finally:
        _cleanup_entities(db_session, conversation, messages)


def test_enforce_booking_aligns_with_selected_slot(db_session):
    conversation = _create_voice_conversation(db_session, "session-enforce")
    messages: list[CommunicationMessage] = []

    try:
        slots = _sample_slots(datetime(2025, 11, 16, 15, 30))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id=None,
            arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-16",
                "service": "Hydrafacial",
                "service_type": "hydrafacial",
            },
        )

        db_session.refresh(conversation)
        metadata = conversation.custom_metadata
        pending = metadata["pending_slot_offers"]
        pending["selected_option_index"] = 1
        pending["selected_slot"] = pending["slots"][0]
        SlotSelectionManager.persist_conversation_metadata(
            db_session, conversation, metadata
        )

        arguments = {
            "customer_name": "Test Caller",
            "customer_phone": "+15555550000",
            "customer_email": "caller@example.com",
            "start_time": "2025-11-16T15:30:00-05:00",
            "service_type": "hydrafacial",
            "notes": None,
        }

        normalized_args, adjustments = SlotSelectionManager.enforce_booking(
            db_session,
            conversation,
            arguments,
        )

        assert normalized_args["start_time"] == pending["slots"][0]["start"]
        # When the requested start already matches the offered slot, adjustments may be empty.
        if adjustments:
            assert "start_time" in adjustments
            assert (
                adjustments["start_time"]["normalized"] == pending["slots"][0]["start"]
            )
    finally:
        _cleanup_entities(db_session, conversation, messages)


def test_capture_selection_with_numbered_choice(db_session):
    conversation = _create_voice_conversation(db_session, "session-numeric-choice")
    messages: list[CommunicationMessage] = []

    try:
        slots = _sample_slots(datetime(2025, 11, 16, 15, 30))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="tool123",
            arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-16",
                "service": "Hydrafacial",
                "service_type": "hydrafacial",
            },
        )

        message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conversation.id,
            direction="inbound",
            content="Option 2 sounds perfect",
            metadata={"source": "voice_transcript_test"},
        )
        messages.append(message)

        captured = SlotSelectionManager.capture_selection(
            db_session, conversation, message
        )
        assert captured is True

        db_session.refresh(conversation)
        pending = conversation.custom_metadata["pending_slot_offers"]
        assert pending["selected_option_index"] == 2
        assert pending["selected_slot"]["start"] == slots[1]["start"]
    finally:
        _cleanup_entities(db_session, conversation, messages)


def test_capture_selection_with_time_phrase(db_session):
    conversation = _create_voice_conversation(db_session, "session-time-choice")
    messages: list[CommunicationMessage] = []

    try:
        slots = _sample_slots(datetime(2025, 11, 16, 15, 30))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="tool456",
            arguments={"date": "2025-11-16", "service_type": "hydrafacial"},
            output={
                "success": True,
                "available_slots": slots,
                "date": "2025-11-16",
                "service": "Hydrafacial",
                "service_type": "hydrafacial",
            },
        )

        message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conversation.id,
            direction="inbound",
            content=f"I can do {slots[0]['start_time']} on the 16th",
            metadata={"source": "voice_transcript_test"},
        )
        messages.append(message)

        captured = SlotSelectionManager.capture_selection(
            db_session, conversation, message
        )
        assert captured is True

        db_session.refresh(conversation)
        pending = conversation.custom_metadata["pending_slot_offers"]
        assert pending["selected_option_index"] == 1
        assert pending["selected_slot"]["start"] == slots[0]["start"]
    finally:
        _cleanup_entities(db_session, conversation, messages)
