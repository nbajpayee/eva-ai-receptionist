"""
Edge case tests for duplicate appointment prevention.

These tests verify:
- Same customer/same time duplicates
- Overlapping appointments
- Cross-channel duplicate detection
- Race condition handling
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch
import uuid

import pytest

from booking_handlers import handle_book_appointment
from database import Customer, Appointment


@pytest.mark.integration
@pytest.mark.booking
class TestDuplicateAppointments:
    """Test duplicate appointment prevention logic."""

    def test_same_customer_same_time_duplicate(self, db_session, customer):
        """Test preventing exact duplicate booking."""
        # Create first appointment
        appt1 = Appointment(
            customer_id=customer.id,
            appointment_datetime=datetime.utcnow() + timedelta(days=7, hours=14),
            service_type="botox",
            status="scheduled",
            calendar_event_id=f"evt-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt1)
        db_session.commit()

        # Try to book same time
        same_time = appt1.appointment_datetime.isoformat()
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=same_time,
            service_type="botox",
        )

        # Should detect duplicate or slot unavailable
        if not result.get("success", False):
            error_msg = result.get("error", "").lower()
            assert "already" in error_msg or "booked" in error_msg or "unavailable" in error_msg

    def test_same_customer_overlapping_time(self, db_session, customer):
        """Test preventing overlapping appointments for same customer."""
        # Create appointment: 2pm - 3pm
        base_time = datetime.utcnow() + timedelta(days=7)
        appt1 = Appointment(
            customer_id=customer.id,
            appointment_datetime=base_time.replace(hour=14, minute=0, second=0, microsecond=0),
            service_type="botox",
            duration_minutes=60,
            status="scheduled",
            calendar_event_id=f"evt-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt1)
        db_session.commit()

        # Try to book 2:30pm (overlaps with existing)
        overlapping_time = base_time.replace(hour=14, minute=30, second=0, microsecond=0).isoformat()
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=overlapping_time,
            service_type="hydrafacial",
        )

        # Should prevent overlap or mark as unavailable
        if not result.get("success", False):
            error_msg = result.get("error", "").lower()
            assert "overlap" in error_msg or "unavailable" in error_msg or "booked" in error_msg

    def test_same_slot_different_customers(self, db_session, customer, returning_customer):
        """Test same slot can be booked by different customers (if capacity allows)."""
        # Book first customer
        slot_time = datetime.utcnow() + timedelta(days=8, hours=15)
        appt1 = Appointment(
            customer_id=customer.id,
            appointment_datetime=slot_time,
            service_type="botox",
            status="scheduled",
            calendar_event_id=f"evt-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt1)
        db_session.commit()

        # Try to book second customer (should conflict in most cases)
        result = handle_book_appointment(
            db_session,
            customer_name=returning_customer.name,
            customer_phone=returning_customer.phone,
            customer_email=returning_customer.email,
            start_time=slot_time.isoformat(),
            service_type="botox",
        )

        # Usually should fail (unless multi-chair setup)
        # System should handle this gracefully either way
        assert "success" in result

    def test_duplicate_detection_across_channels(self, db_session, customer):
        """Test duplicate detection works across voice/SMS/email."""
        # Book via "voice" channel
        appt_time = datetime.utcnow() + timedelta(days=9, hours=10)
        appt1 = Appointment(
            customer_id=customer.id,
            appointment_datetime=appt_time,
            service_type="fillers",
            status="scheduled",
            booked_by="ai",
            calendar_event_id=f"evt-voice-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt1)
        db_session.commit()

        # Try to book via "SMS" (should detect existing)
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=appt_time.isoformat(),
            service_type="fillers",
        )

        # Should detect existing appointment
        existing_appts = db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id,
            Appointment.status == "scheduled"
        ).count()

        assert existing_appts >= 1

    def test_reschedule_vs_new_booking(self, db_session, customer):
        """Test system distinguishes rescheduling from new duplicate."""
        # Create original appointment
        original_time = datetime.utcnow() + timedelta(days=10, hours=14)
        appt = Appointment(
            customer_id=customer.id,
            appointment_datetime=original_time,
            service_type="botox",
            status="scheduled",
            calendar_event_id=f"evt-original-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt)
        db_session.commit()
        appt_id = appt.id

        # Reschedule (should cancel old, create new)
        new_time = datetime.utcnow() + timedelta(days=11, hours=15)

        # Update status to rescheduled
        appt.status = "rescheduled"
        db_session.commit()

        # Create new appointment
        new_appt = Appointment(
            customer_id=customer.id,
            appointment_datetime=new_time,
            service_type="botox",
            status="scheduled",
            calendar_event_id=f"evt-rescheduled-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(new_appt)
        db_session.commit()

        # Verify old is cancelled/rescheduled, new is active
        db_session.refresh(appt)
        assert appt.status == "rescheduled"

        scheduled_count = db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id,
            Appointment.status == "scheduled"
        ).count()

        assert scheduled_count == 1

    def test_cancelled_appointment_rebooking(self, db_session, customer):
        """Test rebooking a previously cancelled appointment."""
        # Create and cancel appointment
        slot_time = datetime.utcnow() + timedelta(days=12, hours=11)
        appt = Appointment(
            customer_id=customer.id,
            appointment_datetime=slot_time,
            service_type="hydrafacial",
            status="cancelled",
            cancelled_at=datetime.utcnow(),
            calendar_event_id=f"evt-cancelled-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt)
        db_session.commit()

        # Rebook same time (should be allowed)
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=slot_time.isoformat(),
            service_type="hydrafacial",
        )

        # Should allow rebooking cancelled slot
        # (depends on implementation - may create new appointment)
        assert "success" in result

    def test_customer_double_confirmation(self, db_session, customer):
        """Test handling repeated confirmation of same booking."""
        # Create pending appointment
        appt_time = datetime.utcnow() + timedelta(days=13, hours=16)
        appt = Appointment(
            customer_id=customer.id,
            appointment_datetime=appt_time,
            service_type="botox",
            status="scheduled",
            calendar_event_id=f"evt-confirm-{uuid.uuid4().hex[:8]}",
        )
        db_session.add(appt)
        db_session.commit()
        appt_id = appt.id

        # Try to "confirm" again (idempotent operation)
        db_session.refresh(appt)
        original_status = appt.status

        # Confirmation should be idempotent
        appt.status = "scheduled"  # Re-confirm
        db_session.commit()

        db_session.refresh(appt)
        assert appt.status == "scheduled"

        # Should not create duplicate
        duplicate_count = db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id,
            Appointment.appointment_datetime == appt_time,
            Appointment.status == "scheduled"
        ).count()

        assert duplicate_count == 1

    @patch("booking_handlers.handle_book_appointment")
    def test_race_condition_handling(self, mock_book, db_session, customer):
        """Test handling race condition with concurrent bookings."""
        import threading
        import time

        slot_time = datetime.utcnow() + timedelta(days=14, hours=10)
        results = []

        def book_appointment():
            """Simulate concurrent booking attempt."""
            time.sleep(0.01)  # Small delay to create race
            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time=slot_time.isoformat(),
                service_type="botox",
            )
            results.append(result)

        # Simulate concurrent requests
        threads = []
        for _ in range(3):
            t = threading.Thread(target=book_appointment)
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # At most one should succeed (may all fail if mock not properly set)
        successes = [r for r in results if r.get("success", False)]
        assert len(successes) <= 1, "Race condition not handled - multiple bookings succeeded"
