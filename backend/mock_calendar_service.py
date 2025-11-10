"""
Mock calendar service for testing without Google Calendar credentials.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import pytz


class MockCalendarService:
    """Mock calendar service that doesn't require real credentials."""

    def __init__(self):
        """Initialize mock calendar."""
        print("Using MOCK calendar service (no real appointments will be created)")

    def get_available_slots(
        self,
        date: datetime,
        service_type: str,
        duration_minutes: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Return mock available time slots."""
        if duration_minutes is None:
            duration_minutes = 60

        # Generate some mock available slots
        pacific = pytz.timezone('America/Los_Angeles')
        start_time = datetime.combine(date.date(), datetime.min.time().replace(hour=9))
        start_time = pacific.localize(start_time)

        slots = []
        for hour in [9, 10, 11, 14, 15, 16]:
            slot_start = start_time.replace(hour=hour)
            slot_end = slot_start + timedelta(minutes=duration_minutes)
            slots.append({
                'start': slot_start.isoformat(),
                'end': slot_end.isoformat(),
                'start_time': slot_start.strftime('%I:%M %p'),
                'end_time': slot_end.strftime('%I:%M %p')
            })

        return slots

    def book_appointment(
        self,
        start_time: datetime,
        end_time: datetime,
        customer_name: str,
        customer_email: str,
        customer_phone: str,
        service_type: str,
        provider: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[str]:
        """Mock book appointment - just return a fake event ID."""
        print(f"MOCK: Booking appointment for {customer_name} at {start_time}")
        return f"mock_event_{datetime.now().timestamp()}"

    def cancel_appointment(self, event_id: str) -> bool:
        """Mock cancel appointment."""
        print(f"MOCK: Cancelling appointment {event_id}")
        return True

    def reschedule_appointment(
        self,
        event_id: str,
        new_start_time: datetime,
        new_end_time: datetime
    ) -> bool:
        """Mock reschedule appointment."""
        print(f"MOCK: Rescheduling appointment {event_id}")
        return True

    def get_appointment_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Mock get appointment details."""
        return {
            'id': event_id,
            'summary': 'Mock Appointment',
            'description': 'This is a mock appointment',
            'start': datetime.now(),
            'end': datetime.now() + timedelta(hours=1),
            'status': 'confirmed'
        }


def get_mock_calendar_service() -> MockCalendarService:
    """Get mock calendar service instance."""
    return MockCalendarService()
