"""Analytics service for call tracking, sentiment analysis, and satisfaction scoring."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ai_config import get_openai_client
from sqlalchemy import func, cast, String
from sqlalchemy.orm import Session

from config import get_settings
from database import (
    Appointment,
    CommunicationEvent,
    CommunicationMessage,
    Conversation,
    Customer,
    DailyMetric,
    EmailDetails,
    SMSDetails,
    VoiceCallDetails,
)

settings = get_settings()
openai_client = get_openai_client()
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(timezone.utc)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize datetime values to timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AnalyticsService:
    """Service for tracking and analyzing conversations."""

    Conversation = Conversation
    CommunicationMessage = CommunicationMessage
    Appointment = Appointment

    @staticmethod
    def resolve_or_create_customer_for_call(
        db: Session,
        customer_data: Dict[str, Any],
    ) -> Optional[Customer]:
        """Find or create a Customer based on call customer_data.

        This helper is safe to call from both legacy CallSession flows and the
        new conversations-based schema.
        """

        if not customer_data.get("phone"):
            return None

        customer = (
            db.query(Customer)
            .filter(Customer.phone == customer_data["phone"])
            .first()
        )

        if customer:
            return customer

        customer = Customer(
            name=customer_data.get("name", "Unknown"),
            phone=customer_data.get("phone"),
            email=customer_data.get("email"),
            is_new_client=True,
        )
        db.add(customer)
        db.flush()  # Get the ID without committing
        logger.info(
            "Created new customer during call resolution: %s (ID: %s)",
            customer.name,
            customer.id,
        )
        return customer

    @staticmethod
    def _determine_outcome(function_calls: List[Dict[str, Any]]) -> str:
        """Determine call outcome based on function calls made."""
        if not function_calls:
            return "info_only"

        function_names = [fc["function"] for fc in function_calls]

        if "book_appointment" in function_names:
            return "booked"
        elif "check_availability" in function_names:
            return "browsing"
        else:
            return "info_only"

    @staticmethod
    def analyze_call_sentiment(transcript: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze call sentiment and calculate satisfaction score using GPT-4.

        Args:
            transcript: Conversation transcript

        Returns:
            Dictionary with sentiment and satisfaction score
        """
        if not transcript:
            return {"sentiment": "neutral", "satisfaction_score": 5.0}

        # Format transcript for analysis
        conversation_text = "\n".join(
            [
                f"{entry['speaker']}: {entry['text']}"
                for entry in transcript
                if entry.get("text")
            ]
        )

        # Use GPT-4 for sentiment analysis with retry logic
        import time
        from openai import APIError, RateLimitError, Timeout

        max_retries = 3
        base_delay = 1.0

        for attempt in range(max_retries):
            try:
                response = openai_client.chat.completions.create(
                    model=settings.OPENAI_SENTIMENT_MODEL,
                    timeout=30.0,  # 30 second timeout
                    messages=[
                        {
                            "role": "system",
                            "content": """You are an expert at analyzing customer service conversations.
Analyze the following conversation between a medical spa AI assistant and a customer.

Provide your analysis in JSON format with these fields:
- sentiment: overall sentiment (positive, neutral, negative, mixed)
- satisfaction_score: score from 0-10 (0=very dissatisfied, 10=very satisfied)
- frustration_indicators: list of moments where customer showed frustration
- success_indicators: list of moments where customer showed satisfaction
- overall_quality: brief assessment of conversation quality

Consider these factors:
- Did the customer accomplish their goal?
- Were there repeated clarifications needed?
- Did the customer express gratitude or positive feedback?
- Were there negative words or tone indicators?
- Was the conversation efficient or drawn out?
""",
                        },
                        {"role": "user", "content": conversation_text},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )

                # Success - parse and return
                analysis_content = response.choices[0].message.content
                analysis = json.loads(analysis_content)
                return {
                    "sentiment": analysis.get("sentiment", "neutral"),
                    "satisfaction_score": float(analysis.get("satisfaction_score", 5.0)),
                    "analysis_details": analysis,
                }

            except RateLimitError:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(
                        "OpenAI rate limit hit during sentiment analysis, retrying in %s seconds (attempt %s/%s)",
                        delay, attempt + 1, max_retries,
                        extra={"attempt": attempt + 1, "max_retries": max_retries}
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "OpenAI rate limit exceeded after %s retries during sentiment analysis",
                        max_retries,
                        exc_info=True
                    )
                    return {"sentiment": "neutral", "satisfaction_score": 5.0}

            except Timeout:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        "OpenAI API timeout during sentiment analysis, retrying in %s seconds (attempt %s/%s)",
                        delay, attempt + 1, max_retries,
                        extra={"attempt": attempt + 1, "max_retries": max_retries}
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "OpenAI API timeout after %s retries during sentiment analysis",
                        max_retries,
                        exc_info=True
                    )
                    return {"sentiment": "neutral", "satisfaction_score": 5.0}

            except APIError:
                logger.error("OpenAI API error during sentiment analysis", exc_info=True)
                return {"sentiment": "neutral", "satisfaction_score": 5.0}

            except Exception:
                logger.error("Unexpected error during sentiment analysis", exc_info=True)
                return {"sentiment": "neutral", "satisfaction_score": 5.0}

        # Fallback if all retries exhausted
        return {"sentiment": "neutral", "satisfaction_score": 5.0}

    @staticmethod
    def get_dashboard_overview(db: Session, period: str = "today") -> Dict[str, Any]:
        """
        Get dashboard overview metrics.

        Args:
            db: Database session
            period: Time period (today, week, month)

        Returns:
            Dictionary with overview metrics
        """
        now = datetime.utcnow()

        if period == "today":
            start_date = datetime.combine(now.date(), datetime.min.time())
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        else:
            start_date = datetime.combine(now.date(), datetime.min.time())

        # Get metrics from daily aggregates (lightweight)
        daily_metrics = (
            db.query(DailyMetric).filter(DailyMetric.date >= start_date.date()).all()
        )

        total_calls = sum(m.total_calls for m in daily_metrics)
        total_talk_time = sum(m.total_talk_time_seconds for m in daily_metrics)
        total_booked = sum(m.appointments_booked for m in daily_metrics)
        total_escalated = sum(m.calls_escalated for m in daily_metrics)

        avg_satisfaction = (
            sum(m.avg_satisfaction_score * m.total_calls for m in daily_metrics)
            / total_calls
            if total_calls > 0
            else 0.0
        )

        conversion_rate = (total_booked / total_calls * 100) if total_calls > 0 else 0.0

        # Count unique customers engaged (filtered by period for performance)
        from database import Conversation

        customers_engaged = (
            db.query(func.count(func.distinct(Conversation.customer_id)))
            .filter(
                Conversation.initiated_at >= start_date,
                Conversation.customer_id.isnot(None),
            )
            .scalar()
            or 0
        )

        # Count total messages sent (filtered by period for performance)
        from database import CommunicationMessage

        total_messages = (
            db.query(func.count(CommunicationMessage.id))
            .filter(CommunicationMessage.sent_at >= start_date)
            .scalar()
            or 0
        )

        return {
            "period": period,
            "total_calls": total_calls,
            "total_talk_time_hours": round(total_talk_time / 3600, 2),
            "total_talk_time_minutes": int(total_talk_time / 60),  # For new UI
            "avg_call_duration_minutes": (
                round(total_talk_time / total_calls / 60, 2) if total_calls > 0 else 0
            ),
            "appointments_booked": total_booked,
            "conversion_rate": round(conversion_rate, 2),
            "avg_satisfaction_score": round(avg_satisfaction, 2),
            "calls_escalated": total_escalated,
            "escalation_rate": (
                round(total_escalated / total_calls * 100, 2) if total_calls > 0 else 0
            ),
            "customers_engaged": customers_engaged,  # New metric
            "total_messages_sent": total_messages,  # New metric
        }

    @staticmethod
    def get_booking_health_window(
        db: Session,
        minutes: int = 60,
    ) -> Dict[str, Any]:
        """Return a lightweight health snapshot for recent AI bookings.

        This is intended for pilot monitoring and basic watchdog checks, not for
        detailed analytics. It looks at conversations and appointments in a
        recent time window and reports simple ratios.
        """

        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=minutes)

        total_conversations = (
            db.query(Conversation)
            .filter(Conversation.initiated_at >= cutoff)
            .count()
        )

        ai_bookings = (
            db.query(Appointment)
            .filter(
                Appointment.created_at >= cutoff,
                Appointment.booked_by == "ai",
                Appointment.status == "scheduled",
            )
            .count()
        )

        cancelled = (
            db.query(Appointment)
            .filter(Appointment.cancelled_at >= cutoff)
            .count()
        )

        conversion_rate = (
            ai_bookings / total_conversations * 100.0 if total_conversations else 0.0
        )

        return {
            "window_minutes": minutes,
            "total_conversations": total_conversations,
            "ai_appointments_scheduled": ai_bookings,
            "appointments_cancelled": cancelled,
            "conversion_rate": round(conversion_rate, 2),
        }

    @staticmethod
    def get_call_history(
        db: Session,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        sort_by: str = "started_at",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        Get paginated call history.

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            search: Search term (phone number or customer name)
            sort_by: Sort field
            sort_order: Sort order (asc/desc)

        Returns:
            Paginated call history
        """
        query = db.query(Conversation).filter(Conversation.channel == "voice")

        # Apply search filter (by customer phone or name where available)
        if search:
            query = query.join(Customer, Conversation.customer_id == Customer.id, isouter=True)
            query = query.filter(
                (Customer.phone.contains(search))
                | (Customer.name.contains(search))
            )

        # Apply sorting
        if sort_by == "duration_seconds":
            sort_column = Conversation.last_activity_at
        elif sort_by == "satisfaction_score":
            sort_column = Conversation.satisfaction_score
        else:
            sort_column = Conversation.initiated_at

        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        conversations = query.offset(offset).limit(page_size).all()

        calls: List[Dict[str, Any]] = []
        for conv in conversations:
            metadata = conv.custom_metadata or {}
            calls.append(
                {
                    "id": conv.id,
                    "session_id": metadata.get("session_id"),
                    "started_at": (
                        conv.initiated_at.isoformat() if conv.initiated_at else None
                    ),
                    "ended_at": (
                        conv.completed_at.isoformat()
                        if conv.completed_at
                        else (
                            conv.last_activity_at.isoformat()
                            if conv.last_activity_at
                            else None
                        )
                    ),
                    "duration_seconds": metadata.get("duration_seconds", 0),
                    "phone_number": metadata.get("phone_number"),
                    "customer_name": conv.customer.name if conv.customer else None,
                    "channel": conv.channel,
                    "customer_id": conv.customer_id,
                    "satisfaction_score": conv.satisfaction_score,
                    "sentiment": conv.sentiment,
                    "outcome": conv.outcome,
                    "escalated": metadata.get("escalated"),
                    "escalation_reason": metadata.get("escalation_reason"),
                }
            )

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "calls": calls,
        }

    # ==================== Omnichannel Communications Methods (Phase 2) ====================

    @staticmethod
    def create_conversation(
        db: Session,
        customer_id: Optional[int],
        channel: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Conversation:
        """
        Create a new omnichannel conversation.

        Args:
            db: Database session
            customer_id: Customer ID
            channel: Communication channel (voice, sms, email)
            metadata: Optional metadata dictionary

        Returns:
            Created Conversation object
        """
        import uuid

        conversation = Conversation(
            id=uuid.uuid4(),
            customer_id=customer_id,
            channel=channel,
            status="active",
            initiated_at=_utcnow(),
            last_activity_at=_utcnow(),
            custom_metadata=metadata or {},
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation

    @staticmethod
    def add_message(
        db: Session,
        conversation_id: Any,  # UUID
        direction: str,
        content: str,
        sent_at: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CommunicationMessage:
        """
        Add a message to a conversation.

        Args:
            db: Database session
            conversation_id: Conversation UUID
            direction: Message direction (inbound, outbound)
            content: Message content/text
            sent_at: Message timestamp (defaults to now)
            metadata: Optional metadata

        Returns:
            Created CommunicationMessage object
        """
        import uuid

        message = CommunicationMessage(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            direction=direction,
            content=content,
            sent_at=sent_at or _utcnow(),
            processed=False,
            custom_metadata=metadata or {},
        )
        db.add(message)

        conversation = (
            db.query(Conversation).filter(Conversation.id == conversation_id).first()
        )
        if conversation:
            conversation.last_activity_at = message.sent_at or _utcnow()

        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def add_voice_details(
        db: Session,
        message_id: Any,  # UUID
        duration_seconds: int,
        recording_url: Optional[str] = None,
        transcript_segments: Optional[List[Dict]] = None,
        function_calls: Optional[List[Dict]] = None,
        interruption_count: int = 0,
    ) -> VoiceCallDetails:
        """
        Add voice call details to a message.

        Args:
            db: Database session
            message_id: Message UUID
            duration_seconds: Call duration
            recording_url: Optional recording URL
            transcript_segments: Structured transcript with timestamps
            function_calls: List of function calls made
            interruption_count: Number of interruptions

        Returns:
            Created VoiceCallDetails object
        """
        voice_details = VoiceCallDetails(
            message_id=message_id,
            duration_seconds=duration_seconds,
            recording_url=recording_url,
            transcript_segments=transcript_segments or [],
            function_calls=function_calls or [],
            audio_quality_score=None,
            interruption_count=interruption_count,
        )
        db.add(voice_details)
        db.commit()
        db.refresh(voice_details)
        return voice_details

    @staticmethod
    def add_sms_details(
        db: Session,
        message_id: Any,  # UUID
        from_number: str,
        to_number: str,
        provider_message_id: str,
        delivery_status: Optional[str] = None,
        segments: int = 1,
        **kwargs,
    ) -> SMSDetails:
        """
        Add SMS details to a message.

        Args:
            db: Database session
            message_id: Message UUID
            from_number: Sender phone number
            to_number: Recipient phone number
            provider_message_id: Twilio message SID
            delivery_status: Delivery status
            segments: Number of SMS segments
            **kwargs: Additional fields (error_code, error_message, media_urls, etc.)

        Returns:
            Created SMSDetails object
        """
        sms_details = SMSDetails(
            message_id=message_id,
            from_number=from_number,
            to_number=to_number,
            provider_message_id=provider_message_id,
            delivery_status=delivery_status,
            segments=segments,
            **kwargs,
        )
        db.add(sms_details)
        db.commit()
        db.refresh(sms_details)
        return sms_details

    @staticmethod
    def add_email_details(
        db: Session,
        message_id: Any,  # UUID
        subject: str,
        from_address: str,
        to_address: str,
        body_text: str,
        body_html: Optional[str] = None,
        **kwargs,
    ) -> EmailDetails:
        """
        Add email details to a message.

        Args:
            db: Database session
            message_id: Message UUID
            subject: Email subject
            from_address: Sender email
            to_address: Recipient email
            body_text: Plain text body
            body_html: HTML body
            **kwargs: Additional fields (cc_addresses, attachments, etc.)

        Returns:
            Created EmailDetails object
        """
        email_details = EmailDetails(
            message_id=message_id,
            subject=subject,
            from_address=from_address,
            to_address=to_address,
            body_text=body_text,
            body_html=body_html,
            **kwargs,
        )
        db.add(email_details)
        db.commit()
        db.refresh(email_details)
        return email_details

    @staticmethod
    def add_communication_event(
        db: Session,
        conversation_id: Any,  # UUID
        event_type: str,
        message_id: Optional[Any] = None,  # UUID
        details: Optional[Dict[str, Any]] = None,
    ):
        """
        Add an event to a conversation.

        Args:
            db: Database session
            conversation_id: Conversation UUID
            event_type: Type of event
            message_id: Optional message UUID this event relates to
            details: Optional event details as JSON
        """
        from datetime import datetime, timezone

        from database import CommunicationEvent

        event = CommunicationEvent(
            conversation_id=conversation_id,
            message_id=message_id,
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            details=details or {},
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def complete_conversation(
        db: Session, conversation_id: Any, outcome: Optional[str] = None  # UUID
    ):
        """
        Mark a conversation as completed.

        Args:
            db: Database session
            conversation_id: Conversation UUID
            outcome: Optional outcome (appointment_scheduled, complaint, etc.)
        """
        conversation = (
            db.query(Conversation).filter(Conversation.id == conversation_id).first()
        )
        if conversation:
            conversation.status = "completed"
            conversation.completed_at = _utcnow()
            if outcome:
                conversation.outcome = outcome
            db.commit()

    @staticmethod
    def score_conversation_satisfaction(
        db: Session, conversation_id: Any  # UUID
    ) -> Dict[str, Any]:
        """
        Use GPT-4 to analyze conversation and generate satisfaction metrics.
        Works for single-message (voice) or multi-message (SMS/email) conversations.

        Args:
            db: Database session
            conversation_id: Conversation UUID

        Returns:
            Dictionary with satisfaction_score, sentiment, outcome, summary
        """
        from sqlalchemy.orm import joinedload

        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.id == conversation_id)
            .first()
        )

        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        messages = sorted(conversation.messages, key=lambda m: m.sent_at)

        if not messages:
            return {
                "satisfaction_score": 5,
                "sentiment": "neutral",
                "outcome": "unresolved",
                "summary": "",
            }

        # Build context for GPT-4
        context_lines = [f"Channel: {conversation.channel}"]

        for msg in messages:
            speaker = "Customer" if msg.direction == "inbound" else "Ava"
            content = msg.content or ""
            context_lines.append(f"{speaker}: {content}")

        context = "\n".join(context_lines)

        # Call GPT-4 for analysis
        try:
            response = openai_client.chat.completions.create(
                model=settings.OPENAI_SENTIMENT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert at analyzing customer service conversations across voice, SMS, and email.
Analyze the following conversation between Ava (AI receptionist) and a customer.

Provide your analysis in JSON format with these fields:
- satisfaction_score: score from 1-10 (1=very dissatisfied, 10=very satisfied)
- sentiment: overall sentiment (positive, neutral, negative, mixed)
- outcome: what happened? Options: appointment_scheduled, appointment_rescheduled, appointment_cancelled, info_request, escalated, abandoned, unresolved
- summary: brief 1-2 sentence description of the conversation

Consider:
- Did the customer accomplish their goal?
- Were there repeated clarifications needed?
- Did the customer express gratitude or positive feedback?
- Were there negative words or frustration indicators?
- Was the conversation efficient or drawn out?
""",
                    },
                    {"role": "user", "content": context},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )

            result = json.loads(response.choices[0].message.content)

            score = result.get("satisfaction_score", 5)
            sentiment = result.get("sentiment", "neutral")
            outcome = result.get("outcome", "unresolved")
            summary = result.get("summary", "")

            # Update conversation
            conversation.satisfaction_score = int(score)
            conversation.sentiment = sentiment
            conversation.outcome = outcome
            conversation.ai_summary = summary
            db.commit()

            return {
                "satisfaction_score": score,
                "sentiment": sentiment,
                "outcome": outcome,
                "summary": summary,
            }
        except Exception as exc:  # noqa: BLE001
            print(f"Error analyzing conversation satisfaction: {exc}")
            # Fallback to neutral values
            conversation.satisfaction_score = 5
            conversation.sentiment = "neutral"
            conversation.outcome = "unresolved"
            db.commit()

            return {
                "satisfaction_score": 5,
                "sentiment": "neutral",
                "outcome": "unresolved",
                "summary": "",
            }

    @staticmethod
    def log_tool_metric(
        db: Session,
        *,
        conversation_id: Any,
        tool_name: str,
        success: bool,
        message_id: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CommunicationEvent:
        """Persist an analytics event capturing tool usage."""
        details: Dict[str, Any] = {"tool": tool_name, "success": success}
        if metadata:
            details.update(metadata)

        event = CommunicationEvent(
            conversation_id=conversation_id,
            message_id=message_id,
            event_type="tool_invocation",
            timestamp=_utcnow(),
            details=details,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def log_calendar_error(
        db: Session,
        *,
        conversation_id: Any,
        tool_name: str,
        error: str,
        message_id: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CommunicationEvent:
        """Record calendar-specific failures for monitoring and alerting."""
        details: Dict[str, Any] = {"tool": tool_name, "error": error}
        if metadata:
            details.update(metadata)

        event = CommunicationEvent(
            conversation_id=conversation_id,
            message_id=message_id,
            event_type="calendar_error",
            timestamp=_utcnow(),
            details=details,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def tool_success_summary(db: Session, *, days: int = 7) -> Dict[str, Any]:
        """Aggregate tool invocation success metrics over a rolling window."""
        cutoff = _utcnow() - timedelta(days=days)

        events = (
            db.query(CommunicationEvent)
            .filter(CommunicationEvent.event_type == "tool_invocation")
            .filter(CommunicationEvent.timestamp >= cutoff)
            .all()
        )

        summary: Dict[str, Dict[str, Any]] = {}
        for event in events:
            details = event.details or {}
            tool = details.get("tool") or "unknown"
            entry = summary.setdefault(tool, {"total": 0, "success": 0})
            entry["total"] += 1
            if details.get("success"):
                entry["success"] += 1

        for entry in summary.values():
            total = entry["total"]
            entry["success_rate"] = entry["success"] / total if total else 0.0

        return {
            "window_days": days,
            "generated_at": _utcnow().isoformat(),
            "tools": summary,
        }

    @staticmethod
    def log_event(
        db: Session,
        *,
        conversation_id: Any,
        event_type: str,
        details: Dict[str, Any],
        message_id: Optional[Any] = None,
        timestamp: Optional[datetime] = None,
    ) -> CommunicationEvent:
        """
        Add an analytics event to a conversation.

        Args:
            db: Database session
            conversation_id: Conversation UUID
            event_type: Event type (intent_detected, function_called, etc.)
            details: Event details dictionary
            message_id: Optional message UUID
            timestamp: Event timestamp (defaults to now)
        """

        event = CommunicationEvent(
            conversation_id=conversation_id,
            message_id=message_id,
            event_type=event_type,
            timestamp=timestamp or _utcnow(),
            details=details,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def get_timeseries_metrics(
        db: Session,
        period: str = "week",
        interval: str = "hour",
        metrics: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get time-series metrics for charting.

        Args:
            db: Database session
            period: Time period (today, week, month)
            interval: Aggregation interval (hour, day)
            metrics: List of metrics to include (calls, bookings, satisfaction)

        Returns:
            List of time-series data points
        """
        from datetime import timedelta

        from sqlalchemy import Integer, cast, func

        now = _utcnow()

        # Determine date range
        if period == "today":
            start_date = datetime.combine(
                now.date(), datetime.min.time(), tzinfo=timezone.utc
            )
            trunc_format = "hour"
        elif period == "week":
            start_date = now - timedelta(days=7)
            trunc_format = interval if interval in ["hour", "day"] else "hour"
        elif period == "month":
            start_date = now - timedelta(days=30)
            trunc_format = "day"
        else:
            start_date = datetime.combine(
                now.date(), datetime.min.time(), tzinfo=timezone.utc
            )
            trunc_format = "hour"

        # Query conversations grouped by time interval
        query = (
            db.query(
                func.date_trunc(trunc_format, Conversation.initiated_at).label(
                    "timestamp"
                ),
                func.count(Conversation.id).label("total_calls"),
                func.count(
                    func.nullif(Conversation.outcome == "appointment_scheduled", False)
                ).label("appointments_booked"),
                func.avg(cast(Conversation.satisfaction_score, Integer)).label(
                    "avg_satisfaction_score"
                ),
            )
            .filter(Conversation.initiated_at >= start_date)
            .group_by(func.date_trunc(trunc_format, Conversation.initiated_at))
            .order_by("timestamp")
        )

        results = query.all()

        return [
            {
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "total_calls": r.total_calls or 0,
                "appointments_booked": r.appointments_booked or 0,
                "avg_satisfaction_score": round(
                    float(r.avg_satisfaction_score or 0), 2
                ),
            }
            for r in results
        ]

    @staticmethod
    def get_conversion_funnel(db: Session, period: str = "week") -> Dict[str, Any]:
        """
        Get conversion funnel metrics.

        Args:
            db: Database session
            period: Time period (today, week, month)

        Returns:
            Dictionary with funnel stage counts
        """
        from datetime import timedelta

        now = _utcnow()

        # Determine date range
        if period == "today":
            start_date = datetime.combine(
                now.date(), datetime.min.time(), tzinfo=timezone.utc
            )
        elif period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        else:
            start_date = datetime.combine(
                now.date(), datetime.min.time(), tzinfo=timezone.utc
            )

        # Stage 1: Total inquiries (all conversations)
        total_inquiries = (
            db.query(func.count(Conversation.id))
            .filter(Conversation.initiated_at >= start_date)
            .scalar()
            or 0
        )

        # Stage 2: Browsing (conversations with check_availability function calls)
        browsing_count = (
            db.query(func.count(func.distinct(CommunicationEvent.conversation_id)))
            .filter(
                CommunicationEvent.event_type == "function_called",
                CommunicationEvent.timestamp >= start_date,
                cast(CommunicationEvent.details["tool"], String) == "check_availability",
            )
            .scalar()
            or 0
        )

        # Stage 3: Booking attempts (book_appointment function called)
        booking_attempts = (
            db.query(func.count(func.distinct(CommunicationEvent.conversation_id)))
            .filter(
                CommunicationEvent.event_type == "function_called",
                CommunicationEvent.timestamp >= start_date,
                cast(CommunicationEvent.details["tool"], String) == "book_appointment",
            )
            .scalar()
            or 0
        )

        # Stage 4: Completed bookings (outcome = 'appointment_scheduled')
        completed_bookings = (
            db.query(func.count(Conversation.id))
            .filter(
                Conversation.initiated_at >= start_date,
                Conversation.outcome == "appointment_scheduled",
            )
            .scalar()
            or 0
        )

        return {
            "period": period,
            "stages": [
                {
                    "name": "Total Inquiries",
                    "value": total_inquiries,
                    "color": "#3b82f6",  # blue-500
                },
                {
                    "name": "Checked Availability",
                    "value": browsing_count,
                    "color": "#8b5cf6",  # violet-500
                },
                {
                    "name": "Attempted Booking",
                    "value": booking_attempts,
                    "color": "#f59e0b",  # amber-500
                },
                {
                    "name": "Booked Successfully",
                    "value": completed_bookings,
                    "color": "#10b981",  # emerald-500
                },
            ],
        }

    @staticmethod
    def get_peak_hours(db: Session, period: str = "week") -> List[Dict[str, Any]]:
        """
        Get peak hours heatmap data.

        Args:
            db: Database session
            period: Time period (week, month)

        Returns:
            List of heatmap cells with day/hour/value
        """
        from datetime import timedelta

        from sqlalchemy import extract

        now = _utcnow()

        # Determine date range
        if period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        else:
            start_date = now - timedelta(days=7)

        # Query conversations grouped by day of week and hour
        results = (
            db.query(
                extract("dow", Conversation.initiated_at).label("day"),
                extract("hour", Conversation.initiated_at).label("hour"),
                func.count(Conversation.id).label("value"),
            )
            .filter(Conversation.initiated_at >= start_date)
            .group_by(
                extract("dow", Conversation.initiated_at),
                extract("hour", Conversation.initiated_at),
            )
            .all()
        )

        return [
            {"day": int(r.day), "hour": int(r.hour), "value": r.value or 0}
            for r in results
        ]

    @staticmethod
    def get_customer_timeline(
        db: Session, customer_id: int, limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get conversation timeline for a specific customer.

        Args:
            db: Database session
            customer_id: Customer ID
            limit: Maximum number of conversations to return

        Returns:
            Dictionary with customer info and timeline
        """
        from sqlalchemy.orm import joinedload

        # Get customer
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Get full history objects
        appointments = (
            db.query(Appointment)
            .filter(Appointment.customer_id == customer_id)
            .order_by(Appointment.appointment_datetime.desc())
            .all()
        )

        # Get recent conversations with messages for rich timeline
        conversations = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.customer_id == customer_id)
            .order_by(Conversation.initiated_at.desc())
            .limit(limit)
            .all()
        )

        # Serialize rich timeline (per-conversation, with summary fields)
        timeline: List[Dict[str, Any]] = []
        for conv in conversations:
            timeline.append(
                {
                    "id": str(conv.id),
                    "channel": conv.channel,
                    "initiated_at": (
                        conv.initiated_at.isoformat() if conv.initiated_at else None
                    ),
                    "completed_at": (

                        conv.completed_at.isoformat() if conv.completed_at else None
                    ),
                    "outcome": conv.outcome,
                    "satisfaction_score": conv.satisfaction_score,
                    "sentiment": conv.sentiment,
                    "ai_summary": conv.ai_summary,
                    "message_count": len(conv.messages),
                    "status": conv.status,
                }
            )

        # Serialize appointments
        appointments_data = [
            {
                "id": apt.id,
                "appointment_datetime": apt.appointment_datetime.isoformat(),
                "service_type": apt.service_type,
                "provider": apt.provider,
                "status": apt.status,
                "booked_by": apt.booked_by,
                "special_requests": apt.special_requests,
                "created_at": apt.created_at.isoformat() if apt.created_at else None,
            }
            for apt in appointments
        ]

        # Serialize calls (voice conversations)
        calls_data = []
        for conv in conversations:
            if conv.channel != "voice":
                continue
            metadata = conv.custom_metadata or {}
            calls_data.append(
                {
                    "id": conv.id,
                    "session_id": metadata.get("session_id"),
                    "started_at": (
                        conv.initiated_at.isoformat() if conv.initiated_at else None
                    ),
                    "duration_seconds": metadata.get("duration_seconds"),
                    "satisfaction_score": conv.satisfaction_score,
                    "sentiment": conv.sentiment,
                    "outcome": conv.outcome,
                    "escalated": metadata.get("escalated"),
                }
            )

        # Simplified conversations list (for stats and message tab)
        conversations_data = [
            {
                "id": str(conv.id),
                "channel": conv.channel,
                "initiated_at": (
                    conv.initiated_at.isoformat() if conv.initiated_at else None
                ),
                "status": conv.status,
                "outcome": conv.outcome,
                "satisfaction_score": conv.satisfaction_score,
            }
            for conv in conversations
        ]

        # Calculate customer stats (lifetime, not limited by `limit`)
        total_appointments = (
            db.query(func.count(Appointment.id))
            .filter(Appointment.customer_id == customer_id)
            .scalar()
        )

        completed_appointments = (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.customer_id == customer_id,
                Appointment.status == "completed",
            )
            .scalar()
        )

        cancelled_appointments = (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.customer_id == customer_id,
                Appointment.status == "cancelled",
            )
            .scalar()
        )

        total_calls = (
            db.query(func.count(Conversation.id))
            .filter(
                Conversation.customer_id == customer_id,
                Conversation.channel == "voice",
            )
            .scalar()
        )

        avg_call_satisfaction = (
            db.query(func.avg(Conversation.satisfaction_score))
            .filter(
                Conversation.customer_id == customer_id,
                Conversation.channel == "voice",
                Conversation.satisfaction_score.isnot(None),
            )
            .scalar()
        )

        total_conversations = (
            db.query(func.count(Conversation.id))
            .filter(Conversation.customer_id == customer_id)
            .scalar()
        )

        total_bookings = sum(
            1 for c in conversations if c.outcome == "appointment_scheduled"
        )

        stats = {
            "customer_id": customer_id,
            "total_appointments": total_appointments or 0,
            "completed_appointments": completed_appointments or 0,
            "cancelled_appointments": cancelled_appointments or 0,
            "no_show_rate": (
                (cancelled_appointments / total_appointments * 100)
                if total_appointments and total_appointments > 0
                else 0
            ),
            "total_calls": total_calls or 0,
            "total_conversations": total_conversations or 0,
            "avg_satisfaction_score": float(avg_call_satisfaction)
            if avg_call_satisfaction
            else None,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "total_bookings": total_bookings,
            "channels_used": list(set(c.channel for c in conversations)),
        }

        customer_data = {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "email": customer.email,
            "is_new_client": customer.is_new_client,
            "has_allergies": customer.has_allergies,
            "is_pregnant": customer.is_pregnant,
            "notes": customer.notes,
            "created_at": (
                customer.created_at.isoformat() if customer.created_at else None
            ),
            "updated_at": (
                customer.updated_at.isoformat() if customer.updated_at else None
            ),
        }

        return {
            "customer": customer_data,
            "appointments": appointments_data,
            "calls": calls_data,
            "conversations": conversations_data,
            "timeline": timeline,
            "stats": stats,
        }

    @staticmethod
    def _get_period_start_date(period: str) -> datetime:
        """
        Helper method to get start date for a period.

        Args:
            period: Time period (today, week, month)

        Returns:
            Start datetime for the period
        """
        from datetime import timedelta

        now = _utcnow()

        if period == "today":
            return datetime.combine(
                now.date(), datetime.min.time(), tzinfo=timezone.utc
            )
        elif period == "week":
            return now - timedelta(days=7)
        elif period == "month":
            return now - timedelta(days=30)
        else:
            return now - timedelta(days=7)  # default to week

    @staticmethod
    def get_channel_distribution(
        db: Session, period: str = "week"
    ) -> List[Dict[str, Any]]:
        """
        Get conversation count by communication channel.

        Args:
            db: Database session
            period: Time period (today, week, month)

        Returns:
            List of channel distribution data
        """
        try:
            start_date = AnalyticsService._get_period_start_date(period)

            # Query channel counts
            results = (
                db.query(
                    Conversation.channel, func.count(Conversation.id).label("count")
                )
                .filter(Conversation.initiated_at >= start_date)
                .group_by(Conversation.channel)
                .all()
            )

            channel_colors = {
                "voice": "#3b82f6",  # blue-500
                "sms": "#8b5cf6",  # violet-500
                "email": "#10b981",  # emerald-500
            }

            return [
                {
                    "name": r.channel.capitalize() if r.channel else "Unknown",
                    "conversations": r.count,
                    "color": channel_colors.get(r.channel, "#6b7280"),
                }
                for r in results
            ]
        except Exception as e:
            print(f"Error in get_channel_distribution: {e}")
            return []

    @staticmethod
    def get_outcome_distribution(
        db: Session, period: str = "week"
    ) -> List[Dict[str, Any]]:
        """
        Get conversation count by outcome.

        Args:
            db: Database session
            period: Time period (today, week, month)

        Returns:
            List of outcome distribution data
        """
        try:
            start_date = AnalyticsService._get_period_start_date(period)

            # Query outcome counts
            results = (
                db.query(
                    Conversation.outcome, func.count(Conversation.id).label("count")
                )
                .filter(
                    Conversation.initiated_at >= start_date,
                    Conversation.outcome.isnot(None),
                )
                .group_by(Conversation.outcome)
                .all()
            )

            outcome_config = {
                "appointment_scheduled": ("Booked", "#10b981"),  # emerald-500
                "appointment_rescheduled": ("Rescheduled", "#6366f1"),  # indigo-500
                "appointment_cancelled": ("Cancelled", "#f97316"),  # orange-500
                "info_request": ("Info Only", "#3b82f6"),  # blue-500
                "escalated": ("Escalated", "#eab308"),  # yellow-500
                "abandoned": ("Abandoned", "#6b7280"),  # gray-500
                "unresolved": ("Unresolved", "#64748b"),  # slate-500
            }

            return [
                {
                    "name": outcome_config.get(
                        r.outcome, (r.outcome.replace("_", " ").title(), "#6b7280")
                    )[0],
                    "count": r.count,
                    "color": outcome_config.get(
                        r.outcome, (r.outcome.replace("_", " ").title(), "#6b7280")
                    )[1],
                }
                for r in results
            ]
        except Exception as e:
            print(f"Error in get_outcome_distribution: {e}")
            return []
