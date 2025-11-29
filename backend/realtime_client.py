"""
OpenAI Realtime API client for voice-to-voice conversation handling.
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import pytz
import websockets
from sqlalchemy.orm import Session

from analytics import AnalyticsService
from analytics_metrics import record_calendar_error, record_tool_execution
from booking import BookingChannel, BookingContext, BookingOrchestrator
from booking.manager import SlotSelectionError, SlotSelectionManager
from booking.time_utils import format_for_display, parse_iso_datetime, to_eastern
from booking_handlers import (
    handle_book_appointment,
    handle_check_availability,
    handle_get_service_info,
)
from calendar_service import get_calendar_service
from config import OPENING_SCRIPT, PROVIDERS, get_settings
from database import Conversation, SessionLocal
from faq_service import get_faq_answer
from realtime_config import build_voice_session_config
from prompts import get_system_prompt
from settings_service import SettingsService
from turn_orchestrator import TurnContext, TurnIntent, TurnOrchestrator

settings = get_settings()
logger = logging.getLogger(__name__)


class _BookingContextFactory:
    """Factory for constructing BookingContext objects for voice sessions.

    This centralizes how we hydrate booking context (db, conversation,
    channel, calendar, services) so that tool handlers stay thin.
    """

    def __init__(
        self,
        *,
        db: Session,
        conversation: Conversation,
        calendar_service,
        get_services: Callable[[], Dict[str, Any]],
    ) -> None:
        self._db = db
        self._conversation = conversation
        self._calendar_service = calendar_service
        self._get_services = get_services

    def for_voice(self, *, customer: Optional[Any] = None) -> BookingContext:
        return BookingContext(
            db=self._db,
            conversation=self._conversation,
            customer=customer,
            channel=BookingChannel.VOICE,
            calendar_service=self._calendar_service,
            services_dict=self._get_services(),
        )


class _VoiceSessionState:
    """Helper for persisting voice session and conversation metadata.

    Keeps RealtimeClient.handle_function_call focused on control flow while
    this class owns how we update session_data and conversation metadata for
    booking-related events.
    """

    def __init__(
        self,
        *,
        db: Session,
        conversation: Conversation,
        session_data: Dict[str, Any],
        refresh_conversation: Callable[[], None],
    ) -> None:
        self._db = db
        self._conversation = conversation
        self._session_data = session_data
        self._refresh_conversation = refresh_conversation

    def record_successful_booking(
        self,
        booking_result: Dict[str, Any],
        arguments: Dict[str, Any],
    ) -> None:
        """Apply side effects after a successful book_appointment call."""

        SlotSelectionManager.clear_offers(self._db, self._conversation)
        self._refresh_conversation()

        customer_name = arguments.get("customer_name")
        customer_phone = arguments.get("customer_phone")
        customer_email = (
            arguments.get("customer_email")
            or (f"{customer_phone}@placeholder.com" if customer_phone else None)
        )
        service_type = booking_result.get("service_type") or arguments.get(
            "service_type"
        )

        start_iso = booking_result.get("start_time")
        formatted_voice_time = None
        if start_iso:
            formatted_voice_time = format_for_display(
                parse_iso_datetime(start_iso),
                channel="voice",
            )
            booking_result["spoken_confirmation"] = (
                f"Perfect! I've booked your {booking_result.get('service', service_type)} "
                f"appointment for {formatted_voice_time}."
            )

        self._session_data["customer_data"] = {
            "name": customer_name,
            "phone": customer_phone,
            "email": customer_email,
        }

        self._session_data["last_appointment"] = {
            "event_id": booking_result.get("event_id"),
            "service_type": service_type,
            "provider": arguments.get("provider"),
            "start_time": start_iso,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
        }

        # Mirror deterministic booking metadata used by messaging flow so
        # cross-channel logic can avoid duplicate bookings for the same slot.
        metadata = SlotSelectionManager.conversation_metadata(self._conversation)
        metadata["last_appointment"] = {
            "calendar_event_id": booking_result.get("event_id"),
            "service_type": service_type,
            "provider": arguments.get("provider"),
            "start_time": start_iso,
            "status": "scheduled",
        }
        # Clear any pending booking intent flags once the appointment is set.
        metadata["pending_booking_intent"] = False
        SlotSelectionManager.persist_conversation_metadata(
            self._db, self._conversation, metadata
        )

    def _current_customer_fields(self) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        data = self._session_data.get("customer_data") or {}
        return data.get("name"), data.get("phone"), data.get("email")

    def record_appointment_details(
        self,
        appointment_id: str,
        details: Dict[str, Any],
    ) -> None:
        """Update session state based on fetched appointment details."""

        name, phone, email = self._current_customer_fields()
        self._session_data["last_appointment"] = {
            "event_id": appointment_id,
            "service_type": self._session_data.get("last_appointment", {}).get(
                "service_type"
            ),
            "provider": details.get("provider"),
            "start_time": (
                details["start"].isoformat() if "start" in details else None
            ),
            "customer_name": name,
            "customer_phone": phone,
            "customer_email": email,
        }

    def record_rescheduled_appointment(
        self,
        appointment_id: str,
        *,
        service_type: str,
        provider: Optional[str],
        start_time_iso: str,
    ) -> None:
        """Persist state and metadata after a successful reschedule."""

        name, phone, email = self._current_customer_fields()

        if provider is None and self._session_data.get("last_appointment"):
            provider = self._session_data["last_appointment"].get("provider")

        self._session_data["last_appointment"] = {
            "event_id": appointment_id,
            "service_type": service_type,
            "provider": provider,
            "start_time": start_time_iso,
            "customer_name": name,
            "customer_phone": phone,
            "customer_email": email,
        }

        metadata = SlotSelectionManager.conversation_metadata(self._conversation)
        metadata["last_appointment"] = {
            "calendar_event_id": appointment_id,
            "service_type": service_type,
            "provider": provider,
            "start_time": start_time_iso,
            "status": "scheduled",
        }
        SlotSelectionManager.persist_conversation_metadata(
            self._db, self._conversation, metadata
        )

    def record_cancelled_appointment(
        self,
        appointment_id: str,
        *,
        cancellation_reason: Optional[str] = None,
    ) -> None:
        """Persist state and metadata after a successful cancellation."""

        self._session_data["last_appointment"] = None

        metadata = SlotSelectionManager.conversation_metadata(self._conversation)
        metadata["last_appointment"] = {
            "calendar_event_id": appointment_id,
            "status": "cancelled",
            "cancellation_reason": cancellation_reason,
        }
        SlotSelectionManager.persist_conversation_metadata(
            self._db, self._conversation, metadata
        )


class RealtimeClient:
    """Client for managing OpenAI Realtime API voice conversations."""

    def __init__(
        self,
        *,
        session_id: str,
        db: Optional[Session] = None,
        conversation: Optional[Conversation] = None,
        legacy_call_session_id: Optional[str] = None,
        transcript_callback: Optional[Callable[[str, str], Any]] = None,
    ) -> None:
        """Initialize the Realtime client with database context."""
        self.ws = None
        self.calendar_service = self._init_calendar_service()
        self.session_id = session_id
        self._owns_db_session = db is None
        self.db = db or SessionLocal()
        self.conversation = (
            conversation
            if conversation is not None
            else self._get_or_create_conversation(legacy_call_session_id)
        )
        self.session_data = {
            "transcript": [],
            "function_calls": [],
            "customer_data": {},
            "sentiment_markers": [],
            "last_appointment": None,
            "conversation_id": str(self.conversation.id),
        }
        self.identity_instructions = ""
        self._current_customer_text = ""
        self._current_assistant_text = ""
        self._pending_items: Dict[str, Dict[str, Any]] = {}
        self._last_transcript_entry: Optional[str] = None
        self._awaiting_response: bool = False
        # Optional callback to stream transcript entries back to the client in real time
        self._transcript_callback = transcript_callback

        # Load services and providers from database (with caching)
        self._services_dict = None
        self._providers_list = None

        # Helpers for booking context and session state management
        self._booking_context_factory = _BookingContextFactory(
            db=self.db,
            conversation=self.conversation,
            calendar_service=self.calendar_service,
            get_services=self._get_services,
        )
        self._session_state = _VoiceSessionState(
            db=self.db,
            conversation=self.conversation,
            session_data=self.session_data,
            refresh_conversation=self._refresh_conversation,
        )

    def _get_services(self) -> Dict[str, Any]:
        """Get services from database (cached)."""
        if self._services_dict is None:
            self._services_dict = SettingsService.get_services_dict(self.db)
        return self._services_dict

    def _get_providers(self) -> List[Dict[str, Any]]:
        """Get providers from database (cached)."""
        if self._providers_list is None:
            self._providers_list = SettingsService.get_providers_dict(self.db)
        return self._providers_list

    def close(self) -> None:
        """Release any resources owned by the client."""
        if self._owns_db_session and self.db:
            self.db.close()

    def _get_or_create_conversation(
        self, legacy_call_session_id: Optional[str]
    ) -> Conversation:
        """Return an existing voice conversation or create one for this session."""
        existing = (
            self.db.query(Conversation)
            .filter(Conversation.channel == "voice")
            .order_by(Conversation.initiated_at.desc())
            .all()
        )
        for candidate in existing:
            metadata = candidate.custom_metadata or {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}
            if metadata.get("session_id") == self.session_id:
                return candidate

        metadata: Dict[str, Any] = {"session_id": self.session_id}
        if legacy_call_session_id:
            metadata["legacy_call_session_id"] = legacy_call_session_id

        conversation = AnalyticsService.create_conversation(
            db=self.db,
            customer_id=None,
            channel="voice",
            metadata=metadata,
        )
        return conversation

    def _refresh_conversation(self) -> None:
        try:
            self.db.refresh(self.conversation)
        except Exception:  # noqa: BLE001
            # Refresh can fail if conversation was expired or detached; ignore silently.
            pass

    def _init_calendar_service(self):
        try:
            return get_calendar_service()
        except Exception as exc:  # noqa: BLE001
            logger.critical(
                "RealtimeClient failed to initialize calendar service: %s",
                exc,
                exc_info=True,
            )
            raise

    async def connect(self):
        """Establish WebSocket connection to OpenAI Realtime API."""
        url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini-2025-10-06"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1",
        }

        logger.info("Connecting to OpenAI Realtime API: %s", url)
        self.ws = await websockets.connect(url, extra_headers=headers)
        logger.info("Connected to OpenAI Realtime API")

        # Initialize session with instructions and tools
        await self._initialize_session()
        logger.info("Realtime session initialized")

    async def send_greeting(self):
        """Send an introductory greeting to kick off the call."""
        if not self.ws:
            logger.warning("WebSocket not ready; cannot send greeting")
            return

        assistant_name = settings.AI_ASSISTANT_NAME or "Eva"
        med_spa_name = settings.MED_SPA_NAME or "our med spa"

        greeting_text = (
            f"Hi, thanks for calling {med_spa_name}. My name is {assistant_name}. "
            "How can I help you?"
        )

        # Use response.create to make assistant speak the greeting
        # This is the correct way to trigger a proactive assistant response
        response_create = {
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"],
                "instructions": f"Start the conversation by saying: {greeting_text}",
            },
        }

        await self.ws.send(json.dumps(response_create))
        # Don't call _request_response() - response.create already triggers a response
        logger.info("Sent greeting request to Realtime API")

    async def _initialize_session(self):
        """Initialize the session with system instructions and available functions."""
        system_prompt = get_system_prompt("voice")

        self.identity_instructions = (
            f"You are {settings.AI_ASSISTANT_NAME}, the virtual receptionist for {settings.MED_SPA_NAME}. "
            "Always stay in character as Ava, focus on med spa services, and never describe yourself as ChatGPT or an OpenAI model. "
            f"If asked who you are, respond with: 'I'm {settings.AI_ASSISTANT_NAME}, the virtual receptionist for {settings.MED_SPA_NAME}. I'm here to help with appointments or any questions about our treatments.'"
        )

        session_config = build_voice_session_config(
            system_prompt=system_prompt,
            tools=self._get_function_definitions(),
        )

        await self.ws.send(json.dumps(session_config))
        # System instructions are already in session config above - no need for separate message

    def _get_function_definitions(self) -> List[Dict[str, Any]]:
        """Define functions that the AI can call."""
        return [
            {
                "type": "function",
                "name": "check_availability",
                "description": "Check available appointment slots for a specific date and service type",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {
                            "type": "string",
                            "description": "Date in YYYY-MM-DD format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": list(self._get_services().keys()),
                            "description": "Type of service requested",
                        },
                    },
                    "required": ["date", "service_type"],
                },
            },
            {
                "type": "function",
                "name": "get_current_date",
                "description": "Retrieve the current Eastern time date context. Call this before referencing relative dates like 'today' or 'tomorrow'.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "type": "function",
                "name": "book_appointment",
                "description": "Book an appointment for a customer",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_name": {
                            "type": "string",
                            "description": "Customer's full name",
                        },
                        "customer_phone": {
                            "type": "string",
                            "description": "Customer's phone number",
                        },
                        "customer_email": {
                            "type": "string",
                            "description": "Customer's email address",
                        },
                        "start_time": {
                            "type": "string",
                            "description": "Appointment start time in ISO 8601 format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": list(self._get_services().keys()),
                            "description": "Type of service",
                        },
                        "provider": {
                            "type": "string",
                            "description": "Preferred provider name (optional)",
                        },
                        "notes": {
                            "type": "string",
                            "description": "Special requests or notes (optional)",
                        },
                    },
                    "required": [
                        "customer_name",
                        "customer_phone",
                        "start_time",
                        "service_type",
                    ],
                },
            },
            {
                "type": "function",
                "name": "get_service_info",
                "description": "Get detailed information about a service including price, duration, and care instructions",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_type": {
                            "type": "string",
                            "enum": list(self._get_services().keys()),
                            "description": "Type of service to get information about",
                        }
                    },
                    "required": ["service_type"],
                },
            },
            {
                "type": "function",
                "name": "get_provider_info",
                "description": "Get information about available providers and their specialties",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "provider_name": {
                            "type": "string",
                            "description": "Specific provider name (optional, returns all if not specified)",
                        }
                    },
                },
            },
            {
                "type": "function",
                "name": "search_customer",
                "description": "Search for existing customer by phone number",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone": {
                            "type": "string",
                            "description": "Customer's phone number",
                        }
                    },
                    "required": ["phone"],
                },
            },
            {
                "type": "function",
                "name": "get_appointment_details",
                "description": "Look up an existing appointment by calendar event ID",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        }
                    },
                    "required": ["appointment_id"],
                },
            },
            {
                "type": "function",
                "name": "reschedule_appointment",
                "description": "Move an appointment to a new start time",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        },
                        "new_start_time": {
                            "type": "string",
                            "description": "New start time in ISO 8601 format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": list(self._get_services().keys()),
                            "description": "Service type for duration lookup (optional if previously stored)",
                        },
                        "provider": {
                            "type": "string",
                            "description": "Preferred provider name (optional)",
                        },
                    },
                    "required": ["appointment_id", "new_start_time"],
                },
            },
            {
                "type": "function",
                "name": "cancel_appointment",
                "description": "Cancel an existing appointment",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        },
                        "cancellation_reason": {
                            "type": "string",
                            "description": "Optional reason provided by customer",
                        },
                    },
                    "required": ["appointment_id"],
                },
            },
            {
                "type": "function",
                "name": "get_faq_answer",
                "description": (
                    "Look up a concise, policy-safe FAQ answer for common questions "
                    "about services, pricing, hours, providers, location, and policies."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": (
                                "The caller's question in natural language, for example "
                                "'What are your hours on Saturday?' or 'Do you offer Botox?'."
                            ),
                        },
                        "category": {
                            "type": "string",
                            "description": (
                                "Optional high-level category hint such as 'services', "
                                "'pricing', 'hours', 'location', or 'policies'."
                            ),
                            "enum": [
                                "services",
                                "pricing",
                                "hours",
                                "location",
                                "providers",
                                "policies",
                                "general",
                            ],
                        },
                    },
                    "required": ["query"],
                },
            },
        ]

    async def handle_function_call(
        self, function_name: str, arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute function calls from the AI assistant.

        Args:
            function_name: Name of the function to call
            arguments: Function arguments

        Returns:
            Function execution result
        """
        self.session_data["function_calls"].append(
            {
                "function": function_name,
                "arguments": arguments,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        try:
            if function_name == "check_availability":
                date_str = arguments.get("date")
                service_type = arguments.get("service_type")

                try:
                    booking_context = self._booking_context_factory.for_voice()
                    orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)
                    availability_result = orchestrator.check_availability(
                        booking_context,
                        date=date_str,
                        service_type=service_type,
                        limit=10,
                        tool_call_id=None,
                    )
                    availability = availability_result.to_dict()

                    # Ensure service_type is explicitly present for Realtime prompts.
                    if service_type and not availability.get("service_type"):
                        availability["service_type"] = service_type

                    if availability.get("success"):
                        self._refresh_conversation()

                    record_tool_execution(
                        tool_name="check_availability",
                        channel="voice",
                        success=bool(availability.get("success")),
                        latency_ms=None,
                        error_code=None,
                        extra={
                            "conversation_id": str(getattr(self.conversation, "id", "unknown")),
                            "service_type": service_type,
                            "date": date_str,
                        },
                    )

                    return availability

                except Exception as calendar_exc:
                    # Enhanced error handling for Google Calendar API failures
                    from googleapiclient.errors import HttpError

                    error_code = None
                    user_message = "I'm having trouble accessing the calendar right now. Would you like me to take your information and have someone call you back?"

                    if isinstance(calendar_exc, HttpError):
                        error_code = calendar_exc.resp.status
                        logger.error(
                            "Google Calendar API error during check_availability: HTTP %s",
                            error_code,
                            exc_info=True,
                            extra={
                                "function": function_name,
                                "status_code": error_code,
                                "date": date_str,
                                "service": service_type
                            }
                        )

                        if error_code == 404:
                            user_message = "I'm having trouble accessing the calendar configuration. Let me transfer you to our staff who can help you immediately."
                        elif error_code == 429:
                            user_message = "Our calendar system is experiencing high demand. Can you try again in just a moment, or would you prefer I take your information?"
                        elif error_code >= 500:
                            user_message = "The calendar service is temporarily unavailable. I'd be happy to take your information and have our team call you back within the hour."
                        elif error_code in (401, 403):
                            user_message = "I'm experiencing a technical issue accessing the calendar. Let me connect you with our receptionist right away."
                    else:
                        logger.error(
                            "Unexpected error during check_availability",
                            exc_info=True,
                            extra={"function": function_name, "date": date_str, "service": service_type}
                        )

                    record_calendar_error(
                        reason="check_availability_calendar_error",
                        http_status=error_code,
                        channel="voice",
                        extra={
                            "function": function_name,
                            "date": date_str,
                            "service_type": service_type,
                            "conversation_id": str(getattr(self.conversation, "id", "unknown")),
                        },
                    )
                    record_tool_execution(
                        tool_name="check_availability",
                        channel="voice",
                        success=False,
                        latency_ms=None,
                        error_code=error_code,
                        extra={"error": "calendar_unavailable"},
                    )

                    return {
                        "success": False,
                        "error": "calendar_unavailable",
                        "error_code": error_code,
                        "user_message": user_message
                    }

            elif function_name == "get_current_date":
                eastern = pytz.timezone("America/New_York")
                now = datetime.now(eastern)
                tomorrow = now + timedelta(days=1)
                next_week = now + timedelta(days=7)

                return {
                    "success": True,
                    "date": now.strftime("%Y-%m-%d"),
                    "day_of_week": now.strftime("%A"),
                    "time": now.strftime("%I:%M %p %Z").lstrip("0"),
                    "datetime_iso": now.isoformat(),
                    "tomorrow": tomorrow.strftime("%Y-%m-%d"),
                    "next_week": next_week.strftime("%Y-%m-%d"),
                }

            elif function_name == "book_appointment":
                service_type = arguments.get("service_type")
                booking_context = self._booking_context_factory.for_voice()
                orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)

                try:
                    booking_result_obj = orchestrator.book_appointment(
                        booking_context,
                        params=dict(arguments),
                    )
                    booking_result = booking_result_obj.to_dict()
                except Exception as booking_exc:
                    # Enhanced error handling for Google Calendar booking failures
                    from googleapiclient.errors import HttpError

                    error_code = None
                    user_message = "I'm having trouble completing your booking right now. Let me connect you with our team who can finalize this for you."

                    if isinstance(booking_exc, HttpError):
                        error_code = booking_exc.resp.status
                        logger.error(
                            "Google Calendar API error during book_appointment: HTTP %s",
                            error_code,
                            exc_info=True,
                            extra={
                                "function": function_name,
                                "status_code": error_code,
                                "customer": arguments.get("customer_name"),
                                "service": arguments.get("service_type"),
                            },
                        )

                        if error_code == 404:
                            user_message = "I'm having trouble accessing the calendar. Let me transfer you to complete your booking with our staff."
                        elif error_code == 429:
                            user_message = "The calendar is temporarily busy. Can you hold for just a moment while I try again?"
                        elif error_code >= 500:
                            user_message = "The booking system is temporarily unavailable. I've saved your information and our team will call you within 15 minutes to confirm your appointment."
                        elif error_code in (401, 403):
                            user_message = "I'm experiencing a technical issue. Let me transfer you to our receptionist to complete your booking right away."
                    else:
                        logger.error(
                            "Unexpected error during book_appointment",
                            exc_info=True,
                            extra={"function": function_name, "customer": arguments.get("customer_name")},
                        )

                    record_calendar_error(
                        reason="book_appointment_calendar_error",
                        http_status=error_code,
                        channel="voice",
                        extra={
                            "function": function_name,
                            "customer": arguments.get("customer_name"),
                            "service_type": arguments.get("service_type"),
                            "conversation_id": str(getattr(self.conversation, "id", "unknown")),
                        },
                    )
                    record_tool_execution(
                        tool_name="book_appointment",
                        channel="voice",
                        success=False,
                        latency_ms=None,
                        error_code=error_code,
                        extra={"error": "booking_failed"},
                    )

                    return {
                        "success": False,
                        "error": "booking_failed",
                        "error_code": error_code,
                        "user_message": user_message,
                    }

                # If slot selection enforcement failed inside the orchestrator, add a
                # voice-friendly message while preserving the structured error.
                if not booking_result.get("success"):
                    if booking_result.get("code") == "slot_selection_mismatch":
                        booking_result.setdefault(
                            "user_message",
                            "I'm sorry, I need to check availability first before I can book that time. Let me pull up the available slots for you.",
                        )

                    record_tool_execution(
                        tool_name="book_appointment",
                        channel="voice",
                        success=False,
                        latency_ms=None,
                        error_code=booking_result.get("error_code"),
                        extra={
                            "code": booking_result.get("code"),
                            "conversation_id": str(getattr(self.conversation, "id", "unknown")),
                        },
                    )

                    return booking_result

                # Success path mirrors previous behavior, now using orchestrator output.
                self._session_state.record_successful_booking(booking_result, arguments)

                record_tool_execution(
                    tool_name="book_appointment",
                    channel="voice",
                    success=True,
                    latency_ms=None,
                    error_code=None,
                    extra={
                        "conversation_id": str(getattr(self.conversation, "id", "unknown")),
                        "service_type": service_type,
                    },
                )

                return booking_result

            elif function_name == "get_service_info":
                service_type = arguments.get("service_type")

                output = handle_get_service_info(
                    service_type=service_type,
                    services_dict=self._get_services(),
                )

                return output

            elif function_name == "get_provider_info":
                provider_name = arguments.get("provider_name")

                if provider_name:
                    provider = PROVIDERS.get(provider_name)
                    if provider:
                        return {"success": True, "provider": provider}
                    else:
                        return {"success": False, "error": "Provider not found"}
                else:
                    return {"success": True, "providers": list(PROVIDERS.values())}

            elif function_name == "search_customer":
                phone = arguments.get("phone")
                # This would query the database in production
                # For now, return mock response
                return {
                    "success": True,
                    "found": False,
                    "message": "No existing customer found with this phone number",
                }

            elif function_name == "get_appointment_details":
                appointment_id = arguments.get("appointment_id")
                details = self.calendar_service.get_appointment_details(appointment_id)

                if not details:
                    return {"success": False, "error": "Appointment not found"}

                self._session_state.record_appointment_details(appointment_id, details)

                return {
                    "success": True,
                    "appointment": {
                        "id": details["id"],
                        "summary": details.get("summary"),
                        "description": details.get("description"),
                        "start": (
                            details.get("start").isoformat()
                            if details.get("start")
                            else None
                        ),
                        "end": (
                            details.get("end").isoformat()
                            if details.get("end")
                            else None
                        ),
                        "status": details.get("status"),
                    },
                }

            elif function_name == "reschedule_appointment":
                appointment_id = arguments.get("appointment_id")
                new_start_time_str = arguments.get("new_start_time")
                service_type = arguments.get("service_type")
                provider = arguments.get("provider")

                if not service_type and self.session_data.get("last_appointment"):
                    service_type = self.session_data["last_appointment"].get(
                        "service_type"
                    )

                booking_context = self._booking_context_factory.for_voice()
                orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)

                start_time = time.time()
                booking_result = orchestrator.reschedule_appointment(
                    booking_context,
                    appointment_id=appointment_id,
                    new_start_time=new_start_time_str,
                    service_type=service_type,
                    provider=provider,
                )
                latency_ms = (time.time() - start_time) * 1000

                record_tool_execution(
                    tool_name="reschedule_appointment",
                    channel="voice",
                    success=booking_result.get("success", False),
                    latency_ms=latency_ms,
                )

                if not booking_result.get("success"):
                    return booking_result

                start_iso = booking_result.get("start_time") or new_start_time_str
                effective_service_type = (
                    booking_result.get("service_type") or service_type
                )
                effective_provider = booking_result.get("provider") or provider

                self._session_state.record_rescheduled_appointment(
                    appointment_id,
                    service_type=effective_service_type,
                    provider=effective_provider,
                    start_time_iso=start_iso,
                )

                try:
                    start_dt = parse_iso_datetime(start_iso)
                    new_time_str = start_dt.strftime("%B %d, %Y at %I:%M %p")
                except Exception:  # noqa: BLE001 - fallback if parsing fails
                    new_time_str = start_iso

                return {
                    "success": True,
                    "appointment_id": appointment_id,
                    "new_time": new_time_str,
                    "service": booking_result.get("service")
                    or (self._get_services().get(effective_service_type, {}).get("name")),
                }

            elif function_name == "cancel_appointment":
                appointment_id = arguments.get("appointment_id")
                cancellation_reason = arguments.get("cancellation_reason")

                booking_context = self._booking_context_factory.for_voice()
                orchestrator = BookingOrchestrator(channel=BookingChannel.VOICE)

                start_time = time.time()
                booking_result = orchestrator.cancel_appointment(
                    booking_context,
                    appointment_id=appointment_id,
                    cancellation_reason=cancellation_reason,
                )
                latency_ms = (time.time() - start_time) * 1000

                record_tool_execution(
                    tool_name="cancel_appointment",
                    channel="voice",
                    success=booking_result.get("success", False),
                    latency_ms=latency_ms,
                )

                if not booking_result.get("success"):
                    return booking_result

                self._session_state.record_cancelled_appointment(
                    appointment_id,
                    cancellation_reason=cancellation_reason
                    or booking_result.get("reason"),
                )

                response = {
                    "success": True,
                    "appointment_id": appointment_id,
                    "status": "cancelled",
                }

                if cancellation_reason or booking_result.get("reason"):
                    response["cancellation_reason"] = (
                        cancellation_reason or booking_result.get("reason")
                    )

                return response

            elif function_name == "get_faq_answer":
                query = str(arguments.get("query", ""))
                category = arguments.get("category")

                result = get_faq_answer(self.db, query=query, category=category)
                return result

            else:
                return {"success": False, "error": f"Unknown function: {function_name}"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def send_audio(self, audio_base64: str, *, commit: bool = False):
        """Send base64-encoded audio data to the Realtime API."""
        if not self.ws:
            logger.warning("WebSocket not ready; dropping audio chunk")
            return

        if not audio_base64:
            logger.debug("Empty audio payload received; skipping append")
            return

        append_event = {"type": "input_audio_buffer.append", "audio": audio_base64}
        await self.ws.send(json.dumps(append_event))
        logger.debug("Sent audio chunk (base64 len=%d)", len(audio_base64))

        if commit:
            await self.commit_audio_buffer()

    async def commit_audio_buffer(self):
        """Commit the current audio buffer and request a model response."""
        if not self.ws:
            logger.warning("WebSocket not ready; cannot commit buffer")
            return

        await self.ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
        logger.debug("Committed audio buffer")
        self._awaiting_response = True

    async def cancel_response(self):
        """Cancel the current assistant response when user interrupts."""
        if not self.ws:
            logger.warning("WebSocket not ready; cannot cancel response")
            return

        await self.ws.send(json.dumps({"type": "response.cancel"}))
        logger.info("Cancelled assistant response")

    async def handle_messages(self, on_audio_callback: Optional[Callable] = None):
        """
        Handle incoming messages from the Realtime API.

        Args:
            on_audio_callback: Callback function for audio output
        """
        logger.info("Starting to listen for OpenAI messages")
        async for message in self.ws:
            data = json.loads(message)
            event_type = data.get("type")

            # Log all events for debugging transcription issues
            if event_type not in ["response.audio.delta", "input_audio_buffer.append"]:
                logger.debug("Received OpenAI event: %s", event_type)
                if event_type.startswith("input_audio") or event_type.startswith(
                    "conversation.item"
                ):
                    logger.debug("   Data: %s", json.dumps(data, indent=2)[:500])

            # Handle different event types
            if event_type == "session.updated":
                # Log session configuration to verify transcription is enabled
                session = data.get("session", {})
                logger.debug(
                    "Session updated - Transcription enabled: %s",
                    session.get("input_audio_transcription") is not None,
                )
                logger.debug("   Voice: %s", session.get("voice"))
                logger.debug(
                    "   Turn detection: %s",
                    session.get("turn_detection", {}).get("type"),
                )

            elif event_type == "response.audio.delta":
                # Audio output from AI
                audio_b64 = data.get("delta")
                if audio_b64 and on_audio_callback:
                    logger.debug("Sending audio to client: %d chars", len(audio_b64))
                    await on_audio_callback(audio_b64)
                elif not audio_b64:
                    logger.warning("No audio data in response.audio.delta event")
                elif not on_audio_callback:
                    logger.warning("No audio callback function configured")

            elif event_type == "input_audio_buffer.transcription.delta":
                delta = data.get("delta")
                if isinstance(delta, str):
                    self._current_customer_text += delta
                elif isinstance(delta, dict):
                    self._current_customer_text += delta.get("transcript", "")
                logger.debug("User speech delta: %s", delta)

            elif event_type == "input_audio_buffer.transcription.completed":
                transcript_text = (
                    data.get("transcript") or self._current_customer_text.strip()
                )
                if transcript_text:
                    logger.debug("User speech completed: %s", transcript_text)
                    self._append_transcript_entry("customer", transcript_text)
                    # Classify turn intent for voice and persist in conversation metadata
                    try:
                        metadata = SlotSelectionManager.conversation_metadata(
                            self.conversation
                        )
                        intent = TurnOrchestrator.classify_intent(
                            TurnContext(
                                channel="voice",
                                last_customer_text=transcript_text,
                                metadata=metadata or {},
                            )
                        )
                        if isinstance(metadata, dict):
                            metadata["last_turn_intent"] = intent.value
                            SlotSelectionManager.persist_conversation_metadata(
                                self.db, self.conversation, metadata
                            )
                    except Exception:  # noqa: BLE001 - intent logging should never break flows
                        logger.exception(
                            "Failed to classify turn intent for voice conversation %s",
                            getattr(self.conversation, "id", "unknown"),
                        )
                self._current_customer_text = ""

            elif event_type == "conversation.item.input_audio_transcription.delta":
                # User audio transcription delta (incremental update)
                delta = data.get("delta")
                item_id = data.get("item_id")
                logger.debug(
                    "User audio transcription delta (item %s): %s", item_id, delta
                )

            elif event_type == "conversation.item.input_audio_transcription.completed":
                # User audio transcription completed
                transcript = data.get("transcript")
                item_id = data.get("item_id")
                logger.debug(
                    "User audio transcription completed (item %s): %s",
                    item_id,
                    transcript,
                )
                if transcript:
                    self._append_transcript_entry("customer", transcript)

            elif event_type == "conversation.item.created":
                logger.debug("conversation.item.created: %s", data)
                self._process_conversation_item_created(data)

            elif event_type == "conversation.item.delta":
                logger.debug("conversation.item.delta: %s", data)
                self._process_conversation_item_delta(data)

            elif event_type == "conversation.item.completed":
                logger.debug("conversation.item.completed: %s", data)
                self._process_conversation_item_completed(data)

            elif event_type == "response.audio_transcript.delta":
                transcript_delta = data.get("delta") or ""
                if transcript_delta:
                    self._current_assistant_text += transcript_delta
                    logger.debug("Assistant speech delta: %s", transcript_delta)

            elif event_type == "response.audio_transcript.done":
                transcript_text = (
                    data.get("transcript") or self._current_assistant_text
                ).strip()
                if transcript_text:
                    logger.debug("Assistant speech completed: %s", transcript_text)
                    self._append_transcript_entry("assistant", transcript_text)
                self._current_assistant_text = ""

            elif event_type == "response.output_text.delta":
                delta = data.get("delta")
                if isinstance(delta, str):
                    self._current_assistant_text += delta
                elif isinstance(delta, dict):
                    self._current_assistant_text += delta.get("text", "")

            elif event_type == "response.output_text.done":
                assistant_text = self._current_assistant_text.strip()
                self._append_transcript_entry("assistant", assistant_text)
                self._current_assistant_text = ""

            elif event_type == "response.text.done":
                # Legacy text response event
                text = data.get("text")
                self._append_transcript_entry("assistant", text)

            elif event_type == "response.function_call_arguments.done":
                # Function call from AI
                function_name = data.get("name")
                arguments_str = data.get("arguments")
                arguments = json.loads(arguments_str) if arguments_str else {}

                # Execute function
                result = await self.handle_function_call(function_name, arguments)

                # Send result back to AI
                response_event = {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": data.get("call_id"),
                        "output": json.dumps(result),
                    },
                }
                await self.ws.send(json.dumps(response_event))

                # Continue the response
                await self._request_response()

            elif event_type == "error":
                error_code = data.get("error", {}).get("code")

                # Some "errors" are expected and can be ignored
                if error_code == "response_cancel_not_active":
                    # This happens when user interrupts after assistant already finished
                    print("ℹ️  Interrupt received but response already completed")
                elif error_code == "input_audio_buffer_commit_empty":
                    # This happens when commit is sent with no audio in buffer
                    print("ℹ️  Commit requested but audio buffer was empty")
                elif error_code == "conversation_already_has_active_response":
                    # This happens when multiple responses are requested simultaneously
                    print(f"⚠️  {data.get('error', {}).get('message')}")
                else:
                    # Unexpected errors should be logged fully
                    print(f"❌ Error: {data}")

    async def disconnect(self):
        """Close the WebSocket connection."""
        if self.ws:
            await self.ws.close()
            print("Disconnected from OpenAI Realtime API")

    def get_session_data(self) -> Dict[str, Any]:
        """Get collected session data for logging."""
        self._finalize_transcript_buffers()
        return self.session_data

    def _append_transcript_entry(self, speaker: str, raw_text: Optional[str]) -> None:
        """
        Append a sanitized transcript entry, skipping empty strings and structured payloads.
        """
        if not raw_text:
            return

        text = raw_text.strip()
        if not text:
            return

        # Skip JSON payloads (e.g., function outputs) to keep transcript conversational
        if text.startswith("{") or text.startswith("["):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, (dict, list)):
                    return
            except json.JSONDecodeError:
                # Not valid JSON, fall through and record text
                pass

        fingerprint = f"{speaker}:{text}"
        if self._last_transcript_entry == fingerprint:
            return

        print(f"📝 Captured transcript entry [{speaker}]: {text}")
        entry = {
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.session_data["transcript"].append(entry)
        self._last_transcript_entry = fingerprint

        # Optionally stream transcript entries to the connected browser client
        if self._transcript_callback is not None:
            try:
                asyncio.create_task(self._transcript_callback(speaker, text))
            except RuntimeError:
                # Event loop may be closed during shutdown; ignore in that case.
                pass
        if speaker == "customer" and self._awaiting_response:
            self._awaiting_response = False
            asyncio.create_task(self._request_response())

        if speaker == "customer":
            self._record_customer_transcript_message(text)

    def _record_customer_transcript_message(self, content: str) -> None:
        """Persist customer transcript entries and capture slot selections."""
        sanitized = content.strip()
        if not sanitized:
            return

        message = AnalyticsService.add_message(
            db=self.db,
            conversation_id=self.conversation.id,
            direction="inbound",
            content=sanitized,
            metadata={"source": "voice_transcript"},
        )

        selection_made = SlotSelectionManager.capture_selection(
            self.db, self.conversation, message
        )

        if selection_made:
            self._refresh_conversation()
            return

        inferred = self._infer_slot_selection_from_text(message, sanitized)
        if inferred:
            self._refresh_conversation()
            return

        if self._backfill_slot_selection_from_history(message):
            self._refresh_conversation()

    def _infer_slot_selection_from_text(self, message: Any, text: str) -> bool:
        """Attempt to infer slot selection from natural-language time references."""
        pending = SlotSelectionManager.get_pending_slot_offers(
            self.db, self.conversation, enforce_expiry=False
        )
        if not pending:
            return False

        slots = pending.get("slots") or []
        if not slots:
            return False

        text_lower = text.lower()
        text_compact = re.sub(r"[^a-z0-9]", "", text_lower)
        time_preferences = self._extract_time_preferences(text_lower)

        matched_index: Optional[int] = None
        matched_slot: Optional[Dict[str, Any]] = None

        if time_preferences:
            matched_index, matched_slot = self._match_slot_by_time(
                slots, time_preferences
            )

        if matched_slot is None:
            matched_index, matched_slot = self._match_slot_by_label(
                slots, text_lower, text_compact
            )

        if matched_slot is None or matched_index is None:
            return False

        metadata = SlotSelectionManager.conversation_metadata(self.conversation)
        pending_metadata = metadata.get("pending_slot_offers") or {}
        pending_metadata["selected_option_index"] = matched_index
        pending_metadata["selected_slot"] = matched_slot
        pending_metadata["selected_by_message_id"] = str(getattr(message, "id", ""))
        pending_metadata["selected_content_preview"] = text[:120]
        pending_metadata["selected_at"] = (
            datetime.utcnow().replace(tzinfo=pytz.utc).isoformat()
        )

        metadata["pending_slot_offers"] = pending_metadata
        SlotSelectionManager.persist_conversation_metadata(
            self.db, self.conversation, metadata
        )

        slot_label = matched_slot.get("start_time") or matched_slot.get("start")
        logger.info(
            "Voice slot inferred from natural language: conversation_id=%s, slot=%s, text=%s",
            self.conversation.id,
            slot_label,
            text,
        )
        return True

    def _backfill_slot_selection_from_history(self, anchor_message: Any) -> bool:
        pending = SlotSelectionManager.get_pending_slot_offers(
            self.db, self.conversation, enforce_expiry=False
        )
        if not pending:
            return False

        messages = [
            m
            for m in getattr(self.conversation, "messages", [])
            if getattr(m, "direction", None) == "inbound"
        ]
        if not messages:
            return False

        recent_messages = messages[-5:]
        anchor_id = getattr(anchor_message, "id", None)

        for msg in reversed(recent_messages):
            if getattr(msg, "id", None) == anchor_id:
                continue
            content = getattr(msg, "content", None) or ""
            text = content.strip()
            if not text:
                continue
            if self._infer_slot_selection_from_text(msg, text):
                return True

        return False

    def _extract_time_preferences(self, text: str) -> List[int]:
        """Return candidate minutes-from-midnight for times mentioned in text."""
        preferences: List[int] = []

        time_pattern = re.compile(
            r"\b(?P<hour>(?:[0-1]?\d|2[0-3]))(?:[:.](?P<minute>[0-5]\d))?\s*(?P<ampm>a\.?m\.?|p\.?m\.?|am|pm)\b",
            re.IGNORECASE,
        )
        daypart_pattern = re.compile(
            r"\b(?P<hour>[0-1]?\d)\s*(?:in\s+the\s+)?(?P<daypart>morning|afternoon|evening|night)\b",
            re.IGNORECASE,
        )

        for match in time_pattern.finditer(text):
            hour = int(match.group("hour"))
            minute = int(match.group("minute") or 0)
            ampm = match.group("ampm").lower()
            if ampm.startswith("p") and hour != 12:
                hour += 12
            if ampm.startswith("a") and hour == 12:
                hour = 0
            preferences.append(hour * 60 + minute)

        for match in daypart_pattern.finditer(text):
            hour = int(match.group("hour"))
            daypart = match.group("daypart").lower()
            if daypart == "morning" and hour == 12:
                hour = 0
            elif daypart in {"afternoon", "evening", "night"} and hour < 12:
                hour += 12
            preferences.append(hour * 60)

        if "noon" in text:
            preferences.append(12 * 60)
        if "midnight" in text:
            preferences.append(0)

        # Deduplicate while preserving order
        seen = set()
        unique_preferences = []
        for pref in preferences:
            if pref not in seen:
                seen.add(pref)
                unique_preferences.append(pref)
        return unique_preferences

    def _match_slot_by_time(
        self, slots: List[Dict[str, Any]], time_preferences: List[int]
    ) -> Tuple[Optional[int], Optional[Dict[str, Any]]]:
        for idx, slot in enumerate(slots, start=1):
            start_iso = slot.get("start")
            if not start_iso:
                continue
            try:
                start_dt = to_eastern(parse_iso_datetime(str(start_iso)))
            except ValueError:
                continue

            slot_minutes = start_dt.hour * 60 + start_dt.minute
            for pref in time_preferences:
                if abs(slot_minutes - pref) <= 15:
                    return idx, slot
        return None, None

    def _match_slot_by_label(
        self, slots: List[Dict[str, Any]], text_lower: str, text_compact: str
    ) -> Tuple[Optional[int], Optional[Dict[str, Any]]]:
        for idx, slot in enumerate(slots, start=1):
            label = (slot.get("start_time") or "").lower()
            if not label:
                continue

            variants = {
                label,
                label.replace(" ", ""),
                label.replace(":", ""),
                re.sub(r"[^a-z0-9]", "", label),
            }
            if label.endswith(":00 am") or label.endswith(":00 pm"):
                variants.add(label.replace(":00", ""))
                variants.add(label.replace(":00", "").replace(" ", ""))

            for variant in variants:
                if not variant:
                    continue
                if variant in text_lower or variant in text_compact:
                    return idx, slot
        return None, None

    def _process_conversation_item_created(self, payload: Dict[str, Any]) -> None:
        item = payload.get("item") or {}
        item_id = item.get("id")
        role = item.get("role")
        speaker = self._speaker_from_role(role)

        print(
            f"🧩 Processing conversation.item.created - ID: {item_id}, Role: {role}, Speaker: {speaker}"
        )

        if not item_id or not speaker:
            print(f"   ⚠️ Skipping - missing item_id or speaker")
            return

        texts = self._extract_text_from_content(item.get("content"))
        pending = self._pending_items.setdefault(
            item_id, {"speaker": speaker, "text": ""}
        )
        if texts:
            pending["text"] += " ".join(texts).strip()
            print(f"   📝 Extracted texts from content: {texts}")

        # Some items are created fully formed without deltas
        if item.get("status") == "completed":
            print(f"   ✅ Item status is completed, finalizing immediately")
            self._finalize_pending_item(item_id)

    def _process_conversation_item_delta(self, payload: Dict[str, Any]) -> None:
        item_id = payload.get("item_id")
        if not item_id or item_id not in self._pending_items:
            return

        delta = payload.get("delta") or {}
        texts = self._extract_text_from_content(delta.get("content"))
        if texts:
            pending = self._pending_items[item_id]
            pending["text"] += " ".join(texts).strip()

    def _process_conversation_item_completed(self, payload: Dict[str, Any]) -> None:
        item_id = payload.get("item_id")
        self._finalize_pending_item(item_id)

    def _finalize_pending_item(self, item_id: Optional[str]) -> None:
        if not item_id:
            return
        pending = self._pending_items.pop(item_id, None)
        if not pending:
            return
        text = pending.get("text", "").strip()
        speaker = pending.get("speaker", "assistant")
        print(
            f"📋 Finalizing pending item {item_id}: Speaker={speaker}, Text={text[:100] if text else 'EMPTY'}"
        )
        if text:
            self._append_transcript_entry(speaker, text)
        else:
            print(f"   ⚠️ Skipping empty text for item {item_id}")

    def _extract_text_from_content(
        self, content: Optional[List[Dict[str, Any]]]
    ) -> List[str]:
        if not content:
            return []

        texts: List[str] = []
        for entry in content:
            entry_type = entry.get("type")

            # Handle text content (all variants)
            if entry_type in {"text", "input_text", "output_text"}:
                if entry.get("text"):
                    texts.append(entry["text"])
                    print(f"      🔤 Extracted {entry_type}: {entry['text'][:100]}")

            # Handle audio transcriptions
            elif entry_type == "input_audio":
                # Check if there's a transcript field in the audio entry
                transcript = entry.get("transcript")
                if transcript:
                    texts.append(transcript)
                    print(
                        f"      🎤 Extracted input_audio transcript: {transcript[:100]}"
                    )

            elif entry_type == "audio":
                # Generic audio with transcript
                transcript = entry.get("transcript")
                if transcript:
                    texts.append(transcript)
                    print(f"      🎤 Extracted audio transcript: {transcript[:100]}")

        if not texts:
            print(f"      ⚠️ No texts extracted from content: {content}")

        return texts

    @staticmethod
    def _speaker_from_role(role: Optional[str]) -> Optional[str]:
        if not role:
            return None
        if role in {"user", "customer", "caller"}:
            return "customer"
        if role in {"assistant", "system"}:
            return "assistant"
        return None

    async def _request_response(self) -> None:
        if not self.ws:
            print("⚠️  WebSocket not ready; cannot request response")
            return
        self._current_assistant_text = ""
        await self.ws.send(
            json.dumps(
                {
                    "type": "response.create",
                    "response": {
                        "modalities": ["text", "audio"],
                        "instructions": self.identity_instructions or None,
                    },
                }
            )
        )
        print("▶️  Requested model response")

    def _finalize_transcript_buffers(self) -> None:
        if self._current_customer_text.strip():
            self._append_transcript_entry(
                "customer", self._current_customer_text.strip()
            )
            self._current_customer_text = ""

        if self._current_assistant_text.strip():
            self._append_transcript_entry(
                "assistant", self._current_assistant_text.strip()
            )
            self._current_assistant_text = ""

        pending_ids = list(self._pending_items.keys())
        for item_id in pending_ids:
            self._finalize_pending_item(item_id)
