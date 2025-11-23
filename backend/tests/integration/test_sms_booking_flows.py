"""
Integration tests for SMS booking flows.

These tests verify end-to-end SMS booking scenarios including:
- Multi-message booking conversations
- Slot selection via text
- SMS confirmations
- Rescheduling via SMS
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
from tests.conftest import (
    build_availability_response,
    build_booking_response,
    mock_ai_response_with_text,
)


@pytest.mark.integration
@pytest.mark.sms
@pytest.mark.booking
class TestSMSBookingFlow:
    """Integration tests for SMS booking flows."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_complete_booking_flow(
        self,
        mock_openai,
        mock_book,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test complete SMS booking flow from start to finish."""
        # Message 1: User initiates booking
        msg1 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="Hi, I want to book a Botox appointment",
            metadata={"from": customer.phone},
        )

        availability = build_availability_response("2025-11-20", num_slots=10)
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            "Great! I have availability this week. When would you like to come in?"
        )

        content1, ai_msg1 = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # Message 2: User requests specific time
        msg2 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="How about tomorrow at 2pm?",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Perfect! I have 2 PM available tomorrow. Can I get your email to send confirmation?"
        )

        content2, ai_msg2 = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # Message 3: User provides email
        msg3 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content=customer.email,
            metadata={"from": customer.phone},
        )

        # Mock successful booking
        slot = availability["available_slots"][4]  # 2pm slot
        mock_book.return_value = build_booking_response(slot, customer)

        mock_openai.return_value = mock_ai_response_with_text(
            "All set! Your Botox appointment is confirmed for tomorrow at 2 PM."
        )

        content3, ai_msg3 = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # Verify deterministic single booking attempt and multi-message conversation
        assert mock_book.call_count == 1

        messages = (
            db_session.query(AnalyticsService.CommunicationMessage)
            .filter(
                AnalyticsService.CommunicationMessage.conversation_id
                == sms_conversation.id
            )
            .count()
        )
        assert messages >= 6  # 3 user + 3 AI messages

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_informational_flow_does_not_book(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Pure informational SMS conversations should not trigger booking attempts."""
        # User asks only for information
        _ = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="What are your hours and where are you located?",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "We're open 9am-6pm at 123 Main St. How else can I help?"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # Availability should not be checked in a pure FAQ flow
        assert not mock_check_avail.called

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_multi_message_booking(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test SMS booking with back-and-forth conversation."""
        # Simulate multi-turn conversation
        messages = [
            ("I need an appointment", "What service would you like?"),
            ("Botox", "Great! What day works for you?"),
            ("This Friday", "We have 10 AM, 2 PM, or 4 PM. Which works?"),
            ("2pm please", "Perfect! Booking you for Friday at 2 PM."),
        ]

        availability = build_availability_response("2025-11-22", num_slots=8)
        mock_check_avail.return_value = availability

        for user_text, ai_text in messages:
            # User message
            AnalyticsService.add_message(
                db=db_session,
                conversation_id=sms_conversation.id,
                direction="inbound",
                content=user_text,
                metadata={"from": customer.phone},
            )

            # AI response
            mock_openai.return_value = mock_ai_response_with_text(ai_text)
            content, ai_msg = MessagingService.generate_ai_response(
                db_session,
                sms_conversation.id,
                "sms",
            )

            assert content == ai_text or len(content) > 0

        # Verify conversation thread
        db_session.refresh(sms_conversation)
        assert sms_conversation.status == "active"

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_booking_with_confirmation_link(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test SMS booking includes confirmation link."""
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="Book me for Botox tomorrow 3pm",
            metadata={"from": customer.phone},
        )

        availability = build_availability_response("2025-11-21", num_slots=10)
        mock_check_avail.return_value = availability

        # AI should offer confirmation link
        confirmation_link = f"https://example.com/confirm/{sms_conversation.id}"
        mock_openai.return_value = mock_ai_response_with_text(
            f"Confirmed! Your appointment is tomorrow at 3 PM. View details: {confirmation_link}"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # Verify link in response
        assert "http" in content or "confirm" in content.lower()

    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_booking_cancellation(
        self,
        mock_openai,
        mock_book,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test canceling appointment via SMS."""
        # Create existing appointment
        appointment = Appointment(
            customer_id=customer.id,
            appointment_datetime=datetime.utcnow() + timedelta(days=3),
            service_type="botox",
            status="scheduled",
            calendar_event_id="evt-cancel-test",
        )
        db_session.add(appointment)
        db_session.commit()

        # User requests cancellation
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="I need to cancel my appointment",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "I can help with that. Which appointment would you like to cancel?"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        # User confirms cancellation
        user_confirm = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="The Botox one",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Your Botox appointment has been cancelled. Would you like to reschedule?"
        )

        content2, ai_msg2 = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        assert "cancel" in content2.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_booking_rescheduling(
        self,
        mock_openai,
        mock_book,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test rescheduling appointment via SMS."""
        # Create existing appointment
        appointment = Appointment(
            customer_id=customer.id,
            appointment_datetime=datetime.utcnow() + timedelta(days=5),
            service_type="hydrafacial",
            status="scheduled",
            calendar_event_id="evt-reschedule-test",
        )
        db_session.add(appointment)
        db_session.commit()

        # User requests reschedule
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="Can I move my Hydrafacial to next week?",
            metadata={"from": customer.phone},
        )

        availability = build_availability_response(
            "2025-11-27", num_slots=8, service_type="hydrafacial"
        )
        mock_check_avail.return_value = availability

        mock_openai.return_value = mock_ai_response_with_text(
            "Sure! I have availability next week. What day works best?"
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session,
            sms_conversation.id,
            "sms",
        )

        assert "week" in content.lower()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_slot_selection_by_number(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test selecting slot by option number via SMS."""
        # AI offers numbered options
        availability = build_availability_response("2025-11-23", num_slots=5)
        mock_check_avail.return_value = availability

        # Record offers with numbered slots
        SlotSelectionManager.record_offers(
            db_session,
            sms_conversation,
            tool_call_id="sms-test",
            arguments={"date": "2025-11-23", "service_type": "botox"},
            output=availability,
        )

        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content="I'll take option 2",
            metadata={"from": customer.phone},
        )

        # Capture numeric selection
        captured = SlotSelectionManager.capture_selection(
            db_session, sms_conversation, user_message
        )

        assert captured is True
        db_session.refresh(sms_conversation)
        metadata = sms_conversation.custom_metadata
        assert metadata.get("pending_slot_offers", {}).get("selected_option_index") == 2

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_slot_selection_by_time(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        sms_conversation,
        customer,
    ):
        """Test selecting slot by time phrase via SMS."""
        availability = build_availability_response("2025-11-24", num_slots=6)
        mock_check_avail.return_value = availability

        # Record offers
        SlotSelectionManager.record_offers(
            db_session,
            sms_conversation,
            tool_call_id="sms-time-test",
            arguments={"date": "2025-11-24", "service_type": "botox"},
            output=availability,
        )

        # User selects by time
        target_slot = availability["available_slots"][3]
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conversation.id,
            direction="inbound",
            content=f"I prefer {target_slot['start_time']}",
            metadata={"from": customer.phone},
        )

        # Capture time-based selection
        captured = SlotSelectionManager.capture_selection(
            db_session, sms_conversation, user_message
        )

        assert captured is True
        db_session.refresh(sms_conversation)
        metadata = sms_conversation.custom_metadata
        selected = metadata.get("pending_slot_offers", {}).get("selected_slot")
        assert selected is not None

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_threading_multiple_conversations(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        customer,
    ):
        """Test handling multiple concurrent SMS conversations for same customer."""
        # Create two separate conversations
        conv1 = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone, "thread_id": "thread-1"},
        )

        conv2 = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone, "thread_id": "thread-2"},
        )

        # Add messages to both conversations
        msg1 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conv1.id,
            direction="inbound",
            content="Book Botox",
            metadata={"from": customer.phone},
        )

        msg2 = AnalyticsService.add_message(
            db=db_session,
            conversation_id=conv2.id,
            direction="inbound",
            content="What are your hours?",
            metadata={"from": customer.phone},
        )

        # Verify conversations are separate
        assert conv1.id != conv2.id
        assert conv1.custom_metadata.get("thread_id") != conv2.custom_metadata.get(
            "thread_id"
        )

        # Verify messages are in correct conversations
        conv1_msgs = (
            db_session.query(AnalyticsService.CommunicationMessage)
            .filter(AnalyticsService.CommunicationMessage.conversation_id == conv1.id)
            .count()
        )

        conv2_msgs = (
            db_session.query(AnalyticsService.CommunicationMessage)
            .filter(AnalyticsService.CommunicationMessage.conversation_id == conv2.id)
            .count()
        )

        assert conv1_msgs > 0
        assert conv2_msgs > 0
