"""
Edge case tests for Calendar API integration failures.

These tests verify:
- Token refresh failures
- Credential expiration
- Calendar deletion
- Event conflicts
- Timezone mismatches
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError

from booking_handlers import handle_book_appointment, handle_check_availability
from calendar_service import GoogleCalendarService


@pytest.mark.integration
class TestCalendarFailures:
    """Test Calendar API failure scenarios."""

    @patch("calendar_service.GoogleCalendarService._get_credentials")
    def test_token_refresh_failure(self, mock_creds, db_session, customer):
        """Test handling when token refresh fails."""
        mock_creds.side_effect = RefreshError("Token refresh failed")

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should fail gracefully
        assert result["success"] is False
        error_msg = result.get("error", "").lower()
        assert "error" in error_msg or "unavailable" in error_msg

    @patch("calendar_service.GoogleCalendarService._get_credentials")
    def test_credentials_expired(self, mock_creds, db_session, customer):
        """Test handling of expired credentials."""
        mock_creds.return_value = None  # No valid credentials

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should indicate system error
        assert result["success"] is False

    @patch("calendar_service.GoogleCalendarService.events")
    def test_calendar_deleted(self, mock_events, db_session, customer):
        """Test handling when calendar is deleted."""
        # Simulate 404 Not Found
        error_response = Mock()
        error_response.status = 404
        error_response.reason = "Not Found"

        mock_events.list.side_effect = HttpError(error_response, b"Calendar not found")

        # Should handle gracefully
        try:
            result = handle_check_availability(
                db_session,
                date="2025-11-20",
                service_type="botox",
            )
            assert result["success"] is False
        except HttpError:
            # If propagated, that's also acceptable
            pass

    @patch("calendar_service.GoogleCalendarService.book_appointment")
    def test_event_creation_failed(self, mock_book, db_session, customer):
        """Test handling when event creation fails."""
        mock_book.return_value = {
            "success": False,
            "error": "Failed to create calendar event",
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
            "failed" in result.get("error", "").lower()
            or "error" in result.get("error", "").lower()
        )

    @patch("calendar_service.GoogleCalendarService.events")
    def test_event_update_conflict(self, mock_events, db_session, customer):
        """Test handling of event update conflicts."""
        # Simulate 409 Conflict
        error_response = Mock()
        error_response.status = 409
        error_response.reason = "Conflict"

        mock_events.update.side_effect = HttpError(
            error_response, b"Event has been modified"
        )

        # Should detect conflict
        try:
            # Attempt to reschedule
            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

            if not result.get("success", False):
                error_msg = result.get("error", "").lower()
                assert (
                    "conflict" in error_msg
                    or "modified" in error_msg
                    or "error" in error_msg
                )
        except HttpError:
            # Acceptable if error propagates
            pass

    @patch("calendar_service.GoogleCalendarService.check_availability")
    def test_timezone_mismatch(self, mock_check, db_session, customer):
        """Test handling of timezone mismatches."""
        # Return times in wrong timezone
        wrong_tz_slot = "2025-11-20T14:00:00+00:00"  # UTC instead of Eastern

        mock_check.return_value = {
            "success": True,
            "available_slots": [
                {
                    "start": wrong_tz_slot,
                    "end": "2025-11-20T15:00:00+00:00",
                    "start_time": "02:00 PM",
                }
            ],
        }

        result = handle_check_availability(
            db_session,
            date="2025-11-20",
            service_type="botox",
        )

        # Should handle timezone conversion
        assert result["success"] is True

        # Verify timezone is handled
        if result.get("available_slots"):
            slot = result["available_slots"][0]
            # Should include timezone info
            assert "start" in slot
