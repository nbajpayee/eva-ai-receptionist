"""Seed Supabase Postgres with representative dashboard data.

Usage:
    python backend/scripts/seed_supabase.py            # seed if empty
    python backend/scripts/seed_supabase.py --force    # wipe and reseed
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

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
    Customer,
    DailyMetric,
    SessionLocal,
)


def clear_existing_data() -> None:
    session = SessionLocal()
    try:
        # Delete in dependency-safe order
        session.query(CallEvent).delete()
        session.query(CallSession).delete()
        session.query(Appointment).delete()
        session.query(Customer).delete()
        session.query(DailyMetric).delete()
        session.commit()
    finally:
        session.close()


def seed_data() -> None:
    session = SessionLocal()
    now = datetime.utcnow()
    try:
        total_calls = session.query(CallSession).count()
        if total_calls > 0:
            print(
                "Seed aborted: call_sessions already contains data. Use --force to reseed."
            )
            return

        # Customers
        customers_data = [
            {
                "name": "Emily Parker",
                "phone": "+13105551234",
                "email": "emily.parker@example.com",
                "is_new_client": True,
            },
            {
                "name": "Jason Rivera",
                "phone": "+13105559876",
                "email": "jason.rivera@example.com",
                "is_new_client": False,
            },
        ]

        customer_objs: List[Customer] = []
        for data in customers_data:
            customer = Customer(**data)
            session.add(customer)
            session.flush()
            customer_objs.append(customer)

        # Appointments (one booked by AI, one rescheduled)
        appointments_data = [
            {
                "customer_id": customer_objs[0].id,
                "calendar_event_id": "cal_evt_001",
                "appointment_datetime": now + timedelta(days=3, hours=10),
                "service_type": "Botox",
                "provider": "Dr. Sarah Smith",
                "duration_minutes": 60,
                "status": "scheduled",
                "booked_by": "ai",
            },
            {
                "customer_id": customer_objs[1].id,
                "calendar_event_id": "cal_evt_002",
                "appointment_datetime": now + timedelta(days=5, hours=9),
                "service_type": "HydraFacial",
                "provider": "Lisa Lee",
                "duration_minutes": 60,
                "status": "rescheduled",
                "booked_by": "ai",
            },
        ]

        appointment_objs: List[Appointment] = []
        for data in appointments_data:
            appt = Appointment(**data)
            session.add(appt)
            session.flush()
            appointment_objs.append(appt)

        # Call sessions
        call_sessions_data = [
            {
                "customer_id": customer_objs[0].id,
                "session_id": "sess_20241108_001",
                "phone_number": customer_objs[0].phone,
                "started_at": now - timedelta(hours=4),
                "ended_at": now - timedelta(hours=3, minutes=50),
                "duration_seconds": 600,
                "transcript": "Emily booked a Botox session for next week.",
                "satisfaction_score": 9.2,
                "sentiment": "positive",
                "outcome": "booked",
                "customer_interruptions": 1,
                "ai_clarifications_needed": 0,
                "function_calls_made": 1,
                "escalated": False,
            },
            {
                "customer_id": customer_objs[1].id,
                "session_id": "sess_20241108_002",
                "phone_number": customer_objs[1].phone,
                "started_at": now - timedelta(hours=2),
                "ended_at": now - timedelta(hours=1, minutes=55),
                "duration_seconds": 300,
                "transcript": "Jason asked about cooling facials and rescheduled his appointment.",
                "satisfaction_score": 8.5,
                "sentiment": "positive",
                "outcome": "rescheduled",
                "customer_interruptions": 0,
                "ai_clarifications_needed": 1,
                "function_calls_made": 1,
                "escalated": False,
            },
            {
                "customer_id": None,
                "session_id": "sess_20241108_003",
                "phone_number": "+13105550000",
                "started_at": now - timedelta(hours=1, minutes=10),
                "ended_at": now - timedelta(hours=1),
                "duration_seconds": 120,
                "transcript": "Caller requested pricing info and ended call before booking.",
                "satisfaction_score": 6.8,
                "sentiment": "neutral",
                "outcome": "info_only",
                "customer_interruptions": 2,
                "ai_clarifications_needed": 1,
                "function_calls_made": 0,
                "escalated": False,
            },
        ]

        call_session_objs: List[CallSession] = []
        for data in call_sessions_data:
            call = CallSession(**data)
            session.add(call)
            session.flush()
            call_session_objs.append(call)

        # Call events for richer history
        call_events_data = [
            {
                "call_session_id": call_session_objs[0].id,
                "event_type": "intent_detected",
                "timestamp": call_session_objs[0].started_at + timedelta(seconds=45),
                "data": {"intent": "book_appointment", "service": "Botox"},
            },
            {
                "call_session_id": call_session_objs[0].id,
                "event_type": "appointment_booked",
                "timestamp": call_session_objs[0].started_at + timedelta(minutes=5),
                "data": {"appointment_id": appointment_objs[0].id},
            },
            {
                "call_session_id": call_session_objs[1].id,
                "event_type": "intent_detected",
                "timestamp": call_session_objs[1].started_at + timedelta(seconds=30),
                "data": {"intent": "reschedule_appointment"},
            },
            {
                "call_session_id": call_session_objs[1].id,
                "event_type": "appointment_rescheduled",
                "timestamp": call_session_objs[1].started_at + timedelta(minutes=3),
                "data": {"appointment_id": appointment_objs[1].id},
            },
            {
                "call_session_id": call_session_objs[2].id,
                "event_type": "intent_detected",
                "timestamp": call_session_objs[2].started_at + timedelta(seconds=20),
                "data": {"intent": "general_question"},
            },
        ]

        for data in call_events_data:
            event = CallEvent(**data)
            session.add(event)

        # Daily metrics summary
        total_calls = len(call_session_objs)
        total_talk_time = sum(cs.duration_seconds or 0 for cs in call_session_objs)
        booked_calls = sum(1 for cs in call_session_objs if cs.outcome == "booked")
        escalations = sum(1 for cs in call_session_objs if cs.escalated)
        avg_duration = int(total_talk_time / total_calls) if total_calls else 0
        avg_satisfaction = (
            sum(cs.satisfaction_score or 0 for cs in call_session_objs) / total_calls
            if total_calls
            else 0
        )

        daily_metric = DailyMetric(
            date=datetime.utcnow().date(),
            total_calls=total_calls,
            total_talk_time_seconds=total_talk_time,
            avg_call_duration_seconds=avg_duration,
            appointments_booked=booked_calls,
            appointments_rescheduled=1,
            appointments_cancelled=0,
            avg_satisfaction_score=round(avg_satisfaction, 1),
            calls_escalated=escalations,
            conversion_rate=round((booked_calls / total_calls) * 100, 1) if total_calls else 0,
        )
        session.add(daily_metric)

        session.commit()
        print("✅ Supabase seeded with sample dashboard data.")
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
