from __future__ import annotations

from typing import Optional

from openai import OpenAI

from config import get_settings


_settings = get_settings()
_client: Optional[OpenAI] = None


def get_openai_client() -> OpenAI:
    global _client
    if _client is None:
        if not _settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not configured")
        _client = OpenAI(api_key=_settings.OPENAI_API_KEY)
    return _client
