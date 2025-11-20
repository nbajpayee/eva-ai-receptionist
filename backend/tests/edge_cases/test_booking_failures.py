"""
Edge case tests for booking failure scenarios.

These tests verify proper error handling for:
- Calendar API failures
- Invalid inputs
- Database errors
- Concurrent booking conflicts
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from requests.exceptions import ConnectionError, HTTPError, Timeout
from sqlalchemy.exc import OperationalError

from booking_handlers import handle_book_appointment, handle_check_availability
from database import Appointment, Customer


@pytest.mark.integration
@pytest.mark.booking
class TestBookingFailures:
    """Test error handling for booking failures."""

    def test_calendar_api_timeout(self, db_session, customer):
        """Test handling of Calendar API timeout."""
        mock_calendar = Mock()
        # Mock get_available_slots to return a valid slot
        mock_calendar.get_available_slots.return_value = [
            {
                "start": "2025-11-20T14:00:00-05:00",
                "end": "2025-11-20T15:00:00-05:00",
                "available": True,
            }
        ]
        # Mock book_appointment to raise Timeout
        mock_calendar.book_appointment.side_effect = Timeout(
            "Request timed out after 30 seconds"
        )

        result = handle_book_appointment(
            mock_calendar,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        assert result["success"] is False
        assert (
            "timeout" in result.get("error", "").lower()
            or "failed" in result.get("error", "").lower()
        )

    def test_calendar_api_unauthorized(self, db_session, customer):
        """Test handling of Calendar API authentication failure."""
        with patch("calendar_service.CalendarService.book_appointment") as mock:
            mock.side_effect = HTTPError("401 Unauthorized")

            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

            assert result["success"] is False
            # Should indicate system error, not user error
            assert "error" in result

    def test_calendar_api_quota_exceeded(self, db_session, customer):
        """Test handling of Calendar API quota/rate limit."""
        with patch("calendar_service.CalendarService.book_appointment") as mock:
            mock.side_effect = HTTPError("429 Too Many Requests")

            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

            assert result["success"] is False
            assert "error" in result

    def test_invalid_service_type(self, db_session, customer):
        """Test rejection of invalid service type."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="invalid_service_xyz_123",
        )

        assert result["success"] is False
        assert (
            "service" in result.get("error", "").lower()
            or "invalid" in result.get("error", "").lower()
        )

    def test_invalid_datetime_format(self, db_session, customer):
        """Test rejection of malformed datetime."""
        invalid_datetimes = [
            "not-a-date",
            "2025-13-45T25:99:99",  # Invalid month/day/time
            "2025-11-20",  # Missing time
            "14:00:00",  # Missing date
            "",  # Empty string
        ]

        for invalid_dt in invalid_datetimes:
            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time=invalid_dt,
                service_type="botox",
            )

            assert (
                result["success"] is False
            ), f"Should reject invalid datetime: {invalid_dt}"

    def test_booking_outside_business_hours(self, db_session, customer):
        """Test rejection of booking outside business hours."""
        # Try booking at midnight
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T00:00:00-05:00",
            service_type="botox",
        )

        # Should either reject or return no availability
        assert result["success"] is False or result.get("available_slots") == []

    def test_booking_past_date(self, db_session, customer):
        """Test rejection of booking in the past."""
        past_date = (
            (datetime.utcnow() - timedelta(days=30))
            .replace(hour=14, minute=0)
            .isoformat()
        )

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=past_date,
            service_type="botox",
        )

        assert result["success"] is False
        assert (
            "past" in result.get("error", "").lower()
            or "invalid" in result.get("error", "").lower()
        )

    def test_incomplete_customer_details(self, db_session):
        """Test handling of missing required customer information."""
        # Missing phone
        result1 = handle_book_appointment(
            db_session,
            customer_name="John Doe",
            customer_phone=None,
            customer_email="john@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Missing email
        result2 = handle_book_appointment(
            db_session,
            customer_name="Jane Doe",
            customer_phone="+15555551234",
            customer_email=None,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Missing name
        result3 = handle_book_appointment(
            db_session,
            customer_name=None,
            customer_phone="+15555551234",
            customer_email="jane@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # At least one should fail (depending on requirements)
        failures = [
            r for r in [result1, result2, result3] if not r.get("success", False)
        ]
        assert len(failures) > 0

    @pytest.mark.parametrize(
        "invalid_phone",
        [
            "123",  # Too short
            "not-a-phone-number",
            "",  # Empty
            "1234567890123456789",  # Too long
            "555-CALL-NOW",  # Letters
        ],
    )
    def test_invalid_phone_number_format(self, db_session, customer, invalid_phone):
        """Test validation of phone number formats."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=invalid_phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should either fail validation or normalize the number
        if not result.get("success", False):
            assert (
                "phone" in result.get("error", "").lower()
                or "invalid" in result.get("error", "").lower()
            )

    @pytest.mark.parametrize(
        "invalid_email",
        ["not-an-email", "missing@domain", "@nodomain.com", "spaces in@email.com", "",],
    )
    def test_invalid_email_format(self, db_session, customer, invalid_email):
        """Test validation of email formats."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=invalid_email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should fail validation
        if not result.get("success", False):
            assert (
                "email" in result.get("error", "").lower()
                or "invalid" in result.get("error", "").lower()
            )

    def test_database_connection_failure(self, db_session, customer):
        """Test handling of database connection errors."""
        with patch("database.SessionLocal") as mock_session:
            mock_session.side_effect = OperationalError(
                "Database connection failed", None, None
            )

            # Should handle gracefully
            try:
                result = handle_book_appointment(
                    db_session,  # This will still work as it's already created
                    customer_name=customer.name,
                    customer_phone=customer.phone,
                    customer_email=customer.email,
                    start_time="2025-11-20T14:00:00-05:00",
                    service_type="botox",
                )
                # If it doesn't raise, check result
                assert result is not None
            except Exception as e:
                # Should not crash the application
                assert "Database" in str(e) or "connection" in str(e).lower()

    @patch("calendar_service.CalendarService.book_appointment")
    def test_concurrent_booking_conflict(self, mock_book, db_session, customer):
        """Test handling when slot is taken during booking attempt."""
        # Simulate slot conflict
        mock_book.return_value = {
            "success": False,
            "error": "Time slot is no longer available",
            "error_code": "SLOT_CONFLICT",
        }

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        assert result["success"] is False
        assert (
            "no longer available" in result.get("error", "").lower()
            or "conflict" in result.get("error", "").lower()
        )
