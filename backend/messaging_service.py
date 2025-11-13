"""Helper utilities for omnichannel messaging console flows."""
from __future__ import annotations

import hashlib
import re

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService, openai_client
from calendar_service import get_calendar_service, SERVICES
from config import get_settings
from database import Conversation, Customer, CommunicationMessage, Appointment
from mock_calendar_service import get_mock_calendar_service
from prompts import get_system_prompt

settings = get_settings()


class MessagingService:
    """Domain helpers for messaging console interactions."""

    _calendar_service_instance = None

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

        try:
            MessagingService._calendar_service_instance = get_calendar_service()
        except Exception as exc:  # noqa: BLE001 - fall back to mock for local dev
            print(f"Warning: Falling back to mock calendar service due to error: {exc}")
            MessagingService._calendar_service_instance = get_mock_calendar_service()
        return MessagingService._calendar_service_instance

    @staticmethod
    def _parse_iso_datetime(value: str) -> datetime:
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        return datetime.fromisoformat(normalized)

    @staticmethod
    def _extract_calendar_action(content: str) -> tuple[Optional[Dict[str, str]], str]:
        pattern = re.compile(r"<calendar_action\b([^>]*)/?>", re.IGNORECASE)
        match = pattern.search(content)
        if not match:
            return None, content

        attr_pattern = re.compile(r"([\w-]+)=\"([^\"]*)\"")
        attributes = {key: value for key, value in attr_pattern.findall(match.group(1))}
        action_type = attributes.get("type", "").strip().lower()
        if not action_type:
            cleaned = (content[:match.start()] + content[match.end():]).strip()
            return None, cleaned if cleaned else content

        attributes["type"] = action_type
        cleaned_content = (content[:match.start()] + content[match.end():]).strip()
        return attributes, cleaned_content or content[:match.start()].strip()

    @staticmethod
    def _conversation_metadata(conversation: Conversation) -> Dict[str, Any]:
        existing = conversation.custom_metadata or {}
        # Ensure we operate on a copy so SQLAlchemy sees assignment
        return dict(existing)

    @staticmethod
    def execute_calendar_action(
        db: Session,
        *,
        conversation: Conversation,
        customer: Customer,
        action: Dict[str, str],
    ) -> Dict[str, Any]:
        """Execute calendar automation based on assistant output."""
        calendar_service = MessagingService._get_calendar_service()
        result: Dict[str, Any] = {
            "type": action.get("type"),
            "request": action,
            "success": False,
        }

        metadata = MessagingService._conversation_metadata(conversation)
        last_appt_meta = metadata.get("last_appointment", {})

        def _resolve_service_type() -> Optional[str]:
            return action.get("service") or action.get("service_type") or last_appt_meta.get("service_type")

        def _resolve_provider() -> Optional[str]:
            return action.get("provider") or last_appt_meta.get("provider")

        action_type = action.get("type")

        if action_type == "book":
            start_str = action.get("start") or action.get("start_time")
            service_type = _resolve_service_type()
            if not start_str or not service_type:
                result["error"] = "Missing start or service for booking"
                return result

            try:
                start_time = MessagingService._parse_iso_datetime(start_str)
            except ValueError as exc:  # noqa: BLE001
                result["error"] = f"Invalid start time format: {exc}"
                return result

            service_config = SERVICES.get(service_type)
            duration = service_config.get("duration_minutes", 60) if service_config else 60
            end_time = start_time + timedelta(minutes=duration)
            provider = _resolve_provider()
            notes = action.get("notes")

            customer_email = customer.email or f"{customer.phone or 'unknown'}@placeholder.com"
            event_id = calendar_service.book_appointment(
                start_time=start_time,
                end_time=end_time,
                customer_name=customer.name,
                customer_email=customer_email,
                customer_phone=customer.phone or "",
                service_type=service_type,
                provider=provider,
                notes=notes,
            )

            if not event_id:
                result["error"] = "Calendar booking failed"
                return result

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

            conversation.custom_metadata = metadata
            db.commit()

            result.update(
                {
                    "success": True,
                    "event_id": event_id,
                    "start": start_time.isoformat(),
                    "service": service_type,
                    "provider": provider,
                }
            )
            return result

        if action_type == "reschedule":
            appointment_id = action.get("appointment_id") or last_appt_meta.get("calendar_event_id")
            new_start_str = action.get("new_start") or action.get("start") or action.get("start_time")
            service_type = _resolve_service_type()
            if not appointment_id or not new_start_str or not service_type:
                result["error"] = "Missing appointment_id, time, or service for reschedule"
                return result

            try:
                new_start = MessagingService._parse_iso_datetime(new_start_str)
            except ValueError as exc:  # noqa: BLE001
                result["error"] = f"Invalid new_start time format: {exc}"
                return result

            service_config = SERVICES.get(service_type)
            duration = service_config.get("duration_minutes", 60) if service_config else 60
            new_end = new_start + timedelta(minutes=duration)
            provider = _resolve_provider()

            success = calendar_service.reschedule_appointment(
                event_id=appointment_id,
                new_start_time=new_start,
                new_end_time=new_end,
            )

            if not success:
                result["error"] = "Calendar reschedule failed"
                return result

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
            conversation.custom_metadata = metadata
            db.commit()

            result.update(
                {
                    "success": True,
                    "appointment_id": appointment_id,
                    "new_start": new_start.isoformat(),
                    "service": service_type,
                    "provider": provider,
                }
            )
            return result

        if action_type == "cancel":
            appointment_id = action.get("appointment_id") or last_appt_meta.get("calendar_event_id")
            if not appointment_id:
                result["error"] = "Missing appointment_id for cancellation"
                return result

            cancellation_reason = action.get("reason") or action.get("cancellation_reason")
            success = calendar_service.cancel_appointment(appointment_id)

            if not success:
                result["error"] = "Calendar cancellation failed"
                return result

            appointment = (
                db.query(Appointment)
                .filter(Appointment.calendar_event_id == appointment_id)
                .first()
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
            conversation.custom_metadata = metadata
            db.commit()

            result.update(
                {
                    "success": True,
                    "appointment_id": appointment_id,
                    "cancellation_reason": cancellation_reason,
                }
            )
            return result

        result["error"] = f"Unsupported calendar action type: {action_type}"
        return result

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
    def generate_ai_response(db: Session, conversation_id: UUID, channel: str) -> str:
        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.id == conversation_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        prompt = get_system_prompt(channel)

        history = [
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

        max_tokens = 500 if channel == "sms" else 1000

        try:
            if not settings.OPENAI_API_KEY:
                raise RuntimeError("OPENAI_API_KEY not configured")

            response = openai_client.chat.completions.create(
                model=settings.OPENAI_MESSAGING_MODEL,
                messages=history,
                temperature=0.7,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:  # noqa: BLE001 - fall back gracefully for local dev
            print(f"Warning: Failed to generate AI response via OpenAI: {exc}")
            return (
                "Ava (AI assistant) is currently unavailable. We'll follow up shortly." if channel == "sms"
                else (
                    "Hello! Ava here — I'm offline at the moment, but we'll reply with more details soon."
                )
            )

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
