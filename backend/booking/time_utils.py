"""Timezone utilities shared across booking channels."""
from __future__ import annotations

from datetime import datetime

import pytz

EASTERN_TZ = pytz.timezone("America/New_York")


def parse_iso_datetime(value: str) -> datetime:
    """Parse ISO 8601 datetime strings, handling trailing 'Z'."""
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


def to_eastern(dt: datetime) -> datetime:
    """Convert datetimes to Eastern timezone, assuming naive values are local."""
    if dt.tzinfo is None:
        return EASTERN_TZ.localize(dt)
    return dt.astimezone(EASTERN_TZ)


def format_for_display(dt: datetime, *, channel: str) -> str:
    """Return human-friendly datetime string tuned per channel."""
    localized = to_eastern(dt)
    date_part = localized.strftime("%B %d, %Y").replace(" 0", " ")
    time_part = localized.strftime("%I:%M %p").lstrip("0")

    if channel == "voice":
        return f"{time_part} on {date_part}"
    return f"{date_part} at {time_part}"
