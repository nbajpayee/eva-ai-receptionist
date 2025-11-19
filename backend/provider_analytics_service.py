"""
Provider analytics service for calculating performance metrics and comparisons.

Handles:
- Performance metric calculation (conversion rates, revenue, NPS)
- Time-based aggregations (daily, weekly, monthly)
- Provider rankings and comparisons
- Trend analysis
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, case, desc, func
from sqlalchemy.orm import Session

try:
    from backend.config import get_settings
    from backend.database import (
        Appointment,
        InPersonConsultation,
        Provider,
        ProviderPerformanceMetric,
    )
except ModuleNotFoundError:
    from config import get_settings
    from database import (
        Appointment,
        InPersonConsultation,
        Provider,
        ProviderPerformanceMetric,
    )


class ProviderAnalyticsService:
    """Service for provider performance analytics and metrics."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_provider_metrics(
        self,
        provider_id: str,
        start_date: datetime,
        end_date: datetime,
        period_type: str = "daily",
    ) -> ProviderPerformanceMetric:
        """
        Calculate performance metrics for a provider over a time period.

        Args:
            provider_id: UUID of provider
            start_date: Start of period
            end_date: End of period
            period_type: 'daily', 'weekly', or 'monthly'
        """
        # Query consultations in the period
        consultations = (
            self.db.query(InPersonConsultation)
            .filter(
                and_(
                    InPersonConsultation.provider_id == uuid.UUID(provider_id),
                    InPersonConsultation.created_at >= start_date,
                    InPersonConsultation.created_at < end_date,
                )
            )
            .all()
        )

        # Calculate metrics
        total_consultations = len(consultations)
        successful_bookings = sum(1 for c in consultations if c.outcome == "booked")
        conversion_rate = (
            (successful_bookings / total_consultations * 100)
            if total_consultations > 0
            else 0.0
        )

        # Calculate revenue (sum of associated appointment prices)
        total_revenue = 0.0
        for consultation in consultations:
            if consultation.appointment_id:
                appointment = (
                    self.db.query(Appointment)
                    .filter(Appointment.id == consultation.appointment_id)
                    .first()
                )
                if appointment and appointment.service_type:
                    # Get service price from config
                    from config import get_settings

                    settings = get_settings()
                    service = settings.SERVICES.get(appointment.service_type, {})
                    # Use average of price range
                    price_range = service.get("price_range", "$0")
                    # Parse price (e.g., "$500-800" -> 650)
                    try:
                        price_str = price_range.replace("$", "").replace(",", "")
                        if "-" in price_str:
                            low, high = price_str.split("-")
                            avg_price = (float(low) + float(high)) / 2
                        else:
                            avg_price = float(price_str)
                        total_revenue += avg_price
                    except:
                        pass

        # Calculate average consultation duration
        durations = [c.duration_seconds for c in consultations if c.duration_seconds]
        avg_duration = int(sum(durations) / len(durations)) if durations else None

        # Calculate average satisfaction score
        scores = [c.satisfaction_score for c in consultations if c.satisfaction_score]
        avg_satisfaction = sum(scores) / len(scores) if scores else None

        # Calculate NPS (mock for now - would need actual NPS survey data)
        avg_nps = avg_satisfaction * 10 if avg_satisfaction else None

        # Create or update metric record
        existing = (
            self.db.query(ProviderPerformanceMetric)
            .filter(
                and_(
                    ProviderPerformanceMetric.provider_id == uuid.UUID(provider_id),
                    ProviderPerformanceMetric.period_start == start_date,
                    ProviderPerformanceMetric.period_end == end_date,
                    ProviderPerformanceMetric.period_type == period_type,
                )
            )
            .first()
        )

        if existing:
            metric = existing
        else:
            metric = ProviderPerformanceMetric(
                id=uuid.uuid4(),
                provider_id=uuid.UUID(provider_id),
                period_start=start_date,
                period_end=end_date,
                period_type=period_type,
            )

        metric.total_consultations = total_consultations
        metric.successful_bookings = successful_bookings
        metric.conversion_rate = conversion_rate
        metric.total_revenue = total_revenue
        metric.avg_consultation_duration_seconds = avg_duration
        metric.avg_satisfaction_score = avg_satisfaction
        metric.avg_nps_score = avg_nps

        if not existing:
            self.db.add(metric)

        self.db.commit()
        self.db.refresh(metric)
        return metric

    def get_provider_metrics(
        self, provider_id: str, period_type: str = "daily", limit: int = 30
    ) -> List[ProviderPerformanceMetric]:
        """Get historical metrics for a provider."""
        return (
            self.db.query(ProviderPerformanceMetric)
            .filter(
                and_(
                    ProviderPerformanceMetric.provider_id == uuid.UUID(provider_id),
                    ProviderPerformanceMetric.period_type == period_type,
                )
            )
            .order_by(desc(ProviderPerformanceMetric.period_start))
            .limit(limit)
            .all()
        )

    def get_all_providers_summary(
        self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get summary metrics for all providers.

        Returns list of provider summaries with key metrics for comparison.
        """
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        providers = self.db.query(Provider).filter(Provider.is_active == True).all()

        summaries = []
        for provider in providers:
            # Get consultations in period
            consultations = (
                self.db.query(InPersonConsultation)
                .filter(
                    and_(
                        InPersonConsultation.provider_id == provider.id,
                        InPersonConsultation.created_at >= start_date,
                        InPersonConsultation.created_at < end_date,
                    )
                )
                .all()
            )

            total = len(consultations)
            booked = sum(1 for c in consultations if c.outcome == "booked")
            conversion_rate = (booked / total * 100) if total > 0 else 0.0

            # Calculate revenue
            revenue = 0.0
            for consultation in consultations:
                if consultation.appointment_id:
                    appointment = (
                        self.db.query(Appointment)
                        .filter(Appointment.id == consultation.appointment_id)
                        .first()
                    )
                    if appointment and appointment.service_type:
                        from config import get_settings

                        settings = get_settings()
                        service = settings.SERVICES.get(appointment.service_type, {})
                        price_range = service.get("price_range", "$0")
                        try:
                            price_str = price_range.replace("$", "").replace(",", "")
                            if "-" in price_str:
                                low, high = price_str.split("-")
                                avg_price = (float(low) + float(high)) / 2
                            else:
                                avg_price = float(price_str)
                            revenue += avg_price
                        except:
                            pass

            # Average satisfaction
            scores = [
                c.satisfaction_score for c in consultations if c.satisfaction_score
            ]
            avg_satisfaction = sum(scores) / len(scores) if scores else None

            summaries.append(
                {
                    "provider_id": str(provider.id),
                    "name": provider.name,
                    "email": provider.email,
                    "avatar_url": provider.avatar_url,
                    "specialties": provider.specialties or [],
                    "total_consultations": total,
                    "successful_bookings": booked,
                    "conversion_rate": round(conversion_rate, 2),
                    "total_revenue": round(revenue, 2),
                    "avg_satisfaction_score": (
                        round(avg_satisfaction, 2) if avg_satisfaction else None
                    ),
                }
            )

        # Sort by conversion rate descending
        summaries.sort(key=lambda x: x["conversion_rate"], reverse=True)

        return summaries

    def get_provider_performance_trend(
        self, provider_id: str, metric: str = "conversion_rate", days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get time series data for a specific metric.

        Args:
            provider_id: UUID of provider
            metric: 'conversion_rate', 'total_consultations', 'revenue', 'satisfaction'
            days: Number of days to look back
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        metrics = (
            self.db.query(ProviderPerformanceMetric)
            .filter(
                and_(
                    ProviderPerformanceMetric.provider_id == uuid.UUID(provider_id),
                    ProviderPerformanceMetric.period_start >= cutoff_date,
                    ProviderPerformanceMetric.period_type == "daily",
                )
            )
            .order_by(ProviderPerformanceMetric.period_start)
            .all()
        )

        trend_data = []
        for m in metrics:
            value = None
            if metric == "conversion_rate":
                value = m.conversion_rate
            elif metric == "total_consultations":
                value = m.total_consultations
            elif metric == "revenue":
                value = m.total_revenue
            elif metric == "satisfaction":
                value = m.avg_satisfaction_score

            trend_data.append({"date": m.period_start.isoformat(), "value": value})

        return trend_data

    def get_provider_ranking(
        self, metric: str = "conversion_rate", days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Rank all providers by a specific metric.

        Args:
            metric: 'conversion_rate', 'total_revenue', 'total_consultations', 'satisfaction'
            days: Time period to consider
        """
        summaries = self.get_all_providers_summary(
            start_date=datetime.utcnow() - timedelta(days=days),
            end_date=datetime.utcnow(),
        )

        # Sort by the specified metric
        if metric == "conversion_rate":
            summaries.sort(key=lambda x: x["conversion_rate"], reverse=True)
        elif metric == "total_revenue":
            summaries.sort(key=lambda x: x["total_revenue"], reverse=True)
        elif metric == "total_consultations":
            summaries.sort(key=lambda x: x["total_consultations"], reverse=True)
        elif metric == "satisfaction":
            summaries.sort(key=lambda x: x["avg_satisfaction_score"] or 0, reverse=True)

        # Add rank
        for i, summary in enumerate(summaries, 1):
            summary["rank"] = i

        return summaries

    def get_consultation_outcomes_breakdown(
        self, provider_id: str, days: int = 30
    ) -> Dict[str, int]:
        """Get breakdown of consultation outcomes for a provider."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        outcomes = (
            self.db.query(
                InPersonConsultation.outcome,
                func.count(InPersonConsultation.id).label("count"),
            )
            .filter(
                and_(
                    InPersonConsultation.provider_id == uuid.UUID(provider_id),
                    InPersonConsultation.created_at >= cutoff_date,
                )
            )
            .group_by(InPersonConsultation.outcome)
            .all()
        )

        return {outcome: count for outcome, count in outcomes}

    def get_service_performance(
        self, provider_id: str, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get performance breakdown by service type."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        services = (
            self.db.query(
                InPersonConsultation.service_type,
                func.count(InPersonConsultation.id).label("total"),
                func.sum(
                    case((InPersonConsultation.outcome == "booked", 1), else_=0)
                ).label("booked"),
            )
            .filter(
                and_(
                    InPersonConsultation.provider_id == uuid.UUID(provider_id),
                    InPersonConsultation.created_at >= cutoff_date,
                    InPersonConsultation.service_type.isnot(None),
                )
            )
            .group_by(InPersonConsultation.service_type)
            .all()
        )

        results = []
        for service_type, total, booked in services:
            conversion_rate = (booked / total * 100) if total > 0 else 0.0
            results.append(
                {
                    "service_type": service_type,
                    "total_consultations": total,
                    "successful_bookings": booked,
                    "conversion_rate": round(conversion_rate, 2),
                }
            )

        # Sort by conversion rate
        results.sort(key=lambda x: x["conversion_rate"], reverse=True)

        return results

    def aggregate_metrics_for_period(self, period_type: str = "daily"):
        """
        Background job to aggregate metrics for all providers.

        Should be run daily to keep metrics up to date.
        """
        providers = self.db.query(Provider).filter(Provider.is_active == True).all()

        today = datetime.utcnow().date()

        if period_type == "daily":
            start_date = datetime.combine(today, datetime.min.time())
            end_date = datetime.combine(today + timedelta(days=1), datetime.min.time())
        elif period_type == "weekly":
            # Start of current week (Monday)
            start_date = datetime.combine(
                today - timedelta(days=today.weekday()), datetime.min.time()
            )
            end_date = start_date + timedelta(days=7)
        elif period_type == "monthly":
            # Start of current month
            start_date = datetime.combine(today.replace(day=1), datetime.min.time())
            # Start of next month
            if today.month == 12:
                end_date = datetime.combine(
                    date(today.year + 1, 1, 1), datetime.min.time()
                )
            else:
                end_date = datetime.combine(
                    date(today.year, today.month + 1, 1), datetime.min.time()
                )

        for provider in providers:
            self.calculate_provider_metrics(
                provider_id=str(provider.id),
                start_date=start_date,
                end_date=end_date,
                period_type=period_type,
            )

        print(f"Aggregated {period_type} metrics for {len(providers)} providers")
