"""FastAPI router for messaging console operations."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload

from analytics import AnalyticsService
from booking.manager import SlotSelectionManager
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
    messages_sorted = sorted(
        conversation.messages, key=lambda m: m.sent_at or conversation.initiated_at
    )
    last_message = messages_sorted[-1] if messages_sorted else None

    return {
        "id": str(conversation.id),
        "channel": conversation.channel,
        "status": conversation.status,
        "subject": conversation.subject,
        "customer_name": conversation.customer.name if conversation.customer else None,
        "customer_phone": (
            conversation.customer.phone if conversation.customer else None
        ),
        "customer_email": (
            conversation.customer.email if conversation.customer else None
        ),
        "message_count": len(messages_sorted),
        "last_message_preview": (
            last_message.content[:140]
            if last_message and last_message.content
            else None
        ),
        "last_activity_at": (
            conversation.last_activity_at.isoformat()
            if conversation.last_activity_at
            else None
        ),
        "initiated_at": (
            conversation.initiated_at.isoformat() if conversation.initiated_at else None
        ),
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
            .options(
                joinedload(Conversation.customer), joinedload(Conversation.messages)
            )
            .filter(Conversation.id == request.conversation_id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.channel != channel:
            raise HTTPException(
                status_code=422, detail="Channel mismatch for conversation"
            )

    customer = _ensure_customer(
        db=db, request=request, conversation=conversation, channel=channel
    )

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
        raise HTTPException(
            status_code=422,
            detail="Customer phone number is required for SMS conversations",
        )
    if channel == "email" and not customer.email:
        raise HTTPException(
            status_code=422, detail="Customer email is required for email conversations"
        )

    inbound_message = MessagingService.add_customer_message(
        db=db,
        conversation=conversation,
        content=request.content,
        metadata={"source": "messaging_console"},
    )

    # Capture slot selections (e.g., "Option 2" or explicit time choices) as soon as the
    # inbound message is stored so deterministic booking can trigger without waiting for
    # the AI to parse the message later.
    SlotSelectionManager.capture_selection(db, conversation, inbound_message)

    # Refresh conversation to get any metadata updates from slot selection capture
    db.refresh(conversation)

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

    initial_content, assistant_message = MessagingService.generate_ai_response(
        db, conversation.id, channel
    )

    logger = logging.getLogger(__name__)

    tool_calls = (
        list(getattr(assistant_message, "tool_calls", []) or [])
        if assistant_message
        else []
    )
    tool_results: List[Dict[str, Any]] = []
    booking_action_success = False

    if tool_calls:
        calendar_service = MessagingService._get_calendar_service()
        booking_confirmation_message: Optional[str] = None
        for call in tool_calls:
            try:
                function_obj = getattr(call, "function", None)
                tool_name = (
                    getattr(function_obj, "name", None) if function_obj else None
                )
                raw_arguments = (
                    getattr(function_obj, "arguments", "") if function_obj else ""
                )
                try:
                    parsed_arguments = (
                        json.loads(raw_arguments) if raw_arguments else {}
                    )
                except json.JSONDecodeError:
                    parsed_arguments = {}

                (
                    normalized_arguments,
                    adjustments,
                ) = MessagingService._normalize_tool_arguments(
                    tool_name, parsed_arguments
                )

                if (
                    function_obj is not None
                    and normalized_arguments != parsed_arguments
                ):
                    function_obj.arguments = json.dumps(normalized_arguments)

                result = MessagingService._execute_tool_call(
                    db=db,
                    conversation=conversation,
                    customer=customer,
                    calendar_service=calendar_service,
                    call=call,
                )

                # CRITICAL: Refresh conversation and customer after each tool call to ensure
                # metadata updates (like pending slot offers) and customer updates
                # are visible to subsequent tool calls in the same request
                db.refresh(conversation)
                db.refresh(customer)

            except (
                Exception
            ) as exc:  # noqa: BLE001 - continue capturing failure details
                result = {
                    "tool_call_id": getattr(call, "id", None),
                    "name": getattr(getattr(call, "function", None), "name", None),
                    "arguments": {},
                    "output": {"success": False, "error": str(exc)},
                }
                logger.warning("Tool call execution raised %s", exc)
            tool_results.append(result)
            if result.get("name") in {
                "book_appointment",
                "reschedule_appointment",
                "cancel_appointment",
            }:
                if (result.get("output") or {}).get("success"):
                    booking_action_success = True
                    if (
                        result.get("name") == "book_appointment"
                        and not booking_confirmation_message
                    ):
                        booking_confirmation_message = (
                            MessagingService.build_booking_confirmation_message(
                                channel=channel,
                                tool_output=result.get("output") or {},
                            )
                        )

            tool_results[-1]["normalized_arguments"] = normalized_arguments
            selection_adjustments = result.get("argument_adjustments") or {}
            merged_adjustments: Dict[str, Dict[str, Optional[str]]] = {}
            if adjustments:
                merged_adjustments.update(adjustments)
            if selection_adjustments:
                merged_adjustments.update(selection_adjustments)
            tool_results[-1]["argument_adjustments"] = merged_adjustments

        if booking_confirmation_message:
            response_content = booking_confirmation_message
            assistant_message = None
        else:
            (
                followup_content,
                followup_message,
            ) = MessagingService.generate_followup_response(
                db=db,
                conversation_id=conversation.id,
                channel=channel,
                assistant_message=assistant_message,
                tool_results=tool_results,
            )
            response_content = followup_content
            assistant_message = followup_message or assistant_message
    else:
        response_content = initial_content

    if channel == "sms" and not booking_action_success:
        logger.warning(
            "SMS conversation %s completed without a successful booking tool execution.",
            conversation.id,
        )

    outbound_metadata = {
        "source": "messaging_console",
        "generated_by": "assistant",
    }

    if tool_calls:
        tool_requests: List[Dict[str, Any]] = []
        for call in tool_calls:
            function_obj = getattr(call, "function", None)
            arguments_raw = (
                getattr(function_obj, "arguments", "") if function_obj else ""
            )
            try:
                parsed_args = json.loads(arguments_raw) if arguments_raw else {}
            except json.JSONDecodeError:
                parsed_args = arguments_raw
            tool_requests.append(
                {
                    "id": getattr(call, "id", None),
                    "type": getattr(call, "type", None),
                    "name": getattr(function_obj, "name", None),
                    "arguments": parsed_args,
                }
            )

        outbound_metadata["tool_invocations"] = {
            "requests": tool_requests,
            "results": tool_results,
        }

    outbound_message = MessagingService.add_assistant_message(
        db=db,
        conversation=conversation,
        content=response_content,
        metadata=outbound_metadata,
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
            body_text=response_content,
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

    # Tool metadata already persisted via outbound_metadata; calendar_result retained for compatibility
    calendar_result: Dict[str, Any] | None = None

    if channel in {"sms", "email"}:
        try:
            AnalyticsService.score_conversation_satisfaction(
                db=db, conversation_id=conversation.id
            )
        except (
            Exception
        ) as exc:  # noqa: BLE001 - fall back to existing values if scoring fails
            print(
                f"Warning: Failed to score messaging conversation {conversation.id}: {exc}"
            )

    db.refresh(conversation)

    return {
        "conversation": _serialize_conversation(conversation),
        "customer_message": _serialize_message(inbound_message, channel),
        "assistant_message": _serialize_message(outbound_message, channel),
        "calendar_action": calendar_result,
    }


@messaging_router.get("", include_in_schema=False)
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
        query.order_by(Conversation.last_activity_at.desc())
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
        "messages": [
            _serialize_message(msg, conversation.channel)
            for msg in sorted(
                conversation.messages,
                key=lambda m: m.sent_at or conversation.initiated_at,
            )
        ],
    }
