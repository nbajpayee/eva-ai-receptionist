"""Google Calendar integration service for managing appointments."""
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

try:  # pragma: no cover - import guard for optional dependency environments
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError  # type: ignore
    GOOGLE_API_IMPORT_ERROR: Optional[Exception] = None
except Exception as exc:  # noqa: BLE001 - capture environment issues early
    Request = None  # type: ignore[assignment]
    Credentials = None  # type: ignore[assignment]
    InstalledAppFlow = None  # type: ignore[assignment]
    build = None  # type: ignore[assignment]

    class HttpError(Exception):  # type: ignore[no-redef]
        """Fallback HttpError placeholder when Google API client is unavailable."""

        pass

    GOOGLE_API_IMPORT_ERROR = exc

import pytz

from config import get_settings, SERVICES

settings = get_settings()
logger = logging.getLogger(__name__)

# If modifying these scopes, delete the token.json file.
SCOPES = ['https://www.googleapis.com/auth/calendar']

EASTERN_TZ = pytz.timezone('America/New_York')


def _resolve_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_absolute():
        return path
    return Path(__file__).resolve().parent / path


def _credentials_available() -> bool:
    creds_path = _resolve_path(settings.GOOGLE_CREDENTIALS_FILE)
    token_path = _resolve_path(settings.GOOGLE_TOKEN_FILE)
    return creds_path.exists() and token_path.exists()


class GoogleCalendarService:
    """Service for interacting with Google Calendar API."""

    def __init__(self):
        """Initialize the Google Calendar service."""
        if GOOGLE_API_IMPORT_ERROR is not None:
            message = (
                "Google Calendar dependencies could not be imported. "
                "See nested exception for details."
            )
            logger.error(message, exc_info=GOOGLE_API_IMPORT_ERROR)
            raise RuntimeError(message) from GOOGLE_API_IMPORT_ERROR

        self.creds = None
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Calendar API."""
        # The file token.json stores the user's access and refresh tokens
        credentials_path = _resolve_path(settings.GOOGLE_CREDENTIALS_FILE)
        token_path = _resolve_path(settings.GOOGLE_TOKEN_FILE)

        if token_path.exists():
            self.creds = Credentials.from_authorized_user_file(
                str(token_path), SCOPES
            )

        # If there are no (valid) credentials available, let the user log in
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                logger.info("Refreshing expired Google Calendar credentials")
                self.creds.refresh(Request())
            else:
                if not credentials_path.exists():
                    message = (
                        "Google credentials file not found: "
                        f"{credentials_path}"
                    )
                    logger.error(message)
                    raise FileNotFoundError(message)
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(credentials_path), SCOPES
                )
                self.creds = flow.run_local_server(port=0)

            # Save the credentials for the next run
            with open(token_path, 'w') as token:
                token.write(self.creds.to_json())
                logger.info("Saved new Google Calendar OAuth token to %s", token_path)

        self.service = build('calendar', 'v3', credentials=self.creds)
        logger.info("Initialized Google Calendar service client")

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
        if not _credentials_available():
            logger.warning(
                "Google Calendar credentials unavailable – returning no slots for %s on %s",
                service_type,
                date.strftime("%Y-%m-%d"),
            )
            return []

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

            # Make timezone aware (using Eastern time)
            start_time = EASTERN_TZ.localize(start_time)
            end_time = EASTERN_TZ.localize(end_time)

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
                    'start': datetime.fromisoformat(start.replace('Z', '+00:00')).astimezone(EASTERN_TZ),
                    'end': datetime.fromisoformat(end.replace('Z', '+00:00')).astimezone(EASTERN_TZ)
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
            logger.exception("Google Calendar API error while fetching slots: %s", error)
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
            summary = f'{service_name} - {customer_name}'
            event = {
                'summary': summary,
                'description': f"""
