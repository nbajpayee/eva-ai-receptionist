"""
Edge case tests for expired slot handling.

These tests verify:
- Slots expiring during conversation
- Business hours changes
- Provider availability changes
- Slot timeout logic
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch, Mock
import uuid

import pytest

from booking_handlers import handle_check_availability, handle_book_appointment
from booking.manager import SlotSelectionManager
from analytics import AnalyticsService
from database import Customer, Conversation


@pytest.mark.integration
@pytest.mark.booking
class TestExpiredSlots:
    """Test handling of expired and unavailable slots."""

    @patch("calendar_service.CalendarService.check_availability")
    @patch("calendar_service.CalendarService.book_appointment")
    def test_slot_expires_during_conversation(
        self, mock_book, mock_check, db_session, customer, voice_conversation
    ):
        """Test handling when offered slot is no longer available."""
        # Initial availability check shows slot
        slot_time = datetime.utcnow() + timedelta(days=3, hours=14)
        initial_slots = [{
            "start": slot_time.isoformat(),
            "end": (slot_time + timedelta(hours=1)).isoformat(),
            "start_time": "02:00 PM",
            "end_time": "03:00 PM",
        }]

        mock_check.return_value = {
            "success": True,
            "available_slots": initial_slots,
            "all_slots": initial_slots,
        }

        # Record offers
        SlotSelectionManager.record_offers(
            db_session,
            voice_conversation,
            tool_call_id="expire-test",
            arguments={"date": "2025-12-06", "service_type": "botox"},
            output={"success": True, "available_slots": initial_slots},
        )

        # Simulate slot being taken
        mock_book.return_value = {
            "success": False,
            "error": "Selected time slot is no longer available",
        }

        # Attempt to book
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=slot_time.isoformat(),
            service_type="botox",
        )

        assert result["success"] is False
        assert "no longer available" in result.get("error", "").lower()

    @patch("calendar_service.CalendarService.check_availability")
    def test_business_hours_change_mid_booking(
        self, mock_check, db_session, customer, voice_conversation
    ):
        """Test handling when business hours change during booking."""
        # Initially shows afternoon slots
        afternoon_slot = datetime.utcnow() + timedelta(days=2, hours=17)  # 5 PM
        mock_check.return_value = {
            "success": True,
            "available_slots": [{
                "start": afternoon_slot.isoformat(),
                "end": (afternoon_slot + timedelta(hours=1)).isoformat(),
                "start_time": "05:00 PM",
                "end_time": "06:00 PM",
            }],
        }

        result1 = handle_check_availability(
            db_session,
            date="2025-12-07",
            service_type="botox",
        )

        assert result1["success"] is True

        # Business hours updated - 5 PM no longer available
        mock_check.return_value = {
            "success": True,
            "available_slots": [],
            "error": "Time outside updated business hours",
        }

        result2 = handle_check_availability(
            db_session,
            date="2025-12-07",
            service_type="botox",
        )

        # Should reflect updated hours
        assert len(result2.get("available_slots", [])) == 0

    @patch("calendar_service.CalendarService.check_availability")
    def test_slot_no_longer_available(
        self, mock_check, db_session, customer, sms_conversation
    ):
        """Test re-checking availability shows slot taken."""
        slot_time = datetime.utcnow() + timedelta(days=4, hours=10)

        # First check: available
        mock_check.return_value = {
            "success": True,
            "available_slots": [{
                "start": slot_time.isoformat(),
                "end": (slot_time + timedelta(hours=1)).isoformat(),
            }],
        }

        result1 = handle_check_availability(
            db_session,
            date="2025-12-08",
            service_type="fillers",
        )

        assert len(result1.get("available_slots", [])) > 0

        # Second check: slot taken
        mock_check.return_value = {
            "success": True,
            "available_slots": [],
            "message": "Previously shown slot has been booked",
        }

        result2 = handle_check_availability(
            db_session,
            date="2025-12-08",
            service_type="fillers",
        )

        assert len(result2.get("available_slots", [])) == 0

    @patch("calendar_service.CalendarService.check_availability")
    def test_provider_unavailable_last_minute(
        self, mock_check, db_session, customer, voice_conversation
    ):
        """Test handling when provider becomes unavailable."""
        slot_time = datetime.utcnow() + timedelta(days=5, hours=11)

        # Initially available
        mock_check.return_value = {
            "success": True,
            "available_slots": [{
                "start": slot_time.isoformat(),
                "end": (slot_time + timedelta(hours=1)).isoformat(),
                "provider": "Dr. Smith",
            }],
        }

        result1 = handle_check_availability(
            db_session,
            date="2025-12-09",
            service_type="botox",
        )

        assert result1["success"] is True

        # Provider cancelled
        mock_check.return_value = {
            "success": True,
            "available_slots": [],
            "message": "Provider unavailable - slot cancelled",
        }

        result2 = handle_check_availability(
            db_session,
            date="2025-12-09",
            service_type="botox",
        )

        assert len(result2.get("available_slots", [])) == 0

    def test_slot_timeout_after_30_minutes(self, db_session, customer, voice_conversation):
        """Test slot offers expire after timeout period."""
        # Record slot offers
        old_time = datetime.utcnow() - timedelta(minutes=35)  # 35 minutes ago
        voice_conversation.last_activity_at = old_time

        metadata = {
            "pending_slot_offers": {
                "offered_at": old_time.isoformat(),
                "slots": [{"start": "2025-12-10T14:00:00-05:00"}],
                "timeout_minutes": 30,
            }
        }

        voice_conversation.custom_metadata = metadata
        db_session.commit()

        # Check if offers expired
        db_session.refresh(voice_conversation)
        offers = voice_conversation.custom_metadata.get("pending_slot_offers")

        if offers:
            offered_at = datetime.fromisoformat(offers["offered_at"])
            timeout_minutes = offers.get("timeout_minutes", 30)
            expired = (datetime.utcnow() - offered_at).total_seconds() / 60 > timeout_minutes

            # Should be expired
            assert expired is True

    @patch("calendar_service.CalendarService.check_availability")
    def test_expired_slot_alternative_offered(
        self, mock_check, db_session, customer, sms_conversation
    ):
        """Test system offers alternatives when selected slot expires."""
        expired_slot = datetime.utcnow() + timedelta(days=6, hours=14)
        alternative_slots = [
            datetime.utcnow() + timedelta(days=6, hours=15),
            datetime.utcnow() + timedelta(days=6, hours=16),
        ]

        # Expired slot no longer available
        mock_check.return_value = {
            "success": True,
            "available_slots": [
                {
                    "start": alt.isoformat(),
                    "end": (alt + timedelta(hours=1)).isoformat(),
                    "start_time": alt.strftime("%I:%M %p"),
                }
                for alt in alternative_slots
            ],
            "message": "Requested slot unavailable, showing alternatives",
        }

        result = handle_check_availability(
            db_session,
            date="2025-12-10",
            service_type="botox",
        )

        # Should offer alternatives
        assert result["success"] is True
        assert len(result.get("available_slots", [])) > 0
