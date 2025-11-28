from __future__ import annotations

from datetime import datetime, timedelta

import pytz

from booking.time_utils import EASTERN_TZ
from booking_handlers import handle_book_appointment, handle_check_availability


class _FakeCalendarService:
    def __init__(self, slots):
        self._slots = slots
        self.book_calls: list[dict] = []

    def get_available_slots(
        self, date, service_type, services_dict=None
    ):  # noqa: ARG002 - signature parity
        return self._slots

    def book_appointment(  # noqa: D401
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
        return "evt-123"


TEST_SERVICES = {
    "botox": {
        "name": "Botox",
        "duration_minutes": 60,
    },
}


def _make_slot(start_dt: datetime, duration_minutes: int = 30) -> dict[str, str]:
    localized = start_dt.astimezone(EASTERN_TZ)
    end_dt = localized + timedelta(minutes=duration_minutes)
    return {
        "start": localized.isoformat(),
        "end": end_dt.isoformat(),
        "start_time": localized.strftime("%I:%M %p"),
        "end_time": end_dt.strftime("%I:%M %p"),
    }


def test_check_availability_returns_summary_and_suggestions():
    tomorrow_base = datetime.now(EASTERN_TZ).replace(
        hour=9, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    slots = [
        _make_slot(tomorrow_base + timedelta(minutes=offset))
        for offset in (0, 30, 60, 420, 450)
    ]
    fake_calendar = _FakeCalendarService(slots)

    result = handle_check_availability(
        fake_calendar,
        date=(tomorrow_base.date()).strftime("%Y-%m-%d"),
        service_type="botox",
        limit=2,
        services_dict=TEST_SERVICES,
    )

    assert result["success"] is True
    assert len(result["available_slots"]) == 2  # limit respected for display
    assert len(result["all_slots"]) == len(slots)

    summary = result["availability_summary"]
    assert "9 AM" in summary and "4 PM" in summary

    windows = result["availability_windows"]
    assert len(windows) == 2
    assert windows[0]["label"].startswith("9")
    assert windows[1]["label"].startswith("4")

    suggestions = result["suggested_slots"]
    assert len(suggestions) == 2
    assert suggestions[0]["start_time"].startswith("09")


def test_book_appointment_uses_full_slot_list_for_validation():
    tomorrow = datetime.now(pytz.UTC).astimezone(EASTERN_TZ).replace(
        hour=9, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    requested_start = tomorrow + timedelta(hours=7)

    slots = [
        _make_slot(tomorrow + timedelta(minutes=offset)) for offset in (0, 30, 60, 420)
    ]
    fake_calendar = _FakeCalendarService(slots)

    payload = handle_book_appointment(
        fake_calendar,
        customer_name="Test Guest",
        customer_phone="+15555550123",
        customer_email="guest@example.com",
        start_time=requested_start.isoformat(),
        service_type="botox",
        services_dict=TEST_SERVICES,
    )

    assert payload["success"] is True
    assert payload["event_id"] == "evt-123"
    assert requested_start.strftime("%Y-%m-%dT%H:%M") in payload["start_time"]
    assert "availability_summary" in payload
    assert fake_calendar.book_calls, "Booking should be attempted"


def test_book_appointment_returns_summary_on_mismatch():
    tomorrow = datetime.now(EASTERN_TZ).replace(
        hour=9, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    slots = [_make_slot(tomorrow + timedelta(minutes=offset)) for offset in (0, 30, 60)]
    fake_calendar = _FakeCalendarService(slots)

    payload = handle_book_appointment(
        fake_calendar,
        customer_name="Test Guest",
        customer_phone="+15555550123",
        customer_email="guest@example.com",
        start_time=(tomorrow + timedelta(hours=5)).isoformat(),
        service_type="botox",
        services_dict=TEST_SERVICES,
    )

    assert payload["success"] is False
    assert "availability_summary" in payload
    assert fake_calendar.book_calls == []
