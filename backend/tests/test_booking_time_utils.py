from datetime import datetime

import pytz

from booking.time_utils import (
    EASTERN_TZ,
    format_for_display,
    parse_iso_datetime,
    to_eastern,
)


def test_parse_iso_datetime_handles_z_suffix():
    parsed = parse_iso_datetime("2025-11-16T13:30:00Z")
    assert parsed.tzinfo is not None
    assert parsed.isoformat() == "2025-11-16T13:30:00+00:00"


def test_to_eastern_from_naive():
    naive_dt = datetime(2025, 11, 16, 10, 30)
    localized = to_eastern(naive_dt)
    assert localized.tzinfo.zone == EASTERN_TZ.zone
    assert localized.hour == 10


def test_to_eastern_from_utc():
    utc_dt = datetime(2025, 11, 16, 15, 30, tzinfo=pytz.utc)
    localized = to_eastern(utc_dt)
    assert localized.tzinfo.zone == EASTERN_TZ.zone
    assert localized.hour == 10


def test_format_for_display_sms():
    source_dt = datetime(2025, 11, 16, 15, 30, tzinfo=pytz.utc)
    formatted = format_for_display(source_dt, channel="sms")
    assert formatted == "November 16, 2025 at 10:30 AM"


def test_format_for_display_voice():
    source_dt = datetime(2025, 11, 16, 15, 30, tzinfo=pytz.utc)
    formatted = format_for_display(source_dt, channel="voice")
    assert formatted == "10:30 AM on November 16, 2025"
