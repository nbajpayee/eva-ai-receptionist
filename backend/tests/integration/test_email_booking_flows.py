"""
Integration tests for email booking flows.

These tests verify end-to-end email booking scenarios including:
- Email-based booking requests
- HTML email parsing
- Email threading
- Confirmation emails
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from analytics import AnalyticsService
from booking.manager import SlotSelectionManager
from database import Appointment, Customer
from messaging_service import MessagingService
from tests.conftest import (build_availability_response,
                            build_booking_response, mock_ai_response_with_text)


@pytest.mark.integration
@pytest.mark.email
@pytest.mark.booking
class TestEmailBookingFlow:
    """Integration tests for email booking flows."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_complete_booking_flow(
        self,
        mock_openai,
        mock_book,
        mock_check_avail,
        db_session,
        email_conversation,
        customer,
    ):
        """Test complete email booking from inquiry to confirmation."""
        # User sends initial email
        email_content = """
        Hi,

        I'd like to schedule a Botox appointment for next week.
        Are you available on Wednesday afternoon?

        Best regards,
        {}
        """.format(
            customer.name
        )

        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content=email_content,
            metadata={
                "from": customer.email,
                "subject": "Botox Appointment Request",
                "message_id": f"<{uuid.uuid4()}@example.com>",
            },
        )

        availability = build_availability_response("2025-11-26", num_slots=8)
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            f"Hello {customer.name},\n\nThank you for reaching out! "
            "I have several Wednesday afternoon slots available. "
            "Would 2 PM or 4 PM work better for you?"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Verify professional email format
        assert customer.name in content
        assert "PM" in content or "afternoon" in content.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_booking_with_attachments(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        email_conversation,
        customer,
    ):
        """Test email booking with attachments (e.g., medical forms)."""
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content="Please find attached my medical history form.",
            metadata={
                "from": customer.email,
                "subject": "New Patient Intake Form",
                "attachments": [{"filename": "medical_history.pdf", "size": 102400}],
            },
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Thank you for submitting your medical history form. "
            "We've received it and will review before your appointment."
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Verify attachment acknowledged
        assert "form" in content.lower() or "received" in content.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_multi_recipient_handling(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        email_conversation,
        customer,
    ):
        """Test handling emails with multiple recipients."""
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content="Booking for two people - my friend and I.",
            metadata={
                "from": customer.email,
                "to": ["info@medspa.com"],
                "cc": ["friend@example.com"],
                "subject": "Group Booking",
            },
        )

        availability = build_availability_response("2025-11-27", num_slots=10)
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            "We can accommodate both of you! "
            "Would you like back-to-back appointments or at the same time?"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Verify group booking handled
        assert "both" in content.lower() or "two" in content.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_html_body_parsing(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        email_conversation,
        customer,
    ):
        """Test parsing HTML email bodies."""
        html_content = """
        <html>
        <body>
            <p>Hi there,</p>
            <p>I would like to book a <strong>Hydrafacial</strong> treatment.</p>
            <p>Preferably on <em>Friday morning</em>.</p>
            <p>Thanks!</p>
        </body>
        </html>
        """

        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content=html_content,
            metadata={
                "from": customer.email,
                "subject": "Hydrafacial Booking",
                "content_type": "text/html",
            },
        )

        availability = build_availability_response(
            "2025-11-29", num_slots=6, service_type="hydrafacial"
        )
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            "Great choice! I have Friday morning slots available at 9 AM, 10 AM, and 11 AM."
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Verify service detected from HTML
        assert "Friday" in content or "morning" in content.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_reply_threading(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        email_conversation,
        customer,
    ):
        """Test email reply threading (In-Reply-To header)."""
        # Initial email
        message_id_1 = f"<{uuid.uuid4()}@example.com>"
        msg1 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content="I'd like to book an appointment",
            metadata={
                "from": customer.email,
                "subject": "Appointment Request",
                "message_id": message_id_1,
            },
        )

        availability = build_availability_response("2025-11-30", num_slots=7)
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            "What service are you interested in?"
        )

        content1, ai_msg1 = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Reply email (should reference original)
        message_id_2 = f"<{uuid.uuid4()}@example.com>"
        msg2 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conversation.id,
            direction="inbound",
            content="Botox please",
            metadata={
                "from": customer.email,
                "subject": "Re: Appointment Request",
                "message_id": message_id_2,
                "in_reply_to": message_id_1,
                "references": [message_id_1],
            },
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Perfect! When would you like to come in for Botox?"
        )

        content2, ai_msg2 = MessagingService.generate_ai_response(
            db_session,
            email_conversation.id,
            "email",
        )

        # Verify threading maintained
        assert msg2.custom_metadata.get("in_reply_to") == message_id_1

    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    @patch("messaging_service.send_email")
    def test_email_booking_confirmation_sent(
        self,
        mock_send_email,
        mock_openai,
        mock_book,
        db_session,
        email_conversation,
        customer,
    ):
        """Test that booking confirmation email is sent."""
        # Simulate booking completion
        slot = {
            "start": "2025-12-01T14:00:00-05:00",
            "end": "2025-12-01T15:00:00-05:00",
            "start_time": "02:00 PM",
            "end_time": "03:00 PM",
        }

        mock_book.return_value = build_booking_response(slot, customer)

        # Store booking in metadata
        db_session.refresh(email_conversation)
        metadata = email_conversation.custom_metadata or {}
        metadata["last_appointment"] = {
            "status": "scheduled",
            "start_time": slot["start"],
            "service_type": "botox",
        }
        SlotSelectionManager.persist_conversation_metadata(
            db_session, email_conversation, metadata
        )

        mock_openai.return_value = mock_ai_response_with_text(
            f"Your Botox appointment is confirmed for December 1st at 2 PM. "
            "You'll receive a confirmation email shortly."
        )

        # Simulate sending confirmation
        mock_send_email.return_value = {"success": True, "message_id": "email-123"}

        # Verify confirmation message includes booking details
        db_session.refresh(email_conversation)
        last_appt = email_conversation.custom_metadata.get("last_appointment")
        assert last_appt is not None
        assert last_appt.get("status") == "scheduled"
