"""
OpenAI Realtime API client for voice-to-voice conversation handling.
"""
import json
import asyncio
import websockets
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime, timedelta
import pytz
from config import get_settings, SERVICES, PROVIDERS, OPENING_SCRIPT
from prompts import get_system_prompt
from mock_calendar_service import get_mock_calendar_service

settings = get_settings()


class RealtimeClient:
    """Client for managing OpenAI Realtime API voice conversations."""

    def __init__(self):
        """Initialize the Realtime client."""
        self.ws = None
        # Use mock calendar for testing
        self.calendar_service = get_mock_calendar_service()
        self.session_data = {
            'transcript': [],
            'function_calls': [],
            'customer_data': {},
            'sentiment_markers': []
        }
        self.identity_instructions = ""
        self._current_customer_text = ""
        self._current_assistant_text = ""
        self._pending_items: Dict[str, Dict[str, Any]] = {}
        self._last_transcript_entry: Optional[str] = None
        self._awaiting_response: bool = False

    async def connect(self):
        """Establish WebSocket connection to OpenAI Realtime API."""
        url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini-2025-10-06"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1"
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
                "instructions": f"Start the conversation by saying: {greeting_text}"
            }
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
                    "create_response": True  # Automatically create response when user stops speaking
                },
                "tools": self._get_function_definitions(),
                "tool_choice": "auto",
                "temperature": 0.7,
            }
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
                            "description": "Date in YYYY-MM-DD format"
                        },
                        "service_type": {
                            "type": "string",
                            "enum": list(SERVICES.keys()),
                            "description": "Type of service requested"
                        }
                    },
                    "required": ["date", "service_type"]
                }
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
                            "description": "Customer's full name"
                        },
                        "customer_phone": {
                            "type": "string",
                            "description": "Customer's phone number"
                        },
                        "customer_email": {
                            "type": "string",
                            "description": "Customer's email address"
                        },
                        "start_time": {
                            "type": "string",
                            "description": "Appointment start time in ISO 8601 format"
                        },
                        "service_type": {
                            "type": "string",
                            "enum": list(SERVICES.keys()),
                            "description": "Type of service"
                        },
                        "provider": {
                            "type": "string",
                            "description": "Preferred provider name (optional)"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Special requests or notes (optional)"
                        }
                    },
                    "required": ["customer_name", "customer_phone", "start_time", "service_type"]
                }
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
                            "enum": list(SERVICES.keys()),
                            "description": "Type of service to get information about"
                        }
                    },
                    "required": ["service_type"]
                }
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
                            "description": "Specific provider name (optional, returns all if not specified)"
                        }
                    }
                }
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
                            "description": "Customer's phone number"
                        }
                    },
                    "required": ["phone"]
                }
            }
        ]

    async def handle_function_call(self, function_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute function calls from the AI assistant.

        Args:
            function_name: Name of the function to call
            arguments: Function arguments

        Returns:
            Function execution result
        """
        self.session_data['function_calls'].append({
            'function': function_name,
            'arguments': arguments,
            'timestamp': datetime.utcnow().isoformat()
        })

        try:
            if function_name == "check_availability":
                date_str = arguments.get("date")
                service_type = arguments.get("service_type")

                date = datetime.strptime(date_str, "%Y-%m-%d")
                slots = self.calendar_service.get_available_slots(date, service_type)

                return {
                    "success": True,
                    "available_slots": slots[:10],  # Return first 10 slots
                    "date": date_str,
                    "service": SERVICES[service_type]["name"]
                }

            elif function_name == "book_appointment":
                customer_name = arguments.get("customer_name")
                customer_phone = arguments.get("customer_phone")
                customer_email = arguments.get("customer_email", f"{customer_phone}@placeholder.com")
                start_time_str = arguments.get("start_time")
                service_type = arguments.get("service_type")
                provider = arguments.get("provider")
                notes = arguments.get("notes")

                # Parse start time
                start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))

                # Calculate end time
                duration = SERVICES[service_type]["duration_minutes"]
                end_time = start_time + timedelta(minutes=duration)

                # Book in calendar
                event_id = self.calendar_service.book_appointment(
                    start_time=start_time,
                    end_time=end_time,
                    customer_name=customer_name,
                    customer_email=customer_email,
                    customer_phone=customer_phone,
                    service_type=service_type,
                    provider=provider,
                    notes=notes
                )

                if event_id:
                    # Store customer data
                    self.session_data['customer_data'] = {
                        'name': customer_name,
                        'phone': customer_phone,
                        'email': customer_email
                    }

                    return {
                        "success": True,
                        "event_id": event_id,
                        "appointment_time": start_time.strftime("%B %d, %Y at %I:%M %p"),
                        "service": SERVICES[service_type]["name"],
                        "provider": provider
                    }
                else:
                    return {
                        "success": False,
                        "error": "Failed to book appointment. Please try again or contact staff."
                    }

            elif function_name == "get_service_info":
                service_type = arguments.get("service_type")
                service = SERVICES.get(service_type)

                if service:
                    return {
                        "success": True,
                        "service": service
                    }
                else:
                    return {
                        "success": False,
                        "error": "Service not found"
                    }

            elif function_name == "get_provider_info":
                provider_name = arguments.get("provider_name")

                if provider_name:
                    provider = PROVIDERS.get(provider_name)
                    if provider:
                        return {
                            "success": True,
                            "provider": provider
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Provider not found"
                        }
                else:
                    return {
                        "success": True,
                        "providers": list(PROVIDERS.values())
                    }

            elif function_name == "search_customer":
                phone = arguments.get("phone")
                # This would query the database in production
                # For now, return mock response
                return {
                    "success": True,
                    "found": False,
                    "message": "No existing customer found with this phone number"
                }

            else:
                return {
                    "success": False,
                    "error": f"Unknown function: {function_name}"
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def send_audio(self, audio_base64: str, *, commit: bool = False):
        """Send base64-encoded audio data to the Realtime API."""
        if not self.ws:
            print("⚠️  WebSocket not ready; dropping audio chunk")
            return

        if not audio_base64:
            print("⚠️  Empty audio payload received; skipping append")
            return

        append_event = {
            "type": "input_audio_buffer.append",
            "audio": audio_base64
        }
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
                if event_type.startswith("input_audio") or event_type.startswith("conversation.item"):
                    print(f"   Data: {json.dumps(data, indent=2)[:500]}")

            # Handle different event types
            if event_type == "session.updated":
                # Log session configuration to verify transcription is enabled
                session = data.get("session", {})
                print(f"✅ Session updated - Transcription enabled: {session.get('input_audio_transcription') is not None}")
                print(f"   Voice: {session.get('voice')}")
                print(f"   Turn detection: {session.get('turn_detection', {}).get('type')}")

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
                transcript_text = data.get("transcript") or self._current_customer_text.strip()
                if transcript_text:
                    print(f"📝 User speech completed: {transcript_text}")
                    self._append_transcript_entry('customer', transcript_text)
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
                print(f"📝 User audio transcription completed (item {item_id}): {transcript}")
                if transcript:
                    self._append_transcript_entry('customer', transcript)

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
                transcript_text = (data.get("transcript") or self._current_assistant_text).strip()
                if transcript_text:
                    print(f"🤖 Assistant speech completed: {transcript_text}")
                    self._append_transcript_entry('assistant', transcript_text)
                self._current_assistant_text = ""

            elif event_type == "response.output_text.delta":
                delta = data.get("delta")
                if isinstance(delta, str):
                    self._current_assistant_text += delta
                elif isinstance(delta, dict):
                    self._current_assistant_text += delta.get("text", "")

            elif event_type == "response.output_text.done":
                assistant_text = self._current_assistant_text.strip()
                self._append_transcript_entry('assistant', assistant_text)
                self._current_assistant_text = ""

            elif event_type == "response.text.done":
                # Legacy text response event
                text = data.get("text")
                self._append_transcript_entry('assistant', text)

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
                        "output": json.dumps(result)
                    }
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
        self.session_data['transcript'].append({
            'speaker': speaker,
            'text': text,
            'timestamp': datetime.utcnow().isoformat()
        })
        self._last_transcript_entry = fingerprint
        if speaker == "customer" and self._awaiting_response:
            self._awaiting_response = False
            asyncio.create_task(self._request_response())

    def _process_conversation_item_created(self, payload: Dict[str, Any]) -> None:
        item = payload.get("item") or {}
        item_id = item.get("id")
        role = item.get("role")
        speaker = self._speaker_from_role(role)

        print(f"🧩 Processing conversation.item.created - ID: {item_id}, Role: {role}, Speaker: {speaker}")

        if not item_id or not speaker:
            print(f"   ⚠️ Skipping - missing item_id or speaker")
            return

        texts = self._extract_text_from_content(item.get("content"))
        pending = self._pending_items.setdefault(item_id, {"speaker": speaker, "text": ""})
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
        print(f"📋 Finalizing pending item {item_id}: Speaker={speaker}, Text={text[:100] if text else 'EMPTY'}")
        if text:
            self._append_transcript_entry(speaker, text)
        else:
            print(f"   ⚠️ Skipping empty text for item {item_id}")

    def _extract_text_from_content(self, content: Optional[List[Dict[str, Any]]]) -> List[str]:
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
                    print(f"      🎤 Extracted input_audio transcript: {transcript[:100]}")

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
        await self.ws.send(json.dumps({
            "type": "response.create",
            "response": {
                "modalities": ["text", "audio"],
                "instructions": self.identity_instructions or None
            }
        }))
        print("▶️  Requested model response")

    def _finalize_transcript_buffers(self) -> None:
        if self._current_customer_text.strip():
            self._append_transcript_entry('customer', self._current_customer_text.strip())
            self._current_customer_text = ""

        if self._current_assistant_text.strip():
            self._append_transcript_entry('assistant', self._current_assistant_text.strip())
            self._current_assistant_text = ""

        pending_ids = list(self._pending_items.keys())
        for item_id in pending_ids:
            self._finalize_pending_item(item_id)
