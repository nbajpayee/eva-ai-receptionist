from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from database import Conversation, Customer
    from calendar_service import CalendarService


class BookingChannel(str, Enum):
    VOICE = "voice"
    SMS = "sms"
    EMAIL = "email"
    STAFF_CONSOLE = "staff_console"
    UNKNOWN = "unknown"


@dataclass
class BookingContext:
    """Context for booking operations across all channels.

    Provides all necessary dependencies and metadata for executing
    booking-related tool calls (check_availability, book_appointment,
    reschedule, cancel).
    """
    db: "Session"
    conversation: "Conversation"
    customer: Optional["Customer"]
    channel: BookingChannel
    calendar_service: "CalendarService"
    services_dict: Optional[Dict[str, Any]] = None
    now: Optional[datetime] = None

    def effective_now(self) -> datetime:
        from booking.time_utils import EASTERN_TZ

        return self.now or datetime.now(EASTERN_TZ)


@dataclass
class CheckAvailabilityResult:
    success: bool
    date: Optional[str] = None
    service_type: Optional[str] = None
    available_slots: List[Dict[str, Any]] = field(default_factory=list)
    all_slots: List[Dict[str, Any]] = field(default_factory=list)
    availability_windows: List[Dict[str, Any]] = field(default_factory=list)
    availability_summary: Optional[str] = None
    suggested_slots: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "CheckAvailabilityResult":
        return cls(
            success=bool(payload.get("success")),
            date=payload.get("date"),
            service_type=payload.get("service_type") or payload.get("service"),
            available_slots=list(payload.get("available_slots") or []),
            all_slots=list(payload.get("all_slots") or []),
            availability_windows=list(payload.get("availability_windows") or []),
            availability_summary=payload.get("availability_summary"),
            suggested_slots=list(payload.get("suggested_slots") or []),
            error=payload.get("error"),
            raw=payload,
        )

    def to_dict(self) -> Dict[str, Any]:
        data = dict(self.raw)
        data.setdefault("success", self.success)
        if self.date is not None:
            data.setdefault("date", self.date)
        if self.service_type is not None:
            data.setdefault("service_type", self.service_type)
        if "available_slots" not in data:
            data["available_slots"] = self.available_slots
        if "all_slots" not in data:
            data["all_slots"] = self.all_slots
        if "availability_windows" not in data:
            data["availability_windows"] = self.availability_windows
        if "availability_summary" not in data and self.availability_summary is not None:
            data["availability_summary"] = self.availability_summary
        if "suggested_slots" not in data:
            data["suggested_slots"] = self.suggested_slots
        if self.error is not None:
            data.setdefault("error", self.error)
        return data


@dataclass
class BookingResult:
    success: bool
    event_id: Optional[str] = None
    start_time: Optional[str] = None
    original_start_time: Optional[str] = None
    was_auto_adjusted: Optional[bool] = None
    service: Optional[str] = None
    service_type: Optional[str] = None
    provider: Optional[str] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    error: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "BookingResult":
        return cls(
            success=bool(payload.get("success")),
            event_id=payload.get("event_id"),
            start_time=payload.get("start_time"),
            original_start_time=payload.get("original_start_time"),
            was_auto_adjusted=payload.get("was_auto_adjusted"),
            service=payload.get("service"),
            service_type=payload.get("service_type"),
            provider=payload.get("provider"),
            duration_minutes=payload.get("duration_minutes"),
            notes=payload.get("notes"),
            error=payload.get("error"),
            raw=payload,
        )

    def to_dict(self) -> Dict[str, Any]:
        data = dict(self.raw)
        data.setdefault("success", self.success)
        if self.event_id is not None:
            data.setdefault("event_id", self.event_id)
        if self.start_time is not None:
            data.setdefault("start_time", self.start_time)
        if self.original_start_time is not None:
            data.setdefault("original_start_time", self.original_start_time)
        if self.was_auto_adjusted is not None:
            data.setdefault("was_auto_adjusted", self.was_auto_adjusted)
        if self.service is not None:
            data.setdefault("service", self.service)
        if self.service_type is not None:
            data.setdefault("service_type", self.service_type)
        if self.provider is not None:
            data.setdefault("provider", self.provider)
        if self.duration_minutes is not None:
            data.setdefault("duration_minutes", self.duration_minutes)
        if self.notes is not None:
            data.setdefault("notes", self.notes)
        if self.error is not None:
            data.setdefault("error", self.error)
        return data
