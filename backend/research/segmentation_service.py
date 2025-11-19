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
        joined_conversation = False
        joined_appointment = False
        joined_message = False

        now = datetime.utcnow()

        # Track which filters need Conversation join
        needs_conversation = any(
            [
                criteria.get("channel"),
                criteria.get("has_booking_intent"),
                criteria.get("min_satisfaction_score"),
                criteria.get("max_satisfaction_score"),
                criteria.get("outcome"),
            ]
        )

        # Track which filters need Appointment join
        needs_appointment = any(
            [
                criteria.get("has_appointment") is True,
                criteria.get("last_appointment_status"),
                criteria.get("days_since_cancellation"),
            ]
        )

        # Perform joins once if needed
        if needs_conversation:
            query = query.join(Conversation, Customer.id == Conversation.customer_id)
            joined_conversation = True

        if needs_appointment:
            query = query.join(Appointment, Customer.id == Appointment.customer_id)
            joined_appointment = True
        elif criteria.get("has_appointment") is False:
            # For "no appointments" filter, use outerjoin
            query = query.outerjoin(Appointment, Customer.id == Appointment.customer_id)
            joined_appointment = True

        # Now apply all filters

        # Channel filter
        if criteria.get("channel"):
            conditions.append(Conversation.channel == criteria["channel"])

        # Booking intent filter - use conversation outcome instead of text search
        if criteria.get("has_booking_intent"):
            # Conversations with booking-related outcomes
            booking_outcomes = [
                "appointment_booked",
                "booking_in_progress",
                "booking_attempted",
            ]
            conditions.append(Conversation.outcome.in_(booking_outcomes))

        # Appointment existence filter
        if criteria.get("has_appointment") is False:
            conditions.append(Appointment.id.is_(None))

        # Days since last contact (use subquery to get LAST contact per customer)
        if criteria.get("days_since_last_contact"):
            days = criteria["days_since_last_contact"]
            cutoff_date = now - timedelta(days=days)

            # Subquery for last conversation date per customer
            last_contact_subq = (
                db.query(
                    Conversation.customer_id,
                    func.max(Conversation.last_activity_at).label("last_contact"),
                )
                .group_by(Conversation.customer_id)
                .subquery()
            )

            query = query.join(
                last_contact_subq, Customer.id == last_contact_subq.c.customer_id
            )
            # Filter for contacts OLDER than X days (last_contact <= cutoff_date)
            conditions.append(last_contact_subq.c.last_contact <= cutoff_date)

        # Days since last appointment (use subquery to get LAST appointment per customer)
        if criteria.get("days_since_last_appointment"):
            days = criteria["days_since_last_appointment"]
            cutoff_date = now - timedelta(days=days)

            # Subquery for last appointment date per customer
            last_appt_date_subq = (
                db.query(
                    Appointment.customer_id,
                    func.max(Appointment.appointment_datetime).label("last_appt_date"),
                )
                .group_by(Appointment.customer_id)
                .subquery()
            )

            query = query.join(
                last_appt_date_subq, Customer.id == last_appt_date_subq.c.customer_id
            )
            # Filter for appointments OLDER than X days (last_appt <= cutoff_date)
            conditions.append(last_appt_date_subq.c.last_appt_date <= cutoff_date)

        # Days since last activity (uses subqueries to avoid join conflicts)
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
                        last_conv.c.last_conv.isnot(None),
                        last_conv.c.last_conv <= cutoff_date,
                    ),
                    and_(
                        last_appt.c.last_appt.isnot(None),
                        last_appt.c.last_appt <= cutoff_date,
                    ),
                )
            )

        # Satisfaction score filters
        if criteria.get("min_satisfaction_score"):
            conditions.append(
                Conversation.satisfaction_score >= criteria["min_satisfaction_score"]
            )

        if criteria.get("max_satisfaction_score"):
            conditions.append(
                Conversation.satisfaction_score <= criteria["max_satisfaction_score"]
            )

        # Outcome filter
        if criteria.get("outcome"):
            outcomes = (
                criteria["outcome"]
                if isinstance(criteria["outcome"], list)
                else [criteria["outcome"]]
            )
            conditions.append(Conversation.outcome.in_(outcomes))

        # Appointment count filter (uses subquery)
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

        # Last appointment status (uses subquery to avoid multiple joins)
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

            # Only join if we haven't already
            if not joined_appointment:
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
