"""
OpenAI Realtime API client for voice-to-voice conversation handling.
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import pytz
import websockets
from sqlalchemy.orm import Session

from analytics import AnalyticsService
from booking.manager import SlotSelectionError, SlotSelectionManager
from booking.time_utils import format_for_display, parse_iso_datetime, to_eastern
from booking_handlers import handle_book_appointment, handle_check_availability
from calendar_service import get_calendar_service
from config import OPENING_SCRIPT, PROVIDERS, get_settings
from database import Conversation, SessionLocal
from prompts import get_system_prompt
from settings_service import SettingsService

settings = get_settings()
logger = logging.getLogger(__name__)


class RealtimeClient:
    """Client for managing OpenAI Realtime API voice conversations."""

    def __init__(
        self,
        *,
        session_id: str,
        db: Optional[Session] = None,
        conversation: Optional[Conversation] = None,
        legacy_call_session_id: Optional[str] = None,
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

        # Load services and providers from database (with caching)
        self._services_dict = None
        self._providers_list = None

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
            db=self.db, customer_id=None, channel="voice", metadata=metadata,
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

        print(f"Connecting to OpenAI Realtime API: {url}")
        self.ws = await websockets.connect(url, extra_headers=headers)
        print("✓ Connected to OpenAI Realtime API")

        # Initialize session with instructions and tools
        await self._initialize_session()
        print("✓ Session initialized")

    async def send_greeting(self):
        """Send an introductory greeting to kick off the call."""
        if not self.ws:
            print("⚠️  WebSocket not ready; cannot send greeting")
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
        print("🗣️  Sent greeting request to Realtime API")

    async def _initialize_session(self):
        """Initialize the session with system instructions and available functions."""
        system_prompt = get_system_prompt("voice")

        self.identity_instructions = (
            f"You are {settings.AI_ASSISTANT_NAME}, the virtual receptionist for {settings.MED_SPA_NAME}. "
            "Always stay in character as Ava, focus on med spa services, and never describe yourself as ChatGPT or an OpenAI model. "
            f"If asked who you are, respond with: 'I'm {settings.AI_ASSISTANT_NAME}, the virtual receptionist for {settings.MED_SPA_NAME}. I'm here to help with appointments or any questions about our treatments.'"
        )

        session_config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": system_prompt,
                "voice": "alloy",  # Fixed: "nova" is invalid, using "alloy" instead
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"  # Required parameter for transcription
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.6,  # Higher threshold = less sensitive to background noise (increased from 0.5)
                    "prefix_padding_ms": 300,  # Capture more of the start of speech
                    "silence_duration_ms": 600,  # Wait 600ms of silence before considering speech done (increased from 500)
                    "create_response": True,  # Automatically create response when user stops speaking
                },
                "tools": self._get_function_definitions(),
                "tool_choice": "auto",
                "temperature": 0.7,
            },
        }

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

                availability = handle_check_availability(
                    self.calendar_service,
                    date=date_str,
                    service_type=service_type,
                    limit=10,
                    services_dict=self._get_services(),
                )

                if availability.get("success"):
                    availability["service_type"] = service_type
                    SlotSelectionManager.record_offers(
                        self.db,
                        self.conversation,
                        tool_call_id=None,
                        arguments={"date": date_str, "service_type": service_type},
                        output=availability,
                    )
                    self._refresh_conversation()

                return availability

            elif function_name == "book_appointment":
                normalization_arguments = dict(arguments)
                try:
                    normalized_args, _ = SlotSelectionManager.enforce_booking(
                        self.db, self.conversation, normalization_arguments,
                    )
                except SlotSelectionError as exc:
                    logger.warning("Voice booking enforcement failed: %s", exc)
                    return {
                        "success": False,
                        "error": str(exc),
                        "user_message": "I'm sorry, I need to check availability first before I can book that time. Let me pull up the available slots for you.",
                    }

                booking_result = handle_book_appointment(
                    self.calendar_service,
                    **normalized_args,
                    services_dict=self._get_services(),
                )

                if booking_result.get("success"):
                    SlotSelectionManager.clear_offers(self.db, self.conversation)
                    self._refresh_conversation()

                    customer_name = normalized_args.get("customer_name")
                    customer_phone = normalized_args.get("customer_phone")
                    customer_email = (
                        normalized_args.get("customer_email")
                        or f"{customer_phone}@placeholder.com"
                    )
                    service_type = normalized_args.get("service_type")

                    start_iso = booking_result.get("start_time")
                    formatted_voice_time = None
                    if start_iso:
                        formatted_voice_time = format_for_display(
                            parse_iso_datetime(start_iso), channel="voice",
                        )
                        booking_result[
                            "spoken_confirmation"
                        ] = f"Perfect! I've booked your {booking_result.get('service', service_type)} appointment for {formatted_voice_time}."

                    self.session_data["customer_data"] = {
                        "name": customer_name,
                        "phone": customer_phone,
                        "email": customer_email,
                    }

                    self.session_data["last_appointment"] = {
                        "event_id": booking_result.get("event_id"),
                        "service_type": service_type,
                        "provider": normalized_args.get("provider"),
                        "start_time": start_iso,
                        "customer_name": customer_name,
                        "customer_phone": customer_phone,
                        "customer_email": customer_email,
                    }

                return booking_result

            elif function_name == "get_service_info":
                service_type = arguments.get("service_type")
                service = self._get_services().get(service_type)

                if service:
                    return {"success": True, "service": service}
                else:
                    return {"success": False, "error": "Service not found"}

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

                self.session_data["last_appointment"] = {
                    "event_id": appointment_id,
                    "service_type": self.session_data.get("last_appointment", {}).get(
                        "service_type"
                    ),
                    "provider": details.get("provider"),
                    "start_time": (
                        details["start"].isoformat() if "start" in details else None
                    ),
                    "customer_name": self.session_data.get("customer_data", {}).get(
                        "name"
                    ),
                    "customer_phone": self.session_data.get("customer_data", {}).get(
                        "phone"
                    ),
                    "customer_email": self.session_data.get("customer_data", {}).get(
                        "email"
                    ),
                }

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

                if not service_type:
                    return {
                        "success": False,
                        "error": "Missing service type to determine appointment duration",
                    }

                start_time = datetime.fromisoformat(
                    new_start_time_str.replace("Z", "+00:00")
                )
                duration = self._get_services()[service_type]["duration_minutes"]
                end_time = start_time + timedelta(minutes=duration)

                success = self.calendar_service.reschedule_appointment(
                    event_id=appointment_id,
                    new_start_time=start_time,
                    new_end_time=end_time,
                )

                if success:
                    self.session_data["last_appointment"] = {
                        "event_id": appointment_id,
                        "service_type": service_type,
                        "provider": provider
                        or self.session_data.get("last_appointment", {}).get(
                            "provider"
                        ),
                        "start_time": start_time.isoformat(),
                        "customer_name": self.session_data.get("customer_data", {}).get(
                            "name"
                        ),
                        "customer_phone": self.session_data.get(
                            "customer_data", {}
                        ).get("phone"),
                        "customer_email": self.session_data.get(
                            "customer_data", {}
                        ).get("email"),
                    }

                    return {
                        "success": True,
                        "appointment_id": appointment_id,
                        "new_time": start_time.strftime("%B %d, %Y at %I:%M %p"),
                        "service": self._get_services()[service_type]["name"],
                    }

                return {
                    "success": False,
                    "error": "Failed to reschedule appointment. Please try again or contact staff.",
                }

            elif function_name == "cancel_appointment":
                appointment_id = arguments.get("appointment_id")
                cancellation_reason = arguments.get("cancellation_reason")

                success = self.calendar_service.cancel_appointment(appointment_id)

                if success:
                    self.session_data["last_appointment"] = None

                    response = {
                        "success": True,
                        "appointment_id": appointment_id,
                        "status": "cancelled",
                    }

                    if cancellation_reason:
                        response["cancellation_reason"] = cancellation_reason

                    return response

                return {
                    "success": False,
                    "error": "Failed to cancel appointment. Please try again or contact staff.",
                }

            else:
                return {"success": False, "error": f"Unknown function: {function_name}"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def send_audio(self, audio_base64: str, *, commit: bool = False):
        """Send base64-encoded audio data to the Realtime API."""
        if not self.ws:
            print("⚠️  WebSocket not ready; dropping audio chunk")
            return

        if not audio_base64:
            print("⚠️  Empty audio payload received; skipping append")
            return

        append_event = {"type": "input_audio_buffer.append", "audio": audio_base64}
        await self.ws.send(json.dumps(append_event))
        print(f"🎙️  Sent audio chunk (base64 len={len(audio_base64)})")

        if commit:
            await self.commit_audio_buffer()

    async def commit_audio_buffer(self):
        """Commit the current audio buffer and request a model response."""
        if not self.ws:
            print("⚠️  WebSocket not ready; cannot commit buffer")
            return

        await self.ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
        print("✅ Committed audio buffer")
        self._awaiting_response = True

    async def cancel_response(self):
        """Cancel the current assistant response when user interrupts."""
        if not self.ws:
            print("⚠️  WebSocket not ready; cannot cancel response")
            return

        await self.ws.send(json.dumps({"type": "response.cancel"}))
        print("🛑 Cancelled assistant response")

    async def handle_messages(self, on_audio_callback: Optional[Callable] = None):
        """
        Handle incoming messages from the Realtime API.

        Args:
            on_audio_callback: Callback function for audio output
        """
        print("Starting to listen for OpenAI messages...")
        async for message in self.ws:
            data = json.loads(message)
            event_type = data.get("type")

            # Log all events for debugging transcription issues
            if event_type not in ["response.audio.delta", "input_audio_buffer.append"]:
                print(f"🔔 Received OpenAI event: {event_type}")
                if event_type.startswith("input_audio") or event_type.startswith(
                    "conversation.item"
                ):
                    print(f"   Data: {json.dumps(data, indent=2)[:500]}")

            # Handle different event types
            if event_type == "session.updated":
                # Log session configuration to verify transcription is enabled
                session = data.get("session", {})
                print(
                    f"✅ Session updated - Transcription enabled: {session.get('input_audio_transcription') is not None}"
                )
                print(f"   Voice: {session.get('voice')}")
                print(
                    f"   Turn detection: {session.get('turn_detection', {}).get('type')}"
                )

            elif event_type == "response.audio.delta":
                # Audio output from AI
                audio_b64 = data.get("delta")
                if audio_b64 and on_audio_callback:
                    print(f"🔊 Sending audio to client: {len(audio_b64)} chars")
                    await on_audio_callback(audio_b64)
                elif not audio_b64:
                    print("⚠️  No audio data in delta")
                elif not on_audio_callback:
                    print("⚠️  No audio callback function")

            elif event_type == "input_audio_buffer.transcription.delta":
                delta = data.get("delta")
                if isinstance(delta, str):
                    self._current_customer_text += delta
                elif isinstance(delta, dict):
                    self._current_customer_text += delta.get("transcript", "")
                print(f"📝 User speech delta: {delta}")

            elif event_type == "input_audio_buffer.transcription.completed":
                transcript_text = (
                    data.get("transcript") or self._current_customer_text.strip()
                )
                if transcript_text:
                    print(f"📝 User speech completed: {transcript_text}")
                    self._append_transcript_entry("customer", transcript_text)
                self._current_customer_text = ""

            elif event_type == "conversation.item.input_audio_transcription.delta":
                # User audio transcription delta (incremental update)
                delta = data.get("delta")
                item_id = data.get("item_id")
                print(f"📝 User audio transcription delta (item {item_id}): {delta}")

            elif event_type == "conversation.item.input_audio_transcription.completed":
                # User audio transcription completed
                transcript = data.get("transcript")
                item_id = data.get("item_id")
                print(
                    f"📝 User audio transcription completed (item {item_id}): {transcript}"
                )
                if transcript:
                    self._append_transcript_entry("customer", transcript)

            elif event_type == "conversation.item.created":
                print(f"🧩 conversation.item.created: {data}")
                self._process_conversation_item_created(data)

            elif event_type == "conversation.item.delta":
                print(f"🧩 conversation.item.delta: {data}")
                self._process_conversation_item_delta(data)

            elif event_type == "conversation.item.completed":
                print(f"🧩 conversation.item.completed: {data}")
                self._process_conversation_item_completed(data)

            elif event_type == "response.audio_transcript.delta":
                transcript_delta = data.get("delta") or ""
                if transcript_delta:
                    self._current_assistant_text += transcript_delta
                    print(f"🤖 Assistant speech delta: {transcript_delta}")

            elif event_type == "response.audio_transcript.done":
                transcript_text = (
                    data.get("transcript") or self._current_assistant_text
                ).strip()
                if transcript_text:
                    print(f"🤖 Assistant speech completed: {transcript_text}")
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

        if self._infer_slot_selection_from_text(message, sanitized):
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
