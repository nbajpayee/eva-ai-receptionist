"""Shared booking handler utilities for conversational agents."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from calendar_service import SERVICES
from config import PROVIDERS


def _normalize_iso_datetime(value: str) -> datetime:
    """Parse ISO 8601 datetime strings, handling trailing 'Z'."""
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    return datetime.fromisoformat(normalized)


def handle_check_availability(calendar_service, *, date: str, service_type: str, limit: int = 10) -> Dict[str, Any]:
    """Return available slots for the given date/service."""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid date format: {exc}"}

    try:
        slots = calendar_service.get_available_slots(target_date, service_type)
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Failed to fetch availability: {exc}"}

    service_config = SERVICES.get(service_type, {})
    return {
        "success": True,
        "available_slots": slots[:limit],
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
) -> Dict[str, Any]:
    """Book an appointment and return booking metadata."""
    try:
        start_dt = _normalize_iso_datetime(start_time)
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid start time: {exc}"}

    service_config = SERVICES.get(service_type)
    if not service_config:
        return {"success": False, "error": f"Unknown service type: {service_type}"}

    duration = service_config.get("duration_minutes", 60)
    end_dt = start_dt + timedelta(minutes=duration)

    email_value = customer_email or f"{customer_phone}@placeholder.com"

    availability = handle_check_availability(
        calendar_service,
        date=start_dt.strftime("%Y-%m-%d"),
        service_type=service_type,
        limit=10,
    )
    if not availability.get("success"):
        return {
            "success": False,
            "error": availability.get("error", "Failed to verify availability"),
            "details": availability,
        }

    available_slots = availability.get("available_slots") or []
    requested_start_iso = start_dt.isoformat()
    if not any(slot.get("start") == requested_start_iso for slot in available_slots):
        return {
            "success": False,
            "error": f"Requested start time {requested_start_iso} is not available",
            "available_slots": available_slots[:3],
            "requested_start": requested_start_iso,
        }

    try:
        event_id = calendar_service.book_appointment(
            start_time=start_dt,
            end_time=end_dt,
            customer_name=customer_name,
            customer_email=email_value,
            customer_phone=customer_phone,
            service_type=service_type,
            provider=provider,
            notes=notes,
        )
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Calendar booking failed: {exc}"}

    if not event_id:
        return {"success": False, "error": "Calendar booking failed"}

    return {
        "success": True,
        "event_id": event_id,
        "start_time": start_dt.isoformat(),
        "service": service_config.get("name", service_type),
        "service_type": service_type,
        "provider": provider,
        "duration_minutes": duration,
        "notes": notes,
    }


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
        new_start = _normalize_iso_datetime(new_start_time)
    except ValueError as exc:  # noqa: BLE001
        return {"success": False, "error": f"Invalid new start time: {exc}"}

    if not service_type:
        return {"success": False, "error": "Service type required to determine duration"}

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

    return {"success": True, "appointment_id": appointment_id, "reason": cancellation_reason}


def handle_get_service_info(*, service_type: str) -> Dict[str, Any]:
    """Fetch service metadata for conversational use."""
    service = SERVICES.get(service_type)
    if not service:
        return {"success": False, "error": "Service not found"}
    return {"success": True, "service": service}


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


def handle_get_appointment_details(calendar_service, *, appointment_id: str) -> Dict[str, Any]:
    """Fetch appointment metadata from the calendar service."""
    try:
        details = calendar_service.get_appointment_details(appointment_id)
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": f"Failed to fetch appointment details: {exc}"}

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
