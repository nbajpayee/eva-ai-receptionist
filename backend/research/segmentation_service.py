"""
Customer segmentation service for research campaigns.
Provides pre-built segment templates and dynamic segment building.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from config import get_settings
from database import Appointment, CommunicationMessage, Conversation, Customer

settings = get_settings()


class SegmentationService:
    """Service for building and executing customer segments."""

    # Pre-built segment templates
    SEGMENT_TEMPLATES = {
        "sms_booking_abandoners": {
            "name": "SMS Booking Abandoners",
            "description": "Customers who texted about booking but didn't complete",
            "criteria": {
                "channel": "sms",
                "has_booking_intent": True,
                "has_appointment": False,
                "days_since_last_contact": 7,
            },
        },
        "booking_flow_abandoners": {
            "name": "Booking Flow Abandoners",
            "description": "Customers who started booking flow but didn't book",
            "criteria": {
                "metadata_key": "visited_booking_page",
                "has_appointment": False,
                "days_since_visit": 3,
            },
        },
        "high_satisfaction_no_repeat": {
            "name": "High Satisfaction, No Repeat",
            "description": "Satisfied customers who haven't returned",
            "criteria": {
                "min_satisfaction_score": 8,
                "has_appointment": True,
                "days_since_last_appointment": 90,
                "appointment_count": 1,
            },
        },
        "recent_callers_no_booking": {
            "name": "Recent Callers Without Booking",
            "description": "Called in last 30 days but didn't book",
            "criteria": {
                "channel": "voice",
                "has_appointment": False,
                "days_since_last_contact": 30,
                "outcome": ["info_only", "browsing"],
            },
        },
        "inactive_customers": {
            "name": "Inactive Customers (90+ days)",
            "description": "No contact or appointment in 90+ days",
            "criteria": {"has_appointment": True, "days_since_last_activity": 90},
        },
        "cancelled_appointments": {
            "name": "Cancelled Appointments",
            "description": "Customers who cancelled their last appointment",
            "criteria": {
                "last_appointment_status": "cancelled",
                "days_since_cancellation": 14,
            },
        },
    }

    @staticmethod
    def get_templates() -> Dict[str, Dict[str, Any]]:
        """Get all segment templates."""
        return SegmentationService.SEGMENT_TEMPLATES

    @staticmethod
    def preview_segment(db: Session, criteria: Dict[str, Any]) -> Dict[str, Any]:
        """
        Preview segment size and sample customers.

        Args:
            db: Database session
            criteria: Segment criteria dictionary

        Returns:
            Dictionary with count and sample customers
        """
        query = SegmentationService._build_query(db, criteria)

        total_count = query.count()
        sample_customers = query.limit(5).all()

        return {
            "total_count": total_count,
            "sample": [
                {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email}
                for c in sample_customers
            ],
        }

    @staticmethod
    def execute_segment(
        db: Session, criteria: Dict[str, Any], limit: Optional[int] = None
    ) -> List[Customer]:
        """
        Execute segment query and return matching customers.

        Args:
            db: Database session
            criteria: Segment criteria dictionary
            limit: Optional limit on results

        Returns:
            List of Customer objects
        """
        query = SegmentationService._build_query(db, criteria)

        if limit:
            query = query.limit(limit)

        return query.all()

    @staticmethod
    def _build_query(db: Session, criteria: Dict[str, Any]):
        """
        Build SQLAlchemy query from criteria dictionary.

        Supported criteria:
        - channel: Filter by conversation channel (voice/sms/email)
        - has_booking_intent: True if conversation shows booking intent
        - has_appointment: True/False for customers with/without appointments
        - days_since_last_contact: Days since last conversation
        - days_since_last_appointment: Days since last appointment
        - days_since_last_activity: Days since any activity
        - min_satisfaction_score: Minimum satisfaction score
        - max_satisfaction_score: Maximum satisfaction score
        - outcome: List of conversation outcomes
        - appointment_count: Specific appointment count
        - last_appointment_status: Status of last appointment
        - days_since_cancellation: Days since last cancellation
        """
        query = db.query(Customer)
        conditions = []

        now = datetime.utcnow()

        # Channel filter
        if criteria.get("channel"):
            channel = criteria["channel"]
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            conditions.append(Conversation.channel == channel)

        # Booking intent filter (checks for keywords in conversations)
        if criteria.get("has_booking_intent"):
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            query = query.join(
                CommunicationMessage,
                Conversation.id == CommunicationMessage.conversation_id,
            )
            conditions.append(
                or_(
                    CommunicationMessage.content.ilike("%book%"),
                    CommunicationMessage.content.ilike("%schedule%"),
                    CommunicationMessage.content.ilike("%appointment%"),
                )
            )

        # Appointment existence filter
        if "has_appointment" in criteria:
            has_appointment = criteria["has_appointment"]
            if has_appointment:
                query = query.join(Appointment, Customer.id == Appointment.customer_id)
            else:
                # Use LEFT JOIN and filter for NULL
                query = query.outerjoin(
                    Appointment, Customer.id == Appointment.customer_id
                )
                conditions.append(Appointment.id == None)

        # Days since last contact
        if criteria.get("days_since_last_contact"):
            days = criteria["days_since_last_contact"]
            cutoff_date = now - timedelta(days=days)
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            conditions.append(Conversation.initiated_at >= cutoff_date)

        # Days since last appointment
        if criteria.get("days_since_last_appointment"):
            days = criteria["days_since_last_appointment"]
            cutoff_date = now - timedelta(days=days)
            query = query.join(Appointment, Customer.id == Appointment.customer_id)
            conditions.append(Appointment.appointment_datetime <= cutoff_date)

        # Days since last activity (conversation or appointment)
        if criteria.get("days_since_last_activity"):
            days = criteria["days_since_last_activity"]
            cutoff_date = now - timedelta(days=days)
            # Subquery for last conversation date
            last_conv = (
                db.query(
                    Conversation.customer_id,
                    func.max(Conversation.last_activity_at).label("last_conv"),
                )
                .group_by(Conversation.customer_id)
                .subquery()
            )

            # Subquery for last appointment date
            last_appt = (
                db.query(
                    Appointment.customer_id,
                    func.max(Appointment.appointment_datetime).label("last_appt"),
                )
                .group_by(Appointment.customer_id)
                .subquery()
            )

            query = query.outerjoin(last_conv, Customer.id == last_conv.c.customer_id)
            query = query.outerjoin(last_appt, Customer.id == last_appt.c.customer_id)
            conditions.append(
                or_(
                    and_(
                        last_conv.c.last_conv != None,
                        last_conv.c.last_conv <= cutoff_date,
                    ),
                    and_(
                        last_appt.c.last_appt != None,
                        last_appt.c.last_appt <= cutoff_date,
                    ),
                )
            )

        # Satisfaction score filters
        if criteria.get("min_satisfaction_score"):
            min_score = criteria["min_satisfaction_score"]
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            conditions.append(Conversation.satisfaction_score >= min_score)

        if criteria.get("max_satisfaction_score"):
            max_score = criteria["max_satisfaction_score"]
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            conditions.append(Conversation.satisfaction_score <= max_score)

        # Outcome filter (from conversations)
        if criteria.get("outcome"):
            outcomes = (
                criteria["outcome"]
                if isinstance(criteria["outcome"], list)
                else [criteria["outcome"]]
            )
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            conditions.append(Conversation.outcome.in_(outcomes))

        # Appointment count filter
        if "appointment_count" in criteria:
            count = criteria["appointment_count"]
            appt_count = (
                db.query(
                    Appointment.customer_id, func.count(Appointment.id).label("count")
                )
                .group_by(Appointment.customer_id)
                .having(func.count(Appointment.id) == count)
                .subquery()
            )

            query = query.join(appt_count, Customer.id == appt_count.c.customer_id)

        # Last appointment status
        if criteria.get("last_appointment_status"):
            status = criteria["last_appointment_status"]
            # Subquery to get most recent appointment per customer
            last_appt_subq = (
                db.query(
                    Appointment.customer_id,
                    func.max(Appointment.appointment_datetime).label("max_date"),
                )
                .group_by(Appointment.customer_id)
                .subquery()
            )

            query = query.join(Appointment, Customer.id == Appointment.customer_id)
            query = query.join(
                last_appt_subq,
                and_(
                    Appointment.customer_id == last_appt_subq.c.customer_id,
                    Appointment.appointment_datetime == last_appt_subq.c.max_date,
                ),
            )
            conditions.append(Appointment.status == status)

        # Days since cancellation
        if criteria.get("days_since_cancellation"):
            days = criteria["days_since_cancellation"]
            cutoff_date = now - timedelta(days=days)
            query = query.join(Appointment, Customer.id == Appointment.customer_id)
            conditions.append(Appointment.status == "cancelled")
            conditions.append(Appointment.cancelled_at >= cutoff_date)

        # Apply all conditions
        if conditions:
            query = query.filter(and_(*conditions))

        # Ensure distinct customers (in case of multiple joins)
        query = query.distinct()

        return query

    @staticmethod
    def save_segment(
        db: Session, name: str, description: Optional[str], criteria: Dict[str, Any]
    ) -> Any:
        """
        Save a segment definition for reuse.

        Args:
            db: Database session
            name: Segment name
            description: Optional description
            criteria: Segment criteria dictionary

        Returns:
            Created CustomerSegment object
        """
        import uuid

        from database import CustomerSegment

        segment = CustomerSegment(
            id=uuid.uuid4(), name=name, description=description, criteria=criteria
        )
        db.add(segment)
        db.commit()
        db.refresh(segment)
        return segment

    @staticmethod
    def get_saved_segments(db: Session) -> List[Any]:
        """Get all saved segments."""
        from database import CustomerSegment

        return (
            db.query(CustomerSegment).order_by(CustomerSegment.created_at.desc()).all()
        )

    @staticmethod
    def delete_segment(db: Session, segment_id: str) -> bool:
        """Delete a saved segment."""
        import uuid

        from database import CustomerSegment

        segment = (
            db.query(CustomerSegment)
            .filter(CustomerSegment.id == uuid.UUID(segment_id))
            .first()
        )
        if segment:
            db.delete(segment)
            db.commit()
            return True
        return False
