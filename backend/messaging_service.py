"""Helper utilities for omnichannel messaging console flows."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified

import pytz

from analytics import AnalyticsService, openai_client
from booking_handlers import (
    handle_book_appointment,
    handle_cancel_appointment,
    handle_check_availability,
    handle_get_appointment_details,
    handle_get_provider_info,
    handle_get_service_info,
    handle_reschedule_appointment,
    handle_search_customer,
    normalize_date_to_future,
    normalize_datetime_to_future,
)
from booking_tools import get_booking_tools
from calendar_service import get_calendar_service
from config import get_settings, SERVICES
from database import Conversation, Customer, CommunicationMessage, Appointment
from prompts import get_system_prompt
from booking.time_utils import parse_iso_datetime, format_for_display, EASTERN_TZ
from booking.manager import SlotSelectionManager, SlotSelectionError

logger = logging.getLogger(__name__)

settings = get_settings()


class MessagingService:
    """Domain helpers for messaging console interactions."""

    _calendar_service_instance = None
    _calendar_credentials_logged = False

    @staticmethod
    def _coerce_phone(channel: str, customer_phone: Optional[str], customer_email: Optional[str]) -> Optional[str]:
        """Ensure we always have a phone value for customer records.

        The customers table requires a unique, non-null phone. For email-only tests,
        use a deterministic placeholder derived from the email address.
        """
        if customer_phone:
            return customer_phone
        if channel == "email" and customer_email:
            digest = hashlib.sha1(customer_email.lower().encode("utf-8")).hexdigest()[:10]
            return f"email:{digest}"
        return None

    @staticmethod
    def find_or_create_customer(
        db: Session,
        *,
        channel: str,
        customer_name: str,
        customer_phone: Optional[str],
        customer_email: Optional[str],
    ) -> Customer:
        phone_value = MessagingService._coerce_phone(channel, customer_phone, customer_email)
        if not phone_value:
            raise HTTPException(status_code=422, detail="customer_phone or customer_email is required")

        customer = (
            db.query(Customer)
            .filter(Customer.phone == phone_value)
            .first()
        )

        if customer:
            # Update name/email if missing to keep data fresh
            updated = False
            if customer_email and customer.email != customer_email:
                customer.email = customer_email
                updated = True
            if customer_name and customer.name != customer_name:
                customer.name = customer_name
                updated = True
            if updated:
                db.commit()
                db.refresh(customer)
            return customer

        customer = Customer(
            name=customer_name or "Unknown",
            phone=phone_value,
            email=customer_email,
            is_new_client=True,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    # ------------------------------------------------------------------
    # Calendar helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_calendar_service():
        """Return a reusable calendar service instance with safe fallback."""
        if MessagingService._calendar_service_instance is not None:
            return MessagingService._calendar_service_instance

        if not MessagingService._calendar_credentials_logged:
            credentials_exists = os.path.exists(settings.GOOGLE_CREDENTIALS_FILE)
            token_exists = os.path.exists(settings.GOOGLE_TOKEN_FILE)
            logger.info(
                "Google Calendar credential status (env=%s): credentials=%s, token=%s",
                settings.ENV,
                credentials_exists,
                token_exists,
            )
            if not credentials_exists or not token_exists:
                logger.warning(
                    "Google Calendar credential files missing (credentials=%s, token=%s)",
                    credentials_exists,
                    token_exists,
                )
            MessagingService._calendar_credentials_logged = True

        credentials_exists = os.path.exists(settings.GOOGLE_CREDENTIALS_FILE)
        token_exists = os.path.exists(settings.GOOGLE_TOKEN_FILE)

        try:
            service = get_calendar_service()
            logger.info("Using Google Calendar service (env=%s)", settings.ENV)
        except Exception as exc:  # noqa: BLE001
            logger.critical(
                "Google Calendar initialization failed (env=%s, credentials=%s, token=%s): %s",
                settings.ENV,
                credentials_exists,
                token_exists,
                exc,
            )
            raise RuntimeError("Calendar service unavailable") from exc

        MessagingService._calendar_service_instance = service
        return MessagingService._calendar_service_instance

    @staticmethod
    def _format_start_for_channel(dt: datetime, channel: str) -> str:
        return format_for_display(dt, channel=channel)

    @staticmethod
    def build_booking_confirmation_message(*, channel: str, tool_output: Dict[str, Any]) -> Optional[str]:
        start_iso = tool_output.get("start_time")
        service_label = tool_output.get("service") or tool_output.get("service_type")
        if not start_iso:
            return None

        try:
            start_dt = parse_iso_datetime(start_iso)
        except ValueError:
            return None

        formatted_datetime = MessagingService._format_start_for_channel(start_dt, channel)
        provider = tool_output.get("provider") or None
        auto_adjusted = tool_output.get("was_auto_adjusted")

        if not service_label:
            service_label = "Your appointment"

        if provider:
            service_phrase = f"{service_label} with {provider}"
        else:
            service_phrase = service_label

        message = f"✓ Booked! {service_phrase} on {formatted_datetime}."

        if auto_adjusted:
            message += " The requested time was unavailable, so I reserved the next available opening for you."

        message += " You'll get a confirmation text soon. Just a reminder, we require 24 hours notice for cancellations or reschedules. Anything else I can help with?"
        return message

    @staticmethod
    def _normalize_tool_arguments(tool_name: Optional[str], arguments: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Optional[str]]]]:
        if not arguments:
            return {}, {}

        normalized = {k: v for k, v in arguments.items()}
        adjustments: Dict[str, Dict[str, Optional[str]]] = {}
        reference = datetime.now(EASTERN_TZ)

        def _set(field: str, new_value: str) -> None:
            original_value = normalized.get(field)
            if original_value == new_value:
                return
            adjustments[field] = {
                "original": str(original_value) if original_value is not None else None,
                "normalized": str(new_value),
            }
            normalized[field] = new_value

        if not tool_name:
            return normalized, adjustments

        try:
            if tool_name == "check_availability":
                date_value = normalized.get("date")
                if date_value:
                    try:
                        new_date = normalize_date_to_future(str(date_value), reference=reference)
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    _set("date", new_date)

            elif tool_name == "book_appointment":
                for key in ("start_time", "start"):
                    if normalized.get(key):
                        try:
                            new_dt = normalize_datetime_to_future(str(normalized[key]), reference=reference)
                        except ValueError:
                            new_dt = normalize_datetime_to_future(reference.isoformat(), reference=reference)
                        _set(key, new_dt)
                        normalized["start_time"] = new_dt
                if normalized.get("date"):
                    try:
                        new_date = normalize_date_to_future(str(normalized["date"]), reference=reference)
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    _set("date", new_date)

            elif tool_name == "reschedule_appointment":
                for key in ("new_start_time", "start_time", "start"):
                    if normalized.get(key):
                        try:
                            new_dt = normalize_datetime_to_future(str(normalized[key]), reference=reference)
                        except ValueError:
                            new_dt = normalize_datetime_to_future(reference.isoformat(), reference=reference)
                        _set(key, new_dt)
                        if key != "new_start_time":
                            normalized["new_start_time"] = new_dt
                if normalized.get("date"):
                    try:
                        new_date = normalize_date_to_future(str(normalized["date"]), reference=reference)
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    _set("date", new_date)

        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to normalize arguments for tool %s: %s", tool_name, exc)

        return normalized, adjustments

    @staticmethod
    def _build_history(conversation: Conversation, channel: str) -> List[Dict[str, Any]]:
        prompt = get_system_prompt(channel)

        history: List[Dict[str, Any]] = [
            {"role": "system", "content": prompt},
        ]

        def _message_sort_key(message: CommunicationMessage) -> datetime:
            return (
                message.sent_at
                or conversation.last_activity_at
                or conversation.initiated_at
                or datetime.utcnow()
            )

        ordered_messages = sorted(conversation.messages, key=_message_sort_key)
        for message in ordered_messages:
            role = "user" if message.direction == "inbound" else "assistant"
            content = message.content or ""
            history.append({"role": role, "content": content})

        return history

    @staticmethod
    def _fallback_response(channel: str) -> str:
        if channel == "sms":
            return "Ava (AI assistant) is currently unavailable. We'll follow up shortly."
        return "Hello! Ava here — I'm offline at the moment, but we'll reply with more details soon."

    @staticmethod
    def _tool_context_messages(assistant_message: Any, tool_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if assistant_message is None:
            return []

        context: List[Dict[str, Any]] = []
        content_text = (getattr(assistant_message, "content", "") or "").strip()
        assistant_entry: Dict[str, Any] = {"role": "assistant", "content": content_text}

        tool_calls_payload: List[Dict[str, Any]] = []
        for call in getattr(assistant_message, "tool_calls", []) or []:
            function_payload = {}
            function_obj = getattr(call, "function", None)
            if function_obj is not None:
                function_payload = {
                    "name": getattr(function_obj, "name", None),
                    "arguments": getattr(function_obj, "arguments", ""),
                }
            tool_calls_payload.append(
                {
                    "id": getattr(call, "id", None),
                    "type": getattr(call, "type", None),
                    "function": function_payload,
                }
            )

        if tool_calls_payload:
            assistant_entry["tool_calls"] = tool_calls_payload

        context.append(assistant_entry)

        for result in tool_results:
            output_payload = result.get("output")

            if isinstance(output_payload, dict):
                sanitized_output = dict(output_payload)
                original_start = sanitized_output.pop("original_start_time", None)
                if original_start and sanitized_output.get("start_time") and sanitized_output["start_time"] != original_start:
                    sanitized_output.setdefault(
                        "note",
                        "Start time automatically adjusted to the next available future slot.",
                    )
            else:
                sanitized_output = output_payload

            adjustments = result.get("argument_adjustments") or {}
            if adjustments:
                sanitized_output = (
                    dict(sanitized_output)
                    if isinstance(sanitized_output, dict)
                    else {"value": sanitized_output}
                )
                sanitized_output.setdefault("argument_adjustments", adjustments)

            slot_offers = result.get("slot_offers")
            if slot_offers:
                sanitized_output = (
                    dict(sanitized_output)
                    if isinstance(sanitized_output, dict)
                    else {"value": sanitized_output}
                )
                sanitized_output.setdefault("slot_offers", slot_offers)

            try:
                content_json = json.dumps(sanitized_output, default=str)
            except (TypeError, ValueError) as exc:
                logger.warning("Failed to serialize tool output for %s: %s", result.get("name"), exc)
                content_json = json.dumps(
                    {
                        "repr": repr(sanitized_output),
                        "type": type(sanitized_output).__name__,
                        "error": "serialization_failed",
                    }
                )

            context.append(
                {
                    "role": "tool",
                    "tool_call_id": result.get("tool_call_id"),
                    "name": result.get("name"),
                    "content": content_json,
                }
            )

        return context

    @staticmethod
    def _update_customer_from_arguments(db: Session, customer: Customer, arguments: Dict[str, Any]) -> None:
        updated = False

        name_arg = arguments.get("customer_name")
        if name_arg and name_arg != customer.name:
            customer.name = name_arg
            updated = True

        phone_arg = arguments.get("customer_phone")
        if phone_arg and phone_arg != customer.phone:
            canonical_phone = phone_arg.strip()

            # If this number already belongs to another customer, keep the existing
            # value to avoid unique constraint violations (front-end should merge
            # records instead of overwriting mid-conversation).
            existing_owner = (
                db.query(Customer)
                .filter(Customer.phone == canonical_phone, Customer.id != customer.id)
                .first()
            )

            if existing_owner is None:
                customer.phone = canonical_phone
                updated = True

        email_arg = arguments.get("customer_email")
        if email_arg and email_arg != customer.email:
            customer.email = email_arg
            updated = True

        if updated:
            db.commit()
            db.refresh(customer)

    # ------------------------------------------------------------------
    # Tool execution helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _execute_tool_call(
        *,
        db: Session,
        conversation: Conversation,
        customer: Customer,
        calendar_service,
        call: Any,
    ) -> Dict[str, Any]:
        name = getattr(call.function, "name", None) if getattr(call, "function", None) else None
        arguments_raw = getattr(call.function, "arguments", "{}") if getattr(call, "function", None) else "{}"
        try:
            arguments = json.loads(arguments_raw) if arguments_raw else {}
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse tool arguments for %s: %s", name, exc)
            arguments = {}

        result: Dict[str, Any] = {
            "tool_call_id": getattr(call, "id", None),
            "name": name,
            "arguments": arguments,
            "output": None,
        }

        if not name:
            result["output"] = {"success": False, "error": "Missing tool name"}
            return result

        selection_adjustments: Optional[Dict[str, Dict[str, Optional[str]]]] = None
        try:
            if name == "check_availability":
                output = handle_check_availability(
                    calendar_service,
                    date=arguments.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                    service_type=arguments.get("service_type", ""),
                )
                if output.get("success"):
                    SlotSelectionManager.record_offers(
                        db,
                        conversation,
                        tool_call_id=result.get("tool_call_id"),
                        arguments=arguments,
                        output=output,
                    )
                else:
                    SlotSelectionManager.clear_offers(db, conversation)
                result["slot_offers"] = SlotSelectionManager.pending_slot_summary(db, conversation)
            elif name == "book_appointment":
                # AI may collect updated customer details mid-conversation; persist them before booking.
                try:
                    arguments, selection_adjustments = SlotSelectionManager.enforce_booking(
                        db,
                        conversation,
                        arguments,
                    )
                except SlotSelectionError as exc:
                    output = {
                        "success": False,
                        "error": str(exc),
                        "code": "slot_selection_mismatch",
                        "pending_slot_options": SlotSelectionManager.pending_slot_summary(db, conversation),
                    }
                else:
                    MessagingService._update_customer_from_arguments(db, customer, arguments)
                    output = handle_book_appointment(
                        calendar_service,
                        customer_name=arguments.get("customer_name", customer.name),
                        customer_phone=arguments.get("customer_phone", customer.phone or ""),
                        customer_email=arguments.get("customer_email", customer.email),
                        start_time=arguments.get("start_time", arguments.get("start")),
                        service_type=arguments.get("service_type"),
                        provider=arguments.get("provider"),
                        notes=arguments.get("notes"),
                    )
                result["slot_offers"] = SlotSelectionManager.pending_slot_summary(db, conversation)
            elif name == "reschedule_appointment":
                output = handle_reschedule_appointment(
                    calendar_service,
                    appointment_id=arguments.get("appointment_id"),
                    new_start_time=arguments.get("new_start_time") or arguments.get("start_time") or arguments.get("start"),
                    service_type=arguments.get("service_type"),
                    provider=arguments.get("provider"),
                )
            elif name == "cancel_appointment":
                output = handle_cancel_appointment(
                    calendar_service,
                    appointment_id=arguments.get("appointment_id"),
                    cancellation_reason=arguments.get("cancellation_reason"),
                )
            elif name == "get_appointment_details":
                output = handle_get_appointment_details(
                    calendar_service,
                    appointment_id=arguments.get("appointment_id"),
                )
            elif name == "get_service_info":
                output = handle_get_service_info(
                    service_type=arguments.get("service_type"),
                )
            elif name == "get_provider_info":
                output = handle_get_provider_info(
                    provider_name=arguments.get("provider_name"),
                )
            elif name == "search_customer":
                output = handle_search_customer(
                    phone=arguments.get("phone", ""),
                )
            else:
                output = {"success": False, "error": f"Unsupported tool: {name}"}
        except Exception as exc:  # noqa: BLE001
            logger.exception("Tool %s execution failed: %s", name, exc)
            output = {"success": False, "error": str(exc)}

        result["output"] = output

        if selection_adjustments:
            result.setdefault("argument_adjustments", {}).update(selection_adjustments)

        if result.get("name") in {"book_appointment", "reschedule_appointment", "cancel_appointment"}:
            if (result.get("output") or {}).get("success"):
                booking_action_success = True
            MessagingService._apply_booking_tool_side_effects(
                db=db,
                conversation=conversation,
                customer=customer,
                tool_name=name,
                arguments=arguments,
                output=output,
            )
        return result

    @staticmethod
    def _apply_booking_tool_side_effects(
        *,
        db: Session,
        conversation: Conversation,
        customer: Customer,
        tool_name: str,
        arguments: Dict[str, Any],
        output: Dict[str, Any],
    ) -> None:
        if not output or not output.get("success"):
            return

        metadata = SlotSelectionManager.conversation_metadata(conversation)
        commit_required = False

        if tool_name == "book_appointment":
            event_id = output.get("event_id")
            start_iso = output.get("start_time") or arguments.get("start_time") or arguments.get("start")
            service_type = output.get("service_type") or arguments.get("service_type")
            if not event_id or not start_iso or not service_type:
                return

            try:
                start_time = MessagingService._parse_iso_datetime(start_iso)
            except ValueError as exc:  # noqa: BLE001
                logger.warning("Failed to parse start_time for booking side effects: %s", exc)
                return

            service_config = SERVICES.get(service_type)
            duration = output.get("duration_minutes")
            if duration is None:
                duration = service_config.get("duration_minutes", 60) if service_config else 60

            provider = output.get("provider") or arguments.get("provider")
            notes = arguments.get("notes")

            appointment = (
                db.query(Appointment)
                .filter(Appointment.calendar_event_id == event_id)
                .first()
            )

            if appointment is None:
                appointment = Appointment(
                    customer_id=customer.id,
                    calendar_event_id=event_id,
                    appointment_datetime=start_time,
                    service_type=service_type,
                    provider=provider,
                    duration_minutes=duration,
                    status="scheduled",
                    booked_by="ai",
                    special_requests=notes,
                )
                db.add(appointment)
            else:
                appointment.appointment_datetime = start_time
                appointment.service_type = service_type
                appointment.provider = provider
                appointment.duration_minutes = duration
                appointment.status = "scheduled"
                appointment.special_requests = notes
                appointment.cancellation_reason = None
                appointment.cancelled_at = None

            metadata["last_appointment"] = {
                "calendar_event_id": event_id,
                "service_type": service_type,
                "provider": provider,
                "start_time": start_time.isoformat(),
                "status": "scheduled",
            }
            commit_required = True
            SlotSelectionManager.clear_offers(db, conversation)

        elif tool_name == "reschedule_appointment":
            appointment_id = output.get("appointment_id") or arguments.get("appointment_id")
            new_start_iso = output.get("start_time") or arguments.get("new_start_time") or arguments.get("start_time") or arguments.get("start")
            service_type = output.get("service_type") or arguments.get("service_type")
            if not appointment_id or not new_start_iso or not service_type:
                return

            try:
                new_start = MessagingService._parse_iso_datetime(new_start_iso)
            except ValueError as exc:  # noqa: BLE001
                logger.warning("Failed to parse new_start for reschedule side effects: %s", exc)
                return

            service_config = SERVICES.get(service_type)
            duration = output.get("duration_minutes")
            if duration is None:
                duration = service_config.get("duration_minutes", 60) if service_config else 60

            provider = output.get("provider") or arguments.get("provider")

            appointment = (
                db.query(Appointment)
                .filter(Appointment.calendar_event_id == appointment_id)
                .first()
            )

            if appointment is None:
                appointment = Appointment(
                    customer_id=customer.id,
                    calendar_event_id=appointment_id,
                    appointment_datetime=new_start,
                    service_type=service_type,
                    provider=provider,
                    duration_minutes=duration,
                    status="scheduled",
                    booked_by="ai",
                )
                db.add(appointment)
            else:
                appointment.appointment_datetime = new_start
                appointment.service_type = service_type
                appointment.provider = provider
                appointment.duration_minutes = duration
                appointment.status = "scheduled"
                appointment.cancellation_reason = None
                appointment.cancelled_at = None

            metadata["last_appointment"] = {
                "calendar_event_id": appointment_id,
                "service_type": service_type,
                "provider": provider,
                "start_time": new_start.isoformat(),
                "status": "scheduled",
            }
            commit_required = True

        elif tool_name == "cancel_appointment":
            appointment_id = output.get("appointment_id") or arguments.get("appointment_id")
            if not appointment_id:
                return

            appointment = (
                db.query(Appointment)
                .filter(Appointment.calendar_event_id == appointment_id)
                .first()
            )

            cancellation_reason = output.get("reason") or output.get("cancellation_reason") or arguments.get("cancellation_reason")

            if appointment:
                appointment.status = "cancelled"
                appointment.cancellation_reason = cancellation_reason
                appointment.cancelled_at = datetime.utcnow()

            metadata["last_appointment"] = {
                "calendar_event_id": appointment_id,
                "status": "cancelled",
                "cancellation_reason": cancellation_reason,
            }
            commit_required = True
            SlotSelectionManager.clear_offers(db, conversation)

        if commit_required:
            SlotSelectionManager.persist_conversation_metadata(db, conversation, metadata)


    @staticmethod
    def find_active_conversation(db: Session, *, customer_id: int, channel: str) -> Optional[Conversation]:
        return (
            db.query(Conversation)
            .filter(
                Conversation.customer_id == customer_id,
                Conversation.channel == channel,
                Conversation.status == "active",
            )
            .order_by(Conversation.last_activity_at.desc())
            .first()
        )

    @staticmethod
    def create_conversation(
        db: Session,
        *,
        customer_id: Optional[int],
        channel: str,
        subject: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Conversation:
        conversation = AnalyticsService.create_conversation(
            db=db,
            customer_id=customer_id,
            channel=channel,
            metadata=metadata,
        )
        if subject:
            conversation.subject = subject
            db.commit()
            db.refresh(conversation)
        return conversation

    @staticmethod
    def add_customer_message(
        db: Session,
        *,
        conversation: Conversation,
        content: str,
        metadata: Optional[dict] = None,
    ) -> CommunicationMessage:
        message = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="inbound",
            content=content,
            sent_at=datetime.utcnow(),
            metadata=metadata or {},
        )
        SlotSelectionManager.capture_selection(db, conversation, message)
        return message

    @staticmethod
    def add_assistant_message(
        db: Session,
        *,
        conversation: Conversation,
        content: str,
        metadata: Optional[dict] = None,
    ) -> CommunicationMessage:
        message = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="outbound",
            content=content,
            sent_at=datetime.utcnow(),
            metadata=metadata or {},
        )
        return message

    @staticmethod
    def generate_ai_response(
        db: Session,
        conversation_id: UUID,
        channel: str,
    ) -> tuple[str, Any | None]:
        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.id == conversation_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        history = MessagingService._build_history(conversation, channel)
        max_tokens = 500 if channel == "sms" else 1000

        try:
            if not settings.OPENAI_API_KEY:
                raise RuntimeError("OPENAI_API_KEY not configured")

            response = openai_client.chat.completions.create(
                model=settings.OPENAI_MESSAGING_MODEL,
                messages=history,
                temperature=0.3,
                max_tokens=max_tokens,
                tools=get_booking_tools(),
                tool_choice="auto",
            )
            message = response.choices[0].message
            text_content = (message.content or "").strip()
            return text_content, message
        except Exception as exc:  # noqa: BLE001 - fall back gracefully for local dev
            logger.warning("Failed to generate AI response via OpenAI: %s", exc)
            return MessagingService._fallback_response(channel), None

    @staticmethod
    def generate_followup_response(
        db: Session,
        conversation_id: UUID,
        channel: str,
        assistant_message: Any,
        tool_results: List[Dict[str, Any]],
    ) -> tuple[str, Any | None]:
        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.id == conversation_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        history = MessagingService._build_history(conversation, channel)
        history.extend(MessagingService._tool_context_messages(assistant_message, tool_results))
        max_tokens = 500 if channel == "sms" else 1000

        try:
            response = openai_client.chat.completions.create(
                model=settings.OPENAI_MESSAGING_MODEL,
                messages=history,
                temperature=0.3,
                max_tokens=max_tokens,
                tools=get_booking_tools(),
                tool_choice="none",
            )
            message = response.choices[0].message
            text_content = (message.content or "").strip()
            return text_content, message
        except Exception as exc:  # noqa: BLE001 - fall back gracefully for local dev
            logger.warning("Failed to generate follow-up AI response: %s", exc)
            return MessagingService._fallback_response(channel), None

    @staticmethod
    def sms_metadata_for_customer(customer_phone: str) -> Dict[str, Any]:
        return {
            "from_number": customer_phone,
            "to_number": settings.MED_SPA_PHONE,
            "provider_message_id": f"test-{uuid4()}",
            "delivery_status": "sent",
        }

    @staticmethod
    def sms_metadata_for_assistant(customer_phone: str) -> Dict[str, Any]:
        return {
            "from_number": settings.MED_SPA_PHONE,
            "to_number": customer_phone,
            "provider_message_id": f"test-{uuid4()}",
            "delivery_status": "sent",
        }

    @staticmethod
    def email_metadata_for_customer(customer_email: str, subject: Optional[str], body_text: str) -> Dict[str, Any]:
        return {
            "subject": subject or "Message from Luxury Med Spa",
            "from_address": customer_email,
            "to_address": settings.MED_SPA_EMAIL,
            "body_text": body_text,
        }

    @staticmethod
    def email_metadata_for_assistant(customer_email: str, subject: Optional[str], body_text: str) -> Dict[str, Any]:
        return {
            "subject": subject or "Message from Luxury Med Spa",
            "from_address": settings.MED_SPA_EMAIL,
            "to_address": customer_email,
            "body_text": body_text,
        }
