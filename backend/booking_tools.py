"""Shared OpenAI tool definitions for booking flows."""
from __future__ import annotations

from typing import Any, Dict, List

from config import SERVICES, PROVIDERS


def get_booking_tools() -> List[Dict[str, Any]]:
    """Return the list of tool definitions available to conversational agents.

    Format matches OpenAI Chat Completions API requirements (nested 'function' object).
    """
    service_keys = list(SERVICES.keys())
    provider_keys = list(PROVIDERS.keys())

    return [
        {
            "type": "function",
            "function": {
                "name": "check_availability",
                "description": "Check available appointment slots for a specific date and service type",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {
                            "type": "string",
                            "description": "Date in YYYY-MM-DD format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": service_keys,
                            "description": "Type of service requested",
                        },
                    },
                    "required": ["date", "service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "book_appointment",
                "description": "Book an appointment for a customer",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_name": {
                            "type": "string",
                            "description": "Customer's full name",
                        },
                        "customer_phone": {
                            "type": "string",
                            "description": "Customer's phone number",
                        },
                        "customer_email": {
                            "type": "string",
                            "description": "Customer's email address",
                        },
                        "start_time": {
                            "type": "string",
                            "description": "Appointment start time in ISO 8601 format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": service_keys,
                            "description": "Type of service",
                        },
                        "provider": {
                            "type": "string",
                            "enum": provider_keys,
                            "description": "Preferred provider (optional)",
                        },
                        "notes": {
                            "type": "string",
                            "description": "Special requests or notes (optional)",
                        },
                    },
                    "required": ["customer_name", "customer_phone", "start_time", "service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_service_info",
                "description": "Get detailed information about a service including price, duration, and care instructions",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_type": {
                            "type": "string",
                            "enum": service_keys,
                            "description": "Type of service to get information about",
                        },
                    },
                    "required": ["service_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_provider_info",
                "description": "Get information about providers and their specialties",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "provider_name": {
                            "type": "string",
                            "enum": provider_keys,
                            "description": "Specific provider name (optional)",
                        }
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_customer",
                "description": "Search for an existing customer by phone number",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone": {
                            "type": "string",
                            "description": "Customer's phone number",
                        }
                    },
                    "required": ["phone"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_appointment_details",
                "description": "Look up an existing appointment by calendar event ID",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        }
                    },
                    "required": ["appointment_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "reschedule_appointment",
                "description": "Move an appointment to a new start time",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        },
                        "new_start_time": {
                            "type": "string",
                            "description": "New start time in ISO 8601 format",
                        },
                        "service_type": {
                            "type": "string",
                            "enum": service_keys,
                            "description": "Service type for duration lookup",
                        },
                        "provider": {
                            "type": "string",
                            "enum": provider_keys,
                            "description": "Preferred provider (optional)",
                        },
                    },
                    "required": ["appointment_id", "new_start_time"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_appointment",
                "description": "Cancel an existing appointment",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {
                            "type": "string",
                            "description": "Google Calendar event ID for the appointment",
                        },
                        "cancellation_reason": {
                            "type": "string",
                            "description": "Optional reason provided by customer",
                        },
                    },
                    "required": ["appointment_id"],
                },
            },
        },
    ]
