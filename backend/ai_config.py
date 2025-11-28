from __future__ import annotations

from typing import Optional

from openai import OpenAI

from config import get_settings


_settings = get_settings()
_client: Optional[OpenAI] = None


# ==================== Model Constants ====================

# Chat/Completion Models
GPT_4_MODEL = "gpt-4"
GPT_4_TURBO_MODEL = "gpt-4-turbo-preview"
GPT_4O_MODEL = "gpt-4o"
GPT_4O_MINI_MODEL = "gpt-4o-mini"
GPT_35_TURBO_MODEL = "gpt-3.5-turbo"

# Audio Models
WHISPER_MODEL = "whisper-1"
TTS_MODEL = "tts-1"
TTS_HD_MODEL = "tts-1-hd"

# Realtime Models
REALTIME_MODEL = "gpt-4o-realtime-preview-2024-10-01"

# Default model selections for different use cases
DEFAULT_CHAT_MODEL = GPT_4O_MINI_MODEL  # Fast, cost-effective for messaging
DEFAULT_SENTIMENT_MODEL = _settings.OPENAI_SENTIMENT_MODEL  # From config
DEFAULT_VOICE_MODEL = REALTIME_MODEL  # For voice conversations


# ==================== Client Factory ====================

def get_openai_client() -> OpenAI:
    """Get or create the singleton OpenAI client.

    Returns:
        OpenAI: Configured OpenAI client instance

    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    global _client
    if _client is None:
        if not _settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not configured")
        _client = OpenAI(api_key=_settings.OPENAI_API_KEY)
    return _client
