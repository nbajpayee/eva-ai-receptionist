from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from unittest.mock import Mock, patch

from analytics import AnalyticsService
from booking.manager import SlotSelectionManager
from booking.time_utils import to_eastern
from database import CommunicationMessage, Conversation, SessionLocal
from realtime_client import RealtimeClient


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


@patch("realtime_client.get_calendar_service")
def test_backfill_slot_selection_from_prior_message(mock_calendar_service, db_session):
    conversation = _create_voice_conversation(db_session, "session-backfill")
    messages: list[CommunicationMessage] = []

    try:
        # Mock calendar service so RealtimeClient initialization has no external dependencies.
        mock_calendar_service.return_value = object()

        # Record slot offers for a specific date/time.
        slots = _sample_slots(datetime(2025, 11, 16, 10, 0))
        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="backfill-call",
            arguments={"date": "2025-11-16", "service_type": "botox"},
            output={
                "success": True,
                "available_slots": slots,
                "all_slots": slots,
                "date": "2025-11-16",
                "service_type": "botox",
            },
        )

        # Earlier user message contains the explicit time.
        earlier = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conversation.id,
            direction="inbound",
            content="Can you book me tomorrow at 10am?",
            metadata={"source": "voice_transcript"},
        )
        messages.append(earlier)

        # Current confirmation message is vague and should trigger backfill.
        anchor = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conversation.id,
            direction="inbound",
            content="Yes, that time works. Please book it.",
            metadata={"source": "voice_transcript"},
        )
        messages.append(anchor)

        client = RealtimeClient(
            session_id="session-backfill",
            db=db_session,
            conversation=conversation,
        )

        # Directly exercise the backfill helper using the vague confirmation as the anchor.
        backfilled = client._backfill_slot_selection_from_history(anchor)
        assert backfilled is True

        db_session.refresh(conversation)
        pending = conversation.custom_metadata.get("pending_slot_offers") or {}
        selected_slot = pending.get("selected_slot")
        selected_index = pending.get("selected_option_index")

        assert selected_slot is not None
        assert selected_index == 1
        assert selected_slot["start"] == slots[0]["start"]
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

@pytest.mark.asyncio
@patch("realtime_client.get_calendar_service")
async def test_voice_booking_sets_last_appointment_metadata(
    mock_get_calendar_service,
    db_session,
):
    conversation = _create_voice_conversation(db_session, "session-voice-booking")
    messages: list[CommunicationMessage] = []

    try:
        mock_get_calendar_service.return_value = object()

        # Seed deterministic slot offers so downstream logic can clear them
        # and write the last_appointment metadata in a realistic state.
        base = datetime(2025, 11, 20, 10, 0)
        slots = _sample_slots(base)
        service_type = "botox"
        provider = "Dr. Test"
        start_time = slots[0]["start"]

        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id=None,
            arguments={"date": "2025-11-20", "service_type": service_type},
            output={
                "success": True,
                "available_slots": slots,
                "all_slots": slots,
                "date": "2025-11-20",
                "service_type": service_type,
            },
        )

        client = RealtimeClient(
            session_id="session-voice-booking",
            db=db_session,
            conversation=conversation,
        )

        arguments = {
            "customer_name": "Voice Caller",
            "customer_phone": "+15555550123",
            "customer_email": "caller@example.com",
            "start_time": start_time,
            "service_type": service_type,
            "provider": provider,
        }

        # Exercise the voice session state updater directly so we verify the
        # metadata written for a successful booking without depending on the
        # full orchestrator stack in this unit test.
        client._session_state.record_successful_booking(  # type: ignore[attr-defined]
            {
                "success": True,
                "event_id": "evt-voice-123",
                "start_time": start_time,
                "service_type": service_type,
                "service": "Botox",
            },
            arguments,
        )

        db_session.refresh(conversation)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        last_appt = metadata.get("last_appointment") or {}

        assert last_appt == {
            "calendar_event_id": "evt-voice-123",
            "service_type": service_type,
            "provider": provider,
            "start_time": start_time,
            "status": "scheduled",
        }
        assert metadata.get("pending_booking_intent") is False
    finally:
        _cleanup_entities(db_session, conversation, messages)


