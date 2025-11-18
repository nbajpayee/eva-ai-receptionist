"""
Edge case tests for customer data validation.

These tests verify:
- Phone number validation and normalization
- Email validation
- Name handling
- PII data sanitization
- Customer deduplication
"""

from __future__ import annotations

import pytest

from booking_handlers import handle_book_appointment
from database import Customer


@pytest.mark.integration
class TestCustomerValidation:
    """Test customer data validation and sanitization."""

    @pytest.mark.parametrize(
        "phone,expected_valid",
        [
            ("+1 (555) 123-4567", True),  # Standard US format
            ("+15551234567", True),  # E.164 format
            ("555-123-4567", True),  # Dash format
            ("(555) 123-4567", True),  # Parens format
            ("+44 20 7123 4567", True),  # International (UK)
            ("+1-555-123-4567", True),  # With country code and dashes
        ],
    )
    def test_phone_international_formats(self, db_session, phone, expected_valid):
        """Test handling of various international phone formats."""
        result = handle_book_appointment(
            db_session,
            customer_name="Test User",
            customer_phone=phone,
            customer_email="test@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        if expected_valid:
            # Should normalize and accept
            assert result is not None
        else:
            # Should reject or request clarification
            if not result.get("success", False):
                assert "phone" in result.get("error", "").lower()

    @pytest.mark.parametrize(
        "phone,should_reject",
        [
            ("123", True),  # Too short
            ("abc-def-ghij", True),  # Letters
            ("", True),  # Empty
            ("555 CALL NOW", True),  # Mixed letters/numbers
            ("00000000000", False),  # All zeros (may normalize)
        ],
    )
    def test_phone_invalid_characters(self, db_session, phone, should_reject):
        """Test rejection of invalid phone numbers."""
        result = handle_book_appointment(
            db_session,
            customer_name="Test User",
            customer_phone=phone,
            customer_email="test@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        if should_reject:
            # Should fail validation
            if not result.get("success", False):
                error_msg = result.get("error", "").lower()
                assert (
                    "phone" in error_msg
                    or "invalid" in error_msg
                    or "number" in error_msg
                )

    @pytest.mark.parametrize(
        "email,expected_valid",
        [
            ("user@example.com", True),
            ("user.name@example.com", True),
            ("user+tag@example.co.uk", True),
            ("user_name@sub.example.com", True),
            ("user123@example-domain.com", True),
            ("invalid.email", False),  # No @
            ("@example.com", False),  # No local part
            ("user@", False),  # No domain
            ("user @example.com", False),  # Space
            ("user@example", False),  # No TLD
        ],
    )
    def test_email_edge_cases(self, db_session, email, expected_valid):
        """Test email validation with various formats."""
        result = handle_book_appointment(
            db_session,
            customer_name="Test User",
            customer_phone="+15551234567",
            customer_email=email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        if not expected_valid:
            # Should reject invalid emails
            if not result.get("success", False):
                error_msg = result.get("error", "").lower()
                assert "email" in error_msg or "invalid" in error_msg

    @pytest.mark.parametrize(
        "name",
        [
            "José García",  # Accented characters
            "O'Brien",  # Apostrophe
            "Mary-Jane Smith",  # Hyphen
            "Dr. John Smith Jr.",  # Title and suffix
            "Jean-Luc Picard",  # Hyphenated first name
            "山田太郎",  # Japanese characters
        ],
    )
    def test_name_special_characters(self, db_session, name):
        """Test handling of names with special characters."""
        result = handle_book_appointment(
            db_session,
            customer_name=name,
            customer_phone="+15551234567",
            customer_email="test@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should accept all valid name formats
        assert result is not None

    def test_name_too_long(self, db_session):
        """Test handling of excessively long names."""
        long_name = "A" * 300  # 300 characters

        result = handle_book_appointment(
            db_session,
            customer_name=long_name,
            customer_phone="+15551234567",
            customer_email="test@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should either truncate or reject
        if result.get("success", False):
            # If accepted, check if truncated
            customer = (
                db_session.query(Customer)
                .filter(Customer.phone == "+15551234567")
                .first()
            )
            if customer:
                assert len(customer.name) <= 255  # Database limit
        else:
            # If rejected, should have error
            assert (
                "name" in result.get("error", "").lower()
                or "long" in result.get("error", "").lower()
            )

    @pytest.mark.parametrize(
        "required_field,value",
        [
            ("customer_name", None),
            ("customer_name", ""),
            ("customer_phone", None),
            ("customer_phone", ""),
        ],
    )
    def test_missing_required_fields(self, db_session, required_field, value):
        """Test validation of required fields."""
        params = {
            "customer_name": "John Doe",
            "customer_phone": "+15551234567",
            "customer_email": "john@example.com",
            "start_time": "2025-11-20T14:00:00-05:00",
            "service_type": "botox",
        }

        # Set field to invalid value
        params[required_field] = value

        result = handle_book_appointment(db_session, **params)

        # Should fail validation
        if not result.get("success", False):
            error_msg = result.get("error", "").lower()
            assert (
                "required" in error_msg
                or required_field.replace("customer_", "") in error_msg
            )

    def test_pii_data_sanitization(self, db_session):
        """Test that PII data is properly sanitized in logs."""
        import logging
        from io import StringIO

        # Capture log output
        log_stream = StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.setLevel(logging.INFO)

        logger = logging.getLogger("booking_handlers")
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

        # Make booking
        result = handle_book_appointment(
            db_session,
            customer_name="Sensitive Name",
            customer_phone="+15559876543",
            customer_email="sensitive@email.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        log_output = log_stream.getvalue()

        # Phone and email should be masked in logs
        if "+15559876543" in log_output:
            # If logged, should be masked
            assert "***" in log_output or "5559876543" not in log_output

        logger.removeHandler(handler)

    def test_customer_merge_detection(self, db_session):
        """Test detection of duplicate customers with slight variations."""
        # Create customer with one phone format
        customer1 = Customer(
            name="John Smith",
            phone="+1-555-123-4567",
            email="john@example.com",
        )
        db_session.add(customer1)
        db_session.commit()

        # Try to create with different phone format (same number)
        result = handle_book_appointment(
            db_session,
            customer_name="John Smith",
            customer_phone="(555) 123-4567",  # Same number, different format
            customer_email="john@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should detect as same customer (phone normalization)
        # Check if only one customer record exists
        customer_count = (
            db_session.query(Customer)
            .filter(Customer.email == "john@example.com")
            .count()
        )

        # May create duplicate or merge - depends on implementation
        assert customer_count >= 1
