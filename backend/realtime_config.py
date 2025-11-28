from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

# ==================== Audio Configuration ====================

# Audio format settings
AudioFormat = Literal["pcm16", "g711_ulaw", "g711_alaw"]
DEFAULT_INPUT_AUDIO_FORMAT: AudioFormat = "pcm16"
DEFAULT_OUTPUT_AUDIO_FORMAT: AudioFormat = "pcm16"

# Voice settings
Voice = Literal["alloy", "echo", "shimmer"]
DEFAULT_VOICE: Voice = "alloy"

# Transcription model
DEFAULT_TRANSCRIPTION_MODEL = "whisper-1"


# ==================== VAD Configuration ====================

# Voice Activity Detection settings
VADType = Literal["server_vad", "none"]
DEFAULT_VAD_TYPE: VADType = "server_vad"

# VAD sensitivity (0.0 - 1.0, higher = less sensitive to background noise)
DEFAULT_VAD_THRESHOLD = 0.6  # Production setting for clean audio
SENSITIVE_VAD_THRESHOLD = 0.4  # For noisy environments
CONSERVATIVE_VAD_THRESHOLD = 0.8  # For very clean audio only

# Silence detection timing (milliseconds)
DEFAULT_SILENCE_DURATION_MS = 600  # Time of silence before turn ends
SHORT_SILENCE_DURATION_MS = 400  # For faster turn-taking
LONG_SILENCE_DURATION_MS = 1000  # For thoughtful responses

# Prefix padding (milliseconds of audio before speech detected to include)
DEFAULT_PREFIX_PADDING_MS = 300
SHORT_PREFIX_PADDING_MS = 200
LONG_PREFIX_PADDING_MS = 500

# Auto-response generation
DEFAULT_CREATE_RESPONSE = True  # Automatically generate response after turn


# ==================== Model Configuration ====================

# Temperature settings
DEFAULT_TEMPERATURE = 0.7  # Balanced creativity vs consistency
CREATIVE_TEMPERATURE = 0.9  # More varied responses
CONSERVATIVE_TEMPERATURE = 0.5  # More predictable responses

# Tool choice
ToolChoice = Literal["auto", "none", "required"]
DEFAULT_TOOL_CHOICE: ToolChoice = "auto"


# ==================== Session Builder ====================

def build_voice_session_config(
    *,
    system_prompt: str,
    tools: List[Dict[str, Any]],
    voice: Optional[Voice] = None,
    vad_threshold: Optional[float] = None,
    silence_duration_ms: Optional[int] = None,
    prefix_padding_ms: Optional[int] = None,
    temperature: Optional[float] = None,
    input_audio_format: Optional[AudioFormat] = None,
    output_audio_format: Optional[AudioFormat] = None,
) -> Dict[str, Any]:
    """Build OpenAI Realtime session.update payload for voice channel.

    This centralizes configuration so future channels can reuse the same
    booking + NLU stack while overriding only what they need.

    Args:
        system_prompt: System instructions for the assistant
        tools: Available function tools
        voice: Voice to use (alloy, echo, shimmer)
        vad_threshold: VAD sensitivity (0.0-1.0, higher = less sensitive)
        silence_duration_ms: Milliseconds of silence before turn ends
        prefix_padding_ms: Milliseconds of audio before speech to include
        temperature: Sampling temperature (0.0-1.0)
        input_audio_format: Input audio format
        output_audio_format: Output audio format

    Returns:
        Session configuration dictionary for Realtime API
    """

    return {
        "type": "session.update",
        "session": {
            "modalities": ["text", "audio"],
            "instructions": system_prompt,
            "voice": voice or DEFAULT_VOICE,
            "input_audio_format": input_audio_format or DEFAULT_INPUT_AUDIO_FORMAT,
            "output_audio_format": output_audio_format or DEFAULT_OUTPUT_AUDIO_FORMAT,
            "input_audio_transcription": {
                "model": DEFAULT_TRANSCRIPTION_MODEL,
            },
            "turn_detection": {
                "type": DEFAULT_VAD_TYPE,
                "threshold": vad_threshold or DEFAULT_VAD_THRESHOLD,
                "prefix_padding_ms": prefix_padding_ms or DEFAULT_PREFIX_PADDING_MS,
                "silence_duration_ms": silence_duration_ms or DEFAULT_SILENCE_DURATION_MS,
                "create_response": DEFAULT_CREATE_RESPONSE,
            },
            "tools": tools,
            "tool_choice": DEFAULT_TOOL_CHOICE,
            "temperature": temperature or DEFAULT_TEMPERATURE,
        },
    }
