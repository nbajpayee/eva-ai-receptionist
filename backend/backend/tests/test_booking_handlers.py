"""Integration tests for booking handlers."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
import pytz

import booking_handlers
from booking_handlers import (
    handle_check_availability,
    handle_book_appointment,
    normalize_date_to_future,
    normalize_datetime_to_future,
    _normalize_iso_datetime,
)


class TestTimezoneNormalization:
    """Test timezone handling in slot matching."""

    def test_normalize_iso_with_timezone(self):
        """Should parse ISO string with timezone offset."""
        result = _normalize_iso_datetime("2025-11-15T09:00:00-08:00")
        assert result.hour == 9
        assert result.day == 15

    def test_normalize_iso_with_z(self):
        """Should parse ISO string with Z (UTC) suffix."""
        result = _normalize_iso_datetime("2025-11-15T09:00:00Z")
        assert result.hour == 9

    def test_normalize_iso_naive(self):
        """Should parse ISO string without timezone."""
        result = _normalize_iso_datetime("2025-11-15T09:00:00")
        assert result.hour == 9


class TestBookingValidation:
    """Test availability validation in book_appointment."""

    def test_booking_succeeds_when_slot_available(self):
        """Should book when requested time matches available slot."""
        # Mock calendar service
        mock_service = MagicMock()
        # Use a future time (2pm Pacific)
        mock_service.get_available_slots.return_value = [
            {"start": "2025-11-16T14:00:00-08:00", "end": "2025-11-16T14:30:00-08:00"}
        ]
        mock_service.book_appointment.return_value = "event_123"

        # Attempt booking at 2pm tomorrow (matches available slot)
        result = handle_book_appointment(
            mock_service,
            customer_name="Test User",
            customer_phone="555-1234",
            customer_email="test@example.com",
            start_time="2025-11-16T14:00:00",  # No timezone (AI format)
            service_type="botox",
        )

        assert result["success"] is True
        assert result["event_id"] == "event_123"
        assert result["was_auto_adjusted"] is False
        # Original time is naive, adjusted time has timezone
        assert "2025-11-16T14:00:00" in result["start_time"]
        assert "2025-11-16T14:00:00" in result["original_start_time"]
        mock_service.book_appointment.assert_called_once()

    def test_booking_fails_when_slot_unavailable(self):
        """Should reject booking when requested time not in available slots."""
        # Mock calendar service
        mock_service = MagicMock()
        # Only 3pm is available tomorrow
        mock_service.get_available_slots.return_value = [
            {"start": "2025-11-16T15:00:00-08:00", "end": "2025-11-16T15:30:00-08:00"}
        ]

        # Attempt booking at 2pm (NOT available - only 3pm is available)
        result = handle_book_appointment(
            mock_service,
            customer_name="Test User",
            customer_phone="555-1234",
            customer_email="test@example.com",
            start_time="2025-11-16T14:00:00",
            service_type="botox",
        )

        assert result["success"] is False
        assert "not available" in result["error"].lower()
        assert len(result["available_slots"]) > 0
        mock_service.book_appointment.assert_not_called()

    def test_timezone_agnostic_matching(self):
        """Should match slots regardless of timezone format differences."""
        mock_service = MagicMock()

        # Calendar returns PST, AI requests naive
        mock_service.get_available_slots.return_value = [
            {"start": "2025-11-15T14:00:00-08:00", "end": "2025-11-15T14:30:00-08:00"}
        ]
        mock_service.book_appointment.return_value = "event_456"

        result = handle_book_appointment(
            mock_service,
            customer_name="Test User",
            customer_phone="555-1234",
            customer_email="test@example.com",
            start_time="2025-11-15T14:00:00",  # No timezone
            service_type="botox",
        )

        assert result["success"] is True


class TestFutureAdjustment:
    """Ensure past start times are auto-adjusted into the future."""

    def test_past_start_time_auto_adjusts(self, monkeypatch):
        mock_service = MagicMock()

        adjusted_dt = datetime(2025, 11, 20, 9, 0, 0)
        original_iso = "2024-06-07T09:00:00"

        def fake_ensure_future(dt, reference=None):
            assert dt == datetime.fromisoformat(original_iso)
            return adjusted_dt, True

        monkeypatch.setattr(booking_handlers, "_ensure_future_datetime", fake_ensure_future)

        mock_service.get_available_slots.return_value = [
            {"start": adjusted_dt.isoformat(), "end": (adjusted_dt + timedelta(minutes=30)).isoformat()}
        ]
        mock_service.book_appointment.return_value = "event_future"

        result = handle_book_appointment(
            mock_service,
            customer_name="Future Client",
            customer_phone="555-0000",
            customer_email="future@example.com",
            start_time=original_iso,
            service_type="botox",
        )

        assert result["success"] is True
        assert result["event_id"] == "event_future"
        assert result["was_auto_adjusted"] is True
        assert result["original_start_time"] == original_iso
        assert result["start_time"] == adjusted_dt.isoformat()


class TestNormalizationHelpers:
    """Verify date/time normalization utilities."""

    def test_normalize_date_to_future_advances_past_date(self):
        reference = pytz.timezone("America/Los_Angeles").localize(datetime(2025, 11, 15, 12, 0))
        result = normalize_date_to_future("2024-06-13", reference=reference)
        assert result == "2025-11-15"

    def test_normalize_datetime_to_future_advances_past_datetime(self):
        reference = pytz.timezone("America/Los_Angeles").localize(datetime(2025, 11, 16, 9, 0))
        future_iso = normalize_datetime_to_future("2024-06-13T14:00:00", reference=reference)
        future_dt = _normalize_iso_datetime(future_iso)
        assert future_dt >= reference
        assert future_dt.tzinfo is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
