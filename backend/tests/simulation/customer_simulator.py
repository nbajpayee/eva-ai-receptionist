from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


# One persona per MECE bucket
PERSONAS: Dict[str, Dict[str, Any]] = {
    "info_seeker_ivy": {
        "name": "Ivy (Curious FirstTimer)",
        "bucket": "information_seeking",
        "goal": (
            "Gather information about services, pricing, downtime, hours, policies, and providers "
            "before deciding whether to book."
        ),
        "personality": "Polite, curious, slightly cautious, not ready to commit yet.",
        "background": "New to aesthetic treatments, doing research before a first visit.",
        "preferences": {
            "typical_questions": [
                "How much is Botox?",
                "Whats the downtime for dermal fillers?",
                "Are you open on Sundays?",
                "Whats your cancellation policy?",
                "Who does the injections there?",
                "What services do you offer?",
            ],
            "ready_to_book_now": False,
        },
    },
    "planner_priya": {
        "name": "Priya (Decisive Planner)",
        "bucket": "appointment_booking",
        "goal": "Book a Botox, filler, or consultation appointment with clear timing preferences.",
        "personality": "Organized, direct, decisive once options are clear.",
        "background": "Has had treatments before and is comfortable booking by text.",
        "preferences": {
            "primary_services": ["Botox", "Lip Filler", "Consultation"],
            "time_phrases": [
                "tomorrow afternoon",
                "Tuesday next week",
                "sometime next week",
                "in 3 weeks",
                "after work tomorrow",
                "Friday afternoon",
            ],
            "open_to_multi_service": True,
            "expects": {
                "specific_time_offers": True,
                "no_preemptive_check_for_vague_relative_time": True,
                "no_post_booking_recheck": True,
            },
        },
    },
    "juggler_jordan": {
        "name": "Jordan (Schedule Juggler)",
        "bucket": "appointment_management",
        "goal": "Reschedule, cancel, confirm, or tweak existing appointments.",
        "personality": "Busy, a bit scattered, assumes the system knows their bookings.",
        "background": "Has multiple future appointments and a changing schedule.",
        "preferences": {
            "common_actions": ["reschedule", "cancel", "confirm_time", "add_on_service"],
            "typical_phrases": [
                "Can we move my appointment to later in the afternoon?",
                "I need to cancel my appointment for tomorrow.",
                "Can you confirm what time my Friday appointment is?",
                "Can we add a facial to my Botox next week?",
            ],
            "often_omits_details": True,
            "expects": {
                "clarification_when_multiple_appointments": True,
                "late_cancel_policy_if_inside_window": True,
                "no_new_booking_when_rescheduling": True,
                "no_post_booking_availability_recheck": True,
            },
        },
    },
    "member_morgan": {
        "name": "Morgan (Practical Member)",
        "bucket": "operational_account",
        "goal": "Update profile details or check membership/package info without changing appointments.",
        "personality": "Straightforward, taskoriented, not chatty.",
        "background": "Existing client with a membership or package, already has bookings.",
        "preferences": {
            "common_actions": ["update_phone", "update_email", "ask_membership_balance"],
            "typical_phrases": [
                "Can you update my phone number to ?",
                "Do I need to do anything before my first visit?",
                "How many Botox units do I have left in my membership?",
            ],
            "expects": {
                "no_appointment_changes": True,
                "no_guessing_membership_balances": True,
                "handoff_if_data_unavailable": True,
                "light_identity_confirmation_only": True,
            },
        },
    },
    "curious_casey": {
        "name": "Casey (Curious Optimizer)",
        "bucket": "sales_conversion_support",
        "goal": "Understand what treatments might be right and possibly move toward a consult/booking.",
        "personality": "Engaged, openminded, cost and outcomeaware.",
        "background": "Has some familiarity with aesthetics but wants guidance.",
        "preferences": {
            "concerns": ["fine lines on forehead", "lip volume", "overall skin glow"],
            "typical_phrases": [
                "What is best for fine lines on my forehead?",
                "Should I do Botox or filler?",
                "Is there anything you recommend adding on?",
            ],
            "open_to_upsell": True,
            "expects": {
                "no_medical_diagnosis": True,
                "consultation_positioned_for_personalized_plan": True,
                "upsell_only_after_core_booking_is_clear": True,
                "no_pressure_language": True,
            },
        },
    },
    "aftercare_alex": {
        "name": "Alex (Aftercare Checker)",
        "bucket": "post_appointment_support",
        "goal": "Get safe aftercare guidance and know when to escalate to a human.",
        "personality": "Concerned but reasonable; wants to do the right thing.",
        "background": "Recently had a treatment (e.g. Botox or filler).",
        "preferences": {
            "typical_phrases": [
                "I just had Botox today, what should I avoid?",
                "My face is very swollen and painful after filler, is this normal?",
            ],
            "expects": {
                "generic_non_diagnostic_aftercare_tips": True,
                "no_reassuring_or_dismissing_diagnosis": True,
                "clear_escalation_to_clinic_or_emergency_instructions": True,
            },
        },
    },
    "organizer_olivia": {
        "name": "Olivia (Organizer & Advocate)",
        "bucket": "administrative_misc",
        "goal": "Handle nonclinical admin tasks like gift cards and feedback.",
        "personality": "Organized, direct, expects professional handling.",
        "background": "Engaged customer who also cares about experience quality.",
        "preferences": {
            "typical_phrases": [
                "Can I buy a gift card for my friend?",
                "I wasnt happy with my last visit and want to file a complaint.",
            ],
            "expects": {
                "clear_gift_card_instructions": True,
                "empathetic_response_to_complaints": True,
                "handoff_to_manager_or_team_for_issues": True,
                "no_appointment_booking_unless_explicitly_requested": True,
            },
        },
    },
}


