"""Seed Supabase Postgres with representative dashboard data.

Usage:
    python backend/scripts/seed_supabase.py            # seed if empty
    python backend/scripts/seed_supabase.py --force    # wipe and reseed
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, time
import random
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from config import get_settings  # noqa: E402
from database import (  # noqa: E402
    Appointment,
    CallEvent,
    CallSession,
    CommunicationEvent,
    CommunicationMessage,
    Conversation,
    Customer,
    DailyMetric,
    SessionLocal,
    VoiceCallDetails,
)


def clear_existing_data() -> None:
    session = SessionLocal()
    try:
        # Delete in dependency-safe order
        session.query(CallEvent).delete()
        session.query(CallSession).delete()
        session.query(Appointment).delete()
        session.query(DailyMetric).delete()
        session.query(CommunicationEvent).delete()
        session.query(VoiceCallDetails).delete()
        session.query(CommunicationMessage).delete()
        session.query(Conversation).delete()
        session.query(Customer).delete()
        session.commit()
    finally:
        session.close()


def seed_data() -> None:
    session = SessionLocal()
    now = datetime.utcnow()
    random.seed(42)
    try:
        total_calls = session.query(CallSession).count()
        if total_calls > 0:
            print(
                "Seed aborted: call_sessions already contains data. Use --force to reseed."
            )
            return

        # Customer roster for realistic dataset
        customer_directory = [
            ("Emily Parker", True),
            ("Jason Rivera", False),
            ("Sarah Johnson", True),
            ("Michael Chen", False),
            ("Olivia Martinez", True),
            ("Noah Patel", False),
            ("Ava Thompson", True),
            ("Daniel Kim", False),
            ("Sophia Nguyen", True),
            ("Liam Rodriguez", False),
            ("Grace Lee", True),
            ("Ethan Walker", False),
            ("Isabella Flores", True),
            ("Mason Cooper", False),
            ("Camila Ortiz", True),
            ("Logan Davis", False),
            ("Harper Wilson", True),
            ("Benjamin Scott", False),
            ("Layla Green", True),
            ("Jacob Adams", False),
            ("Mia Hernandez", True),
            ("Elijah Brooks", False),
            ("Avery Simmons", True),
            ("Jackson Lee", False),
            ("Scarlett Perez", True),
            ("Lucas Bennett", False),
            ("Chloe Rivera", True),
            ("Henry Foster", False),
            ("Zoey Carter", True),
        ]

        customer_objs: List[Customer] = []
        for idx, (name, is_new) in enumerate(customer_directory, start=1):
            phone = f"+1310555{idx:04d}"
            email = name.lower().replace(" ", ".") + "@example.com"
            customer = Customer(
                name=name,
                phone=phone,
                email=email,
                is_new_client=is_new,
            )
            session.add(customer)
            session.flush()
            customer_objs.append(customer)

        services = [
            ("Botox", 0.4),
            ("Dermal Fillers", 0.25),
            ("Laser Hair Removal", 0.15),
            ("HydraFacial", 0.2),
        ]

        outcomes = [
            ("booked", 0.6),
            ("info_only", 0.25),
            ("escalated", 0.1),
            ("abandoned", 0.05),
        ]

        providers = [
            "Dr. Sarah Smith",
            "Nurse Emily Johnson",
            "Lisa Lee",
        ]

        transcripts_templates = {
            "booked": "{name} called about {service} and booked a consultation for next week.",
            "info_only": "{name} asked about {service} pricing and requested follow-up information via email.",
            "escalated": "{name} had detailed medical questions about {service}; call escalated to on-site staff.",
            "abandoned": "Caller inquired about {service} but ended the call before we could finish scheduling.",
        }

        def weighted_choice(options):
            roll = random.random()
            cumulative = 0.0
            for value, weight in options:
                cumulative += weight
                if roll <= cumulative:
                    return value
            return options[-1][0]

        def random_business_time(days_back: int) -> datetime:
            day_offset = random.randint(0, days_back)
            hour = random.randint(9, 18)
            minute = random.choice([0, 15, 30, 45])
            base_date = (now - timedelta(days=day_offset)).date()
            return datetime.combine(base_date, time(hour=hour, minute=minute))

        call_session_objs: List[CallSession] = []
        conversation_objs: List[Conversation] = []
        messages_created: List[CommunicationMessage] = []
        appointments_created: List[Appointment] = []
        daily_rollups: dict = {}

        total_calls_to_generate = 26

        for idx in range(total_calls_to_generate):
            customer = random.choice(customer_objs)
            service = weighted_choice(services)
            outcome = weighted_choice(outcomes)
            started_at = random_business_time(13)
            duration_seconds = random.randint(240, 780)
            ended_at = started_at + timedelta(seconds=duration_seconds)

            satisfaction = round(min(10, max(6, random.gauss(8.2, 0.7))), 1)
            if outcome in {"escalated", "abandoned"}:
                satisfaction = round(min(8.5, max(5.5, random.gauss(6.8, 0.6))), 1)

            sentiment = "positive"
            if outcome == "info_only":
                sentiment = "neutral"
            elif outcome in {"escalated", "abandoned"}:
                sentiment = "negative"

            session_id = f"sess_{started_at.strftime('%Y%m%d')}_{idx:03d}"
            transcript = transcripts_templates[outcome].format(name=customer.name, service=service)

            call = CallSession(
                customer_id=customer.id,
                session_id=session_id,
                phone_number=customer.phone,
                started_at=started_at,
                ended_at=ended_at,
                duration_seconds=duration_seconds,
                transcript=transcript,
                satisfaction_score=satisfaction,
                sentiment=sentiment,
                outcome=outcome,
                customer_interruptions=random.randint(0, 2),
                ai_clarifications_needed=random.randint(0, 2),
                function_calls_made=1 if outcome in {"booked", "info_only", "escalated"} else 0,
                escalated=outcome == "escalated",
            )
            session.add(call)
            session.flush()
            call_session_objs.append(call)

            # Create omnichannel conversation for dashboard
            convo_status = "completed" if outcome != "abandoned" else "failed"
            conversation = Conversation(
                customer_id=customer.id,
                channel="voice",
                status=convo_status,
                initiated_at=started_at,
                last_activity_at=ended_at,
                completed_at=ended_at,
                satisfaction_score=int(round(satisfaction)),
                sentiment=sentiment,
                outcome=outcome,
                subject=f"{service} consultation",
                ai_summary=transcript,
                custom_metadata={
                    "phone_number": customer.phone,
                    "duration_seconds": duration_seconds,
                    "session_id": session_id,
                    "escalated": outcome == "escalated",
                    "source": "seed_script",
                },
            )
            session.add(conversation)
            session.flush()
            conversation_objs.append(conversation)

            # Generate message + voice metadata for conversation
            summary = transcript
            transcript_segments = [
                {
                    "speaker": "customer",
                    "text": f"Hi there, I'm interested in {service}.",
                    "timestamp": 0,
                },
                {
                    "speaker": "assistant",
                    "text": "Ava explained the treatment details and pricing options.",
                    "timestamp": 32,
                },
                {
                    "speaker": "assistant",
                    "text": transcript,
                    "timestamp": duration_seconds - 30,
                },
            ]

            function_calls: List[Dict[str, str]] = []
            if outcome == "booked":
                function_calls.append(
                    {
                        "name": "book_appointment",
                        "args": {"service": service, "customer": customer.name},
                        "result": {"status": "confirmed"},
                    }
                )
            elif outcome == "info_only":
                function_calls.append(
                    {
                        "name": "send_follow_up",
                        "args": {"channel": "email", "service": service},
                        "result": {"status": "queued"},
                    }
                )
            elif outcome == "escalated":
                function_calls.append(
                    {
                        "name": "notify_staff",
                        "args": {"reason": "medical_question", "service": service},
                        "result": {"status": "acknowledged"},
                    }
                )

            message = CommunicationMessage(
                conversation_id=conversation.id,
                direction="inbound",
                content=summary,
                sent_at=ended_at,
                custom_metadata={
                    "transcript_entry_count": len(transcript_segments),
                    "customer_interruptions": call.customer_interruptions,
                },
            )
            session.add(message)
            session.flush()
            messages_created.append(message)

            voice_details = VoiceCallDetails(
                message_id=message.id,
                duration_seconds=duration_seconds,
                transcript_segments=transcript_segments,
                function_calls=function_calls,
                interruption_count=call.customer_interruptions,
            )
            session.add(voice_details)

            # Omnichannel communication events mirror call timeline
            communication_events = [
                CommunicationEvent(
                    conversation_id=conversation.id,
                    message_id=message.id,
                    event_type="intent_detected",
                    timestamp=call.started_at + timedelta(seconds=45),
                    details={"intent": "book_appointment", "service": service},
                )
            ]

            if outcome == "booked":
                communication_events.append(
                    CommunicationEvent(
                        conversation_id=conversation.id,
                        message_id=message.id,
                        event_type="appointment_booked",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 90),
                        details={"service": service},
                    )
                )
            elif outcome == "info_only":
                communication_events.append(
                    CommunicationEvent(
                        conversation_id=conversation.id,
                        message_id=message.id,
                        event_type="follow_up_required",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 45),
                        details={"channel": "email"},
                    )
                )
            elif outcome == "escalated":
                communication_events.append(
                    CommunicationEvent(
                        conversation_id=conversation.id,
                        message_id=message.id,
                        event_type="escalation_requested",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 60),
                        details={"reason": "medical_question"},
                    )
                )

            for comm_event in communication_events:
                session.add(comm_event)

            # Create appointments for booked/rescheduled outcomes
            if outcome == "booked":
                appointment_time = now + timedelta(days=random.randint(1, 7), hours=random.randint(10, 17))
                appointment = Appointment(
                    customer_id=customer.id,
                    calendar_event_id=f"cal_evt_{session_id}",
                    appointment_datetime=appointment_time,
                    service_type=service,
                    provider=random.choice(providers),
                    duration_minutes=60,
                    status="scheduled",
                    booked_by="ai",
                )
                session.add(appointment)
                session.flush()
                appointments_created.append(appointment)
            elif outcome == "escalated":
                appointment_time = now + timedelta(days=random.randint(2, 9), hours=random.randint(9, 16))
                appointment = Appointment(
                    customer_id=customer.id,
                    calendar_event_id=f"cal_evt_{session_id}",
                    appointment_datetime=appointment_time,
                    service_type=service,
                    provider=random.choice(providers),
                    duration_minutes=45,
                    status="pending",
                    booked_by="staff",
                )
                session.add(appointment)
                session.flush()
                appointments_created.append(appointment)

            # Event timeline snapshots
            event_entries = [
                CallEvent(
                    call_session_id=call.id,
                    event_type="intent_detected",
                    timestamp=call.started_at + timedelta(seconds=45),
                    data={"intent": "book_appointment", "service": service},
                )
            ]

            if outcome == "booked":
                event_entries.append(
                    CallEvent(
                        call_session_id=call.id,
                        event_type="appointment_booked",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 90),
                        data={"service": service},
                    )
                )
            elif outcome == "info_only":
                event_entries.append(
                    CallEvent(
                        call_session_id=call.id,
                        event_type="follow_up_required",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 45),
                        data={"channel": "email"},
                    )
                )
            elif outcome == "escalated":
                event_entries.append(
                    CallEvent(
                        call_session_id=call.id,
                        event_type="escalation_requested",
                        timestamp=call.started_at + timedelta(seconds=duration_seconds - 60),
                        data={"reason": "medical_question"},
                    )
                )

            for event in event_entries:
                session.add(event)

            # Aggregate metrics per day
            day_key = call.started_at.date()
            rollup = daily_rollups.setdefault(
                day_key,
                {
                    "total_calls": 0,
                    "total_talk_time": 0,
                    "booked": 0,
                    "rescheduled": 0,
                    "cancelled": 0,
                    "escalated": 0,
                    "satisfaction_total": 0.0,
                },
            )
            rollup["total_calls"] += 1
            rollup["total_talk_time"] += duration_seconds
            rollup["satisfaction_total"] += satisfaction
            if outcome == "booked":
                rollup["booked"] += 1
            if outcome == "escalated":
                rollup["escalated"] += 1

        # Daily metrics entries spread across demo window
        for day, values in sorted(daily_rollups.items()):
            total = values["total_calls"]
            avg_duration = int(values["total_talk_time"] / total) if total else 0
            avg_satisfaction = round(values["satisfaction_total"] / total, 1) if total else 0
            conversion = round((values["booked"] / total) * 100, 1) if total else 0

            metric = DailyMetric(
                date=day,
                total_calls=values["total_calls"],
                total_talk_time_seconds=values["total_talk_time"],
                avg_call_duration_seconds=avg_duration,
                appointments_booked=values["booked"],
                appointments_rescheduled=values["rescheduled"],
                appointments_cancelled=values["cancelled"],
                avg_satisfaction_score=avg_satisfaction,
                calls_escalated=values["escalated"],
                conversion_rate=conversion,
            )
            session.add(metric)

        session.commit()
        print(
            f"✅ Supabase seeded with {len(call_session_objs)} call sessions, "
            f"{len(conversation_objs)} conversations, {len(messages_created)} messages, "
            f"{len(appointments_created)} appointments, spanning {len(daily_rollups)} days."
        )
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Supabase database with sample data")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Clear existing data before seeding",
    )
    args = parser.parse_args()

    settings = get_settings()
    if settings.DATABASE_URL.startswith("sqlite"):
        print("[ERROR] DATABASE_URL is pointing to SQLite. Update .env before seeding.")
        sys.exit(1)

    if args.force:
        print("Clearing existing data...")
        clear_existing_data()

    seed_data()


if __name__ == "__main__":
    main()