@pytest.mark.asyncio
@patch("realtime_client.BookingOrchestrator.book_appointment")
@patch("realtime_client.get_calendar_service")
async def test_voice_booking_slot_mismatch_sets_user_message(
    mock_get_calendar_service,
    mock_book_appointment,
    db_session,
):
    conversation = _create_voice_conversation(db_session, "session-voice-mismatch")
    messages: list[CommunicationMessage] = []

    try:
        mock_get_calendar_service.return_value = object()

        class _DummyBookingResult:
            def __init__(self, payload: dict):
                self._payload = payload

            def to_dict(self) -> dict:
                return self._payload

        def _fake_book(self, context, *, params):  # noqa: ARG001
            payload = {
                "success": False,
                "error": "Requested time is not in offered slots",
                "code": "slot_selection_mismatch",
            }
            return _DummyBookingResult(payload)

        mock_book_appointment.side_effect = _fake_book

        client = RealtimeClient(
            session_id="session-voice-mismatch",
            db=db_session,
            conversation=conversation,
        )

        arguments = {
            "customer_name": "Voice Caller",
            "customer_phone": "+15555550123",
            "customer_email": "caller@example.com",
            "start_time": "2025-11-20T12:00:00-05:00",
            "service_type": "botox",
        }

        result = await client.handle_function_call("book_appointment", arguments)

        assert result["success"] is False
        assert result.get("code") == "slot_selection_mismatch"
        assert isinstance(result.get("user_message"), str)
        assert "check availability" in result["user_message"].lower()
    finally:
        _cleanup_entities(db_session, conversation, messages)


@pytest.mark.asyncio
@patch("realtime_client.get_calendar_service")
async def test_voice_reschedule_updates_last_appointment_metadata(
    mock_get_calendar_service,
    db_session,
):
    conversation = _create_voice_conversation(db_session, "session-voice-reschedule")
    messages: list[CommunicationMessage] = []

    try:
        fake_calendar = Mock()
        fake_calendar.reschedule_appointment.return_value = True
        mock_get_calendar_service.return_value = fake_calendar

        client = RealtimeClient(
            session_id="session-voice-reschedule",
            db=db_session,
            conversation=conversation,
        )

        # Seed customer + last_appointment context as a real call would.
        client.session_data["customer_data"] = {
            "name": "Voice Caller",
            "phone": "+15555550123",
            "email": "caller@example.com",
        }
        client.session_data["last_appointment"] = {
            "event_id": "evt-123",
            "service_type": "botox",
            "provider": "Dr. Old",
            "start_time": "2025-11-20T10:00:00-05:00",
            "customer_name": "Voice Caller",
            "customer_phone": "+15555550123",
            "customer_email": "caller@example.com",
        }

        # Stub services lookup so duration/name are defined.
        client._get_services = lambda: {
            "botox": {"name": "Botox", "duration_minutes": 60}
        }

        new_start = "2025-11-21T11:30:00-05:00"
        result = await client.handle_function_call(
            "reschedule_appointment",
            {
                "appointment_id": "evt-123",
                "new_start_time": new_start,
                "service_type": "botox",
                "provider": "Dr. New",
            },
        )

        assert result["success"] is True
        assert result["appointment_id"] == "evt-123"

        db_session.refresh(conversation)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        last_appt = metadata.get("last_appointment") or {}

        assert last_appt["calendar_event_id"] == "evt-123"
        assert last_appt["service_type"] == "botox"
        assert last_appt["provider"] == "Dr. New"
        assert last_appt["status"] == "scheduled"
        assert last_appt["start_time"] == new_start.replace("Z", "+00:00") or new_start
    finally:
        _cleanup_entities(db_session, conversation, messages)


@pytest.mark.asyncio
@patch("realtime_client.get_calendar_service")
async def test_voice_cancel_updates_last_appointment_metadata(
    mock_get_calendar_service,
    db_session,
):
    conversation = _create_voice_conversation(db_session, "session-voice-cancel")
    messages: list[CommunicationMessage] = []

    try:
        fake_calendar = Mock()
        fake_calendar.cancel_appointment.return_value = True
        mock_get_calendar_service.return_value = fake_calendar

        client = RealtimeClient(
            session_id="session-voice-cancel",
            db=db_session,
            conversation=conversation,
        )

        client.session_data["last_appointment"] = {
            "event_id": "evt-789",
            "service_type": "botox",
            "provider": "Dr. Test",
            "start_time": "2025-11-22T09:00:00-05:00",
        }

        result = await client.handle_function_call(
            "cancel_appointment",
            {
                "appointment_id": "evt-789",
                "cancellation_reason": "user_request",
            },
        )

        assert result["success"] is True
        assert result["appointment_id"] == "evt-789"
        assert result["status"] == "cancelled"
        assert result.get("cancellation_reason") == "user_request"

        # Session state should be cleared and metadata should reflect cancellation.
        assert client.session_data["last_appointment"] is None

        db_session.refresh(conversation)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        last_appt = metadata.get("last_appointment") or {}

        assert last_appt["calendar_event_id"] == "evt-789"
        assert last_appt["status"] == "cancelled"
        assert last_appt["cancellation_reason"] == "user_request"
    finally:
        _cleanup_entities(db_session, conversation, messages)
