"""Regression-style tests driven by golden_scenarios.json.

These are intentionally light-weight and focus on enforcing a few
critical behavioral invariants using the golden scenarios as a source
of truth.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from messaging_service import MessagingService


FIXTURES_DIR = Path(__file__).parent / "fixtures"
GOLDEN_PATH = FIXTURES_DIR / "golden_scenarios.json"


@pytest.fixture(scope="session")
def golden_scenarios() -> dict:
    """Load the golden_scenarios.json fixture once per test session."""
    with GOLDEN_PATH.open() as f:
        data = json.load(f)
    assert "scenarios" in data and isinstance(data["scenarios"], list)
    return data


def _get_scenario(golden_scenarios: dict, scenario_id: str) -> dict:
    for scenario in golden_scenarios["scenarios"]:
        if scenario.get("id") == scenario_id:
            return scenario
    raise KeyError(f"Scenario id not found: {scenario_id}")


def _make_simple_conversation(last_text: str):
    """Create a minimal conversation-like object for internal helpers.

    We don't need a real SQLAlchemy Conversation here; MessagingService
    helpers only expect a few attributes: messages, initiated_at,
    last_activity_at, and custom_metadata. Messages only need direction
    and content.
    """

    now = datetime.utcnow()
    conv = SimpleNamespace()
    conv.initiated_at = now
    conv.last_activity_at = now
    conv.custom_metadata = {}
    conv.messages = [
        SimpleNamespace(
            direction="inbound",
            content=last_text,
            sent_at=now,
        )
    ]
    return conv


class TestRelativeDateEnforcement:
    """Ensure long-range relative dates do not trigger preemptive checks.

    These tests tie directly to the golden scenarios that describe
    behaviour for phrases like "next week" and "in 3 weeks".
    """

    @patch("messaging_service.SlotSelectionManager.get_pending_slot_offers")
    def test_next_week_without_day_does_not_force_enforcement(
        self, mock_pending, golden_scenarios
    ) -> None:
        """Scenario book_next_week_ambiguous_11.

        When the guest says "next week" without a specific day, we should
        *not* force preemptive availability enforcement. Instead, the
        assistant is expected to ask which day they prefer.
        """

        scenario = _get_scenario(golden_scenarios, "book_next_week_ambiguous_11")
        user_turn = scenario["conversation"][0]
        assert user_turn["role"] == "user"

        mock_pending.return_value = None
        conv = _make_simple_conversation(user_turn["content"])

        # db argument is unused in _requires_availability_enforcement when
        # get_pending_slot_offers is patched, so we can pass None.
        should_force = MessagingService._requires_availability_enforcement(
            None, conv
        )

        # Golden success criteria says no_preemptive_check should be true.
        assert scenario["success_criteria"].get("no_preemptive_check") is True
        assert (
            should_force is False
        ), "Expected no preemptive availability enforcement for bare 'next week'"

    @patch("messaging_service.SlotSelectionManager.get_pending_slot_offers")
    def test_long_range_relative_does_not_force_enforcement(
        self, mock_pending, golden_scenarios
    ) -> None:
        """Scenario book_long_range_relative_12.

        For phrases like "in 3 weeks", we should also avoid preemptive
        enforcement so the assistant can clarify a specific date first.
        """

        scenario = _get_scenario(golden_scenarios, "book_long_range_relative_12")
        user_turn = scenario["conversation"][0]
        assert user_turn["role"] == "user"

        # Sanity check that this scenario really is a long-range relative phrase.
        assert re.search(r"\bin\s+\d+\s+weeks?\b", user_turn["content"].lower())

        mock_pending.return_value = None
        conv = _make_simple_conversation(user_turn["content"])

        should_force = MessagingService._requires_availability_enforcement(
            None, conv
        )

        assert scenario["success_criteria"].get("no_preemptive_check") is True
        assert (
            should_force is False
        ), "Expected no preemptive availability enforcement for 'in 3 weeks'"


class TestPostBookingEnforcement:
    """Ensure we do not re-enforce availability after a successful booking.

    This is a lightweight guardrail for the "Liam 3 PM" style bug where the
    system must *not* re-check availability or claim the booked time is
    unavailable after `last_appointment` is recorded as scheduled and the
    guest only sends a neutral acknowledgement like "ok".
    """

    @patch("messaging_service.SlotSelectionManager.get_pending_slot_offers")
    def test_scheduled_last_appointment_blocks_forced_enforcement(
        self, mock_pending, golden_scenarios
    ) -> None:
        """Scenario manage_liam_post_booking_20.

        When custom_metadata.last_appointment.status == "scheduled" and the
        latest user message contains no reschedule/cancel keywords (e.g. just
        "ok"), `_requires_availability_enforcement` should return False so we
        do not run another forced availability check.
        """

        scenario = _get_scenario(golden_scenarios, "manage_liam_post_booking_20")
        assert scenario["success_criteria"].get("no_post_booking_recheck") is True

        mock_pending.return_value = None

        now = datetime.utcnow()
        conv = SimpleNamespace()
        conv.initiated_at = now
        conv.last_activity_at = now
        # Simulate a scheduled last appointment and a simple "ok" reply.
        conv.custom_metadata = {
            "last_appointment": {
                "status": "scheduled",
                "start_time": "2025-11-20T15:00:00",
            }
        }
        conv.messages = [
            SimpleNamespace(
                direction="inbound",
                content="ok",
                sent_at=now,
            )
        ]

        should_force = MessagingService._requires_availability_enforcement(
            None, conv
        )

        assert (
            should_force is False
        ), "Expected no forced availability after a scheduled last appointment and neutral 'ok'"


class TestIndecisiveServiceSelection:
    """Ensure we do not auto-pick a service for indecisive skin concerns.

    This guards against the old behavior where Botox might be assumed when a
    guest only says they want to "do something for my skin" without naming a
    treatment.
    """

    def test_indecisive_customer_does_not_default_service(self, golden_scenarios) -> None:
        """Scenario book_indecisive_service_10.

        `_extract_booking_params` should *not* infer a `service_type` when the
        latest messages only express vague goals and do not mention any
        concrete service keyword.
        """

        scenario = _get_scenario(golden_scenarios, "book_indecisive_service_10")
        assert scenario["success_criteria"].get("no_auto_service_selection") is True

        # Conversation where the user is only expressing general skin goals.
        user_turn = scenario["conversation"][0]
        now = datetime.utcnow()
        conv = SimpleNamespace()
        conv.initiated_at = now
        conv.last_activity_at = now
        conv.custom_metadata = {}
        conv.channel = "sms"
        conv.messages = [
            SimpleNamespace(
                direction="inbound",
                content=user_turn["content"],
                sent_at=now,
            )
        ]

        with patch(
            "messaging_service.SlotSelectionManager.conversation_metadata",
            return_value={},
        ) as mock_metadata, patch(
            "messaging_service.SettingsService.get_services_dict",
            return_value={
                "botox": {},
                "filler": {},
                "hydrafacial": {},
            },
        ) as mock_services:
            # db is unused because services and metadata are patched.
            date, service_type = MessagingService._extract_booking_params(None, conv)

        mock_metadata.assert_called_once()
        mock_services.assert_called_once()

        # We should have a valid date but *no* inferred service type.
        assert isinstance(date, str) and date
        assert (
            service_type is None
        ), "Expected no auto-selected service for indecisive skin request"