Service: {service_name}
Customer: {customer_name}
Phone: {customer_phone}
Email: {customer_email}
Provider: {provider or 'Not specified'}
Notes: {notes or 'None'}
""".strip(),
                'start': {
                    'dateTime': start_time.astimezone(EASTERN_TZ).isoformat(),
                    'timeZone': 'America/New_York',
                },
                'end': {
                    'dateTime': end_time.astimezone(EASTERN_TZ).isoformat(),
                    'timeZone': 'America/New_York',
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

            event_id = event.get('id')
            if event_id:
                return event_id

            logger.warning(
                "Google Calendar insert returned without an event ID; attempting fallback lookup."
            )
            return self._find_existing_event(
                start_time=start_time,
                end_time=end_time,
                summary=summary,
            )

        except HttpError as error:
            logger.exception("Google Calendar API booking error: %s", error)
            fallback_id = self._find_existing_event(
                start_time=start_time,
                end_time=end_time,
                summary=summary,
            )
            if fallback_id:
                logger.warning(
                    "Google Calendar reported an error but matching event exists; treating as success."
                )
                return fallback_id
            return None

    def _find_existing_event(
        self,
        *,
        start_time: datetime,
        end_time: datetime,
        summary: str,
    ) -> Optional[str]:
        """Best-effort search for an event matching the requested booking details."""
        window_start = (start_time - timedelta(minutes=1)).astimezone(EASTERN_TZ)
        window_end = (end_time + timedelta(minutes=1)).astimezone(EASTERN_TZ)

        try:
            events_result = self.service.events().list(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                timeMin=window_start.isoformat(),
                timeMax=window_end.isoformat(),
                singleEvents=True,
                orderBy='startTime',
            ).execute()
        except HttpError as lookup_error:  # pragma: no cover - defensive
            logger.exception(
                "Google Calendar fallback lookup failed: %s", lookup_error
            )
            return None

        for event in events_result.get('items', []):
            event_id = event.get('id')
            if not event_id:
                continue

            event_summary = event.get('summary') or ""
            if event_summary.strip() != summary.strip():
                continue

            raw_start = event.get('start', {}).get('dateTime') or event.get('start', {}).get('date')
            if not raw_start:
                continue

            try:
                event_start = datetime.fromisoformat(raw_start.replace('Z', '+00:00'))
            except ValueError:
                continue

            if abs((event_start.astimezone(EASTERN_TZ) - start_time.astimezone(EASTERN_TZ)).total_seconds()) <= 60:
                return event_id

        return None

    def cancel_appointment(self, event_id: str) -> bool:
        """Cancel an appointment in Google Calendar."""
        try:
            self.service.events().delete(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id
            ).execute()
            return True

        except HttpError as error:
            logger.exception("Google Calendar API cancellation error: %s", error)
            return False

    def reschedule_appointment(
        self,
        event_id: str,
        new_start_time: datetime,
        new_end_time: datetime
    ) -> bool:
        """Reschedule an existing appointment."""
        try:
            event = self.service.events().get(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id
            ).execute()

            event['start'] = {
                'dateTime': new_start_time.isoformat(),
                'timeZone': 'America/Los_Angeles',
            }
            event['end'] = {
                'dateTime': new_end_time.isoformat(),
                'timeZone': 'America/Los_Angeles',
            }

            self.service.events().update(
                calendarId=settings.GOOGLE_CALENDAR_ID,
                eventId=event_id,
                body=event
            ).execute()

            return True

        except HttpError as error:
            logger.exception("Google Calendar API reschedule error: %s", error)
            return False

    def get_appointment_details(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get details of an appointment."""
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
            logger.exception("Google Calendar API details fetch error: %s", error)
            return None


# Singleton instance
_calendar_service: Optional[GoogleCalendarService] = None


def get_calendar_service() -> GoogleCalendarService:
    """Get or create calendar service instance."""
    global _calendar_service
    if _calendar_service is None:
        _calendar_service = GoogleCalendarService()
    return _calendar_service


def check_calendar_credentials() -> Dict[str, Any]:
    """Validate Google Calendar credential and token availability."""
    credentials_path = _resolve_path(settings.GOOGLE_CREDENTIALS_FILE)
    token_path = _resolve_path(settings.GOOGLE_TOKEN_FILE)

    status: Dict[str, Any] = {
        "dependencies_ok": GOOGLE_API_IMPORT_ERROR is None,
        "credentials_file": {
            "path": str(credentials_path),
            "exists": credentials_path.exists(),
        },
        "token_file": {
            "path": str(token_path),
            "exists": token_path.exists(),
            "valid": False,
            "needs_refresh": False,
        },
        "ok": False,
    }

    if GOOGLE_API_IMPORT_ERROR is not None:
        status["error"] = str(GOOGLE_API_IMPORT_ERROR)
        logger.error(
            "Google Calendar dependencies missing or incompatible: %s",
            GOOGLE_API_IMPORT_ERROR,
        )
        return status

    credential_path = credentials_path
    token_file_path = token_path

    if not status["credentials_file"]["exists"]:
        logger.error("Google Calendar credentials file missing at %s", credential_path)
    else:
        logger.debug("Google Calendar credentials file located at %s", credential_path)

    if status["token_file"]["exists"]:
        try:
            creds = Credentials.from_authorized_user_file(str(token_file_path), SCOPES)
            if creds.valid:
                status["token_file"]["valid"] = True
                logger.debug("Google Calendar OAuth token is valid")
            elif creds.expired and creds.refresh_token:
                status["token_file"]["needs_refresh"] = True
                logger.warning("Google Calendar OAuth token expired; refresh required")
            else:
                logger.error(
                    "Google Calendar OAuth token invalid and cannot be refreshed"
                )
        except Exception as exc:  # noqa: BLE001
            status["token_file"]["error"] = str(exc)
            logger.exception(
                "Failed to load Google Calendar token from %s: %s", token_file_path, exc
            )
    else:
        logger.warning("Google Calendar token file missing at %s", token_file_path)

    status["ok"] = (
        status["dependencies_ok"]
        and status["credentials_file"]["exists"]
        and (
            status["token_file"]["valid"]
            or status["token_file"]["needs_refresh"]
        )
    )

    if status["ok"]:
        logger.info("Google Calendar credentials validated successfully")
    else:
        logger.warning("Google Calendar credentials require attention: %s", status)

    return status
