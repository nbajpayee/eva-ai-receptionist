from __future__ import annotations

from turn_orchestrator import TurnContext, TurnIntent, TurnOrchestrator


def test_classify_intent_detects_booking_keywords():
    ctx = TurnContext(
        channel="sms",
        last_customer_text="Can you book me a Botox appointment for tomorrow?",
        metadata={},
    )

    intent = TurnOrchestrator.classify_intent(ctx)

    assert intent == TurnIntent.BOOKING


def test_classify_intent_uses_pending_booking_intent_metadata():
    ctx = TurnContext(
        channel="sms",
        last_customer_text="Okay, sounds good",
        metadata={"pending_booking_intent": True},
    )

    intent = TurnOrchestrator.classify_intent(ctx)

    assert intent == TurnIntent.BOOKING


def test_classify_intent_detects_faq_questions():
    ctx = TurnContext(
        channel="sms",
        last_customer_text="What are your hours and where are you located?",
        metadata={},
    )

    intent = TurnOrchestrator.classify_intent(ctx)

    assert intent == TurnIntent.FAQ


def test_classify_intent_detects_small_talk():
    ctx = TurnContext(
        channel="sms",
        last_customer_text="Hi there!",
        metadata={},
    )

    intent = TurnOrchestrator.classify_intent(ctx)

    assert intent == TurnIntent.SMALL_TALK


def test_classify_intent_defaults_to_general():
    ctx = TurnContext(
        channel="sms",
        last_customer_text="I had a question about something from last time.",
        metadata={},
    )

    intent = TurnOrchestrator.classify_intent(ctx)

    assert intent == TurnIntent.GENERAL
