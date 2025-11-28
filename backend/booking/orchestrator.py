from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

from booking_handlers import (
    handle_book_appointment,
    handle_cancel_appointment,
    handle_check_availability,
    handle_reschedule_appointment,
)

from .manager import SlotSelectionManager, SlotSelectionError
from .orchestrator_types import (
    BookingChannel,
    BookingContext,
    BookingResult,
    CheckAvailabilityResult,
)


class BookingOrchestrator:
    """High-level booking orchestration shared across channels.

    This class is intentionally thin and defers core business rules to the
    existing booking handlers plus the shared SlotSelectionManager. It exists
    to provide a single, typed surface for booking-related tool calls.
    """

    def __init__(
        self,
        *,
        channel: Optional[BookingChannel] = None,
        check_availability_func: Optional[Callable[..., Dict[str, Any]]] = None,
        book_appointment_func: Optional[Callable[..., Dict[str, Any]]] = None,
        reschedule_appointment_func: Optional[Callable[..., Dict[str, Any]]] = None,
        cancel_appointment_func: Optional[Callable[..., Dict[str, Any]]] = None,
    ) -> None:
        self._channel = channel
        self._check_availability_func = (
            check_availability_func or handle_check_availability
        )
        self._book_appointment_func = book_appointment_func or handle_book_appointment
        self._reschedule_appointment_func = (
            reschedule_appointment_func or handle_reschedule_appointment
        )
        self._cancel_appointment_func = (
            cancel_appointment_func or handle_cancel_appointment
        )

    @staticmethod
    def _get_db(context: BookingContext) -> Session:
        db = context.db
        if not isinstance(db, Session):  # defensive; tests may pass raw session
            return db
        return db

    # Availability ---------------------------------------------------------

    def check_availability(
        self,
        context: BookingContext,
        *,
        date: str,
        service_type: str,
        limit: Optional[int] = 10,
        tool_call_id: Optional[str] = None,
    ) -> CheckAvailabilityResult:
        """Fetch availability and register slot offers for later enforcement."""

        services = context.services_dict or {}
        payload = self._check_availability_func(
            context.calendar_service,
            date=date,
            service_type=service_type,
            limit=limit,
            services_dict=services,
        )

        db = self._get_db(context)

        if payload.get("success"):
            SlotSelectionManager.record_offers(
                db,
                context.conversation,
                tool_call_id=tool_call_id,
                arguments={"date": date, "service_type": service_type},
                output=payload,
            )
        else:
            SlotSelectionManager.clear_offers(db, context.conversation)

        return CheckAvailabilityResult.from_dict(payload)

    # Booking --------------------------------------------------------------

    def book_appointment(
        self,
        context: BookingContext,
        *,
        params: Dict[str, Any],
    ) -> BookingResult:
        """Book an appointment using previously offered slots.

        Enforces that the requested start time matches a previously recorded
        slot offer via SlotSelectionManager.enforce_booking.
        """

        db = self._get_db(context)

        selection_adjustments: Optional[Dict[str, Dict[str, Optional[str]]]] = None
        try:
            normalized_args, selection_adjustments = SlotSelectionManager.enforce_booking(
                db,
                context.conversation,
                dict(params),
            )
        except SlotSelectionError as exc:
            payload: Dict[str, Any] = {
                "success": False,
                "error": str(exc),
                "code": "slot_selection_mismatch",
                "pending_slot_options": SlotSelectionManager.pending_slot_summary(
                    db, context.conversation
                ),
            }
            return BookingResult.from_dict(payload)

        services = context.services_dict or {}

        customer_name = normalized_args.get("customer_name")
        if not customer_name and context.customer is not None:
            customer_name = getattr(context.customer, "name", None)

        customer_phone = normalized_args.get("customer_phone")
        if not customer_phone and context.customer is not None:
            customer_phone = getattr(context.customer, "phone", None)

        customer_email = normalized_args.get("customer_email")
        if not customer_email and context.customer is not None:
            customer_email = getattr(context.customer, "email", None)

        start_time = normalized_args.get("start_time") or normalized_args.get("start")

        payload = self._book_appointment_func(
            context.calendar_service,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            start_time=start_time,
            service_type=normalized_args.get("service_type"),
            provider=normalized_args.get("provider"),
            notes=normalized_args.get("notes"),
            services_dict=services,
        )

        if selection_adjustments:
            payload.setdefault("argument_adjustments", {}).update(selection_adjustments)

        return BookingResult.from_dict(payload)

    # Reschedule / cancel --------------------------------------------------

    def reschedule_appointment(
        self,
        context: BookingContext,
        *,
        appointment_id: str,
        new_start_time: str,
        service_type: Optional[str],
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reschedule an existing appointment.

        This currently forwards directly to the underlying handler and returns
        its dict payload unchanged so callers preserve existing behavior.
        """

        services = context.services_dict or {}

        return self._reschedule_appointment_func(
            context.calendar_service,
            appointment_id=appointment_id,
            new_start_time=new_start_time,
            service_type=service_type,
            provider=provider,
            services_dict=services,
        )

    def cancel_appointment(
        self,
        context: BookingContext,
        *,
        appointment_id: str,
        cancellation_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Cancel an appointment by ID (pass-through to handler)."""

        return self._cancel_appointment_func(
            context.calendar_service,
            appointment_id=appointment_id,
            cancellation_reason=cancellation_reason,
        )
