"""
Synthetic conversation testing using LLM-simulated customers.

These tests simulate full conversations with AI customers to validate
Eva's behavior across all MECE intent buckets.

**Usage:**

Run all simulations:
    pytest tests/simulation/test_synthetic_conversations.py -v -s -m simulation

Run specific persona:
    pytest tests/simulation/test_synthetic_conversations.py::TestSyntheticConversations::test_persona_conversation[planner_priya] -v -s -m simulation

View results:
    ls tests/simulation_results/
    cat tests/simulation_results/YYYYMMDD_HHMMSS/planner_priya.json

**Note:** These tests are SKIPPED by default (marked with @pytest.mark.simulation).
Only run when you want to actively test prompt changes or validate behavior.
"""

import pytest
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from unittest.mock import patch, Mock

from tests.simulation.customer_simulator import CustomerSimulator, PERSONAS
from tests.simulation.llm_wrapper import create_openai_simulator_callable
from messaging_service import MessagingService
from analytics import AnalyticsService
from database import Customer, Conversation
from calendar_service import get_calendar_service
from booking.manager import SlotSelectionManager


# Skip these tests unless explicitly requested
pytestmark = pytest.mark.simulation


class TestSyntheticConversations:
    """Simulate conversations with LLM-based customers across all MECE buckets."""

    @pytest.fixture(scope="class")
    def results_dir(self):
        """Create directory for simulation results."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_path = Path(__file__).parent.parent / "simulation_results" / timestamp
        results_path.mkdir(parents=True, exist_ok=True)
        return results_path

    @pytest.fixture
    def llm_callable(self):
        """Create LLM callable for customer simulator (if API key available)."""
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set - skipping LLM-based simulation")
        return create_openai_simulator_callable(model="gpt-4o", temperature=0.7)

    @pytest.mark.parametrize("persona_id", [
        "planner_priya",        # Appointment Booking
        "info_seeker_ivy",      # Information Seeking
        "juggler_jordan",       # Appointment Management
        "member_morgan",        # Operational/Account
        "curious_casey",        # Sales/Conversion
        "aftercare_alex",       # Post-Appointment
        "organizer_olivia"      # Administrative
    ])
    def test_persona_conversation(
        self,
        persona_id: str,
        db_session,
        llm_callable,
        results_dir
    ):
        """
        Simulate a full conversation with a specific customer persona.

        This test:
        1. Creates a simulated customer with MECE-aligned goal
        2. Runs ~10 message exchanges with Eva
        3. Saves full transcript to JSON
        4. Provides manual review data (no automated quality scoring yet)
        """
        # Setup simulator
        simulator = CustomerSimulator(
            persona_id=persona_id,
            model_name="gpt-4o",
            llm_callable=llm_callable
        )

        # Create real database entities
        customer = Customer(
            name=simulator.persona["name"],
            phone=f"+155555{persona_id[:6]}",
            email=f"{persona_id}@simulation.test.com"
        )
        db_session.add(customer)
        db_session.commit()

        conv = AnalyticsService.create_conversation(
            db=db_session,
            customer_id=customer.id,
            channel="sms"
        )

        transcript = []
        max_turns = 10

        print(f"\n\n{'='*70}")
        print(f"SIMULATING: {simulator.persona['name']}")
        print(f"GOAL: {simulator.persona['goal']}")
        print(f"BUCKET: {simulator.bucket}")
        print(f"{'='*70}\n")

        # Mock calendar service for testing
        with patch("messaging_service.handle_check_availability") as mock_check, \
             patch("messaging_service.handle_book_appointment") as mock_book:

            # Mock availability
            mock_check.return_value = {
                "success": True,
                "date": "2025-11-27",
                "service_type": "Botox",
                "available_slots": [
                    {"start": "14:00", "end": "14:30", "provider": "Sarah"},
                    {"start": "15:00", "end": "15:30", "provider": "Sarah"},
                    {"start": "16:00", "end": "16:30", "provider": "Sarah"}
                ],
                "suggested_slots": [
                    "2:00 PM",
                    "3:00 PM",
                    "4:00 PM"
                ]
            }

            # Mock successful booking
            mock_book.return_value = {
                "success": True,
                "event_id": "mock_event_123",
                "start_time": "2025-11-27T15:00:00",
                "service_type": "Botox",
                "provider": "Sarah"
            }

            # Run conversation
            for turn in range(max_turns):
                try:
                    # Customer sends message
                    if turn == 0:
                        customer_message = simulator.get_initial_message()
                    else:
                        # Check if conversation naturally ended
                        if self._conversation_ended(transcript):
                            print(f"\n[Conversation ended naturally after {turn} turns]")
                            break

                        customer_message = simulator.generate_response(
                            assistant_message=transcript[-1]["content"]
                        )

                    print(f"\nCustomer: {customer_message}")
                    transcript.append({"role": "customer", "content": customer_message})

                    # Add to database using the same helper as the live messaging API
                    # so booking intent flags and slot selections are tracked.
                    inbound_message = MessagingService.add_customer_message(
                        db=db_session,
                        conversation=conv,
                        content=customer_message,
                        metadata={"source": "simulation"},
                    )

                    # Capture any slot selection (e.g., "3 PM works for me") so that
                    # deterministic booking can trigger on the next turn.
                    SlotSelectionManager.capture_selection(
                        db_session, conv, inbound_message
                    )

                    # Refresh conversation to pick up any metadata changes
                    db_session.refresh(conv)

                    # Eva responds
                    eva_response, ai_message = MessagingService.generate_ai_response(
                        db=db_session,
                        conversation_id=conv.id,
                        channel="sms"
                    )

                    # If AI made tool calls, re-execute them and get followup response
                    # (tools were already executed internally in generate_ai_response,
                    # but we need to re-execute to get tool_results for followup)
                    if not eva_response and ai_message and getattr(ai_message, "tool_calls", None):
                        tool_calls = getattr(ai_message, "tool_calls", [])
                        print(f"[Tool calls detected: {len(tool_calls)} calls]")

                        tool_results = []
                        calendar_service = get_calendar_service()

                        for call in tool_calls:
                            # Re-execute tool (will be idempotent thanks to metadata checks)
                            result = MessagingService._execute_tool_call(
                                db=db_session,
                                conversation=conv,
                                customer=customer,
                                calendar_service=calendar_service,
                                call=call,
                            )
                            tool_results.append(result)

                        # Now get the followup text response
                        eva_response, _ = MessagingService.generate_followup_response(
                            db=db_session,
                            conversation_id=conv.id,
                            channel="sms",
                            assistant_message=ai_message,
                            tool_results=tool_results,
                        )

                    print(f"Eva: {eva_response}")
                    transcript.append({"role": "assistant", "content": eva_response})

                except Exception as e:
                    print(f"\n[ERROR] Conversation failed: {e}")
                    transcript.append({
                        "role": "system",
                        "content": f"ERROR: {str(e)}"
                    })
                    break

        # Save results
        self._save_results(results_dir, persona_id, transcript, simulator.persona)

        print(f"\n{'='*70}")
        print(f"CONVERSATION COMPLETE - {len(transcript)} messages")
        print(f"Results saved to: {results_dir / persona_id}.json")
        print(f"{'='*70}\n")

        # Assert basic success (conversation happened)
        assert len(transcript) >= 2, "Conversation should have at least 1 exchange"
        assert not any(msg.get("role") == "system" for msg in transcript), \
            "Conversation should not have system errors"

    def _conversation_ended(self, transcript: List[Dict]) -> bool:
        """Check if conversation naturally ended."""
        if len(transcript) < 2:
            return False

        last_customer = transcript[-2]["content"].lower() if len(transcript) >= 2 else ""

        ending_phrases = [
            "great, thank",
            "perfect, thanks",
            "sounds good",
            "see you then",
            "that's all",
            "thanks!",
            "ok thanks",
            "thank you",
            "perfect!",
            "awesome"
        ]

        return any(phrase in last_customer for phrase in ending_phrases)

    def _save_results(
        self,
        results_dir: Path,
        persona_id: str,
        transcript: List[Dict],
        persona: Dict
    ):
        """Save conversation transcript to JSON for manual review."""
        result_file = results_dir / f"{persona_id}.json"

        # Calculate basic stats
        customer_messages = [m for m in transcript if m.get("role") == "customer"]
        eva_messages = [m for m in transcript if m.get("role") == "assistant"]

        result = {
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "persona_goal": persona["goal"],
            "bucket": persona["bucket"],
            "timestamp": datetime.now().isoformat(),
            "transcript": transcript,
            "stats": {
                "total_messages": len(transcript),
                "customer_messages": len(customer_messages),
                "eva_messages": len(eva_messages),
                "completed_naturally": self._conversation_ended(transcript)
            },
            "review_notes": {
                "manual_review_required": True,
                "check_for": persona.get("preferences", {}).get("expects", {})
            }
        }

        with open(result_file, "w") as f:
            json.dump(result, f, indent=2)


@pytest.mark.simulation
def test_simulation_infrastructure():
    """Smoke test to verify simulation infrastructure is set up correctly."""
    # Verify all personas are defined
    assert len(PERSONAS) == 7, f"Expected 7 personas, got {len(PERSONAS)}"

    # Verify each persona has required fields
    for persona_id, persona in PERSONAS.items():
        assert "name" in persona, f"{persona_id} missing 'name'"
        assert "bucket" in persona, f"{persona_id} missing 'bucket'"
        assert "goal" in persona, f"{persona_id} missing 'goal'"
        assert "personality" in persona, f"{persona_id} missing 'personality'"

    # Verify CustomerSimulator can be instantiated
    sim = CustomerSimulator(persona_id="planner_priya")
    assert sim.bucket == "appointment_booking"

    # Verify it can generate initial message (without LLM)
    initial = sim.get_initial_message()
    assert isinstance(initial, str)
    assert len(initial) > 0

    print("\n✅ Simulation infrastructure verified!")
