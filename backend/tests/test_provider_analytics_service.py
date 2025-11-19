"""
Tests for provider analytics service.

Test coverage:
- Calculating provider metrics
- Getting provider summaries
- Performance trends
- Provider rankings
- Service performance breakdown
- N+1 query prevention verification
"""
import pytest
import uuid
from datetime import datetime, timedelta, date
from unittest.mock import patch, MagicMock

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).resolve().parents[1]
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from provider_analytics_service import ProviderAnalyticsService
from database import (
    Provider, InPersonConsultation, Appointment, Customer,
    ProviderPerformanceMetric, SessionLocal, Base, engine
)


@pytest.fixture
def db_session():
    """Create a test database session."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def analytics_service(db_session):
    """Create analytics service instance."""
    return ProviderAnalyticsService(db_session)


@pytest.fixture
def sample_providers(db_session):
    """Create sample providers."""
    providers = [
        Provider(
            id=uuid.uuid4(),
            name=f"Provider {i}",
            email=f"provider{i}@example.com",
            specialties=["Botox", "Fillers"],
            is_active=True
        )
        for i in range(3)
    ]
    db_session.add_all(providers)
    db_session.commit()
    for p in providers:
        db_session.refresh(p)
    return providers


@pytest.fixture
def sample_customer(db_session):
    """Create a sample customer."""
    customer = Customer(
        name="Test Customer",
        phone="555-0100",
        email="customer@example.com"
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


class TestProviderAnalyticsService:
    """Test suite for ProviderAnalyticsService."""

    def test_calculate_metrics_empty_period(self, analytics_service, sample_providers):
        """Test calculating metrics for a period with no consultations."""
        provider = sample_providers[0]
        today = datetime.utcnow()

        metric = analytics_service.calculate_provider_metrics(
            provider_id=str(provider.id),
            start_date=today,
            end_date=today + timedelta(days=1),
            period_type="daily"
        )

        assert metric.total_consultations == 0
        assert metric.successful_bookings == 0
        assert metric.conversion_rate == 0.0
        assert metric.total_revenue == 0.0

    def test_calculate_metrics_with_consultations(self, analytics_service, sample_providers, db_session):
        """Test calculating metrics with consultations."""
        provider = sample_providers[0]
        today = datetime.utcnow()

        # Create consultations
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                service_type="Botox",
                outcome="booked" if i < 3 else "declined",
                satisfaction_score=8.5,
                duration_seconds=600,
                created_at=today
            )
            db_session.add(consultation)

        db_session.commit()

        metric = analytics_service.calculate_provider_metrics(
            provider_id=str(provider.id),
            start_date=today - timedelta(hours=1),
            end_date=today + timedelta(days=1),
            period_type="daily"
        )

        assert metric.total_consultations == 5
        assert metric.successful_bookings == 3
        assert metric.conversion_rate == 60.0
        assert metric.avg_consultation_duration_seconds == 600
        assert metric.avg_satisfaction_score == 8.5

    @patch('provider_analytics_service.get_settings')
    def test_calculate_revenue(self, mock_settings, analytics_service, sample_providers, db_session, sample_customer):
        """Test revenue calculation with appointments."""
        # Mock settings
        mock_config = MagicMock()
        mock_config.SERVICES = {
            "Botox": {"price_range": "$500-800"},
            "Fillers": {"price_range": "$1000"}
        }
        mock_settings.return_value = mock_config

        provider = sample_providers[0]
        today = datetime.utcnow()

        # Create appointments
        appointments = []
        for service, count in [("Botox", 2), ("Fillers", 1)]:
            for _ in range(count):
                appt = Appointment(
                    customer_id=sample_customer.id,
                    service_type=service,
                    appointment_datetime=today + timedelta(days=7),
                    status="scheduled"
                )
                db_session.add(appt)
                db_session.flush()
                appointments.append(appt)

        # Create consultations linked to appointments
        for appt in appointments:
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                appointment_id=appt.id,
                service_type=appt.service_type,
                outcome="booked",
                created_at=today
            )
            db_session.add(consultation)

        db_session.commit()

        metric = analytics_service.calculate_provider_metrics(
            provider_id=str(provider.id),
            start_date=today - timedelta(hours=1),
            end_date=today + timedelta(days=1),
            period_type="daily"
        )

        # Expected: 2 * $650 (avg of 500-800) + 1 * $1000 = $2300
        assert metric.total_revenue == 2300.0

    def test_no_n_plus_one_in_calculate_metrics(self, analytics_service, sample_providers, db_session, sample_customer):
        """Verify no N+1 queries in calculate_provider_metrics."""
        provider = sample_providers[0]
        today = datetime.utcnow()

        # Create many consultations with appointments
        for i in range(20):
            appt = Appointment(
                customer_id=sample_customer.id,
                service_type="Botox",
                appointment_datetime=today + timedelta(days=7),
                status="scheduled"
            )
            db_session.add(appt)
            db_session.flush()

            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                appointment_id=appt.id,
                outcome="booked",
                created_at=today
            )
            db_session.add(consultation)

        db_session.commit()

        # Enable query logging
        from sqlalchemy import event
        queries = []

        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            queries.append(statement)

        event.listen(db_session.bind, "after_cursor_execute", receive_after_cursor_execute)

        # Calculate metrics
        analytics_service.calculate_provider_metrics(
            provider_id=str(provider.id),
            start_date=today - timedelta(hours=1),
            end_date=today + timedelta(days=1),
            period_type="daily"
        )

        event.remove(db_session.bind, "after_cursor_execute", receive_after_cursor_execute)

        # Should not have 20+ queries (one per consultation)
        # Should have ~3-5 queries total (select consultations with joinedload, select/insert/update metrics)
        assert len(queries) < 10, f"Too many queries: {len(queries)} (possible N+1 problem)"

    def test_get_all_providers_summary(self, analytics_service, sample_providers, db_session):
        """Test getting summary for all providers."""
        today = datetime.utcnow()

        # Create consultations for each provider
        for i, provider in enumerate(sample_providers):
            # Each provider gets different number of consultations
            for j in range((i + 1) * 3):
                consultation = InPersonConsultation(
                    id=uuid.uuid4(),
                    provider_id=provider.id,
                    outcome="booked" if j % 2 == 0 else "declined",
                    created_at=today
                )
                db_session.add(consultation)

        db_session.commit()

        summaries = analytics_service.get_all_providers_summary(
            start_date=today - timedelta(hours=1),
            end_date=today + timedelta(days=1)
        )

        assert len(summaries) == 3
        # Verify sorted by conversion rate
        for i in range(len(summaries) - 1):
            assert summaries[i]["conversion_rate"] >= summaries[i + 1]["conversion_rate"]

    def test_no_n_plus_one_in_get_all_providers(self, analytics_service, sample_providers, db_session):
        """Verify no N+1 queries in get_all_providers_summary."""
        today = datetime.utcnow()

        # Create consultations for all providers
        for provider in sample_providers:
            for _ in range(10):
                consultation = InPersonConsultation(
                    id=uuid.uuid4(),
                    provider_id=provider.id,
                    outcome="booked",
                    created_at=today
                )
                db_session.add(consultation)

        db_session.commit()

        # Enable query logging
        from sqlalchemy import event
        queries = []

        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            queries.append(statement)

        event.listen(db_session.bind, "after_cursor_execute", receive_after_cursor_execute)

        analytics_service.get_all_providers_summary(
            start_date=today - timedelta(hours=1),
            end_date=today + timedelta(days=1)
        )

        event.remove(db_session.bind, "after_cursor_execute", receive_after_cursor_execute)

        # Should not scale with number of providers/consultations
        # Should be ~2-3 queries (select providers, select all consultations with appointments)
        assert len(queries) < 5, f"Too many queries: {len(queries)} (possible N+1 problem)"

    def test_provider_ranking(self, analytics_service, sample_providers, db_session):
        """Test provider ranking by different metrics."""
        today = datetime.utcnow()

        # Provider 0: High conversion, low consultations
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=sample_providers[0].id,
                outcome="booked",
                created_at=today
            )
            db_session.add(consultation)

        # Provider 1: Medium conversion, high consultations
        for i in range(20):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=sample_providers[1].id,
                outcome="booked" if i < 10 else "declined",
                created_at=today
            )
            db_session.add(consultation)

        # Provider 2: Low conversion
        for i in range(10):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=sample_providers[2].id,
                outcome="booked" if i < 2 else "declined",
                created_at=today
            )
            db_session.add(consultation)

        db_session.commit()

        # Rank by conversion rate
        by_conversion = analytics_service.get_provider_ranking(metric="conversion_rate", days=1)
        assert by_conversion[0]["rank"] == 1
        assert by_conversion[0]["conversion_rate"] == 100.0  # Provider 0

        # Rank by total consultations
        by_consultations = analytics_service.get_provider_ranking(metric="total_consultations", days=1)
        assert by_consultations[0]["total_consultations"] == 20  # Provider 1

    def test_outcome_breakdown(self, analytics_service, sample_providers, db_session):
        """Test consultation outcome breakdown."""
        provider = sample_providers[0]
        today = datetime.utcnow()

        outcomes = {"booked": 5, "declined": 3, "thinking": 2}
        for outcome, count in outcomes.items():
            for _ in range(count):
                consultation = InPersonConsultation(
                    id=uuid.uuid4(),
                    provider_id=provider.id,
                    outcome=outcome,
                    created_at=today
                )
                db_session.add(consultation)

        db_session.commit()

        breakdown = analytics_service.get_consultation_outcomes_breakdown(
            provider_id=str(provider.id),
            days=1
        )

        assert breakdown["booked"] == 5
        assert breakdown["declined"] == 3
        assert breakdown["thinking"] == 2

    def test_service_performance(self, analytics_service, sample_providers, db_session):
        """Test performance breakdown by service type."""
        provider = sample_providers[0]
        today = datetime.utcnow()

        # Botox: 80% conversion
        for i in range(5):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                service_type="Botox",
                outcome="booked" if i < 4 else "declined",
                created_at=today
            )
            db_session.add(consultation)

        # Fillers: 50% conversion
        for i in range(4):
            consultation = InPersonConsultation(
                id=uuid.uuid4(),
                provider_id=provider.id,
                service_type="Fillers",
                outcome="booked" if i < 2 else "declined",
                created_at=today
            )
            db_session.add(consultation)

        db_session.commit()

        performance = analytics_service.get_service_performance(
            provider_id=str(provider.id),
            days=1
        )

        # Should be sorted by conversion rate
        assert performance[0]["service_type"] == "Botox"
        assert performance[0]["conversion_rate"] == 80.0
        assert performance[1]["service_type"] == "Fillers"
        assert performance[1]["conversion_rate"] == 50.0

    def test_aggregate_metrics_daily(self, analytics_service, sample_providers, db_session):
        """Test daily metrics aggregation."""
        today = datetime.utcnow().date()
        start_of_day = datetime.combine(today, datetime.min.time())

        # Create consultation for today
        consultation = InPersonConsultation(
            id=uuid.uuid4(),
            provider_id=sample_providers[0].id,
            outcome="booked",
            created_at=start_of_day + timedelta(hours=10)
        )
        db_session.add(consultation)
        db_session.commit()

        # Aggregate
        analytics_service.aggregate_metrics_for_period(period_type="daily")

        # Verify metric was created
        metric = db_session.query(ProviderPerformanceMetric).filter(
            ProviderPerformanceMetric.provider_id == sample_providers[0].id,
            ProviderPerformanceMetric.period_type == "daily"
        ).first()

        assert metric is not None
        assert metric.total_consultations == 1
        assert metric.successful_bookings == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
