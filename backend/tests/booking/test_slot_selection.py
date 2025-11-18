from __future__ import annotations

from datetime import datetime, timedelta

import pytest
import pytz

from booking.slot_selection import SlotSelectionCore, SlotSelectionError
from booking.time_utils import to_eastern
from database import CommunicationMessage, Conversation, SessionLocal


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_conversation(session, metadata=None):
    conversation = Conversation(
        channel="sms",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata=metadata or {},
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


def _make_message(session, conversation, content: str) -> CommunicationMessage:
    message = CommunicationMessage(
        conversation_id=conversation.id,
        direction="inbound",
        content=content,
        sent_at=datetime.utcnow(),
        processed=False,
        custom_metadata={},
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


def _sample_slot(index: int, start: datetime) -> dict[str, str]:
    localized_start = to_eastern(start)
    end = localized_start + timedelta(minutes=60)
    return {
        "index": index,
        "start": localized_start.isoformat(),
        "end": end.isoformat(),
        "start_time": localized_start.strftime("%I:%M %p"),
        "end_time": end.strftime("%I:%M %p"),
    }


def test_record_offers_replaces_pending_when_empty(db_session):
    conversation = _make_conversation(db_session)
    slots = [_sample_slot(1, datetime(2025, 11, 16, 15, 30))]

    SlotSelectionCore.record_offers(
        db_session,
        conversation,
        tool_call_id="tool1",
        arguments={"date": "2025-11-16"},
        output={
            "available_slots": slots,
            "date": "2025-11-16",
            "service_type": "hydrafacial",
        },
    )

    db_session.refresh(conversation)
    pending = conversation.custom_metadata.get("pending_slot_offers")
    assert pending is not None
    assert pending["slots"][0]["index"] == 1
    assert pending["service_type"] == "hydrafacial"


def test_clear_offers_removes_pending(db_session):
    conversation = _make_conversation(
        db_session,
        metadata={
            "pending_slot_offers": {
                "slots": [_sample_slot(1, datetime(2025, 11, 16, 15, 30))]
            }
        },
    )

    SlotSelectionCore.clear_offers(db_session, conversation)
    db_session.refresh(conversation)
    assert "pending_slot_offers" not in (conversation.custom_metadata or {})


def test_capture_selection_parses_numeric_choice(db_session):
    conversation = _make_conversation(db_session)
    slots = [
        _sample_slot(1, datetime(2025, 11, 16, 15, 30)),
        _sample_slot(2, datetime(2025, 11, 16, 17, 30)),
    ]
    SlotSelectionCore.record_offers(
        db_session,
        conversation,
        tool_call_id="tool2",
        arguments={},
        output={"available_slots": slots},
    )

    message = _make_message(db_session, conversation, "Option 2 sounds great")
    captured = SlotSelectionCore.capture_selection(db_session, conversation, message)
    assert captured is True

    db_session.refresh(conversation)
    pending = conversation.custom_metadata["pending_slot_offers"]
    assert pending["selected_option_index"] == 2
    assert pending["selected_slot"]["start"] == slots[1]["start"]


def test_enforce_booking_raises_when_no_pending_offers(db_session):
    conversation = _make_conversation(db_session)

    with pytest.raises(SlotSelectionError):
        SlotSelectionCore.enforce_booking(
            db_session,
            conversation,
            {"start_time": "2025-11-16T15:30:00-05:00"},
        )


def test_enforce_booking_matches_requested_slot(db_session):
    conversation = _make_conversation(db_session)
    offered_slot = _sample_slot(1, datetime(2025, 11, 16, 15, 30))
    SlotSelectionCore.record_offers(
        db_session,
        conversation,
        tool_call_id="tool3",
        arguments={},
        output={"available_slots": [offered_slot]},
    )

    args = {"start_time": offered_slot["start"], "service_type": "hydrafacial"}
    normalized, adjustments = SlotSelectionCore.enforce_booking(
        db_session, conversation, args
    )

    assert normalized["start_time"] == offered_slot["start"]
    assert normalized["service_type"] == "hydrafacial"
    assert adjustments == {}


def test_enforce_booking_raises_for_mismatch(db_session):
    conversation = _make_conversation(db_session)
    SlotSelectionCore.record_offers(
        db_session,
        conversation,
        tool_call_id="tool4",
        arguments={},
        output={
            "available_slots": [_sample_slot(1, datetime(2025, 11, 16, 15, 30))],
        },
    )

    with pytest.raises(SlotSelectionError):
        SlotSelectionCore.enforce_booking(
            db_session,
            conversation,
            {"start_time": "2025-11-16T20:30:00-05:00"},
        )


def test_get_pending_slot_offers_expiry(db_session):
    past_ts = (
        datetime.utcnow().replace(tzinfo=pytz.utc) - timedelta(hours=1)
    ).isoformat()
    conversation = _make_conversation(
        db_session,
        metadata={
            "pending_slot_offers": {
                "slots": [],
                "expires_at": past_ts,
            }
        },
    )

    pending = SlotSelectionCore.get_pending_slot_offers(db_session, conversation)
    assert pending is None


def test_extract_choice_prefers_numeric(db_session):
    slots = [
        {"start": "2025-11-16T15:30:00-05:00", "start_time": "3:30 PM"},
        {"start": "2025-11-16T17:30:00-05:00", "start_time": "5:30 PM"},
    ]
    assert SlotSelectionCore.extract_choice("I'll take option 2 please", slots) == 2


def test_extract_choice_matches_time_phrase(db_session):
    slots = [
        {"start": "2025-11-16T15:30:00-05:00", "start_time": "3:30 PM"},
        {"start": "2025-11-16T17:30:00-05:00", "start_time": "5:30 PM"},
    ]
    assert SlotSelectionCore.extract_choice("Let's do 5:30 PM", slots) == 2


def test_pending_slot_summary_returns_stripped_fields(db_session):
    conversation = _make_conversation(
        db_session,
        metadata={
            "pending_slot_offers": {
                "slots": [
                    {
                        "index": 1,
                        "start": "2025-11-16T15:30:00-05:00",
                        "end": "2025-11-16T16:30:00-05:00",
                        "start_time": "03:30 PM",
                        "end_time": "04:30 PM",
                        "extra": "ignore",
                    }
                ]
            }
        },
    )

    summary = SlotSelectionCore.pending_slot_summary(db_session, conversation)
    assert summary == [
        {
            "index": 1,
            "start": "2025-11-16T15:30:00-05:00",
            "end": "2025-11-16T16:30:00-05:00",
            "start_time": "03:30 PM",
            "end_time": "04:30 PM",
        }
    ]


def test_slot_matches_request_parses_strings():
    slot = {"start": "2025-11-16T15:30:00-05:00"}
    assert SlotSelectionCore.slot_matches_request(slot, "2025-11-16T15:30:00-05:00")
    assert SlotSelectionCore.slot_matches_request(slot, None) is False


def test_get_pending_slot_offers_returns_value_when_not_expired(db_session):
    future_ts = (
        datetime.utcnow().replace(tzinfo=pytz.utc) + timedelta(hours=1)
    ).isoformat()
    conversation = _make_conversation(
        db_session,
        metadata={
            "pending_slot_offers": {
                "slots": [_sample_slot(1, datetime(2025, 11, 16, 15, 30))],
                "expires_at": future_ts,
            }
        },
    )

    pending = SlotSelectionCore.get_pending_slot_offers(db_session, conversation)
    assert pending is not None
    assert pending["expires_at"] == future_ts
