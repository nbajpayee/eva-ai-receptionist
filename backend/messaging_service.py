"""Helper utilities for omnichannel messaging console flows."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import textwrap
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any
from typing import Any as TypingAny
from typing import Callable, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

import pytz
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified

from analytics import AnalyticsService, openai_client
from booking.manager import SlotSelectionError, SlotSelectionManager
from booking.time_utils import EASTERN_TZ, format_for_display, parse_iso_datetime
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
from config import get_settings
from database import Appointment, CommunicationMessage, Conversation, Customer
from prompts import get_system_prompt
from settings_service import SettingsService

logger = logging.getLogger(__name__)
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False
s = get_settings()


class MessagingService:
    """Domain helpers for messaging console interactions."""

    _calendar_service_instance = None
    _calendar_credentials_logged = False

    def __init__(
        self,
        *,
        db_session_factory,
        calendar_service=None,
        analytics_service=None,
    ):
        self._db_session_factory = db_session_factory
        self.calendar_service = calendar_service or get_calendar_service()
        self.analytics_service = analytics_service or AnalyticsService(
            db_session_factory
        )
        self._trace_seq = 0
        self._services_cache = None

    def _get_services(self, db: Session) -> Dict[str, Any]:
        """Get services from database (cached per instance)."""
        if self._services_cache is None:
            self._services_cache = SettingsService.get_services_dict(db)
        return self._services_cache

    @staticmethod
    def _format_start_for_channel(dt: datetime, channel: str) -> str:
        return format_for_display(dt, channel=channel)

    # ------------------------------------------------------------------
    # Customer & conversation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def find_or_create_customer(
        *,
        db: Session,
        channel: str,
        customer_name: str,
        customer_phone: Optional[str],
        customer_email: Optional[str],
    ) -> Customer:
        """Find an existing customer by phone/email or create a new record."""

        customer: Optional[Customer] = None
        canonical_phone = (customer_phone or "").strip() or None
        email_value = (customer_email or "").strip() or None

        if canonical_phone:
            customer = (
                db.query(Customer).filter(Customer.phone == canonical_phone).first()
            )

        if customer is None and email_value:
            customer = db.query(Customer).filter(Customer.email == email_value).first()

        if customer:
            updated = False
            if canonical_phone and not customer.phone:
                customer.phone = canonical_phone
                updated = True
            if email_value and not customer.email:
                customer.email = email_value
                updated = True
            if customer.name != customer_name and customer_name:
                customer.name = customer_name
                updated = True
            if updated:
                db.commit()
                db.refresh(customer)
            return customer

        customer = Customer(
            name=customer_name,
            phone=canonical_phone,
            email=email_value,
            is_new_client=True,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def find_active_conversation(
        *,
        db: Session,
        customer_id: int,
        channel: str,
    ) -> Optional[Conversation]:
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
        *,
        db: Session,
        customer_id: Optional[int],
        channel: str,
        subject: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Conversation:
        conversation = AnalyticsService.create_conversation(
            db=db,
            customer_id=customer_id,
            channel=channel,
            metadata=metadata or {},
        )
        if subject:
            conversation.subject = subject
            db.commit()
            db.refresh(conversation)
        return conversation

    @staticmethod
    def add_customer_message(
        *,
        db: Session,
        conversation: Conversation,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CommunicationMessage:
        message = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="inbound",
            content=content,
            metadata=metadata or {},
        )

        # Update booking intent flags based on this inbound message so that
        # subsequent turns can preemptively enforce availability, even if the
        # user replies with simple acknowledgements like "ok" or "yes".
        try:
            MessagingService._update_booking_intent_from_inbound_message(
                db=db,
                conversation=conversation,
                message=message,
            )
        except Exception as exc:  # noqa: BLE001 - intent tracking should never break flows
            logger.warning(
                "Failed to update booking intent from inbound message for conversation %s: %s",
                conversation.id,
                exc,
            )

        return message

    @staticmethod
    def add_assistant_message(
        *,
        db: Session,
        conversation: Conversation,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CommunicationMessage:
        message = AnalyticsService.add_message(
            db=db,
            conversation_id=conversation.id,
            direction="outbound",
            content=content,
            metadata=metadata or {},
        )
        return message

    @staticmethod
    def _get_calendar_service():
        if MessagingService._calendar_service_instance is None:
            MessagingService._calendar_service_instance = get_calendar_service()
        return MessagingService._calendar_service_instance

    @staticmethod
    def _parse_iso_datetime(value: str) -> datetime:
        return parse_iso_datetime(value)

    # ------------------------------------------------------------------
    # Conversation intent helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _latest_customer_message(
        conversation: Conversation,
    ) -> Optional[CommunicationMessage]:
        if not conversation.messages:
            return None
        inbound_messages = [
            m for m in conversation.messages if m.direction == "inbound"
        ]
        if not inbound_messages:
            return None
        return max(
            inbound_messages,
            key=lambda m: m.sent_at
            or conversation.last_activity_at
            or conversation.initiated_at,
        )

    @staticmethod
    def _latest_assistant_message(
        conversation: Conversation,
    ) -> Optional[CommunicationMessage]:
        if not conversation.messages:
            return None
        outbound_messages = [
            m for m in conversation.messages if m.direction == "outbound"
        ]
        if not outbound_messages:
            return None
        return max(
            outbound_messages,
            key=lambda m: m.sent_at
            or conversation.last_activity_at
            or conversation.initiated_at,
        )

    @staticmethod
    def _update_booking_intent_from_inbound_message(
        *,
        db: Session,
        conversation: Conversation,
        message: CommunicationMessage,
    ) -> None:
        """Mark pending booking intent when the user is clearly trying to book.

        This covers two patterns:
        - Direct booking phrases in the user message ("book", "schedule",
          "appointment", "reserve", "slot").
        - Short acknowledgements ("yes", "ok", "yes please", etc.) that
          immediately follow an assistant prompt like "Would you like to book
          ..." or "Would you like to schedule one?".

        The flag persists across simple replies so that availability enforcement
        can still run when the latest user message is just "ok".
        """

        content = (message.content or "").strip().lower()
        if not content:
            return

        metadata = SlotSelectionManager.conversation_metadata(conversation)

        # Respect existing intent; don't thrash the flag once it's set.
        if metadata.get("pending_booking_intent"):
            return

        # If we already have a scheduled appointment recorded, avoid forcing
        # additional availability checks unless the user is clearly asking to
        # change or cancel that booking. That gating is handled in
        # _requires_availability_enforcement, so we don't repeat it here.
        last_appointment = metadata.get("last_appointment")
        if (
            isinstance(last_appointment, dict)
            and last_appointment.get("status") == "scheduled"
        ):
            return

        booking_keywords = ["book", "schedule", "appointment", "reserve", "slot"]
        current_message_is_booking = any(
            keyword in content for keyword in booking_keywords
        )

        # Short acknowledgements like "yes", "ok", "yes please", etc. These
        # only indicate booking intent when the prior assistant message was a
        # booking/scheduling prompt.
        ack_phrases = [
            "yes",
            "yes please",
            "yeah",
            "yep",
            "sure",
            "of course",
            "ok",
            "okay",
            "okkk",
            "okkkk",
            "okkkkk",
            "sounds good",
            "that works",
            "let's do it",
        ]
        is_ack = any(
            content == phrase or content.startswith(phrase + " ")
            for phrase in ack_phrases
        )

        prior_prompt_is_booking = False
        if is_ack:
            last_assistant = MessagingService._latest_assistant_message(conversation)
            if last_assistant and last_assistant.content:
                assistant_text = last_assistant.content.strip().lower()
                booking_prompt_phrases = [
                    "would you like to book",
                    "would you like me to book",
                    "would you like to schedule",
                    "would you like to schedule one",
                    "do you want to book",
                    "shall i book",
                    "should i book",
                ]
                if any(phrase in assistant_text for phrase in booking_prompt_phrases):
                    prior_prompt_is_booking = True

        if not (current_message_is_booking or (is_ack and prior_prompt_is_booking)):
            return

        # At this point we consider there to be an active booking intent. Try to
        # capture a hinted date so that _extract_booking_params can resolve
        # service/date more deterministically on the next turn.
        try:
            date, _service = MessagingService._extract_booking_params(db, conversation)
        except Exception:  # noqa: BLE001 - best-effort only
            date = None

        if date:
            metadata["pending_booking_date"] = date
        metadata["pending_booking_intent"] = True
        SlotSelectionManager.persist_conversation_metadata(db, conversation, metadata)

    @staticmethod
    def _resolve_selected_slot(pending: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not pending:
            return None

        selected_slot = (
            pending.get("selected_slot") if isinstance(pending, dict) else None
        )
        slots = pending.get("slots") if isinstance(pending, dict) else None

        if not selected_slot and isinstance(slots, list):
            index = pending.get("selected_option_index")
            if isinstance(index, int) and 1 <= index <= len(slots):
                selected_slot = slots[index - 1]

        if isinstance(selected_slot, dict) and selected_slot.get("start"):
            return selected_slot
        return None

    @staticmethod
    def _should_execute_booking(
        db: Session, conversation: Conversation
    ) -> Optional[Dict[str, Any]]:
        pending = SlotSelectionManager.get_pending_slot_offers(db, conversation)
        if not pending:
            return None

        selected_slot = MessagingService._resolve_selected_slot(pending)
        if not selected_slot:
            return None

        customer = conversation.customer
        if not customer or not customer.name or not customer.phone:
            return None

        last_message = MessagingService._latest_customer_message(conversation)
        if not last_message or not last_message.content:
            return None

        # Don't execute if last appointment already matches this slot (prevents duplicates)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        last_appointment = (
            metadata.get("last_appointment") if isinstance(metadata, dict) else {}
        )
        if (
            isinstance(last_appointment, dict)
            and last_appointment.get("status") == "scheduled"
        ):
            last_start = last_appointment.get("start_time")
            if last_start and last_start == selected_slot.get("start"):
                return None

        return {
            "pending": pending,
            "selected_slot": selected_slot,
            "customer": customer,
            "last_message": last_message,
        }

    @staticmethod
    def _execute_deterministic_booking(
        *,
        db: Session,
        conversation: Conversation,
        calendar_service,
        channel: str,
        trace: Callable[..., None],
        readiness: Dict[str, Any],
    ) -> Dict[str, Any]:
        customer: Customer = readiness["customer"]
        pending = readiness["pending"]
        selected_slot = readiness["selected_slot"]

        arguments: Dict[str, Any] = {
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "customer_email": customer.email,
            "start_time": selected_slot.get("start") or selected_slot.get("start_time"),
            "service_type": pending.get("service_type"),
        }

        if not arguments["start_time"] or not arguments["service_type"]:
            return {"status": "skipped"}

        provider = pending.get("provider")
        if provider:
            arguments["provider"] = provider

        tool_call_id = f"autobook_{uuid4()}"
        call = SimpleNamespace(
            id=tool_call_id,
            type="function",
            function=SimpleNamespace(
                name="book_appointment",
                arguments=json.dumps(arguments),
            ),
        )

        trace(
            "Deterministic book_appointment -> call_id=%s start=%s service=%s",
            tool_call_id,
            arguments.get("start_time"),
            arguments.get("service_type"),
        )

        result = MessagingService._execute_tool_call(
            db=db,
            conversation=conversation,
            customer=customer,
            calendar_service=calendar_service,
            call=call,
        )

        output = result.get("output") or {}
        success = output.get("success") is True

        tool_history = [
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": tool_call_id,
                        "type": "function",
                        "function": {
                            "name": "book_appointment",
                            "arguments": json.dumps(
                                {k: v for k, v in arguments.items() if v is not None}
                            ),
                        },
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": json.dumps(output),
            },
        ]

        if success:
            # Clear booking intent and slot offers after successful booking
            metadata = SlotSelectionManager.conversation_metadata(conversation)
            metadata["pending_booking_intent"] = False
            SlotSelectionManager.persist_conversation_metadata(
                db, conversation, metadata
            )
            SlotSelectionManager.clear_offers(db, conversation)

            confirmation = MessagingService.build_booking_confirmation_message(
                channel=channel,
                tool_output=output,
            )
            if not confirmation:
                confirmation = "✓ Booked! Your appointment is confirmed."
            return {
                "status": "success",
                "message": confirmation,
                "tool_history": tool_history,
            }

        trace("Deterministic booking failed: %s", output)
        return {
            "status": "failure",
            "result": result,
            "tool_history": tool_history,
        }

    @staticmethod
    def _extract_booking_params(
        db: Session, conversation: Conversation
    ) -> Tuple[str, Optional[str]]:
        """Extract date and (if known) service type from recent conversation messages."""
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        hinted_date = metadata.get("pending_booking_date")
        hinted_service = metadata.get("pending_booking_service")

        # Default date is tomorrow
        date = hinted_date or (datetime.utcnow() + timedelta(days=1)).strftime(
            "%Y-%m-%d"
        )
        service_type = hinted_service

        # Get services from database
        services = SettingsService.get_services_dict(db)

        # Consider last few inbound and outbound messages to capture user requests
        relevant_messages = [
            m for m in conversation.messages if m.direction == "inbound"
        ][-5:]
        # Include last assistant reply in case it mentioned a service the user confirmed
        outbound_messages = [
            m for m in conversation.messages if m.direction == "outbound"
        ][-3:]

        def _scan(messages: List[CommunicationMessage]) -> None:
            nonlocal date, service_type
            for msg in reversed(messages):
                content = (msg.content or "").lower()
                if not content:
                    continue

                if service_type is None:
                    for service_name in services.keys():
                        if service_name.lower() in content:
                            service_type = service_name.lower()
                            break

                if "today" in content:
                    date = datetime.utcnow().strftime("%Y-%m-%d")
                elif any(token in content for token in ("tomorrow", "tmrw", "tmr")):
                    date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

        _scan(relevant_messages)
        if service_type is None:
            _scan(outbound_messages)

        if service_type is None:
            channel = getattr(conversation, "channel", None)
            if channel == "sms":
                logger.info(
                    "Could not extract service type from SMS conversation %s; skipping preemptive availability.",
                    conversation.id,
                )
            else:
                logger.info(
                    "Could not extract service type from %s conversation %s; skipping preemptive availability.",
                    channel or "unknown",
                    conversation.id,
                )

        return date, service_type

    @staticmethod
    def _is_cancellation_message(text: str) -> bool:
        normalized = text.strip().lower()
        phrases = [
            "never mind",
            "nevermind",
            "i'll call back later",
            "i will call back later",
            "i'll call later",
            "i will call later",
            "don't worry about it",
            "dont worry about it",
            "actually never mind",
            "actually, never mind",
        ]
        for phrase in phrases:
            if phrase in normalized:
                return True
        return False

    @staticmethod
    def _requires_availability_enforcement(
        db: Session, conversation: Conversation
    ) -> bool:
        pending = SlotSelectionManager.get_pending_slot_offers(
            db, conversation, enforce_expiry=False
        )
        if pending:
            return False

        # Check if there's a pending booking intent from a previous message
        metadata = conversation.custom_metadata or {}
        pending_booking_intent = metadata.get("pending_booking_intent", False)

        # If we already have a scheduled appointment recorded, avoid forcing
        # additional availability checks unless the user is clearly asking to
        # change or cancel that booking. This prevents confusing re-checks
        # where the assistant says a time is "booked" right after it was
        # successfully reserved for the guest.
        last_appointment = metadata.get("last_appointment")

        last_customer = MessagingService._latest_customer_message(conversation)
        if not last_customer or not last_customer.content:
            return False

        text = last_customer.content.lower()
        if isinstance(last_appointment, dict) and last_appointment.get("status") == "scheduled":
            reschedule_keywords = ["resched", "move", "change", "different time"]
            cancel_keywords = ["cancel", "can't make", "cannot make", "won't make"]
            if not any(keyword in text for keyword in reschedule_keywords + cancel_keywords):
                return False

        # If the latest message mentions "next week" (or similar) without naming
        # a specific day of the week, we are not ready to enforce availability yet.
        # The assistant should first clarify which day next week they want before
        # running check_availability or offering times.
        next_week_phrases = ["next week", "coming week"]
        has_next_week = any(phrase in text for phrase in next_week_phrases)
        day_tokens = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]
        has_explicit_day = any(day in text for day in day_tokens)
        if has_next_week and not has_explicit_day:
            return False

        # Similarly, if the latest message uses long-range relative time phrases
        # like "next month" or "in 3 weeks" without a concrete date, skip
        # preemptive availability enforcement so the assistant can first ask
        # which specific date or week the caller prefers.
        long_range_phrases = [
            "next month",
            "coming month",
            "next year",
            "coming year",
            "in a few weeks",
            "in a few months",
            "few weeks from now",
            "few months from now",
        ]
        has_long_range_phrase = any(phrase in text for phrase in long_range_phrases)

        long_range_patterns = [
            r"\bin\s+\d+\s+weeks?\b",
            r"\bin\s+\d+\s+months?\b",
            r"\b\d+\s+weeks?\s+from now\b",
            r"\b\d+\s+months?\s+from now\b",
        ]
        has_long_range_pattern = any(re.search(pattern, text) for pattern in long_range_patterns)

        if has_long_range_phrase or has_long_range_pattern:
            return False

        booking_keywords = ["book", "schedule", "appointment", "reserve", "slot"]
        current_message_is_booking = any(
            keyword in text for keyword in booking_keywords
        )

        # Return True if EITHER current message OR pending intent indicates booking
        if current_message_is_booking or pending_booking_intent:
            return True
        return False

    @staticmethod
    def _should_force_availability(
        db: Session,
        conversation: Conversation,
        ai_message: Any,
    ) -> bool:
        tool_calls = getattr(ai_message, "tool_calls", None) or []
        if tool_calls:
            return False

        # Check if there's a pending booking intent in the conversation metadata
        metadata = conversation.custom_metadata or {}
        pending_booking_intent = metadata.get("pending_booking_intent", False)

        # If we already have pending slot offers, don't force check_availability again
        # (the user might be trying to select from existing offers)
        if metadata.get("pending_slot_offers"):
            return False

        last_customer = MessagingService._latest_customer_message(conversation)
        if not last_customer or not last_customer.content:
            return False

        text = last_customer.content.lower()
        booking_keywords = ["book", "schedule", "appointment", "reserve", "slot"]

        # Check if the current message OR pending intent indicates a booking request
        current_message_is_booking = any(
            keyword in text for keyword in booking_keywords
        )

        if current_message_is_booking or pending_booking_intent:
            return True
        return False

    @staticmethod
    def build_booking_confirmation_message(
        *, channel: str, tool_output: Dict[str, Any]
    ) -> Optional[str]:
        start_iso = tool_output.get("start_time")
        service_label = tool_output.get("service") or tool_output.get("service_type")
        if not start_iso:
            return None

        try:
            start_dt = parse_iso_datetime(start_iso)
        except ValueError:
            return None

        formatted_datetime = MessagingService._format_start_for_channel(
            start_dt, channel
        )
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
    def _normalize_tool_arguments(
        tool_name: Optional[str],
        arguments: Dict[str, Any],
        conversation: Optional[Conversation] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Optional[str]]]]:
        if not arguments:
            return {}, {}

        normalized = {k: v for k, v in arguments.items()}
        adjustments: Dict[str, Dict[str, Optional[str]]] = {}
        reference = datetime.now(EASTERN_TZ)

        def _message_mentions_tomorrow(text: Optional[str]) -> bool:
            if not text:
                return False
            lowered = text.lower()
            if "tomor" in lowered:
                return True
            return any(token in lowered for token in ("tmrw", "tmr"))

        tomorrow_hint = False
        if conversation and conversation.messages:
            ordered_messages = sorted(
                conversation.messages,
                key=lambda message: (
                    message.sent_at
                    or conversation.last_activity_at
                    or conversation.initiated_at
                    or datetime.utcnow()
                ),
            )

            last_customer_message: Optional[CommunicationMessage] = None
            preceding_assistant_message: Optional[CommunicationMessage] = None

            for message in reversed(ordered_messages):
                if message.direction == "inbound":
                    last_customer_message = message
                    break

            if last_customer_message is not None:
                if _message_mentions_tomorrow(last_customer_message.content):
                    tomorrow_hint = True
                else:
                    try:
                        idx = ordered_messages.index(last_customer_message)
                    except ValueError:
                        idx = -1
                    if idx > 0:
                        for candidate in reversed(ordered_messages[:idx]):
                            if candidate.direction == "outbound":
                                preceding_assistant_message = candidate
                                break
                    if (
                        preceding_assistant_message is not None
                        and _message_mentions_tomorrow(
                            preceding_assistant_message.content
                        )
                    ):
                        stripped = (last_customer_message.content or "").strip().lower()
                        if stripped in {"1", "option 1", "1.", "one", "1)"}:
                            tomorrow_hint = True

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
                        new_date = normalize_date_to_future(
                            str(date_value), reference=reference
                        )
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    if tomorrow_hint and new_date == reference.strftime("%Y-%m-%d"):
                        tomorrow_date = (reference + timedelta(days=1)).strftime(
                            "%Y-%m-%d"
                        )
                        _set("date", tomorrow_date)
                    else:
                        _set("date", new_date)

            elif tool_name == "book_appointment":
                for key in ("start_time", "start"):
                    if normalized.get(key):
                        try:
                            new_dt = normalize_datetime_to_future(
                                str(normalized[key]), reference=reference
                            )
                        except ValueError:
                            new_dt = normalize_datetime_to_future(
                                reference.isoformat(), reference=reference
                            )
                        _set(key, new_dt)
                        normalized["start_time"] = new_dt
                if normalized.get("date"):
                    try:
                        new_date = normalize_date_to_future(
                            str(normalized["date"]), reference=reference
                        )
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    _set("date", new_date)

            elif tool_name == "reschedule_appointment":
                for key in ("new_start_time", "start_time", "start"):
                    if normalized.get(key):
                        try:
                            new_dt = normalize_datetime_to_future(
                                str(normalized[key]), reference=reference
                            )
                        except ValueError:
                            new_dt = normalize_datetime_to_future(
                                reference.isoformat(), reference=reference
                            )
                        _set(key, new_dt)
                        if key != "new_start_time":
                            normalized["new_start_time"] = new_dt
                if normalized.get("date"):
                    try:
                        new_date = normalize_date_to_future(
                            str(normalized["date"]), reference=reference
                        )
                    except ValueError:
                        new_date = reference.strftime("%Y-%m-%d")
                    _set("date", new_date)

        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to normalize arguments for tool %s: %s", tool_name, exc
            )

        return normalized, adjustments

    @staticmethod
    def _build_history(
        conversation: Conversation, channel: str
    ) -> List[Dict[str, Any]]:
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

        # CRITICAL FIX: If pending slot offers exist, inject them into history
        # so the AI knows availability was already checked and doesn't re-check
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        pending_offers = metadata.get("pending_slot_offers")
        if pending_offers and isinstance(pending_offers, dict):
            # Reconstruct the check_availability tool call and result
            tool_call_id = pending_offers.get(
                "source_tool_call_id", "reconstructed_call"
            )
            service_type = pending_offers.get("service_type")
            date = pending_offers.get("date")
            display_slots = pending_offers.get("slots") or []
            all_slots = pending_offers.get("all_slots") or display_slots

            # Create a synthetic availability output matching what check_availability returns
            availability_output = {
                "success": True,
                "date": date,
                "service_type": service_type,
                # all_slots should reflect the full availability set for this date/service,
                # not just the 1-2 options we displayed to the guest.
                "all_slots": all_slots,
                "available_slots": all_slots,
                "availability_summary": f"We have availability on {date}",
                # suggested_slots mirrors the compact options that were actually offered.
                "suggested_slots": display_slots[:3]
                if len(display_slots) > 3
                else display_slots,
            }

            # Inject tool call and result into history
            history.append(
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": tool_call_id,
                            "type": "function",
                            "function": {
                                "name": "check_availability",
                                "arguments": json.dumps(
                                    {"date": date, "service_type": service_type}
                                ),
                            },
                        }
                    ],
                }
            )
            history.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": json.dumps(availability_output),
                }
            )

        last_appointment = (
            metadata.get("last_appointment") if isinstance(metadata, dict) else None
        )
        if (
            isinstance(last_appointment, dict)
            and last_appointment.get("status") == "scheduled"
        ):
            start_iso = last_appointment.get("start_time")
            service_type = last_appointment.get("service_type")
            provider = last_appointment.get("provider")
            event_id = last_appointment.get("calendar_event_id") or "last_appointment"

            if start_iso and service_type:
                try:
                    start_dt = parse_iso_datetime(start_iso)
                except ValueError:
                    start_dt = None

                tool_call_id = f"last_booking_{event_id}"
                tool_arguments = {
                    "customer_name": conversation.customer.name if conversation.customer else None,
                    "customer_phone": conversation.customer.phone if conversation.customer else None,
                    "customer_email": conversation.customer.email if conversation.customer else None,
                    "start_time": start_iso,
                    "service_type": service_type,
                    "provider": provider,
                }

                history.append(
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [
                            {
                                "id": tool_call_id,
                                "type": "function",
                                "function": {
                                    "name": "book_appointment",
                                    "arguments": json.dumps(tool_arguments),
                                },
                            }
                        ],
                    }
                )

                tool_output = {
                    "success": True,
                    "event_id": event_id,
                    "start_time": start_iso,
                    "service_type": service_type,
                    "provider": provider,
                }
                history.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": json.dumps(tool_output),
                    }
                )

        return history

    @staticmethod
    def _fallback_response(channel: str) -> str:
        return "Sorry, we're having some technical issues right now. We'll reach back out to you shortly."

    @staticmethod
    def _tool_context_messages(
        assistant_message: Any, tool_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
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
                if (
                    original_start
                    and sanitized_output.get("start_time")
                    and sanitized_output["start_time"] != original_start
                ):
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
                logger.warning(
                    "Failed to serialize tool output for %s: %s",
                    result.get("name"),
                    exc,
                )
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
    def _current_datetime_context() -> Dict[str, Any]:
        now = datetime.now(EASTERN_TZ)
        tomorrow = now + timedelta(days=1)
        next_week = now + timedelta(days=7)
        return {
            "success": True,
            "date": now.strftime("%Y-%m-%d"),
            "day_of_week": now.strftime("%A"),
            "time": now.strftime("%I:%M %p %Z").lstrip("0"),
            "datetime_iso": now.isoformat(),
            "tomorrow": tomorrow.strftime("%Y-%m-%d"),
            "next_week": next_week.strftime("%Y-%m-%d"),
        }

    @staticmethod
    def _update_customer_from_arguments(
        db: Session, customer: Customer, arguments: Dict[str, Any]
    ) -> None:
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
        name = (
            getattr(call.function, "name", None)
            if getattr(call, "function", None)
            else None
        )
        arguments_raw = (
            getattr(call.function, "arguments", "{}")
            if getattr(call, "function", None)
            else "{}"
        )
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
                services = SettingsService.get_services_dict(db)
                output = handle_check_availability(
                    calendar_service,
                    date=arguments.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                    service_type=arguments.get("service_type", ""),
                    services_dict=services,
                )
                if output.get("success"):
                    SlotSelectionManager.record_offers(
                        db,
                        conversation,
                        tool_call_id=result.get("tool_call_id"),
                        arguments=arguments,
                        output=output,
                    )
                    # NOTE: Don't clear pending_booking_intent here!
                    # It should persist until the booking is complete or user changes topic.
                    # Clearing it too early causes the retry loop to stop triggering.
                else:
                    SlotSelectionManager.clear_offers(db, conversation)
                result["slot_offers"] = SlotSelectionManager.pending_slot_summary(
                    db, conversation
                )
            elif name == "book_appointment":
                # AI may collect updated customer details mid-conversation; persist them before booking.
                # First, detect idempotent re-booking: if there is already a scheduled
                # appointment in this conversation at the exact requested time, treat
                # this call as a no-op success instead of raising a slot selection
                # error. This avoids confusing "technical issue" flows when the
                # appointment is actually booked.
                metadata = SlotSelectionManager.conversation_metadata(conversation)
                last_appt = metadata.get("last_appointment") if isinstance(
                    metadata, dict
                ) else None
                requested_start = arguments.get("start_time") or arguments.get("start")
                requested_service = arguments.get("service_type")
                idempotent_output: Optional[Dict[str, Any]] = None
                if (
                    isinstance(last_appt, dict)
                    and last_appt.get("status") == "scheduled"
                    and last_appt.get("start_time")
                    and requested_start
                ):
                    try:
                        last_dt = MessagingService._parse_iso_datetime(
                            str(last_appt["start_time"])
                        )
                        req_dt = MessagingService._parse_iso_datetime(str(requested_start))
                    except ValueError:
                        last_dt = None
                        req_dt = None

                    if last_dt and req_dt and last_dt.replace(tzinfo=None) == req_dt.replace(
                        tzinfo=None
                    ):
                        last_service = last_appt.get("service_type")
                        if not requested_service or not last_service or requested_service == last_service:
                            idempotent_output = {
                                "success": True,
                                "event_id": last_appt.get("calendar_event_id"),
                                "start_time": last_appt["start_time"],
                                "service_type": last_service or requested_service,
                                "provider": last_appt.get("provider"),
                                "duration_minutes": last_appt.get("duration_minutes"),
                                "notes": arguments.get("notes"),
                            }

                if idempotent_output is not None:
                    output = idempotent_output
                else:
                    try:
                        (
                            arguments,
                            selection_adjustments,
                        ) = SlotSelectionManager.enforce_booking(
                            db,
                            conversation,
                            arguments,
                        )
                    except SlotSelectionError as exc:
                        output = {
                            "success": False,
                            "error": str(exc),
                            "code": "slot_selection_mismatch",
                            "pending_slot_options": SlotSelectionManager.pending_slot_summary(
                                db, conversation
                            ),
                        }
                    else:
                        MessagingService._update_customer_from_arguments(
                            db, customer, arguments
                        )
                        services = SettingsService.get_services_dict(db)
                        output = handle_book_appointment(
                            calendar_service,
                            customer_name=arguments.get("customer_name", customer.name),
                            customer_phone=arguments.get(
                                "customer_phone", customer.phone or ""
                            ),
                            customer_email=arguments.get("customer_email", customer.email),
                            start_time=arguments.get("start_time", arguments.get("start")),
                            service_type=arguments.get("service_type"),
                            provider=arguments.get("provider"),
                            notes=arguments.get("notes"),
                            services_dict=services,
                        )
                        # Clear pending booking intent after successful booking
                        if output.get("success"):
                            metadata = conversation.custom_metadata or {}
                            if metadata.get("pending_booking_intent"):
                                metadata["pending_booking_intent"] = False
                                conversation.custom_metadata = metadata
                                db.commit()
                result["slot_offers"] = SlotSelectionManager.pending_slot_summary(
                    db, conversation
                )
            elif name == "reschedule_appointment":
                services = SettingsService.get_services_dict(db)
                output = handle_reschedule_appointment(
                    calendar_service,
                    appointment_id=arguments.get("appointment_id"),
                    new_start_time=arguments.get("new_start_time")
                    or arguments.get("start_time")
                    or arguments.get("start"),
                    service_type=arguments.get("service_type"),
                    provider=arguments.get("provider"),
                    services_dict=services,
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
                services = SettingsService.get_services_dict(db)
                output = handle_get_service_info(
                    service_type=arguments.get("service_type"),
                    services_dict=services,
                )
            elif name == "get_provider_info":
                output = handle_get_provider_info(
                    provider_name=arguments.get("provider_name"),
                )
            elif name == "search_customer":
                output = handle_search_customer(
                    phone=arguments.get("phone", ""),
                )
            elif name == "get_current_date":
                output = MessagingService._current_datetime_context()
            else:
                output = {"success": False, "error": f"Unsupported tool: {name}"}
        except Exception as exc:  # noqa: BLE001
            logger.exception("Tool %s execution failed: %s", name, exc)
            output = {"success": False, "error": str(exc)}

        result["output"] = output

        if selection_adjustments:
            result.setdefault("argument_adjustments", {}).update(selection_adjustments)

        if result.get("name") in {
            "book_appointment",
            "reschedule_appointment",
            "cancel_appointment",
        }:
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
            start_iso = (
                output.get("start_time")
                or arguments.get("start_time")
                or arguments.get("start")
            )
            service_type = output.get("service_type") or arguments.get("service_type")
            if not event_id or not start_iso or not service_type:
                return

            try:
                start_time = MessagingService._parse_iso_datetime(start_iso)
            except ValueError as exc:  # noqa: BLE001
                logger.warning(
                    "Failed to parse start_time for booking side effects: %s", exc
                )
                return

            services = SettingsService.get_services_dict(db)
            service_config = services.get(service_type)
            duration = output.get("duration_minutes")
            if duration is None:
                duration = (
                    service_config.get("duration_minutes", 60) if service_config else 60
                )

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
            appointment_id = output.get("appointment_id") or arguments.get(
                "appointment_id"
            )
            new_start_iso = (
                output.get("start_time")
                or arguments.get("new_start_time")
                or arguments.get("start_time")
                or arguments.get("start")
            )
            service_type = output.get("service_type") or arguments.get("service_type")
            if not appointment_id or not new_start_iso or not service_type:
                return

            try:
                new_start = MessagingService._parse_iso_datetime(new_start_iso)
            except ValueError as exc:  # noqa: BLE001
                logger.warning(
                    "Failed to parse new_start for reschedule side effects: %s", exc
                )
                return

            services = SettingsService.get_services_dict(db)
            service_config = services.get(service_type)
            duration = output.get("duration_minutes")
            if duration is None:
                duration = (
                    service_config.get("duration_minutes", 60) if service_config else 60
                )

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
            appointment_id = output.get("appointment_id") or arguments.get(
                "appointment_id"
            )
            if not appointment_id:
                return

            appointment = (
                db.query(Appointment)
                .filter(Appointment.calendar_event_id == appointment_id)
                .first()
            )

            cancellation_reason = (
                output.get("reason")
                or output.get("cancellation_reason")
                or arguments.get("cancellation_reason")
            )

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
            SlotSelectionManager.persist_conversation_metadata(
                db, conversation, metadata
            )

    @staticmethod
    def _make_trace_logger(conversation: Conversation):
        conversation_id = conversation.id
        counter = {"value": 0}

        def _trace(message: str, *args) -> None:
            counter["value"] += 1
            formatted = message % args if args else message
            logger.info(
                "[trace:%s:%03d] %s", conversation_id, counter["value"], formatted
            )

        return _trace

    @staticmethod
    def _condense_messages_for_trace(messages: List[Dict[str, Any]]) -> str:
        lines: List[str] = []
        for entry in messages[-12:]:  # limit for readability
            role = entry.get("role")
            if role == "system":
                content = entry.get("content", "").splitlines()[0:3]
                lines.append(f"system: {' | '.join(content)}".strip())
            elif role in {"user", "assistant"}:
                content = entry.get("content", "")
                snippet = textwrap.shorten(content, width=180, placeholder=" …")
                lines.append(f"{role}: {snippet}")
            elif role == "tool":
                name = entry.get("name")
                payload = entry.get("content")
                snippet = textwrap.shorten(str(payload), width=160, placeholder=" …")
                lines.append(f"tool:{name}: {snippet}")
        return "\n".join(lines)

    @staticmethod
    def _call_ai(
        messages: List[Dict[str, Any]],
        *,
        db: Session,
        channel: str,
        ai_mode: str,
        temperature: float,
        max_tokens: int,
        tool_choice: Any,
        trace: Callable[..., None],
    ) -> Any:
        condensed = MessagingService._condense_messages_for_trace(messages)
        trace(
            "AI request -> channel=%s mode=%s temperature=%.2f max_tokens=%d tool_choice=%s\n%s",
            channel,
            ai_mode,
            temperature,
            max_tokens,
            tool_choice,
            condensed,
        )

        try:
            if not s.OPENAI_API_KEY:
                raise RuntimeError("OPENAI_API_KEY not configured")

            response = openai_client.chat.completions.create(
                model=s.OPENAI_MESSAGING_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                tools=get_booking_tools(db),
                tool_choice=tool_choice,
            )
            trace("AI raw response: %s", response)
            return response
        except Exception as exc:  # noqa: BLE001 - fall back gracefully for local dev
            trace("AI call failed: %s", exc)
            fallback_message = "I'm running in a local environment without AI access."
            return MessagingService._mock_completion(fallback_message)

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

        last_customer = MessagingService._latest_customer_message(conversation)
        if last_customer and last_customer.content:
            last_text = last_customer.content.strip().lower()
            if MessagingService._is_cancellation_message(last_text):
                metadata = SlotSelectionManager.conversation_metadata(conversation)
                if isinstance(metadata, dict):
                    changed = False
                    if metadata.get("pending_booking_intent"):
                        metadata["pending_booking_intent"] = False
                        changed = True
                    for key in ("pending_booking_date", "pending_booking_service"):
                        if key in metadata:
                            metadata.pop(key, None)
                            changed = True
                    if changed:
                        SlotSelectionManager.persist_conversation_metadata(
                            db, conversation, metadata
                        )
                SlotSelectionManager.clear_offers(db, conversation)

        history = MessagingService._build_history(conversation, channel)
        max_tokens = 500 if channel == "sms" else 1000
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        force_needed = MessagingService._requires_availability_enforcement(
            db, conversation
        )

        trace = MessagingService._make_trace_logger(conversation)
        calendar_service = MessagingService._get_calendar_service()
        trace("=== TURN START: channel=%s mode=%s", channel, "ai")

        # DETERMINISTIC APPROACH: If we detect booking intent, call check_availability
        # BEFORE asking the AI, then inject results into the conversation context.
        # This avoids relying on the AI to call the tool (which it often refuses to do).
        preemptive_availability_result = None
        if force_needed:
            logger.info(
                "Booking intent detected for conversation %s. Calling check_availability preemptively.",
                conversation_id,
            )

            # Extract date and service from recent messages
            date, service_type = MessagingService._extract_booking_params(
                db, conversation
            )

            if not service_type:
                trace(
                    "Skipping preemptive check_availability for conversation %s because service type is unknown; AI should clarify service first.",
                    conversation_id,
                )
            else:
                trace(
                    "Preemptively calling check_availability: date=%s, service=%s",
                    date,
                    service_type,
                )

                try:
                    services = SettingsService.get_services_dict(db)
                    output = handle_check_availability(
                        calendar_service,
                        date=date,
                        service_type=service_type,
                        services_dict=services,
                    )

                    if output.get("success"):
                        # Store the offers
                        SlotSelectionManager.record_offers(
                            db,
                            conversation,
                            tool_call_id="preemptive_call",
                            arguments={"date": date, "service_type": service_type},
                            output=output,
                        )
                        db.refresh(conversation)
                        metadata = SlotSelectionManager.conversation_metadata(conversation)

                        preemptive_availability_result = {
                            "tool_call_id": "preemptive_call",
                            "name": "check_availability",
                            "arguments": {"date": date, "service_type": service_type},
                            "output": output,
                        }

                        # Add tool result to history so AI knows about the availability
                        history.append(
                            {
                                "role": "assistant",
                                "content": "",  # Empty string instead of None to avoid trace errors
                                "tool_calls": [
                                    {
                                        "id": "preemptive_call",
                                        "type": "function",
                                        "function": {
                                            "name": "check_availability",
                                            "arguments": json.dumps(
                                                {"date": date, "service_type": service_type}
                                            ),
                                        },
                                    }
                                ],
                            }
                        )
                        history.append(
                            {
                                "role": "tool",
                                "tool_call_id": "preemptive_call",
                                "content": json.dumps(output),
                            }
                        )

                        # Only set booking intent if not already completed
                        # If last_appointment exists with same slot, don't restart the booking flow
                        should_set_intent = True
                        last_appt = metadata.get("last_appointment")
                        if (
                            isinstance(last_appt, dict)
                            and last_appt.get("status") == "scheduled"
                        ):
                            should_set_intent = False

                        if should_set_intent:
                            metadata.update(
                                {
                                    "pending_booking_intent": True,
                                    "pending_booking_date": date,
                                    "pending_booking_service": service_type,
                                }
                            )
                            SlotSelectionManager.persist_conversation_metadata(
                                db, conversation, metadata
                            )

                        trace(
                            "Preemptive check_availability succeeded. Injected results into context."
                        )
                    else:
                        logger.warning(
                            "Preemptive check_availability failed for conversation %s: %s",
                            conversation_id,
                            output.get("error", "Unknown error"),
                        )
                except Exception as exc:
                    logger.error(
                        "Exception during preemptive check_availability for conversation %s: %s",
                        conversation_id,
                        exc,
                        exc_info=True,
                    )

        readiness = MessagingService._should_execute_booking(db, conversation)
        if readiness:
            booking_result = MessagingService._execute_deterministic_booking(
                db=db,
                conversation=conversation,
                calendar_service=calendar_service,
                channel=channel,
                trace=trace,
                readiness=readiness,
            )

            tool_history = booking_result.get("tool_history") or []
            if tool_history:
                history.extend(tool_history)

            if booking_result.get("status") == "success":
                trace("Deterministic booking completed successfully.")
                return booking_result["message"], None

            if booking_result.get("status") == "failure":
                trace("Deterministic booking failed; proceeding with AI follow-up.")

        # With preemptive tool calling, we don't need complex retry loops.
        # Just call the AI once with the availability already in context.
        ai_response = MessagingService._call_ai(
            messages=history,
            db=db,
            channel=channel,
            ai_mode="ai",
            temperature=0.3,
            max_tokens=max_tokens,
            tool_choice="auto",  # No forcing needed - context already has availability
            trace=trace,
        )

        message = ai_response.choices[0].message
        text_content = (message.content or "").strip()
        tool_calls = getattr(message, "tool_calls", None) or []

        if not tool_calls and not text_content:
            logger.warning(
                "AI returned empty response with no tool calls for conversation %s; using fallback.",
                conversation_id,
            )
            text_content = MessagingService._fallback_response(channel)

        # If we called check_availability preemptively and AI still tries to call it,
        # that's fine - just let it proceed normally
        trace("Assistant provisional reply: %s", text_content)
        history.append({"role": "assistant", "content": text_content})
        if tool_calls:
            trace("AI requested %d tool call(s)", len(tool_calls))
            tool_call_results = []
            for tool_call in tool_calls:
                call_id = getattr(tool_call, "id", None)
                function_payload = getattr(tool_call, "function", None)
                function_repr = {
                    "name": getattr(function_payload, "name", None),
                    "arguments": getattr(function_payload, "arguments", ""),
                }
                trace("-- ToolCall[%s]: %s", call_id, function_repr)
                result = MessagingService._execute_tool_call(
                    db=db,
                    conversation=conversation,
                    customer=conversation.customer,
                    calendar_service=calendar_service,
                    call=tool_call,
                )
                trace("-- ToolResult[%s]: %s", call_id, result.get("output"))
                tool_call_results.append(result)

            history.extend(
                MessagingService._tool_context_messages(message, tool_call_results)
            )

            # When tools are called, return empty text content
            # The followup response will generate the actual message based on tool results
            return "", message

        # If no tool calls, return the text
        return text_content, message

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

        trace = MessagingService._make_trace_logger(conversation)
        trace("=== FOLLOWUP START: channel=%s", channel)

        history = MessagingService._build_history(conversation, channel)
        history.extend(
            MessagingService._tool_context_messages(assistant_message, tool_results)
        )
        max_tokens = 500 if channel == "sms" else 1000

        # Quick summary of tool_results for tracing (tool name + success flag)
        summary_items: List[str] = []
        for result in tool_results:
            name = result.get("name")
            output = result.get("output") or {}
            success = output.get("success") if isinstance(output, dict) else None
            summary_items.append(f"{name}:success={success}")
        if summary_items:
            trace("Tool results summary: %s", "; ".join(summary_items))

        if not s.OPENAI_API_KEY:
            logger.info(
                "OPENAI_API_KEY not configured; returning fallback follow-up response for conversation %s",
                conversation_id,
            )
            return MessagingService._fallback_response(channel), None

        try:
            # Check if any tool result was a successful book_appointment
            booking_success = None
            for result in tool_results:
                output = result.get("output", {})
                if isinstance(output, dict) and output.get("success") is True:
                    # Check if this was a booking operation
                    if output.get("event_id") or output.get("appointment_id"):
                        booking_success = output
                        break

            # If booking succeeded, force a confirmation message
            if booking_success:
                trace("Follow-up: successful booking detected; forcing confirmation message")
                confirmation = MessagingService.build_booking_confirmation_message(
                    channel=channel,
                    tool_output=booking_success,
                )
                if confirmation:
                    # Return confirmation directly, don't let AI generate ambiguous text
                    return confirmation, None

            ai_response = MessagingService._call_ai(
                messages=history,
                db=db,
                channel=channel,
                ai_mode="followup",
                temperature=0.3,
                max_tokens=max_tokens,
                tool_choice="none",
                trace=trace,
            )
            message = ai_response.choices[0].message
            text_content = (message.content or "").strip()
            trace("Follow-up assistant reply: %s", text_content)
            return text_content, message
        except Exception as exc:  # noqa: BLE001 - fall back gracefully for local dev
            logger.warning("Failed to generate follow-up AI response: %s", exc)
            return MessagingService._fallback_response(channel), None

    @staticmethod
    def _mock_completion(content: str) -> TypingAny:
        message = SimpleNamespace(content=content, tool_calls=[])
        choice = SimpleNamespace(message=message)
        return SimpleNamespace(choices=[choice])

    @staticmethod
    def sms_metadata_for_customer(customer_phone: str) -> Dict[str, Any]:
        return {
            "from_number": customer_phone,
            "to_number": s.MED_SPA_PHONE,
            "provider_message_id": f"test-{uuid4()}",
            "delivery_status": "sent",
        }

    @staticmethod
    def sms_metadata_for_assistant(customer_phone: str) -> Dict[str, Any]:
        return {
            "from_number": s.MED_SPA_PHONE,
            "to_number": customer_phone,
            "provider_message_id": f"test-{uuid4()}",
            "delivery_status": "sent",
        }

    @staticmethod
    def email_metadata_for_customer(
        customer_email: str, subject: Optional[str], body_text: str
    ) -> Dict[str, Any]:
        return {
            "subject": subject or "Message from Luxury Med Spa",
            "from_address": customer_email,
            "to_address": s.MED_SPA_EMAIL,
            "body_text": body_text,
        }

    @staticmethod
    def email_metadata_for_assistant(
        customer_email: str, subject: Optional[str], body_text: str
    ) -> Dict[str, Any]:
        return {
            "subject": subject or "Message from Luxury Med Spa",
            "from_address": s.MED_SPA_EMAIL,
            "to_address": customer_email,
            "body_text": body_text,
        }
