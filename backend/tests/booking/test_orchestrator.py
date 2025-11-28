from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

import pytz

from booking import (
    BookingChannel,
    BookingContext,
    BookingOrchestrator,
    CheckAvailabilityResult,
)
from booking.time_utils import EASTERN_TZ
from booking.manager import SlotSelectionManager
from database import Conversation, SessionLocal


class _FakeCalendarService:
    def __init__(self, slots: List[Dict[str, Any]]):
        self._slots = slots
        self.book_calls: List[Dict[str, Any]] = []

    def get_available_slots(
        self, date, service_type, services_dict=None
    ):  # noqa: ARG002 - signature parity
        return self._slots

    def book_appointment(
        self,
        *,
        start_time,
        end_time,
        customer_name,
        customer_email,
        customer_phone,
        service_type,
        services_dict=None,  # noqa: ARG002 - unused in fake
        provider=None,
        notes=None,
    ):
        self.book_calls.append(
            {
                "start": start_time,
                "end": end_time,
                "customer_name": customer_name,
                "customer_email": customer_email,
                "customer_phone": customer_phone,
                "service_type": service_type,
                "provider": provider,
                "notes": notes,
            }
        )
        return "evt-orchestrator-test"


TEST_SERVICES = {
    "botox": {
        "name": "Botox",
        "duration_minutes": 60,
    },
}


def _make_slot(start_dt: datetime, duration_minutes: int = 30) -> Dict[str, str]:
    localized = start_dt.astimezone(EASTERN_TZ)
    end_dt = localized + timedelta(minutes=duration_minutes)
    return {
        "start": localized.isoformat(),
        "end": end_dt.isoformat(),
        "start_time": localized.strftime("%I:%M %p"),
        "end_time": end_dt.strftime("%I:%M %p"),
    }


def _make_conversation(session) -> Conversation:
    now = datetime.utcnow()
    conversation = Conversation(
        channel="sms",
        status="active",
        initiated_at=now,
        last_activity_at=now,
        custom_metadata={},
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


def _db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_check_availability_registers_slot_offers():
    session_gen = _db_session()
    db = next(session_gen)
    try:
        tomorrow_base = datetime.now(EASTERN_TZ).replace(
            hour=9, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
        slots = [
            _make_slot(tomorrow_base + timedelta(minutes=offset))
            for offset in (0, 30, 60)
        ]
        fake_calendar = _FakeCalendarService(slots)
        conversation = _make_conversation(db)

        context = BookingContext(
            db=db,
            conversation=conversation,
            customer=None,
            channel=BookingChannel.SMS,
            calendar_service=fake_calendar,
            services_dict=TEST_SERVICES,
        )

        orchestrator = BookingOrchestrator(channel=BookingChannel.SMS)
        result = orchestrator.check_availability(
            context,
            date=tomorrow_base.date().strftime("%Y-%m-%d"),
            service_type="botox",
            limit=2,
            tool_call_id="test-call",
        )

        assert isinstance(result, CheckAvailabilityResult)
        assert result.success is True
        assert len(result.available_slots) == 2
        assert len(result.all_slots) == len(slots)

        pending = SlotSelectionManager.get_pending_slot_offers(db, conversation)
        assert pending is not None
        assert pending["service_type"] == "botox"
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


def test_book_appointment_uses_enforced_slot_and_books_calendar():
    session_gen = _db_session()
    db = next(session_gen)
    try:
        tomorrow = datetime.now(pytz.UTC).astimezone(EASTERN_TZ).replace(
            hour=9, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
        requested_start = tomorrow + timedelta(hours=1)

        slots = [
            _make_slot(tomorrow + timedelta(minutes=offset))
            for offset in (0, 30, 60, 90)
        ]
        fake_calendar = _FakeCalendarService(slots)
        conversation = _make_conversation(db)

        SlotSelectionManager.record_offers(
            db,
            conversation,
            tool_call_id="offers-call",
            arguments={
                "date": tomorrow.date().strftime("%Y-%m-%d"),
                "service_type": "botox",
            },
            output={
                "success": True,
                "available_slots": slots,
                "all_slots": slots,
                "date": tomorrow.date().strftime("%Y-%m-%d"),
                "service_type": "botox",
            },
        )

        context = BookingContext(
            db=db,
            conversation=conversation,
            customer=None,
            channel=BookingChannel.SMS,
            calendar_service=fake_calendar,
            services_dict=TEST_SERVICES,
        )

        orchestrator = BookingOrchestrator(channel=BookingChannel.SMS)
        params: Dict[str, Any] = {
            "customer_name": "Test Guest",
            "customer_phone": "+15555550123",
            "customer_email": "guest@example.com",
            "start_time": requested_start.isoformat(),
            "service_type": "botox",
        }

        result = orchestrator.book_appointment(context, params=params)

        assert result.success is True
        assert result.event_id == "evt-orchestrator-test"
        assert fake_calendar.book_calls, "Booking should be attempted via calendar service"
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


def test_book_appointment_rejects_mismatched_slot():
    session_gen = _db_session()
    db = next(session_gen)
    try:
        tomorrow = datetime.now(EASTERN_TZ).replace(
            hour=9, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
        slots = [
            _make_slot(tomorrow + timedelta(minutes=offset))
            for offset in (0, 30, 60)
        ]
        fake_calendar = _FakeCalendarService(slots)
        conversation = _make_conversation(db)

        SlotSelectionManager.record_offers(
            db,
            conversation,
            tool_call_id="offers-call-mismatch",
            arguments={
                "date": tomorrow.date().strftime("%Y-%m-%d"),
                "service_type": "botox",
            },
            output={
                "success": True,
                "available_slots": slots,
                "all_slots": slots,
                "date": tomorrow.date().strftime("%Y-%m-%d"),
                "service_type": "botox",
            },
        )

        context = BookingContext(
            db=db,
            conversation=conversation,
            customer=None,
            channel=BookingChannel.VOICE,
            calendar_service=fake_calendar,
            services_dict=TEST_SERVICES,
        )

        orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)
        params: Dict[str, Any] = {
            "customer_name": "Test Guest",
            "customer_phone": "+15555550123",
            "customer_email": "guest@example.com",
            "start_time": (tomorrow + timedelta(hours=5)).isoformat(),
            "service_type": "botox",
        }

        result = orchestrator.book_appointment(context, params=params)

        assert result.success is False
        assert not fake_calendar.book_calls
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
