"""Ad-hoc simulation script for exercising real OpenAI + booking flows.

Run this locally to see how the current prompts + tools behave for a few
representative scenarios (voice and SMS) without touching Google Calendar or
Twilio. It uses your real OPENAI_API_KEY from .env but stubs the calendar
service to avoid creating real events.

Usage (from backend/):

    python simulate_booking_flows.py           # run all scenarios
    python simulate_booking_flows.py voice     # voice-only scenarios
    python simulate_booking_flows.py sms       # SMS-only scenarios

Scenarios:
- voice_simple_booking:   Straightforward voice booking intent
- voice_faq_only:         Voice FAQ / non-booking
- sms_simple_booking:     Straightforward SMS booking intent
- sms_faq_only:           SMS FAQ / non-booking

Each scenario prints:
- Turn-by-turn user and assistant messages
- Any deterministic booking tool calls (check_availability / book_appointment)
- Final appointments for the scenario's customer
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import List

import logging
from sqlalchemy.orm import Session

from booking.time_utils import EASTERN_TZ
from database import Appointment, Customer, SessionLocal
from messaging_service import MessagingService


# ---------------------------------------------------------------------------
# Logging: silence noisy SQL during simulations
# ---------------------------------------------------------------------------

logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
# Calendar stub to avoid hitting real Google Calendar during simulations
# ---------------------------------------------------------------------------


@dataclass
class _FakeSlot:
    start_iso: str
    end_iso: str
    start_label: str
    end_label: str


class FakeCalendarService:
    """Very small stub implementing the calendar API used by booking handlers.

    This avoids external Google Calendar calls but still lets us exercise the
    full booking pipeline (check_availability + book_appointment).
    """

    def __init__(self) -> None:
        # Build a fixed set of three slots starting tomorrow at 10 AM ET
        from datetime import datetime, timedelta

        base = datetime.now(EASTERN_TZ).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

        self._slots: List[_FakeSlot] = []
        for offset_hours in (0, 1, 2):
            start_dt = base + timedelta(hours=offset_hours)
            end_dt = start_dt + timedelta(minutes=60)
            self._slots.append(
                _FakeSlot(
                    start_iso=start_dt.isoformat(),
                    end_iso=end_dt.isoformat(),
                    start_label=start_dt.strftime("%I:%M %p"),
                    end_label=end_dt.strftime("%I:%M %p"),
                )
            )

    # Signature matches what booking_handlers.handle_check_availability expects
    def get_available_slots(self, date, service_type, services_dict=None, duration_minutes=None):  # noqa: ARG002
        return [
            {
                "start": slot.start_iso,
                "end": slot.end_iso,
                "start_time": slot.start_label,
                "end_time": slot.end_label,
            }
            for slot in self._slots
        ]

    # Signature matches what booking_handlers.handle_book_appointment expects
    def book_appointment(
        self,
        *,
        start_time,
        end_time,
        customer_name,
        customer_email,
        customer_phone,
        service_type,
        services_dict=None,  # noqa: ARG002
        provider=None,  # noqa: ARG002
        notes=None,  # noqa: ARG002
    ) -> str:
        # We just return a synthetic event ID; no side effects.
        return "evt-simulated"


# ---------------------------------------------------------------------------
# Scenario harness
# ---------------------------------------------------------------------------


@dataclass
class Scenario:
    name: str
    channel: str  # "voice" or "sms"
    customer_name: str
    customer_phone: str
    customer_email: str
    user_messages: List[str]


SCENARIOS: List[Scenario] = [
    Scenario(
        name="voice_simple_booking",
        channel="voice",
        customer_name="Scenario Voice Booking",
        customer_phone="+15555550011",
        customer_email="voice.booking@example.com",
        user_messages=[
            "Hi, I'd like to book a Botox appointment for tomorrow afternoon.",
            "Yes, 2 PM works for me.",
            "My name is Scenario Voice Booking and my number is +1 555-555-0011.",
        ],
    ),
    Scenario(
        name="voice_faq_only",
        channel="voice",
        customer_name="Scenario Voice FAQ",
        customer_phone="+15555550012",
        customer_email="voice.faq@example.com",
        user_messages=[
            "What services do you offer?",
            "What are your prices for Botox?",
            "What are your hours?",
        ],
    ),
    Scenario(
        name="sms_simple_booking",
        channel="sms",
        customer_name="Scenario SMS Booking",
        customer_phone="+15555550021",
        customer_email="sms.booking@example.com",
        user_messages=[
            "Hi, can you book me for Botox next Thursday at 3pm?",
            "Yes, that time works.",
        ],
    ),
    Scenario(
        name="sms_faq_only",
        channel="sms",
        customer_name="Scenario SMS FAQ",
        customer_phone="+15555550022",
        customer_email="sms.faq@example.com",
        user_messages=[
            "What's your address?",
            "How much is a Hydrafacial?",
        ],
    ),
    # Additional voice scenarios
    Scenario(
        name="voice_ambiguous_then_clarify",
        channel="voice",
        customer_name="Scenario Voice Ambiguous",
        customer_phone="+15555550013",
        customer_email="voice.ambiguous@example.com",
        user_messages=[
            "I'd like to come in sometime next week for Botox.",
            "Actually, Thursday afternoon would be best.",
            "3pm sounds good.",
            "My name is Scenario Voice Ambiguous and my number is +1 555-555-0013.",
        ],
    ),
    Scenario(
        name="voice_reschedule_style_request",
        channel="voice",
        customer_name="Scenario Voice Reschedule",
        customer_phone="+15555550014",
        customer_email="voice.reschedule@example.com",
        user_messages=[
            "I think I already have a Botox appointment on Friday, can we move it to next Tuesday afternoon?",
            "Any time after 2pm works.",
        ],
    ),
    Scenario(
        name="voice_cancel_mid_flow",
        channel="voice",
        customer_name="Scenario Voice Cancel",
        customer_phone="+15555550015",
        customer_email="voice.cancel@example.com",
        user_messages=[
            "Hi, I want to book a Hydrafacial.",
            "Maybe sometime this weekend.",
            "You know what, never mind, I'll call back later.",
        ],
    ),
    # Additional SMS scenarios
    Scenario(
        name="sms_ambiguous_then_precise",
        channel="sms",
        customer_name="Scenario SMS Ambiguous",
        customer_phone="+15555550023",
        customer_email="sms.ambiguous@example.com",
        user_messages=[
            "Can I do Botox sometime next month?",
            "Actually, let's do next Thursday at 4pm.",
        ],
    ),
    Scenario(
        name="sms_slot_change_after_offer",
        channel="sms",
        customer_name="Scenario SMS Slot Change",
        customer_phone="+15555550024",
        customer_email="sms.slotchange@example.com",
        user_messages=[
            "Hi, I'd like to book a Hydrafacial tomorrow afternoon.",
            "5pm sounds good.",
            "Wait, can we do 3pm instead?",
        ],
    ),
    Scenario(
        name="sms_double_confirmation",
        channel="sms",
        customer_name="Scenario SMS Double Confirm",
        customer_phone="+15555550025",
        customer_email="sms.doubleconfirm@example.com",
        user_messages=[
            "Can you book me for Botox next Wednesday at 2pm?",
            "Great, thanks.",
            "Just confirming it's Wednesday at 2pm, right?",
        ],
    ),
    Scenario(
        name="sms_cross_channel_reference",
        channel="sms",
        customer_name="Scenario SMS CrossChannel",
        customer_phone="+15555550026",
        customer_email="sms.cross@example.com",
        user_messages=[
            "Hi, I was just on the phone about booking Botox.",
            "Can you confirm the 3pm Thursday slot you mentioned?",
        ],
    ),
]


def _get_or_create_customer(db: Session, scenario: Scenario) -> Customer:
    customer = (
        db.query(Customer)
        .filter(Customer.phone == scenario.customer_phone)
        .order_by(Customer.id.desc())
        .first()
    )
    if customer:
        return customer

    customer = Customer(
        name=scenario.customer_name,
        phone=scenario.customer_phone,
        email=scenario.customer_email,
        is_new_client=True,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def run_scenario(db: Session, scenario: Scenario) -> None:
    print("\n" + "=" * 80)
    print(f"Scenario: {scenario.name}  (channel={scenario.channel})")
    print("=" * 80)

    customer = _get_or_create_customer(db, scenario)

    conversation = MessagingService.create_conversation(
        db=db,
        customer_id=customer.id,
        channel=scenario.channel,
        metadata={"simulation": scenario.name},
    )

    for idx, user_text in enumerate(scenario.user_messages, start=1):
        print(f"\n[User {idx}] {user_text}")
        MessagingService.add_customer_message(
            db=db,
            conversation=conversation,
            content=user_text,
            metadata={"source": "simulation"},
        )

        try:
            assistant_text, _ = MessagingService.generate_ai_response(
                db, conversation.id, scenario.channel
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[Assistant ERROR] {exc}")
            break

        print(f"[Assistant] {assistant_text}\n")

    # After the scenario, show any appointments for this customer
    appts = (
        db.query(Appointment)
        .filter(Appointment.customer_id == customer.id)
        .order_by(Appointment.appointment_datetime.asc())
        .all()
    )

    print("--- Appointment Summary ---")
    if not appts:
        print("No appointments booked for this customer.")
    else:
        for appt in appts:
            print(
                f"- {appt.service_type} at {appt.appointment_datetime} "
                f"(status={appt.status}, event_id={appt.calendar_event_id})"
            )

    # Show latest conversation metadata for debugging (slot offers, etc.)
    db.refresh(conversation)
    metadata = conversation.custom_metadata or {}
    print("\n--- Conversation Metadata ---")
    print(json.dumps(metadata, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate booking flows.")
    parser.add_argument(
        "channel",
        nargs="?",
        choices=["voice", "sms", "all"],
        default="all",
        help="Which channel scenarios to run (default: all)",
    )
    args = parser.parse_args()

    # Force MessagingService to use a fake calendar service instead of Google.
    # This avoids network calls while still exercising booking logic.
    from messaging_service import MessagingService as MSClass

    MSClass._calendar_service_instance = FakeCalendarService()

    db = SessionLocal()
    try:
        for scenario in SCENARIOS:
            if args.channel != "all" and scenario.channel != args.channel:
                continue
            run_scenario(db, scenario)
    finally:
        db.close()


if __name__ == "__main__":
    main()
