"""Shared booking handler utilities for conversational agents."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple

# Import SERVICES and PROVIDERS as fallbacks for backward compatibility
try:
    from config import PROVIDERS as FALLBACK_PROVIDERS
    from config import SERVICES as FALLBACK_SERVICES
except ImportError:
    FALLBACK_PROVIDERS = {}
    FALLBACK_SERVICES = {}

# Aliases for backward compatibility
SERVICES = FALLBACK_SERVICES
PROVIDERS = FALLBACK_PROVIDERS

from booking.time_utils import EASTERN_TZ, parse_iso_datetime, to_eastern


def _ensure_future_datetime(
    start_dt: datetime, reference: Optional[datetime] = None
) -> Tuple[datetime, bool]:
    """Ensure the requested start datetime is not in the past.

    Returns the adjusted datetime (always Eastern) and whether an adjustment occurred.
    """
    reference_dt = to_eastern(reference) if reference else datetime.now(EASTERN_TZ)
    candidate = to_eastern(start_dt)
    adjusted = False

    # Cap iterations to avoid infinite loops on pathological inputs (≈3 years).
    for _ in range(366 * 3):
        if candidate >= reference_dt:
            break
        candidate += timedelta(days=1)
        adjusted = True
    return candidate, adjusted


def normalize_datetime_to_future(
    value: str, *, reference: Optional[datetime] = None
) -> str:
    """Return ISO string ensured to represent a future datetime in Eastern time."""
    start_dt = parse_iso_datetime(value)
    adjusted_dt, _ = _ensure_future_datetime(start_dt, reference)
    return adjusted_dt.isoformat()


def normalize_date_to_future(
    value: str, *, reference: Optional[datetime] = None
) -> str:
    """Return YYYY-MM-DD string ensured to represent a present/future date (Eastern)."""
    try:
        parsed_date = datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError as exc:  # noqa: BLE001
        raise ValueError(f"Invalid date format: {exc}") from exc

    reference_dt = to_eastern(reference) if reference else datetime.now(EASTERN_TZ)
    candidate_date = parsed_date

    for _ in range(366 * 3):  # safety guard (~3 years)
        if candidate_date >= reference_dt.date():
            break
        candidate_date += timedelta(days=1)

    return candidate_date.strftime("%Y-%m-%d")


def _format_time_display(dt: datetime) -> str:
    localized = to_eastern(dt)
    formatted = localized.strftime("%I:%M %p").lstrip("0")
    if formatted.endswith(":00 AM"):
        formatted = formatted.replace(":00 AM", " AM")
    elif formatted.endswith(":00 PM"):
        formatted = formatted.replace(":00 PM", " PM")
    return formatted


def _build_availability_windows(
    slots: List[Dict[str, Any]],
) -> Tuple[List[Tuple[datetime, datetime]], List[Dict[str, Any]]]:
    if not slots:
        return [], []

    sorted_slots = sorted(
        [slot for slot in slots if slot.get("start") and slot.get("end")],
        key=lambda slot: slot.get("start"),
    )

    raw_windows: List[Tuple[datetime, datetime]] = []
    current_start: Optional[datetime] = None
    current_end: Optional[datetime] = None
    gap_tolerance = timedelta(minutes=5)

    for slot in sorted_slots:
        try:
            start_dt = to_eastern(parse_iso_datetime(str(slot["start"])))
            end_dt = to_eastern(parse_iso_datetime(str(slot["end"])))
        except (ValueError, TypeError):
            continue

        if current_start is None:
            current_start = start_dt
            current_end = end_dt
            continue

        assert current_end is not None  # for type checkers
        if start_dt <= current_end + gap_tolerance:
            if end_dt > current_end:
                current_end = end_dt
        else:
            raw_windows.append((current_start, current_end))
            current_start = start_dt
            current_end = end_dt

    if current_start is not None and current_end is not None:
        raw_windows.append((current_start, current_end))

    serialized_windows: List[Dict[str, Any]] = []
    for start_dt, end_dt in raw_windows:
        start_label = _format_time_display(start_dt)
        end_label = _format_time_display(end_dt)
        if start_label == end_label:
            compact = start_label
            spoken = start_label
        else:
            compact = f"{start_label}-{end_label}"
            spoken = f"{start_label} to {end_label}"
        serialized_windows.append(
            {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "start_time": start_label,
                "end_time": end_label,
                "label": compact,
                "spoken_label": spoken,
            }
        )

    return raw_windows, serialized_windows


def _availability_summary_text(windows: List[Dict[str, Any]]) -> str:
    if not windows:
        return "Were fully booked for that day."

    segments = [window["spoken_label"] for window in windows]
    if len(segments) == 1:
        return f"We have availability from {segments[0]}."
    if len(segments) == 2:
        return f"We have availability from {segments[0]} and {segments[1]}."
    joined = ", ".join(segments[:-1]) + f", and {segments[-1]}"
    return f"We have availability from {joined}."


def _suggested_slots(
    slots: List[Dict[str, Any]], raw_windows: List[Tuple[datetime, datetime]]
) -> List[Dict[str, Any]]:
    if not slots:
        return []

    def _compact(slot: Dict[str, Any]) -> Dict[str, Any]:
        label = slot.get("start_time")
        if not label and slot.get("start"):
            try:
                label = _format_time_display(parse_iso_datetime(str(slot["start"])))
            except (ValueError, TypeError):
                label = None
        compact_slot = {
            "start": slot.get("start"),
            "end": slot.get("end"),
            "start_time": label or slot.get("start_time"),
            "end_time": slot.get("end_time"),
        }
        return compact_slot

    seen_starts: set[str] = set()
    selections: List[Dict[str, Any]] = []

    first_slot = slots[0]
    first_start = str(first_slot.get("start")) if first_slot.get("start") else None
    if first_start:
        seen_starts.add(first_start)
    selections.append(_compact(first_slot))

    if len(slots) == 1:
        return selections

    if len(raw_windows) > 1:
        second_window_start = raw_windows[1][0]
        for slot in slots:
            start_value = slot.get("start")
            if not start_value:
                continue
            try:
                slot_start = to_eastern(parse_iso_datetime(str(start_value)))
            except (ValueError, TypeError):
                continue
            if slot_start >= second_window_start:
                if start_value not in seen_starts:
                    seen_starts.add(start_value)
                    selections.append(_compact(slot))
                break
    if len(selections) < 2:
        mid_index = max(1, len(slots) // 2)
        mid_slot = slots[mid_index]
        start_value = mid_slot.get("start")
        if not start_value or start_value not in seen_starts:
            if start_value:
                seen_starts.add(start_value)
            selections.append(_compact(mid_slot))

    return selections[:2]


def handle_check_availability(
    calendar_service,
    *,
    date: str,
    service_type: str,
    limit: Optional[int] = 10,
    services_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Return available slots for the given date/service."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid date format: {exc}"}

    try:
        slots = calendar_service.get_available_slots(
            target_date, service_type, services_dict=services_dict
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Failed to fetch availability: {exc}"}

    # Filter out past slots (only show future times)
    now = datetime.now(EASTERN_TZ)
    future_slots = []
    for slot in slots:
        slot_start = slot.get("start")
        if slot_start:
            try:
                slot_dt = parse_iso_datetime(slot_start)
                slot_dt_eastern = to_eastern(slot_dt)
                # Only include slots that are in the future
                if slot_dt_eastern > now:
                    future_slots.append(slot)
            except (ValueError, AttributeError):
                # If we can't parse the slot time, skip it
                continue

    future_slots = sorted(
        future_slots,
        key=lambda slot: slot.get("start") or slot.get("start_time") or "",
    )

    raw_windows, serialized_windows = _build_availability_windows(future_slots)
    summary_text = _availability_summary_text(serialized_windows)
    suggestions = _suggested_slots(future_slots, raw_windows)

    limited_slots = future_slots
    if limit is not None and limit > 0:
        limited_slots = future_slots[:limit]

    services = services_dict if services_dict is not None else FALLBACK_SERVICES
    service_config = services.get(service_type, {})
    return {
        "success": True,
        "available_slots": limited_slots,
        "all_slots": future_slots,
        "availability_windows": serialized_windows,
        "availability_summary": summary_text,
        "suggested_slots": suggestions,
        "date": date,
        "service": service_config.get("name", service_type),
    }


def handle_book_appointment(
    calendar_service,
    *,
    customer_name: str,
    customer_phone: str,
    customer_email: Optional[str],
    start_time: str,
    service_type: str,
    provider: Optional[str] = None,
    notes: Optional[str] = None,
    services_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Book an appointment and return booking metadata."""
    try:
        start_dt_original = parse_iso_datetime(start_time)
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid start time: {exc}"}

    start_dt, was_adjusted = _ensure_future_datetime(start_dt_original)

    services = services_dict if services_dict is not None else FALLBACK_SERVICES
    service_config = services.get(service_type)
    if not service_config:
        return {"success": False, "error": f"Unknown service type: {service_type}"}

    duration = service_config.get("duration_minutes", 60)
    end_dt = start_dt + timedelta(minutes=duration)

    email_value = customer_email or f"{customer_phone}@placeholder.com"

    availability = handle_check_availability(
        calendar_service,
        date=start_dt.strftime("%Y-%m-%d"),
        service_type=service_type,
        limit=None,
    )
    if not availability.get("success"):
        return {
            "success": False,
            "error": availability.get("error", "Failed to verify availability"),
            "details": availability,
        }

    available_slots = (
        availability.get("all_slots") or availability.get("available_slots") or []
    )
    requested_start_iso = start_dt.isoformat()

    def _slot_matches_request(slot_start: str, requested: datetime) -> bool:
        if not slot_start:
            return False
        try:
            slot_dt = parse_iso_datetime(slot_start)
        except ValueError:
            return False

        # Compare in naive form to avoid timezone-string mismatches when AI-provided
        # ISO strings omit offsets but calendar slots include them.
        return slot_dt.replace(tzinfo=None) == requested.replace(tzinfo=None)

    if not any(
        _slot_matches_request(slot.get("start"), start_dt) for slot in available_slots
    ):
        error_payload = {
            "success": False,
            "error": f"Requested start time {requested_start_iso} is not available",
            "available_slots": available_slots[:3],
            "requested_start": requested_start_iso,
        }
        if availability.get("availability_summary"):
            error_payload["availability_summary"] = availability["availability_summary"]
        if availability.get("availability_windows"):
            error_payload["availability_windows"] = availability["availability_windows"]
        return error_payload

    try:
        event_id = calendar_service.book_appointment(
            start_time=start_dt,
            end_time=end_dt,
            customer_name=customer_name,
            customer_email=email_value,
            customer_phone=customer_phone,
            service_type=service_type,
            services_dict=services_dict,
            provider=provider,
            notes=notes,
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Calendar booking failed: {exc}"}

    if not event_id:
        return {"success": False, "error": "Calendar booking failed"}

    success_payload = {
        "success": True,
        "event_id": event_id,
        "start_time": start_dt.isoformat(),
        "original_start_time": start_dt_original.isoformat(),
        "was_auto_adjusted": was_adjusted,
        "service": service_config.get("name", service_type),
        "service_type": service_type,
        "provider": provider,
        "duration_minutes": duration,
        "notes": notes,
    }
    if availability.get("availability_summary"):
        success_payload["availability_summary"] = availability["availability_summary"]
    if availability.get("availability_windows"):
        success_payload["availability_windows"] = availability["availability_windows"]
    if availability.get("suggested_slots"):
        success_payload["suggested_slots"] = availability["suggested_slots"]
    return success_payload


def handle_reschedule_appointment(
    calendar_service,
    *,
    appointment_id: str,
    new_start_time: str,
    service_type: Optional[str],
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """Reschedule an appointment to a new start time."""
    try:
        new_start = parse_iso_datetime(new_start_time)
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid new start time: {exc}"}

    if not service_type:
        return {
            "success": False,
            "error": "Service type required to determine duration",
        }

    service_config = SERVICES.get(service_type)
    if not service_config:
        return {"success": False, "error": f"Unknown service type: {service_type}"}

    duration = service_config.get("duration_minutes", 60)
    new_end = new_start + timedelta(minutes=duration)

    try:
        success = calendar_service.reschedule_appointment(
            event_id=appointment_id,
            new_start_time=new_start,
            new_end_time=new_end,
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Reschedule failed: {exc}"}

    if not success:
        return {"success": False, "error": "Calendar reschedule failed"}

    return {
        "success": True,
        "appointment_id": appointment_id,
        "start_time": new_start.isoformat(),
        "service": service_config.get("name", service_type),
        "service_type": service_type,
        "provider": provider,
        "duration_minutes": duration,
    }


def handle_cancel_appointment(
    calendar_service,
    *,
    appointment_id: str,
    cancellation_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Cancel an appointment by ID."""
    try:
        success = calendar_service.cancel_appointment(event_id=appointment_id)
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Cancellation failed: {exc}"}

    if not success:
        return {"success": False, "error": "Calendar cancellation failed"}

    return {
        "success": True,
        "appointment_id": appointment_id,
        "reason": cancellation_reason,
    }


def handle_get_service_info(*, service_type: str) -> Dict[str, Any]:
    """Fetch service metadata for conversational use."""
    # First try exact match (case-insensitive)
    service_type_lower = service_type.lower()

    # Try direct lookup with normalized key
    service = SERVICES.get(service_type_lower)
    if service:
        return {"success": True, "service": service}

    # Try fuzzy matching on service names and common aliases
    aliases = {
        "botox": ["botox", "botulinum toxin", "botulinum toxin treatment", "neurotoxin"],
        "dermal_fillers": ["dermal fillers", "fillers", "hyaluronic acid", "juvederm", "restylane"],
        "laser_hair_removal": ["laser hair removal", "laser hair", "hair removal"],
        "chemical_peels": ["chemical peels", "chemical peel", "peel"],
        "microneedling": ["microneedling", "micro needling", "collagen induction"],
        "hydrafacial": ["hydrafacial", "hydra facial", "facial"],
        "prp_therapy": ["prp", "prp therapy", "platelet rich plasma", "vampire facial"],
        "coolsculpting": ["coolsculpting", "cool sculpting", "cryolipolysis", "fat freezing"],
        "medical_grade_facials": ["medical grade facial", "medical facial", "medical grade facials"],
    }

    # Search through aliases
    for service_key, alias_list in aliases.items():
        for alias in alias_list:
            if alias in service_type_lower:
                service = SERVICES.get(service_key)
                if service:
                    return {"success": True, "service": service}

    return {"success": False, "error": "Service not found"}


def handle_get_provider_info(*, provider_name: Optional[str] = None) -> Dict[str, Any]:
    """Fetch provider details; with no name, return full roster."""
    if provider_name:
        provider = PROVIDERS.get(provider_name)
        if not provider:
            return {"success": False, "error": "Provider not found"}
        return {"success": True, "provider": provider}

    return {"success": True, "providers": list(PROVIDERS.values())}


def handle_search_customer(*, phone: str) -> Dict[str, Any]:
    """Placeholder customer search handler (extend for production)."""
    # Messaging flow will replace this with real DB lookup in future.
    return {
        "success": True,
        "found": False,
        "message": "No existing customer found with this phone number",
        "phone": phone,
    }


def handle_get_appointment_details(
    calendar_service, *, appointment_id: str
) -> Dict[str, Any]:
    """Fetch appointment metadata from the calendar service."""
    try:
        details = calendar_service.get_appointment_details(appointment_id)
    except Exception as exc:  # noqa: BLE001
        return {
            "success": False,
            "error": f"Failed to fetch appointment details: {exc}",
        }

    if not details:
        return {"success": False, "error": "Appointment not found"}

    start_value = details.get("start")
    end_value = details.get("end")

    if hasattr(start_value, "isoformat"):
        start_value = start_value.isoformat()
    if hasattr(end_value, "isoformat"):
        end_value = end_value.isoformat()

    return {
        "success": True,
        "appointment": {
            "id": details.get("id"),
            "summary": details.get("summary"),
            "description": details.get("description"),
            "start": start_value,
            "end": end_value,
            "status": details.get("status"),
        },
    }
