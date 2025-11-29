"""Turn-level intent classification and orchestration helpers.

This module provides a very thin, heuristic-based intent classifier used
by both messaging and (optionally) voice surfaces to decide whether a
turn is primarily about booking, FAQ-style information, or general
conversation/small talk.

It is intentionally lightweight and stateless so it can be called inside
request handlers without extra model hops.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict


class TurnIntent(str, Enum):
    """High-level turn intents used for routing.

    Values are strings so they serialize cleanly into JSON/metadata.
    """

    BOOKING = "booking"
    FAQ = "faq"
    GENERAL = "general"
    SMALL_TALK = "small_talk"


@dataclass
class TurnContext:
    """Minimal context needed to classify a single turn.

    This is intentionally decoupled from any particular ORM or channel
    implementation so it can be reused across messaging/voice and future
    adapters.
    """

    channel: str
    last_customer_text: str
    metadata: Dict[str, Any]


class TurnOrchestrator:
    """Static helpers for classifying turn intent.

    Today this is a thin heuristic layer; in the future it could be
    upgraded to use a small classifier model or few-shot prompt.
    """

    @staticmethod
    def classify_intent(context: TurnContext) -> TurnIntent:
        text = (context.last_customer_text or "").strip().lower()
        metadata = context.metadata or {}

        if not text:
            # No recent text – fall back to metadata.
            if metadata.get("pending_booking_intent"):
                return TurnIntent.BOOKING
            return TurnIntent.GENERAL

        # 1) Explicit booking intent: reuse the same keyword family used by
        #    deterministic booking helpers so behavior stays aligned.
        booking_keywords = [
            "book",
            "schedule",
            "appointment",
            "reserve",
            "slot",
            "resched",
            "reschedule",
            "cancel my appointment",
        ]
        if metadata.get("pending_booking_intent") or any(
            kw in text for kw in booking_keywords
        ):
            return TurnIntent.BOOKING

        # 2) Small talk / greetings / pure acknowledgements.
        small_talk_phrases = [
            "hi",
            "hi there",
            "hello",
            "hey",
            "good morning",
            "good afternoon",
            "good evening",
            "thanks",
            "thank you",
            "thx",
            "ok",
            "okay",
            "sounds good",
        ]
        for phrase in small_talk_phrases:
            if text == phrase or text.startswith(phrase + " "):
                return TurnIntent.SMALL_TALK

        # 3) FAQ-style informational questions (hours, location, services,
        #    pricing, providers, policies, etc.).
        question_starters = (
            "what ",
            "when ",
            "where ",
            "how ",
            "do you ",
            "are you ",
            "can you ",
        )
        faq_keywords = [
            "hours",
            "open",
            "close",
            "location",
            "address",
            "parking",
            "services",
            "service do you offer",
            "offer ",
            "price",
            "pricing",
            "cost",
            "how much",
            "insurance",
            "policy",
            "policies",
            "cancellation",
            "provider",
            "doctor",
            "nurse",
        ]

        if text.endswith("?") or any(text.startswith(s) for s in question_starters):
            if any(kw in text for kw in faq_keywords):
                return TurnIntent.FAQ

        # 4) Default to GENERAL.
        return TurnIntent.GENERAL
