from __future__ import annotations

from typing import Any, Dict, List


def build_voice_session_config(
    *, system_prompt: str, tools: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Build OpenAI Realtime session.update payload for voice channel.

    This centralizes configuration so future channels can reuse the same
    booking + NLU stack while overriding only what they need.
    """

    return {
        "type": "session.update",
        "session": {
            "modalities": ["text", "audio"],
            "instructions": system_prompt,
            "voice": "alloy",
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {
                "model": "whisper-1",
            },
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.6,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 600,
                "create_response": True,
            },
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.7,
        },
    }
