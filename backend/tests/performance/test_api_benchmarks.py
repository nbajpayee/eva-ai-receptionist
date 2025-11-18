"""
API response time benchmarks using pytest-benchmark.

Run with: pytest -m performance --benchmark-only
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import patch
import pytest

from booking_handlers import handle_check_availability, handle_book_appointment
from analytics import AnalyticsService


@pytest.mark.performance
@pytest.mark.benchmark
class TestAPIBenchmarks:
    """Benchmark critical API operations."""

    def test_check_availability_performance(self, benchmark, db_session):
        """Benchmark check_availability execution time."""

        @patch("calendar_service.CalendarService.check_availability")
        def run_check(mock_check):
            mock_check.return_value = {
                "success": True,
                "available_slots": [],
            }
            return handle_check_availability(
                db_session,
                date="2025-11-20",
                service_type="botox",
            )

        result = benchmark(run_check)
        assert result is not None

    def test_book_appointment_performance(self, benchmark, db_session, customer):
        """Benchmark book_appointment execution time."""

        @patch("calendar_service.CalendarService.book_appointment")
        def run_book(mock_book):
            mock_book.return_value = {
                "success": True,
                "event_id": "evt-benchmark",
            }
            return handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

        result = benchmark(run_book)
        assert result is not None

    def test_create_conversation_performance(self, benchmark, db_session, customer):
        """Benchmark conversation creation."""

        def create_conv():
            return AnalyticsService.create_conversation(
                db=db_session,
                customer_id=customer.id,
                channel="voice",
                metadata={"session_id": "benchmark-test"},
            )

        result = benchmark(create_conv)
        assert result is not None

    def test_add_message_performance(self, benchmark, db_session, voice_conversation):
        """Benchmark message addition."""

        def add_msg():
            return AnalyticsService.add_message(
                db=db_session,
                conversation_id=voice_conversation.id,
                direction="inbound",
                content="Benchmark test message",
                metadata={"source": "benchmark"},
            )

        result = benchmark(add_msg)
        assert result is not None

    def test_customer_lookup_performance(self, benchmark, db_session, customer):
        """Benchmark customer lookup by phone."""
        from database import Customer

        def lookup():
            return db_session.query(Customer).filter(
                Customer.phone == customer.phone
            ).first()

        result = benchmark(lookup)
        assert result is not None

    def test_appointment_query_performance(self, benchmark, db_session, customer):
        """Benchmark appointment queries."""
        from database import Appointment
        from datetime import datetime, timedelta

        # Create test appointments
        for i in range(10):
            appt = Appointment(
                customer_id=customer.id,
                appointment_datetime=datetime.utcnow() + timedelta(days=i),
                service_type="botox",
            )
            db_session.add(appt)
        db_session.commit()

        def query_appointments():
            return db_session.query(Appointment).filter(
                Appointment.customer_id == customer.id
            ).all()

        result = benchmark(query_appointments)
        assert len(result) >= 10

    def test_conversation_history_performance(self, benchmark, db_session, voice_conversation):
        """Benchmark conversation history retrieval."""
        from database import CommunicationMessage

        # Add messages
        for i in range(50):
            msg = AnalyticsService.add_message(
                db=db_session,
                conversation_id=voice_conversation.id,
                direction="inbound" if i % 2 == 0 else "outbound",
                content=f"Message {i}",
                metadata={"index": i},
            )

        def get_history():
            return db_session.query(CommunicationMessage).filter(
                CommunicationMessage.conversation_id == voice_conversation.id
            ).all()

        result = benchmark(get_history)
        assert len(result) >= 50

    def test_database_write_performance(self, benchmark, db_session):
        """Benchmark database write operations."""
        from database import Customer

        def create_customer():
            customer = Customer(
                name="Benchmark User",
                phone=f"+1555{benchmark.__name__[:7]}",
                email=f"bench-{benchmark.__name__[:5]}@example.com",
            )
            db_session.add(customer)
            db_session.commit()
            return customer

        result = benchmark(create_customer)
        assert result.id is not None
