"""Integration tests for AI booking flow.

These tests verify the end-to-end interaction between the AI and the booking system,
including tool calling behavior, retry logic, and error handling.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from booking.manager import SlotSelectionManager
from booking.time_utils import to_eastern
from database import CommunicationMessage, Conversation, Customer, SessionLocal
from messaging_service import MessagingService


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def customer(db_session):
    """Create a test customer."""
    # Use unique phone for each test to avoid conflicts
    unique_phone = f"+1555555{uuid4().hex[:4]}"
    cust = Customer(
        name="Integration Test User",
        phone=unique_phone,
        email=f"integration-{uuid4().hex[:8]}@test.com",
    )
    db_session.add(cust)
    db_session.commit()
    db_session.refresh(cust)
    yield cust
    # Cleanup
    try:
        db_session.query(Customer).filter(Customer.id == cust.id).delete()
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture
def conversation(db_session, customer):
    """Create a test conversation."""
    conv = Conversation(
        customer_id=customer.id,
        channel="sms",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={},
    )
    db_session.add(conv)
    db_session.commit()
    db_session.refresh(conv)
    yield conv
    # Cleanup messages first (foreign key constraint)
    try:
        db_session.query(CommunicationMessage).filter(
            CommunicationMessage.conversation_id == conv.id
        ).delete()
        db_session.query(Conversation).filter(Conversation.id == conv.id).delete()
        db_session.commit()
    except Exception:
        db_session.rollback()


def _mock_ai_response_with_tool_call(tool_name: str, arguments: dict) -> Mock:
    """Create a mock AI response that includes a tool call."""
    tool_call = Mock()
    tool_call.id = f"call_{uuid4()}"
    tool_call.type = "function"
    tool_call.function = Mock()
    tool_call.function.name = tool_name
    tool_call.function.arguments = str(arguments).replace("'", '"')

    message = Mock()
    message.content = ""  # No text content, just tool call
    message.tool_calls = [tool_call]

    choice = Mock()
    choice.message = message

    response = Mock()
    response.choices = [choice]
    return response


def _mock_ai_response_with_text(text: str) -> Mock:
    """Create a mock AI response that only contains text (no tool calls)."""
    message = Mock()
    message.content = text
    message.tool_calls = []

    choice = Mock()
    choice.message = message

    response = Mock()
    response.choices = [choice]
    return response


def _add_user_message(
    db_session, conversation: Conversation, content: str
) -> CommunicationMessage:
    """Add a user message to the conversation."""
    msg = CommunicationMessage(
        conversation_id=conversation.id,
        direction="inbound",
        content=content,
        sent_at=datetime.utcnow(),
        processed=False,
        custom_metadata={"source": "test"},
    )
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)
    return msg


def _build_availability_output(date: str = "2025-11-20") -> dict:
    """Build a realistic check_availability output."""
    base_time = to_eastern(datetime(2025, 11, 20, 10, 0))
    slots = []
    for i in range(10):
        start = base_time + timedelta(hours=i)
        end = start + timedelta(minutes=60)
        slots.append(
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "start_time": start.strftime("%I:%M %p"),
                "end_time": end.strftime("%I:%M %p"),
            }
        )

    return {
        "success": True,
        "all_slots": slots,
        "available_slots": slots[:10],
        "availability_summary": "We have availability from 10 AM to 7 PM.",
        "availability_windows": [
            {
                "start": slots[0]["start"],
                "end": slots[-1]["end"],
                "start_time": "10 AM",
                "end_time": "7 PM",
                "label": "10 AM-7 PM",
                "spoken_label": "10 AM to 7 PM",
            }
        ],
        "suggested_slots": [slots[0], slots[-1]],
        "date": date,
        "service": "Botox",
        "service_type": "botox",
    }


class TestPreemptiveAvailability:
    """Tests covering the deterministic preemptive availability check."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_preemptive_call_injects_availability(
        self, mock_openai, mock_check_avail, db_session, conversation
    ):
        """Ensure preemptive check_availability runs and injects tool context before the AI call."""
        _add_user_message(
            db_session, conversation, "can you book me for botox tomorrow at 4 pm"
        )

        availability_output = _build_availability_output()
        mock_check_avail.return_value = availability_output

        def _mock_ai_request(**kwargs):
            history = kwargs.get("messages") or []

            tool_call_entry = next(
                (entry for entry in history if entry.get("tool_calls")), None,
            )
            assert tool_call_entry is not None
            assert (
                tool_call_entry["tool_calls"][0]["function"]["name"]
                == "check_availability"
            )

            tool_result_entry = next(
                (
                    entry
                    for entry in history
                    if entry.get("role") == "tool"
                    and entry.get("tool_call_id") == "preemptive_call"
                ),
                None,
            )
            assert tool_result_entry is not None

            return _mock_ai_response_with_text(
                "We have availability at 4 PM. Would you like to take it?"
            )

        mock_openai.side_effect = _mock_ai_request

        content, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms",
        )

        assert mock_check_avail.call_count == 1  # only the preemptive call
        assert mock_openai.call_count == 1
        assert content.startswith("We have availability")
        assert message is not None
        assert not getattr(message, "tool_calls", [])

        db_session.refresh(conversation)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        assert metadata.get("pending_booking_intent") is True
        assert metadata.get("pending_booking_service") == "botox"
        offers = metadata.get("pending_slot_offers") or {}
        assert offers.get("service_type") == "botox"
        assert len(offers.get("slots") or []) == len(availability_output["all_slots"])

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_ai_can_still_request_tool_after_preemptive_check(
        self, mock_openai, mock_check_avail, db_session, conversation
    ):
        """If the AI still asks to run the tool, we execute it again and return follow-up flow."""
        _add_user_message(
            db_session, conversation, "book me a botox appointment tomorrow"
        )

        availability_output = _build_availability_output()
        mock_check_avail.return_value = availability_output

        mock_openai.return_value = _mock_ai_response_with_tool_call(
            "check_availability",
            {
                "date": availability_output["date"],
                "service_type": availability_output["service_type"],
            },
        )

        content, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms",
        )

        # Preemptive call + AI-requested call
        assert mock_check_avail.call_count == 2
        assert content == ""
        assert message is not None
        assert len(getattr(message, "tool_calls", []) or []) == 1


