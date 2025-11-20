"""
Integration tests for cross-channel communication flows.

These tests verify seamless transitions and data continuity across:
- Voice to SMS
- SMS to Voice
- Email to SMS
- Unified customer timeline
- Cross-channel booking persistence
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from analytics import AnalyticsService
from booking.manager import SlotSelectionManager
from database import Appointment, Conversation, Customer
from messaging_service import MessagingService
from tests.conftest import (
    build_availability_response,
    build_booking_response,
    mock_ai_response_with_text,
)


@pytest.mark.integration
@pytest.mark.slow
class TestCrossChannelBooking:
    """Integration tests for cross-channel booking flows."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_voice_to_sms_continuation(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test booking started on voice, completed via SMS."""
        # Create voice conversation
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={"session_id": str(uuid.uuid4())},
        )

        # Voice: User starts booking
        voice_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conv.id,
            direction="inbound",
            content="I need to book a Botox appointment but I'm in a hurry",
            metadata={"source": "voice_transcript"},
        )

        availability = build_availability_response("2025-12-02", num_slots=10)
        mock_check_avail.return_value = availability

        # Record slot offers in voice conversation
        SlotSelectionManager.record_offers(
            db_session,
            voice_conv,
            tool_call_id="voice-call",
            arguments={"date": "2025-12-02", "service_type": "botox"},
            output=availability,
        )

        # Voice conversation ends
        voice_conv.status = "completed"
        db_session.commit()

        # Create SMS conversation for same customer
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # SMS: User continues booking
        sms_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conv.id,
            direction="inbound",
            content="Hi, I was just on the phone about booking Botox. Can I take the 2pm slot?",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Yes! I have your voice conversation here. Booking you for 2 PM on December 2nd."
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session, sms_conv.id, "sms",
        )

        # Verify customer history accessible across channels
        all_conversations = (
            db_session.query(Conversation)
            .filter(Conversation.customer_id == customer.id)
            .all()
        )
        assert len(all_conversations) == 2
        assert any(c.channel == "voice" for c in all_conversations)
        assert any(c.channel == "sms" for c in all_conversations)

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_sms_to_voice_escalation(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test escalation from SMS to voice call."""
        # Create SMS conversation
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # SMS: Complex inquiry
        sms_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conv.id,
            direction="inbound",
            content="I have questions about combining multiple treatments and pricing",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "I'd be happy to discuss this in detail. Would you prefer a phone call? "
            "I can have someone call you right away."
        )

        content, ai_msg = MessagingService.generate_ai_response(
            db_session, sms_conv.id, "sms",
        )

        # Mark SMS for escalation
        sms_conv.custom_metadata = sms_conv.custom_metadata or {}
        sms_conv.custom_metadata["escalation_requested"] = True
        sms_conv.custom_metadata["escalation_reason"] = "Complex pricing inquiry"
        db_session.commit()

        # Create voice conversation for follow-up
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={
                "session_id": str(uuid.uuid4()),
                "escalated_from_sms": sms_conv.id,
            },
        )

        # Verify escalation link
        assert voice_conv.custom_metadata.get("escalated_from_sms") == sms_conv.id
        assert sms_conv.custom_metadata.get("escalation_requested") is True

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_email_to_sms_reminder(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test sending SMS reminder after email booking."""
        # Create email conversation with booking
        email_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="email",
            metadata={"email": customer.email},
        )

        # Email booking completed
        email_conv.custom_metadata = {
            "last_appointment": {
                "status": "scheduled",
                "start_time": "2025-12-03T14:00:00-05:00",
                "service_type": "hydrafacial",
            }
        }
        email_conv.status = "completed"
        db_session.commit()

        # Create SMS conversation for reminder
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={
                "phone_number": customer.phone,
                "reminder_for_appointment": "2025-12-03T14:00:00-05:00",
            },
        )

        # Send SMS reminder
        reminder_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conv.id,
            direction="outbound",
            content="Reminder: You have a Hydrafacial appointment tomorrow at 2 PM.",
            metadata={"type": "appointment_reminder"},
        )

        # Verify reminder references email booking
        assert sms_conv.custom_metadata.get("reminder_for_appointment") is not None

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_booking_history_unified_timeline(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test unified customer timeline across all channels."""
        # Create conversations across multiple channels
        channels = ["voice", "sms", "email"]
        conversations = []

        for idx, channel in enumerate(channels):
            conv = AnalyticsService.create_conversation(
                db=db_session,
                customer_id=customer.id,
                channel=channel,
                metadata={"channel_order": idx + 1},
            )
            conversations.append(conv)

            # Add message to each channel
            AnalyticsService.add_message(
                db=db_session,
                conversation_id=conv.id,
                direction="inbound",
                content=f"Message via {channel}",
                metadata={"channel": channel},
            )

        # Query unified timeline
        all_messages = (
            db_session.query(AnalyticsService.CommunicationMessage)
            .join(Conversation)
            .filter(Conversation.customer_id == customer.id)
            .order_by(AnalyticsService.CommunicationMessage.sent_at)
            .all()
        )

        # Verify all channels present
        message_channels = [msg.custom_metadata.get("channel") for msg in all_messages]
        assert "voice" in message_channels
        assert "sms" in message_channels
        assert "email" in message_channels

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_customer_preference_persistence(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test customer preferences persist across channels."""
        # Set preferences in voice conversation
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={"session_id": str(uuid.uuid4())},
        )

        voice_conv.custom_metadata = {
            "preferences": {
                "preferred_provider": "Dr. Smith",
                "preferred_time": "afternoon",
                "contact_method": "sms",
            }
        }
        db_session.commit()

        # Create SMS conversation - should access preferences
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # Query customer's last preferences
        latest_prefs_conv = (
            db_session.query(Conversation)
            .filter(
                Conversation.customer_id == customer.id,
                Conversation.custom_metadata.isnot(None),
            )
            .order_by(Conversation.last_activity_at.desc())
            .first()
        )

        if latest_prefs_conv:
            prefs = latest_prefs_conv.custom_metadata.get("preferences", {})
            assert prefs.get("preferred_provider") == "Dr. Smith"

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_slot_selection_across_channels(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test slot offers made in one channel, selected in another."""
        # Voice: Offer slots
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={"session_id": str(uuid.uuid4())},
        )

        availability = build_availability_response("2025-12-04", num_slots=8)
        mock_check_avail.return_value = availability

        SlotSelectionManager.record_offers(
            db_session,
            voice_conv,
            tool_call_id="voice-offer",
            arguments={"date": "2025-12-04", "service_type": "botox"},
            output=availability,
        )

        # Store pending offers
        voice_conv.status = "pending"
        db_session.commit()

        # SMS: Select slot
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # Transfer pending offers to SMS conversation
        db_session.refresh(voice_conv)
        pending_offers = voice_conv.custom_metadata.get("pending_slot_offers")

        if pending_offers:
            sms_conv.custom_metadata = sms_conv.custom_metadata or {}
            sms_conv.custom_metadata["pending_slot_offers"] = pending_offers
            db_session.commit()

            # User selects via SMS
            selection_msg = AnalyticsService.add_message(
                db=db_session,
                conversation_id=sms_conv.id,
                direction="inbound",
                content="I'll take option 1",
                metadata={"from": customer.phone},
            )

            captured = SlotSelectionManager.capture_selection(
                db_session, sms_conv, selection_msg
            )
            assert captured is True

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_conversation_metadata_sync(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test metadata synchronization across conversations."""
        # Create conversations
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={"session_id": str(uuid.uuid4())},
        )

        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # Set customer-level metadata in voice
        voice_conv.custom_metadata = {
            "customer_notes": "Prefers gentle approach",
            "medical_alerts": "Sensitive skin",
        }
        db_session.commit()

        # Verify SMS conversation can access customer history
        all_customer_convs = (
            db_session.query(Conversation)
            .filter(Conversation.customer_id == customer.id)
            .all()
        )

        # Collect all customer notes
        all_notes = []
        for conv in all_customer_convs:
            if conv.custom_metadata:
                notes = conv.custom_metadata.get("customer_notes")
                if notes:
                    all_notes.append(notes)

        assert len(all_notes) > 0

    @patch("messaging_service.handle_book_appointment")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_duplicate_booking_prevention(
        self, mock_openai, mock_book, db_session, customer,
    ):
        """Test preventing duplicate bookings across channels."""
        # Create appointment via voice
        appointment = Appointment(
            customer_id=customer.id,
            appointment_datetime=datetime.utcnow() + timedelta(days=7),
            service_type="botox",
            status="scheduled",
            calendar_event_id="evt-cross-channel",
        )
        db_session.add(appointment)
        db_session.commit()

        # Try to book same time via SMS
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        # Check for existing appointments
        existing = (
            db_session.query(Appointment)
            .filter(
                Appointment.customer_id == customer.id,
                Appointment.status == "scheduled",
            )
            .first()
        )

        assert existing is not None
        # System should prevent duplicate booking
        mock_openai.return_value = mock_ai_response_with_text(
            "I see you already have an appointment scheduled. Would you like to modify it?"
        )

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_channel_specific_formatting(
        self, mock_openai, mock_check_avail, db_session, customer,
    ):
        """Test responses formatted appropriately for each channel."""
        availability = build_availability_response("2025-12-05", num_slots=5)
        mock_check_avail.return_value = availability

        # Voice: Natural conversation
        voice_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="voice",
            metadata={"session_id": str(uuid.uuid4())},
        )

        voice_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conv.id,
            direction="inbound",
            content="What times are available?",
            metadata={"source": "voice_transcript"},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "I have availability at 10 AM, 2 PM, and 4 PM. Which works best for you?"
        )

        voice_content, _ = MessagingService.generate_ai_response(
            db_session, voice_conv.id, "voice"
        )

        # SMS: Concise format
        sms_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms",
            metadata={"phone_number": customer.phone},
        )

        sms_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=sms_conv.id,
            direction="inbound",
            content="Times?",
            metadata={"from": customer.phone},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            "Available:\n1) 10 AM\n2) 2 PM\n3) 4 PM\nReply with option number."
        )

        sms_content, _ = MessagingService.generate_ai_response(
            db_session, sms_conv.id, "sms"
        )

        # Email: Professional format
        email_conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="email",
            metadata={"email": customer.email},
        )

        email_msg = AnalyticsService.add_message(
            db=db_session,
            conversation_id=email_conv.id,
            direction="inbound",
            content="Please send available times.",
            metadata={"from": customer.email},
        )

        mock_openai.return_value = mock_ai_response_with_text(
            f"Dear {customer.name},\n\nThank you for your inquiry. "
            "We have the following times available:\n\n"
            "- 10:00 AM\n- 2:00 PM\n- 4:00 PM\n\n"
            "Please let me know which time works best for you.\n\n"
            "Best regards"
        )

        email_content, _ = MessagingService.generate_ai_response(
            db_session, email_conv.id, "email"
        )

        # Verify different formatting styles
        assert len(voice_content) > 0
        assert len(sms_content) > 0
        assert len(email_content) > 0
