"""Seed demo customers and appointments for scripted walkthroughs.

This script creates or updates a small set of customers and appointments
scheduled for the next day so the calendar dashboard and messaging demos
have realistic data to reference.

Usage:
    poetry run python backend/scripts/seed_demo_appointments.py

The script is idempotent: running it multiple times will keep the same
calendar event identifiers but refresh appointment details and timestamps.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Tuple

import pytz

from backend.config import SERVICES
from backend.database import Appointment, Customer, SessionLocal

PACIFIC = pytz.timezone("America/Los_Angeles")


def _ensure_customer(session, *, name: str, phone: str, email: str) -> Customer:
    customer = session.query(Customer).filter(Customer.phone == phone).first()
    if customer:
        # Keep contact info fresh for repeated seeds
        customer.name = name
        customer.email = email
        customer.is_new_client = False
        return customer

    customer = Customer(
        name=name,
        phone=phone,
        email=email,
        is_new_client=False,
    )
    session.add(customer)
    session.flush()
    return customer


def _ensure_appointment(
    session,
    *,
    customer: Customer,
    calendar_event_id: str,
    start_time: datetime,
    service_type: str,
    provider: str,
    notes: str | None = None,
) -> Appointment:
    duration = SERVICES.get(service_type, {}).get("duration_minutes", 60)

    appointment = (
        session.query(Appointment)
        .filter(Appointment.calendar_event_id == calendar_event_id)
        .first()
    )

    if appointment is None:
        appointment = Appointment(
            calendar_event_id=calendar_event_id,
            customer_id=customer.id,
            appointment_datetime=start_time,
            service_type=service_type,
            provider=provider,
            duration_minutes=duration,
            status="scheduled",
            booked_by="ai",
            special_requests=notes,
        )
        session.add(appointment)
    else:
        appointment.customer_id = customer.id
        appointment.appointment_datetime = start_time
        appointment.service_type = service_type
        appointment.provider = provider
        appointment.duration_minutes = duration
        appointment.status = "scheduled"
        appointment.booked_by = "ai"
        appointment.special_requests = notes
        appointment.cancellation_reason = None
        appointment.cancelled_at = None

    return appointment


def seed_demo_data(session) -> Tuple[int, int]:
    tomorrow = datetime.now(PACIFIC).date() + timedelta(days=1)

    demo_scenarios: Iterable[dict] = (
        {
            "label": "voice_booking",
            "customer": {
                "name": "Jamie Rivera",
                "phone": "+13105550001",
                "email": "jamie.rivera@example.com",
            },
            "service_type": "hydrafacial",
            "provider": "nurse_johnson",
            "hour": 10,
            "notes": "Requested hydrating serum add-on",
        },
        {
            "label": "sms_reschedule",
            "customer": {
                "name": "Avery Chen",
                "phone": "+13105550002",
                "email": "avery.chen@example.com",
            },
            "service_type": "botox",
            "provider": "dr_smith",
            "hour": 13,
            "notes": "Follow-up visit from August",
        },
        {
            "label": "email_cancel",
            "customer": {
                "name": "Jordan Patel",
                "phone": "+13105550003",
                "email": "jordan.patel@example.com",
            },
            "service_type": "microneedling",
            "provider": "nurse_kelly",
            "hour": 16,
            "notes": "Prefers topical numbing",
        },
    )

    customers_seeded = 0
    appointments_seeded = 0

    for scenario in demo_scenarios:
        start_naive = datetime.combine(
            tomorrow, datetime.min.time().replace(hour=scenario["hour"], minute=0)
        )
        start_time = PACIFIC.localize(start_naive)

        customer_info = scenario["customer"]
        customer = _ensure_customer(
            session,
            name=customer_info["name"],
            phone=customer_info["phone"],
            email=customer_info["email"],
        )
        customers_seeded += 1

        appointment = _ensure_appointment(
            session,
            customer=customer,
            calendar_event_id=f"demo-{scenario['label']}",
            start_time=start_time,
            service_type=scenario["service_type"],
            provider=scenario["provider"],
            notes=scenario.get("notes"),
        )
        appointment.special_requests = scenario.get("notes")
        appointments_seeded += 1

    session.commit()
    return customers_seeded, appointments_seeded


def main() -> None:
    session = SessionLocal()
    try:
        customers, appointments = seed_demo_data(session)
        print(
            f"Seeded {customers} customers and {appointments} appointments for the demo day (tomorrow Pacific time)."
        )
        print("Event IDs:")
        print("  - demo-voice_booking")
        print("  - demo-sms_reschedule")
        print("  - demo-email_cancel")
    finally:
        session.close()


if __name__ == "__main__":
    main()
