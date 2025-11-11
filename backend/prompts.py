"""Prompt helpers shared across communication channels."""
from __future__ import annotations

from typing import Literal

from config import SYSTEM_PROMPT, get_settings

Channel = Literal["voice", "sms", "email"]


_CHANNEL_GUIDANCE: dict[str, str] = {
    "voice": "",
    "sms": """
<channel_guidance>
When communicating via SMS text message:
- Keep replies concise (2-3 sentences max) and easy to read on a phone.
- Confirm key details with short bullet-style sentences where helpful.
- Avoid markdown formatting; plain text is preferred.
- Offer next steps or questions that can be answered quickly over text.
</channel_guidance>
""".strip(),
    "email": """
<channel_guidance>
When communicating by email:
- Use a warm, professional greeting and sign-off (for example, "Best regards, Ava").
- Provide slightly more detail than SMS while keeping paragraphs short.
- Highlight key information using short sentences rather than long blocks.
- When scheduling, clearly list the proposed date/time and any follow-up actions.
</channel_guidance>
""".strip(),
}


def get_system_prompt(channel: Channel) -> str:
    """Return the base persona prompt with channel-specific guidance."""
    settings = get_settings()
    base_prompt = SYSTEM_PROMPT.format(
        assistant_name=settings.AI_ASSISTANT_NAME,
        med_spa_name=settings.MED_SPA_NAME,
        address=settings.MED_SPA_ADDRESS,
        hours=settings.MED_SPA_HOURS,
        phone=settings.MED_SPA_PHONE,
    )

    guidance = _CHANNEL_GUIDANCE.get(channel.lower(), "").strip()
    if guidance:
        return f"{base_prompt}\n\n{guidance}"
    return base_prompt