class TestEndToEndBookingFlow:
    """Test complete booking flow from user request to slot selection."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    @patch("messaging_service.MessagingService._get_calendar_service")
    def test_complete_booking_flow_with_tool_calls(
        self, mock_calendar, mock_openai, mock_check_avail, db_session, conversation
    ):
        """Test full flow: user request → AI calls check_availability → stores offers."""
        # Setup user message
        _add_user_message(
            db_session, conversation, "book me a botox appointment for Nov 20"
        )

        availability_output = _build_availability_output("2025-11-20")
        mock_check_avail.return_value = availability_output

        # Mock AI to call check_availability
        mock_openai.return_value = _mock_ai_response_with_tool_call(
            "check_availability", {"date": "2025-11-20", "service_type": "botox"}
        )

        # Mock calendar service (not needed for this test but prevents errors)
        mock_calendar.return_value = Mock()

        # Execute
        content, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms"
        )

        # Preemptive call + AI requested call
        assert mock_check_avail.call_count == 2
        assert message.tool_calls[0].function.name == "check_availability"

        # Note: Slot offers are stored by the outer API layer (api_messaging.py),
        # not by generate_ai_response itself. This test verifies the AI behavior only.


@patch("messaging_service.handle_book_appointment")
@patch("messaging_service.openai_client.chat.completions.create")
class TestDeterministicBooking:
    """Tests around the proactive book_appointment execution."""

    @patch("messaging_service.MessagingService._get_calendar_service")
    def test_auto_books_when_slot_selected_and_details_complete(
        self, mock_calendar, mock_openai, mock_book, db_session, customer, conversation,
    ):
        slots = _build_availability_output()["available_slots"]

        SlotSelectionManager.record_offers(
            db_session,
            conversation,
            tool_call_id="auto-test",
            arguments={"date": "2025-11-20", "service_type": "botox"},
            output={
                "success": True,
                "available_slots": slots,
                "all_slots": slots,
                "date": "2025-11-20",
                "service_type": "botox",
            },
        )

        selection_message = _add_user_message(
            db_session, conversation, "Option 1 sounds perfect"
        )
        assert (
            SlotSelectionManager.capture_selection(
                db_session, conversation, selection_message
            )
            is True
        )

        mock_calendar.return_value = Mock()
        mock_book.return_value = {
            "success": True,
            "event_id": "evt-123",
            "start_time": slots[0]["start"],
            "original_start_time": slots[0]["start"],
            "service_type": "botox",
            "service": "Botox",
        }

        response_text, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms",
        )

        mock_openai.assert_not_called()
        mock_book.assert_called_once()
        assert "Booked" in response_text
        assert message is None

        db_session.refresh(conversation)
        metadata = SlotSelectionManager.conversation_metadata(conversation)
        last_appt = metadata.get("last_appointment") or {}
        assert last_appt.get("status") == "scheduled"
        assert last_appt.get("start_time") == slots[0]["start"]


class TestNonBookingRequests:
    """Ensure non-booking flows do not trigger preemptive availability checks."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_info_request_allows_text_response(
        self, mock_openai, mock_check_avail, db_session, conversation
    ):
        """Informational questions should bypass check_availability entirely."""
        _add_user_message(db_session, conversation, "What services do you offer?")

        # Mock AI to return text answer (no tool call)
        mock_openai.return_value = _mock_ai_response_with_text(
            "We offer Botox, fillers, facials, and more!"
        )

        # Execute
        content, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms"
        )

        # Verify
        assert mock_openai.call_count == 1  # No retry
        assert "We offer" in content
        assert not hasattr(message, "tool_calls") or not message.tool_calls
        mock_check_avail.assert_not_called()

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_greeting_allows_text_response(
        self, mock_openai, mock_check_avail, db_session, conversation
    ):
        """Greetings should not kick off availability checks."""
        _add_user_message(db_session, conversation, "Hi there!")

        # Mock AI to return greeting
        mock_openai.return_value = _mock_ai_response_with_text(
            "Hello! How can I help you today?"
        )

        # Execute
        content, message = MessagingService.generate_ai_response(
            db_session, conversation.id, "sms"
        )

        # Verify
        assert mock_openai.call_count == 1  # No retry for greetings
        assert "Hello" in content
        mock_check_avail.assert_not_called()


class TestPromptEffectiveness:
    """Test that the critical prompt rules are effective."""

    @patch("messaging_service.openai_client.chat.completions.create")
    def test_prompt_includes_critical_rules(
        self, mock_openai, db_session, conversation
    ):
        """Test that system prompt includes critical rules about tool calling."""
        _add_user_message(db_session, conversation, "schedule appointment")

        mock_openai.return_value = _mock_ai_response_with_text("Checking...")

        # Execute
        MessagingService.generate_ai_response(db_session, conversation.id, "sms")

        # Verify system prompt was passed and includes critical rules
        call_args = mock_openai.call_args
        messages = call_args.kwargs["messages"]

        system_message = next((m for m in messages if m["role"] == "system"), None)
        assert system_message is not None
        assert "CRITICAL RULES" in system_message["content"]
        assert (
            "NEVER state availability times without first calling check_availability"
            in system_message["content"]
        )
