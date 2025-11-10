"""
Analytics service for call tracking, sentiment analysis, and satisfaction scoring.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from openai import OpenAI
from database import CallSession, CallEvent, Customer, Appointment, DailyMetric
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
        db: Session,
        session_id: str,
        phone_number: Optional[str] = None
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
            session_id=session_id,
            phone_number=phone_number,
            started_at=_utcnow()
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
        customer_data: Dict[str, Any]
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
        call_session = db.query(CallSession).filter(
            CallSession.session_id == session_id
        ).first()

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

        # Link to customer if identified
        if customer_data.get('phone'):
            customer = db.query(Customer).filter(
                Customer.phone == customer_data['phone']
            ).first()
            if customer:
                call_session.customer_id = customer.id

        # Determine outcome
        call_session.outcome = AnalyticsService._determine_outcome(function_calls)

        # Analyze sentiment and satisfaction
        sentiment_analysis = AnalyticsService.analyze_call_sentiment(transcript)
        call_session.sentiment = sentiment_analysis['sentiment']
        call_session.satisfaction_score = sentiment_analysis['satisfaction_score']

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

        function_names = [fc['function'] for fc in function_calls]

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
            return {
                'sentiment': 'neutral',
                'satisfaction_score': 5.0
            }

        # Format transcript for analysis
        conversation_text = "\n".join([
            f"{entry['speaker']}: {entry['text']}"
            for entry in transcript
            if entry.get('text')
        ])

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
"""
                    },
                    {
                        "role": "user",
                        "content": conversation_text
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )

            analysis_content = response.choices[0].message.content
            analysis = json.loads(analysis_content)
            return {
                'sentiment': analysis.get('sentiment', 'neutral'),
                'satisfaction_score': float(analysis.get('satisfaction_score', 5.0)),
                'analysis_details': analysis
            }

        except Exception as e:
            print(f"Error analyzing sentiment: {e}")
            return {
                'sentiment': 'neutral',
                'satisfaction_score': 5.0
            }

    @staticmethod
    def log_call_event(
        db: Session,
        call_session_id: int,
        event_type: str,
        data: Optional[Dict[str, Any]] = None
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
            timestamp=_utcnow()
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
            daily_metric = db.query(DailyMetric).filter(
                DailyMetric.date == normalized_date
            ).first()

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
                    conversion_rate=0.0
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
            all_sessions_today = db.query(CallSession).filter(
                CallSession.started_at >= normalized_date,
                CallSession.started_at < normalized_date + timedelta(days=1),
                CallSession.satisfaction_score.isnot(None)
            ).all()

            if all_sessions_today:
                total_score = sum(s.satisfaction_score for s in all_sessions_today)
                daily_metric.avg_satisfaction_score = total_score / len(all_sessions_today)

            try:
                db.commit()
                break
            except IntegrityError:
                print("IntegrityError updating daily metrics; retrying with fresh state")
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

        # Get metrics
        daily_metrics = db.query(DailyMetric).filter(
            DailyMetric.date >= start_date.date()
        ).all()

        total_calls = sum(m.total_calls for m in daily_metrics)
        total_talk_time = sum(m.total_talk_time_seconds for m in daily_metrics)
        total_booked = sum(m.appointments_booked for m in daily_metrics)
        total_escalated = sum(m.calls_escalated for m in daily_metrics)

        avg_satisfaction = (
            sum(m.avg_satisfaction_score * m.total_calls for m in daily_metrics) / total_calls
            if total_calls > 0 else 0.0
        )

        conversion_rate = (total_booked / total_calls * 100) if total_calls > 0 else 0.0

        return {
            "period": period,
            "total_calls": total_calls,
            "total_talk_time_hours": round(total_talk_time / 3600, 2),
            "avg_call_duration_minutes": round(total_talk_time / total_calls / 60, 2) if total_calls > 0 else 0,
            "appointments_booked": total_booked,
            "conversion_rate": round(conversion_rate, 2),
            "avg_satisfaction_score": round(avg_satisfaction, 2),
            "calls_escalated": total_escalated,
            "escalation_rate": round(total_escalated / total_calls * 100, 2) if total_calls > 0 else 0
        }

    @staticmethod
    def get_call_history(
        db: Session,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        sort_by: str = "started_at",
        sort_order: str = "desc"
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
            query = query.join(Customer, CallSession.customer_id == Customer.id, isouter=True)
            query = query.filter(
                (CallSession.phone_number.contains(search)) |
                (Customer.name.contains(search))
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
            serialized_calls.append({
                "id": call.id,
                "session_id": call.session_id,
                "started_at": call.started_at.isoformat() if call.started_at else None,
                "ended_at": call.ended_at.isoformat() if call.ended_at else None,
                "duration_seconds": call.duration_seconds or 0,
                "phone_number": call.phone_number,
                "customer_id": call.customer_id,
                "satisfaction_score": call.satisfaction_score,
                "sentiment": call.sentiment,
                "outcome": call.outcome,
                "escalated": call.escalated,
                "escalation_reason": call.escalation_reason,
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "calls": serialized_calls
        }
