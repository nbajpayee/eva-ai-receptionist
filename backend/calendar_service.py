"""
Google Calendar integration service for managing appointments.
"""
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pytz
from config import get_settings, SERVICES

settings = get_settings()

# If modifying these scopes, delete the token.json file.
SCOPES = ['https://www.googleapis.com/auth/calendar']


class GoogleCalendarService:
    """Service for interacting with Google Calendar API."""

    def __init__(self):
        """Initialize the Google Calendar service."""
        self.creds = None
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Calendar API."""
        # The file token.json stores the user's access and refresh tokens
        if os.path.exists(settings.GOOGLE_TOKEN_FILE):
            self.creds = Credentials.from_authorized_user_file(
                settings.GOOGLE_TOKEN_FILE, SCOPES
            )

        # If there are no (valid) credentials available, let the user log in
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                if not os.path.exists(settings.GOOGLE_CREDENTIALS_FILE):
                    raise FileNotFoundError(
                        f"Google credentials file not found: {settings.GOOGLE_CREDENTIALS_FILE}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    settings.GOOGLE_CREDENTIALS_FILE, SCOPES
                )
                self.creds = flow.run_local_server(port=0)

            # Save the credentials for the next run
            with open(settings.GOOGLE_TOKEN_FILE, 'w') as token:
                token.write(self.creds.to_json())

        self.service = build('calendar', 'v3', credentials=self.creds)

    def get_available_slots(
        self,
        date: datetime,
        service_type: str,
        duration_minutes: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get available time slots for a specific date and service.

        Args:
            date: The date to check availability
            service_type: Type of service (key from SERVICES config)
            duration_minutes: Duration override, uses service default if not provided

        Returns:
            List of available time slots with start and end times
        """
        try:
            # Get service duration
            if duration_minutes is None:
                service = SERVICES.get(service_type)
                if not service:
                    raise ValueError(f"Unknown service type: {service_type}")
                duration_minutes = service["duration_minutes"]

            # Define business hours (9 AM to 7 PM)
            start_time = datetime.combine(date.date(), datetime.min.time().replace(hour=9))
            end_time = datetime.combine(date.date(), datetime.min.time().replace(hour=19))

            # Make timezone aware (using PST/PDT)
            pacific = pytz.timezone('America/Los_Angeles')
            start_time = pacific.localize(start_time)
            end_time = pacific.localize(end_time)

            # Get existing events for the day
            events_result = self.service.events().list(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                timeMin=start_time.isoformat(),
                timeMax=end_time.isoformat(),
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            # Convert events to busy periods
            busy_periods = []
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                end = event['end'].get('dateTime', event['end'].get('date'))
                busy_periods.append({
                    'start': datetime.fromisoformat(start.replace('Z', '+00:00')),
                    'end': datetime.fromisoformat(end.replace('Z', '+00:00'))
                })

            # Generate available slots
            available_slots = []
            current_time = start_time
            slot_duration = timedelta(minutes=duration_minutes)

            while current_time + slot_duration <= end_time:
                slot_end = current_time + slot_duration

                # Check if slot overlaps with any busy period
                is_available = True
                for busy in busy_periods:
                    if (current_time < busy['end'] and slot_end > busy['start']):
                        is_available = False
                        # Jump to end of busy period
                        current_time = busy['end']
                        break

                if is_available:
                    available_slots.append({
                        'start': current_time.isoformat(),
                        'end': slot_end.isoformat(),
                        'start_time': current_time.strftime('%I:%M %p'),
                        'end_time': slot_end.strftime('%I:%M %p')
                    })
                    current_time += timedelta(minutes=30)  # Move to next 30-min interval
                else:
                    continue

            return available_slots

        except HttpError as error:
            print(f"An error occurred: {error}")
            return []

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
        """
        Book an appointment in Google Calendar.

        Args:
            start_time: Appointment start time
            end_time: Appointment end time
            customer_name: Customer's name
            customer_email: Customer's email
            customer_phone: Customer's phone number
            service_type: Type of service
            provider: Provider name (optional)
            notes: Special requests or notes

        Returns:
            Google Calendar event ID if successful, None otherwise
        """
        try:
            service_info = SERVICES.get(service_type, {})
            service_name = service_info.get('name', service_type)

            # Create event
            event = {
                'summary': f'{service_name} - {customer_name}',
                'description': f"""
Service: {service_name}
Customer: {customer_name}
Phone: {customer_phone}
Email: {customer_email}
Provider: {provider or 'Not specified'}
Notes: {notes or 'None'}
""".strip(),
                'start': {
                    'dateTime': start_time.isoformat(),
                    'timeZone': 'America/Los_Angeles',
                },
                'end': {
                    'dateTime': end_time.isoformat(),
                    'timeZone': 'America/Los_Angeles',
                },
                'attendees': [
                    {'email': customer_email} if customer_email else None
                ],
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 60},  # 1 hour before
                    ],
                },
            }

            # Remove None attendees
            event['attendees'] = [a for a in event['attendees'] if a is not None]

            # Insert event
            event = self.service.events().insert(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                body=event
            ).execute()

            return event.get('id')

        except HttpError as error:
            print(f"An error occurred: {error}")
            return None

    def cancel_appointment(self, event_id: str) -> bool:
        """
        Cancel an appointment in Google Calendar.

        Args:
            event_id: Google Calendar event ID

        Returns:
            True if successful, False otherwise
        """
        try:
            self.service.events().delete(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id
            ).execute()
            return True

        except HttpError as error:
            print(f"An error occurred: {error}")
            return False

    def reschedule_appointment(
        self,
        event_id: str,
        new_start_time: datetime,
        new_end_time: datetime
    ) -> bool:
        """
        Reschedule an existing appointment.

        Args:
            event_id: Google Calendar event ID
            new_start_time: New start time
            new_end_time: New end time

        Returns:
            True if successful, False otherwise
        """
        try:
            # Get existing event
            event = self.service.events().get(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id
            ).execute()

            # Update times
            event['start'] = {
                'dateTime': new_start_time.isoformat(),
                'timeZone': 'America/Los_Angeles',
            }
            event['end'] = {
                'dateTime': new_end_time.isoformat(),
                'timeZone': 'America/Los_Angeles',
            }

            # Update event
            self.service.events().update(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id,
                body=event
            ).execute()

            return True

        except HttpError as error:
            print(f"An error occurred: {error}")
            return False

    def get_appointment_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details of an appointment.

        Args:
            event_id: Google Calendar event ID

        Returns:
            Appointment details dictionary or None
        """
        try:
            event = self.service.events().get(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id
            ).execute()

            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))

            return {
                'id': event['id'],
                'summary': event.get('summary', ''),
                'description': event.get('description', ''),
                'start': datetime.fromisoformat(start.replace('Z', '+00:00')),
                'end': datetime.fromisoformat(end.replace('Z', '+00:00')),
                'status': event.get('status', '')
            }

        except HttpError as error:
            print(f"An error occurred: {error}")
            return None


# Singleton instance
_calendar_service: Optional[GoogleCalendarService] = None


def get_calendar_service() -> GoogleCalendarService:
    """Get or create calendar service instance."""
    global _calendar_service
    if _calendar_service is None:
        _calendar_service = GoogleCalendarService()
    return _calendar_service
