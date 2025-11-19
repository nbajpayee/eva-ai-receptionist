"""
Analytics service for call tracking, sentiment analysis, and satisfaction scoring.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from openai import OpenAI
from database import (
    CallSession,
    CallEvent,
    Customer,
    Appointment,
    DailyMetric,
    Conversation,
    CommunicationMessage,
    VoiceCallDetails,
    EmailDetails,
    SMSDetails,
    CommunicationEvent,
)
from config import get_settings

settings = get_settings()
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


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
    """Service for tracking and analyzing call sessions."""

    @staticmethod
    def create_call_session(
        db: Session, session_id: str, phone_number: Optional[str] = None
    ) -> CallSession:
        """
        Create a new call session record.

        Args:
            db: Database session
            session_id: Unique session identifier
            phone_number: Customer phone number

        Returns:
            Created CallSession object
        """
        call_session = CallSession(
            session_id=session_id, phone_number=phone_number, started_at=_utcnow()
        )
        db.add(call_session)
        db.commit()
        db.refresh(call_session)
        return call_session

    @staticmethod
    def end_call_session(
        db: Session,
        session_id: str,
        transcript: List[Dict[str, Any]],
        function_calls: List[Dict[str, Any]],
        customer_data: Dict[str, Any],
    ) -> CallSession:
        """
        End a call session and analyze it.

        Args:
            db: Database session
            session_id: Session identifier
            transcript: Full conversation transcript
            function_calls: List of function calls made
            customer_data: Customer information collected

        Returns:
            Updated CallSession object
        """
        call_session = (
            db.query(CallSession).filter(CallSession.session_id == session_id).first()
        )

        if not call_session:
            raise ValueError(f"Call session not found: {session_id}")

        # Calculate duration
        ended_at = _utcnow()
        call_session.ended_at = ended_at

        started_at = _ensure_utc(call_session.started_at)
        if started_at is not None:
            call_session.duration_seconds = int((ended_at - started_at).total_seconds())
        else:
            call_session.duration_seconds = 0

        # Store transcript
        call_session.transcript = json.dumps(transcript)

        # Store function calls count
        call_session.function_calls_made = len(function_calls)

        # Link to customer if identified (create if doesn't exist)
        if customer_data.get("phone"):
            customer = (
                db.query(Customer)
                .filter(Customer.phone == customer_data["phone"])
                .first()
            )

            if not customer:
                # Create new customer
                customer = Customer(
                    name=customer_data.get("name", "Unknown"),
                    phone=customer_data.get("phone"),
                    email=customer_data.get("email"),
                    is_new_client=True,
                )
                db.add(customer)
                db.flush()  # Get the ID without committing
                print(f"✨ Created new customer: {customer.name} (ID: {customer.id})")

            call_session.customer_id = customer.id

        # Determine outcome
        call_session.outcome = AnalyticsService._determine_outcome(function_calls)

        # Analyze sentiment and satisfaction
        sentiment_analysis = AnalyticsService.analyze_call_sentiment(transcript)
        call_session.sentiment = sentiment_analysis["sentiment"]
        call_session.satisfaction_score = sentiment_analysis["satisfaction_score"]

        db.commit()
        db.refresh(call_session)

        # Update daily metrics
        AnalyticsService.update_daily_metrics(db, call_session)

        return call_session

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

        # Use GPT-4 for sentiment analysis
        try:
            response = openai_client.chat.completions.create(
                model=settings.OPENAI_SENTIMENT_MODEL,
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

            analysis_content = response.choices[0].message.content
            analysis = json.loads(analysis_content)
            return {
                "sentiment": analysis.get("sentiment", "neutral"),
                "satisfaction_score": float(analysis.get("satisfaction_score", 5.0)),
                "analysis_details": analysis,
            }

        except Exception as e:
            print(f"Error analyzing sentiment: {e}")
            return {"sentiment": "neutral", "satisfaction_score": 5.0}

    @staticmethod
    def log_call_event(
        db: Session,
        call_session_id: int,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
    ):
        """
        Log an event during a call.

        Args:
            db: Database session
            call_session_id: Call session ID
            event_type: Type of event
            data: Event data
        """
        event = CallEvent(
            call_session_id=call_session_id,
            event_type=event_type,
            data=data,
            timestamp=_utcnow(),
        )
        db.add(event)
        db.commit()

    @staticmethod
    def update_daily_metrics(db: Session, call_session: CallSession):
        """
        Update daily metrics based on completed call.

        Args:
            db: Database session
            call_session: Completed call session
        """
        started_at = _ensure_utc(call_session.started_at) or _utcnow()
        normalized_date = datetime.combine(
            started_at.date(),
            datetime.min.time(),
            tzinfo=timezone.utc,
        )

        while True:
            daily_metric = (
                db.query(DailyMetric)
                .filter(DailyMetric.date == normalized_date)
                .first()
            )

            if not daily_metric:
                daily_metric = DailyMetric(
                    date=normalized_date,
                    total_calls=0,
                    total_talk_time_seconds=0,
                    avg_call_duration_seconds=0,
                    appointments_booked=0,
                    appointments_rescheduled=0,
                    appointments_cancelled=0,
                    avg_satisfaction_score=0.0,
                    calls_escalated=0,
                    conversion_rate=0.0,
                )
                db.add(daily_metric)

            # Update metrics
            daily_metric.total_calls += 1
            daily_metric.total_talk_time_seconds += call_session.duration_seconds or 0

            if call_session.outcome == "booked":
                daily_metric.appointments_booked += 1

            if call_session.escalated:
                daily_metric.calls_escalated += 1

            # Calculate averages
            daily_metric.avg_call_duration_seconds = int(
                daily_metric.total_talk_time_seconds / daily_metric.total_calls
            )

            # Calculate conversion rate
            if daily_metric.total_calls > 0:
                daily_metric.conversion_rate = (
                    daily_metric.appointments_booked / daily_metric.total_calls * 100
                )

            # Update average satisfaction score
            all_sessions_today = (
                db.query(CallSession)
                .filter(
                    CallSession.started_at >= normalized_date,
                    CallSession.started_at < normalized_date + timedelta(days=1),
                    CallSession.satisfaction_score.isnot(None),
                )
                .all()
            )

            if all_sessions_today:
                total_score = sum(s.satisfaction_score for s in all_sessions_today)
                daily_metric.avg_satisfaction_score = total_score / len(
                    all_sessions_today
                )

            try:
                db.commit()
                break
            except IntegrityError:
                print(
                    "IntegrityError updating daily metrics; retrying with fresh state"
                )
                db.rollback()
                continue

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
        query = db.query(CallSession)

        # Apply search filter
        if search:
            query = query.join(
                Customer, CallSession.customer_id == Customer.id, isouter=True
            )
            query = query.filter(
                (CallSession.phone_number.contains(search))
                | (Customer.name.contains(search))
            )

        # Apply sorting
        sort_column = getattr(CallSession, sort_by, CallSession.started_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Get total count
        total = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        calls = query.offset(offset).limit(page_size).all()

        serialized_calls: List[Dict[str, Any]] = []
        for call in calls:
            serialized_calls.append(
                {
                    "id": call.id,
                    "session_id": call.session_id,
                    "started_at": (
                        call.started_at.isoformat() if call.started_at else None
                    ),
                    "ended_at": call.ended_at.isoformat() if call.ended_at else None,
                    "duration_seconds": call.duration_seconds or 0,
                    "phone_number": call.phone_number,
                    "customer_name": call.customer.name if call.customer else None,
                    "channel": "voice",
                    "customer_id": call.customer_id,
                    "satisfaction_score": call.satisfaction_score,
                    "sentiment": call.sentiment,
                    "outcome": call.outcome,
                    "escalated": call.escalated,
                    "escalation_reason": call.escalation_reason,
                }
            )

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "calls": serialized_calls,
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
- outcome: what happened? Options: appointment_scheduled, appointment_rescheduled, appointment_cancelled, info_request, complaint, unresolved
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
        from sqlalchemy import func, cast, Integer

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
                CommunicationEvent.details["tool"].astext == "check_availability",
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
                CommunicationEvent.details["tool"].astext == "book_appointment",
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

        # Get conversations
        conversations = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.customer_id == customer_id)
            .order_by(Conversation.initiated_at.desc())
            .limit(limit)
            .all()
        )

        # Serialize timeline
        timeline = []
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

        # Calculate customer stats
        total_conversations = len(conversations)
        avg_satisfaction = sum(c.satisfaction_score or 0 for c in conversations) / max(
            total_conversations, 1
        )
        total_bookings = sum(
            1 for c in conversations if c.outcome == "appointment_scheduled"
        )

        return {
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "phone": customer.phone,
                "email": customer.email,
                "created_at": (
                    customer.created_at.isoformat() if customer.created_at else None
                ),
            },
            "stats": {
                "total_conversations": total_conversations,
                "avg_satisfaction_score": round(avg_satisfaction, 2),
                "total_bookings": total_bookings,
                "channels_used": list(set(c.channel for c in conversations)),
            },
            "timeline": timeline,
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
                "info_request": ("Info Only", "#3b82f6"),  # blue-500
                "complaint": ("Complaint", "#ef4444"),  # red-500
                "unresolved": ("Unresolved", "#f97316"),  # orange-500
                "browsing": ("Browsing", "#8b5cf6"),  # violet-500
                "escalated": ("Escalated", "#eab308"),  # yellow-500
                "abandoned": ("Abandoned", "#6b7280"),  # gray-500
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
