"""FastAPI router for messaging console operations."""
from __future__ import annotations

from typing import Optional, List, Literal, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService
from database import Conversation, Customer, get_db
from messaging_service import MessagingService

ChannelLiteral = Literal["sms", "email"]


class SendMessageRequest(BaseModel):
    channel: ChannelLiteral
    content: str
    conversation_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    subject: Optional[str] = None


messaging_router = APIRouter(prefix="/api/admin/messaging", tags=["messaging"])


def _serialize_conversation(conversation: Conversation) -> Dict[str, Any]:
    messages_sorted = sorted(conversation.messages, key=lambda m: m.sent_at or conversation.initiated_at)
    last_message = messages_sorted[-1] if messages_sorted else None

    return {
        "id": str(conversation.id),
        "channel": conversation.channel,
        "status": conversation.status,
        "subject": conversation.subject,
        "customer_name": conversation.customer.name if conversation.customer else None,
        "customer_phone": conversation.customer.phone if conversation.customer else None,
        "customer_email": conversation.customer.email if conversation.customer else None,
        "message_count": len(messages_sorted),
        "last_message_preview": (last_message.content[:140] if last_message and last_message.content else None),
        "last_activity_at": conversation.last_activity_at.isoformat() if conversation.last_activity_at else None,
        "initiated_at": conversation.initiated_at.isoformat() if conversation.initiated_at else None,
    }


def _serialize_message(message, channel: str) -> Dict[str, Any]:
    return {
        "id": str(message.id),
        "channel": channel,
        "direction": message.direction,
        "content": message.content,
        "sent_at": message.sent_at.isoformat() if message.sent_at else None,
        "metadata": message.custom_metadata or {},
    }


def _ensure_customer(
    db: Session,
    *,
    request: SendMessageRequest,
    conversation: Optional[Conversation],
    channel: ChannelLiteral,
) -> Customer:
    if conversation and conversation.customer:
        return conversation.customer

    if not request.customer_name:
        raise HTTPException(status_code=422, detail="customer_name is required")

    customer = MessagingService.find_or_create_customer(
        db=db,
        channel=channel,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        customer_email=request.customer_email,
    )

    if conversation and not conversation.customer_id:
        conversation.customer_id = customer.id
        db.commit()
        db.refresh(conversation)

    return customer


@messaging_router.post("/send")
def send_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    channel = request.channel

    conversation: Optional[Conversation] = None

    if request.conversation_id:
        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.customer), joinedload(Conversation.messages))
            .filter(Conversation.id == request.conversation_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.channel != channel:
            raise HTTPException(status_code=422, detail="Channel mismatch for conversation")

    customer = _ensure_customer(db=db, request=request, conversation=conversation, channel=channel)

    if conversation is None:
        conversation = MessagingService.find_active_conversation(
            db=db,
            customer_id=customer.id,
            channel=channel,
        )

    if conversation is None:
        conversation = MessagingService.create_conversation(
            db=db,
            customer_id=customer.id,
            channel=channel,
            subject=request.subject,
            metadata={"source": "messaging_console"},
        )
    elif request.subject and not conversation.subject:
        conversation.subject = request.subject
        db.commit()
        db.refresh(conversation)

    if channel == "sms" and not customer.phone:
        raise HTTPException(status_code=422, detail="Customer phone number is required for SMS conversations")
    if channel == "email" and not customer.email:
        raise HTTPException(status_code=422, detail="Customer email is required for email conversations")

    inbound_message = MessagingService.add_customer_message(
        db=db,
        conversation=conversation,
        content=request.content,
        metadata={"source": "messaging_console"},
    )

    if channel == "sms":
        sms_meta = MessagingService.sms_metadata_for_customer(customer.phone)
        AnalyticsService.add_sms_details(
            db=db,
            message_id=inbound_message.id,
            **sms_meta,
        )
    else:
        email_meta = MessagingService.email_metadata_for_customer(
            customer_email=customer.email,
            subject=request.subject or conversation.subject,
            body_text=request.content,
        )
        AnalyticsService.add_email_details(
            db=db,
            message_id=inbound_message.id,
            subject=email_meta["subject"],
            from_address=email_meta["from_address"],
            to_address=email_meta["to_address"],
            body_text=email_meta["body_text"],
            body_html=None,
        )

    ai_response = MessagingService.generate_ai_response(db, conversation.id, channel)

    outbound_message = MessagingService.add_assistant_message(
        db=db,
        conversation=conversation,
        content=ai_response,
        metadata={
            "source": "messaging_console",
            "generated_by": "assistant",
        },
    )

    if channel == "sms":
        sms_meta_outgoing = MessagingService.sms_metadata_for_assistant(customer.phone)
        AnalyticsService.add_sms_details(
            db=db,
            message_id=outbound_message.id,
            **sms_meta_outgoing,
        )
    else:
        email_meta_outgoing = MessagingService.email_metadata_for_assistant(
            customer_email=customer.email,
            subject=request.subject or conversation.subject,
            body_text=ai_response,
        )
        AnalyticsService.add_email_details(
            db=db,
            message_id=outbound_message.id,
            subject=email_meta_outgoing["subject"],
            from_address=email_meta_outgoing["from_address"],
            to_address=email_meta_outgoing["to_address"],
            body_text=email_meta_outgoing["body_text"],
            body_html=None,
        )

    if channel in {"sms", "email"}:
        try:
            AnalyticsService.score_conversation_satisfaction(db=db, conversation_id=conversation.id)
        except Exception as exc:  # noqa: BLE001 - fall back to existing values if scoring fails
            print(f"Warning: Failed to score messaging conversation {conversation.id}: {exc}")

    db.refresh(conversation)

    return {
        "conversation": _serialize_conversation(conversation),
        "customer_message": _serialize_message(inbound_message, channel),
        "assistant_message": _serialize_message(outbound_message, channel),
    }


@messaging_router.get("/conversations")
def list_conversations(
    channel: Optional[ChannelLiteral] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Conversation)
        .options(joinedload(Conversation.customer), joinedload(Conversation.messages))
        .filter(Conversation.channel.in_(["sms", "email"]))
    )

    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)

    total = query.count()

    conversations = (
        query
        .order_by(Conversation.last_activity_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "conversations": [_serialize_conversation(convo) for convo in conversations],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@messaging_router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: UUID, db: Session = Depends(get_db)):
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.customer), joinedload(Conversation.messages))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation": _serialize_conversation(conversation),
        "messages": [_serialize_message(msg, conversation.channel) for msg in sorted(conversation.messages, key=lambda m: m.sent_at or conversation.initiated_at)],
    }
