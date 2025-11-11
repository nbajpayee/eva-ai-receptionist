"""Helper utilities for omnichannel messaging console flows."""
from __future__ import annotations

import hashlib

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService, openai_client
from config import get_settings
from database import Conversation, Customer, CommunicationMessage
from prompts import get_system_prompt

settings = get_settings()


class MessagingService:
    """Domain helpers for messaging console interactions."""

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