def _load_golden_openers_by_bucket(channel: str = "sms") -> Dict[str, List[str]]:
    """Load a simple mapping of bucket -> example opening user messages from golden_scenarios.json.

    This gives the simulator realistic first messages that mirror our deterministic
    golden scenarios, without coupling tightly to any one scenario ID.
    """

    fixtures_path = Path(__file__).resolve().parents[1] / "fixtures" / "golden_scenarios.json"
    if not fixtures_path.exists():
        return {}

    try:
        with fixtures_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {}

    scenarios = data.get("scenarios", [])
    by_bucket: Dict[str, List[str]] = {}

    for scenario in scenarios:
        if channel and scenario.get("channel") != channel:
            continue
        bucket = scenario.get("bucket")
        if not bucket:
            continue

        convo = scenario.get("conversation") or []
        # Take the first user turn as the canonical opener for that scenario
        for turn in convo:
            if turn.get("role") == "user":
                text = (turn.get("content") or "").strip()
                if not text:
                    continue
                by_bucket.setdefault(bucket, []).append(text)
                break

    return by_bucket


GOLDEN_OPENERS_BY_BUCKET: Dict[str, List[str]] = _load_golden_openers_by_bucket()


@dataclass
class CustomerSimulator:
    """Lightweight customer simulator wired to the 7 MECE personas.

    This class does *not* depend on any particular LLM provider. Instead it
    accepts an optional ``llm_callable`` that you can wire to OpenAI, Claude,
    or any other chat model. The callable receives a payload with persona and
    history and must return the next customer message as a string.
    """

    persona_id: str
    model_name: Optional[str] = None
    llm_callable: Optional[Callable[[Dict[str, Any]], str]] = None

    persona: Dict[str, Any] = field(init=False)
    bucket: str = field(init=False)
    history: List[Dict[str, str]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.persona_id not in PERSONAS:
            raise ValueError(f"Unknown persona_id: {self.persona_id}")
        self.persona = PERSONAS[self.persona_id]
        self.bucket = self.persona["bucket"]

    # --------- Opening message helpers ---------

    def _pick_opening_from_persona(self) -> Optional[str]:
        prefs = self.persona.get("preferences", {})
        typical = prefs.get("typical_phrases") or prefs.get("typical_questions")
        if typical:
            return str(typical[0])
        return None

    def _pick_opening_from_golden(self) -> Optional[str]:
        candidates = GOLDEN_OPENERS_BY_BUCKET.get(self.bucket) or []
        if candidates:
            return str(candidates[0])
        return None

    # --------- Public simulation API ---------

    def get_initial_message(self) -> str:
        """Return the customer's first message and record it in history.

        Prefers persona-specific "typical" phrases; falls back to a golden
        scenario opener for the same bucket; finally uses a generic greeting
        if nothing else is available.
        """

        message = self._pick_opening_from_persona() or self._pick_opening_from_golden()
        if not message:
            message = "Hi, I have a question about treatments."

        self.history.append({"role": "customer", "content": message})
        return message

    def generate_response(self, assistant_message: Optional[str]) -> str:
        """Generate the next customer message.

        If ``llm_callable`` is provided, it will be called with a payload of:

        .. code-block:: python

            {
                "persona": <dict>,
                "bucket": <str>,
                "model_name": <str | None>,
                "history": <list[{"role", "content"}]>,
                "assistant_message": <str | None>,
            }

        and must return the customer's next utterance as a string.

        If no ``llm_callable`` is configured, this falls back to a trivial
        canned reply so tests can still run without external keys.
        """

        if assistant_message:
            self.history.append({"role": "assistant", "content": assistant_message})

        if self.llm_callable is None:
            # Minimal, deterministic fallback so the simulator is usable without LLM keys.
            # If this is the first turn after the opener, acknowledge and move the
            # conversation forward a bit.
            if not self.history or self.history[-1]["role"] != "assistant":
                reply = self.get_initial_message()
            else:
                reply = "Okay, that sounds good."
        else:
            payload: Dict[str, Any] = {
                "persona": self.persona,
                "bucket": self.bucket,
                "model_name": self.model_name,
                "history": list(self.history),
                "assistant_message": assistant_message,
            }
            reply = self.llm_callable(payload)

        self.history.append({"role": "customer", "content": reply})
        return reply
