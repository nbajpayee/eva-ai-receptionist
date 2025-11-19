"""
Main FastAPI application for Med Spa Voice AI.
"""

import asyncio
import logging
import uuid
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from starlette.websockets import WebSocketState

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from analytics import AnalyticsService
from api_messaging import messaging_router
from calendar_service import check_calendar_credentials
from config import get_settings
from database import (
    Appointment,
    BusinessHours,
    CallSession,
    Conversation,
    Customer,
    Location,
    MedSpaSettings,
    Provider,
    Service,
    AIInsight,
    InPersonConsultation,
    get_db,
    init_db,
)
from provider_analytics_service import ProviderAnalyticsService
from ai_insights_service import AIInsightsService
from consultation_service import ConsultationService
from settings_service import SettingsService
from realtime_client import RealtimeClient

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered voice receptionist for medical spas",
)

# Register routers
app.include_router(messaging_router)


class MedSpaSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    email: EmailStr
    website: Optional[str] = None
    timezone: str
    ai_assistant_name: str
    cancellation_policy: Optional[str] = None


class MedSpaSettingsUpdateRequest(BaseModel):
    name: str
    phone: str
    email: EmailStr
    website: Optional[str] = None
    timezone: str
    ai_assistant_name: str
    cancellation_policy: Optional[str] = None


class ServiceResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    duration_minutes: int
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_display: Optional[str] = None
    prep_instructions: Optional[str] = None
    aftercare_instructions: Optional[str] = None
    category: Optional[str] = None
    is_active: bool
    display_order: int


class ServiceCreateRequest(BaseModel):
    name: str
    description: str
    duration_minutes: int
    slug: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_display: Optional[str] = None
    prep_instructions: Optional[str] = None
    aftercare_instructions: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = True
    display_order: Optional[int] = None


class ServiceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    slug: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_display: Optional[str] = None
    prep_instructions: Optional[str] = None
    aftercare_instructions: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ProviderResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    specialties: List[str] = []
    bio: Optional[str] = None
    is_active: bool
    hire_date: Optional[str] = None
    avatar_url: Optional[str] = None


class ProviderCreateRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    specialties: Optional[List[str]] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = True
    hire_date: Optional[str] = None
    avatar_url: Optional[str] = None


class ProviderUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    specialties: Optional[List[str]] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = None
    hire_date: Optional[str] = None
    avatar_url: Optional[str] = None


class BusinessHourEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    is_closed: Optional[bool] = False


class ProviderSummary(BaseModel):
    provider_id: str
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    specialties: List[str] = []
    total_consultations: int
    successful_bookings: int
    conversion_rate: float
    total_revenue: float
    avg_satisfaction_score: Optional[float] = None


class ProvidersSummaryResponse(BaseModel):
    providers: List[ProviderSummary]
    period_days: int


class ProviderDetailResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    specialties: List[str] = []
    hire_date: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool


class ProviderMetricsSummary(BaseModel):
    provider_id: str
    name: str
    total_consultations: int
    successful_bookings: int
    conversion_rate: float
    total_revenue: float
    avg_satisfaction_score: Optional[float] = None


class TrendPoint(BaseModel):
    date: str
    value: Optional[float] = None


class ProviderMetricsTrends(BaseModel):
    conversion_rate: List[TrendPoint]
    revenue: List[TrendPoint]


class ServicePerformanceEntry(BaseModel):
    service_type: str
    total_consultations: int
    successful_bookings: int
    conversion_rate: float


class ProviderMetricsResponse(BaseModel):
    summary: ProviderMetricsSummary
    trends: ProviderMetricsTrends
    outcomes: Dict[str, int]
    service_performance: List[ServicePerformanceEntry]
    period_days: int


class ProviderInsightModel(BaseModel):
    id: str
    type: str
    title: str
    insight_text: str
    supporting_quote: Optional[str] = None
    recommendation: Optional[str] = None
    confidence_score: Optional[float] = None
    is_positive: bool
    is_reviewed: bool
    created_at: Optional[str] = None


class ProviderInsightsResponse(BaseModel):
    insights: List[ProviderInsightModel]


class ConsultationEntry(BaseModel):
    id: str
    customer_id: Optional[int] = None
    service_type: Optional[str] = None
    outcome: Optional[str] = None
    duration_seconds: Optional[int] = None
    satisfaction_score: Optional[float] = None
    sentiment: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: Optional[str] = None
    ended_at: Optional[str] = None


class ProviderConsultationsResponse(BaseModel):
    consultations: List[ConsultationEntry]


class LocationResponse(BaseModel):
    id: int
    name: str
    address: str
    phone: Optional[str] = None
    is_primary: bool
    is_active: bool
    business_hours: List[BusinessHourEntry] = []


class LocationCreateRequest(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    is_primary: Optional[bool] = False
    is_active: Optional[bool] = True
    business_hours: Optional[List[BusinessHourEntry]] = None


class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
    business_hours: Optional[List[BusinessHourEntry]] = None


def _serialize_service(service: Service) -> Dict[str, Any]:
    return {
        "id": service.id,
        "name": service.name,
        "slug": service.slug,
        "description": service.description,
        "duration_minutes": service.duration_minutes,
        "price_min": float(service.price_min) if service.price_min is not None else None,
        "price_max": float(service.price_max) if service.price_max is not None else None,
        "price_display": service.price_display,
        "prep_instructions": service.prep_instructions,
        "aftercare_instructions": service.aftercare_instructions,
        "category": service.category,
        "is_active": service.is_active,
        "display_order": service.display_order,
    }


def _serialize_provider(provider: Provider) -> Dict[str, Any]:
    hire_date = provider.hire_date.isoformat() if provider.hire_date else None
    specialties = provider.specialties or []
    return {
        "id": str(provider.id),
        "name": provider.name,
        "email": provider.email,
        "phone": provider.phone,
        "specialties": specialties,
        "bio": provider.bio,
        "is_active": provider.is_active,
        "hire_date": hire_date,
        "avatar_url": provider.avatar_url,
    }


def _parse_hire_date(value: Optional[str]) -> Optional[datetime]:
    if value is None or value == "":
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400, detail="Invalid hire_date format. Use ISO 8601 date string."
        ) from exc


def _parse_time(value: Optional[str]) -> Optional[time]:
    if value in (None, ""):
        return None
    try:
        return time.fromisoformat(value)
    except ValueError as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400,
            detail="Invalid time format. Use HH:MM or HH:MM:SS",
        ) from exc


def _serialize_business_hours(hours: List[BusinessHours]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []
    for entry in hours:
        serialized.append(
            {
                "day_of_week": entry.day_of_week,
                "open_time": entry.open_time.strftime("%H:%M") if entry.open_time else None,
                "close_time": entry.close_time.strftime("%H:%M") if entry.close_time else None,
                "is_closed": entry.is_closed,
            }
        )
    return serialized


def _serialize_location(location: Location, hours: List[BusinessHours]) -> Dict[str, Any]:
    return {
        "id": location.id,
        "name": location.name,
        "address": location.address,
        "phone": location.phone,
        "is_primary": location.is_primary,
        "is_active": location.is_active,
        "business_hours": _serialize_business_hours(hours),
    }


def _write_business_hours(db: Session, location_id: int, entries: List[BusinessHourEntry]) -> None:
    normalized: List[Dict[str, Any]] = []
    for entry in entries:
        if entry.is_closed:
            normalized.append(
                {
                    "day_of_week": entry.day_of_week,
                    "open_time": None,
                    "close_time": None,
                    "is_closed": True,
                }
            )
        else:
            open_time = _parse_time(entry.open_time)
            close_time = _parse_time(entry.close_time)
            if open_time is None or close_time is None:
                raise HTTPException(
                    status_code=400,
                    detail="open_time and close_time are required unless is_closed is true",
                )
            normalized.append(
                {
                    "day_of_week": entry.day_of_week,
                    "open_time": open_time,
                    "close_time": close_time,
                    "is_closed": False,
                }
            )

    SettingsService.update_business_hours(db, location_id, normalized)


def _serialize_provider(provider: Provider) -> Dict[str, Any]:
    hire_date = provider.hire_date.isoformat() if provider.hire_date else None
    return {
        "id": str(provider.id),
        "name": provider.name,
        "email": provider.email,
        "phone": provider.phone,
        "specialties": provider.specialties or [],
        "hire_date": hire_date,
        "bio": provider.bio,
        "avatar_url": provider.avatar_url,
        "is_active": provider.is_active,
    }


def _serialize_consultation(consultation: InPersonConsultation) -> Dict[str, Any]:
    return {
        "id": str(consultation.id),
        "customer_id": consultation.customer_id,
        "service_type": consultation.service_type,
        "outcome": consultation.outcome,
        "duration_seconds": consultation.duration_seconds,
        "satisfaction_score": consultation.satisfaction_score,
        "sentiment": consultation.sentiment,
        "ai_summary": consultation.ai_summary,
        "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
        "ended_at": consultation.ended_at.isoformat() if consultation.ended_at else None,
    }


def _serialize_insight(insight: AIInsight) -> Dict[str, Any]:
    return {
        "id": str(insight.id),
        "type": insight.insight_type,
        "title": insight.title,
        "insight_text": insight.insight_text,
        "supporting_quote": insight.supporting_quote,
        "recommendation": insight.recommendation,
        "confidence_score": insight.confidence_score,
        "is_positive": insight.is_positive,
        "is_reviewed": insight.is_reviewed,
        "created_at": insight.created_at.isoformat() if insight.created_at else None,
    }


def _ensure_med_spa_settings(db: Session) -> MedSpaSettings:
    existing = SettingsService.get_settings(db)
    if existing:
        return existing

    defaults = {
        "name": settings.MED_SPA_NAME,
        "phone": settings.MED_SPA_PHONE,
        "email": settings.MED_SPA_EMAIL,
        "website": settings.MED_SPA_URL if hasattr(settings, "MED_SPA_URL") else None,
        "timezone": getattr(settings, "MED_SPA_TIMEZONE", "America/New_York"),
        "ai_assistant_name": settings.AI_ASSISTANT_NAME,
        "cancellation_policy": None,
    }

    return SettingsService.update_settings(db, defaults)


@app.get("/api/admin/settings", response_model=MedSpaSettingsResponse)
def get_admin_settings(db: Session = Depends(get_db)):
    settings_row = _ensure_med_spa_settings(db)
    return MedSpaSettingsResponse.from_orm(settings_row)


@app.put("/api/admin/settings", response_model=MedSpaSettingsResponse)
def update_admin_settings(
    payload: MedSpaSettingsUpdateRequest, db: Session = Depends(get_db)
):
    updated = SettingsService.update_settings(db, payload.dict())
    return MedSpaSettingsResponse.from_orm(updated)


@app.get("/api/admin/services", response_model=List[ServiceResponse])
def list_services(
    active_only: bool = Query(False),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    services = SettingsService.get_all_services(
        db, active_only=active_only, category=category
    )
    return [_serialize_service(service) for service in services]


@app.get("/api/admin/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = SettingsService.get_service(db, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _serialize_service(service)


@app.post("/api/admin/services", response_model=ServiceResponse, status_code=201)
def create_service(payload: ServiceCreateRequest, db: Session = Depends(get_db)):
    service_data = payload.dict(exclude_unset=True)
    service = SettingsService.create_service(db, service_data)
    return _serialize_service(service)


@app.put("/api/admin/services/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int, payload: ServiceUpdateRequest, db: Session = Depends(get_db)
):
    service_data = payload.dict(exclude_unset=True)
    if not service_data:
        service = SettingsService.get_service(db, service_id)
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        return _serialize_service(service)

    service = SettingsService.update_service(db, service_id, service_data)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _serialize_service(service)


@app.delete("/api/admin/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    deleted = SettingsService.delete_service(db, service_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service not found or already inactive")
    return {"success": True}


@app.get("/api/admin/providers", response_model=List[ProviderResponse])
def list_providers(
    active_only: bool = Query(False), db: Session = Depends(get_db)
):
    providers = SettingsService.get_all_providers(db, active_only=active_only)
    return [_serialize_provider(provider) for provider in providers]


@app.get("/api/admin/providers/{provider_id}", response_model=ProviderResponse)
def get_provider(provider_id: str, db: Session = Depends(get_db)):
    provider = SettingsService.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _serialize_provider(provider)


@app.post("/api/admin/providers", response_model=ProviderResponse, status_code=201)
def create_provider(payload: ProviderCreateRequest, db: Session = Depends(get_db)):
    provider_data = payload.dict(exclude_unset=True)
    if "hire_date" in provider_data:
        provider_data["hire_date"] = _parse_hire_date(provider_data["hire_date"])
    provider = SettingsService.create_provider(db, provider_data)
    return _serialize_provider(provider)


@app.put("/api/admin/providers/{provider_id}", response_model=ProviderResponse)
def update_provider(
    provider_id: str, payload: ProviderUpdateRequest, db: Session = Depends(get_db)
):
    provider_data = payload.dict(exclude_unset=True)
    if "hire_date" in provider_data:
        provider_data["hire_date"] = _parse_hire_date(provider_data["hire_date"])

    provider = SettingsService.update_provider(db, provider_id, provider_data)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _serialize_provider(provider)


@app.delete("/api/admin/providers/{provider_id}")
def delete_provider(provider_id: str, db: Session = Depends(get_db)):
    deleted = SettingsService.delete_provider(db, provider_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Provider not found or already inactive")
    return {"success": True}


@app.get("/api/admin/locations", response_model=List[LocationResponse])
def list_locations(
    active_only: bool = Query(False), db: Session = Depends(get_db)
):
    locations = SettingsService.get_all_locations(db, active_only=active_only)
    serialized = []
    for location in locations:
        hours = SettingsService.get_business_hours(db, location.id)
        serialized.append(_serialize_location(location, hours))
    return serialized


@app.get("/api/admin/locations/{location_id}", response_model=LocationResponse)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = SettingsService.get_location(db, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    hours = SettingsService.get_business_hours(db, location.id)
    return _serialize_location(location, hours)


@app.get("/api/admin/locations/{location_id}/hours", response_model=List[BusinessHourEntry])
def get_location_hours(location_id: int, db: Session = Depends(get_db)):
    location = SettingsService.get_location(db, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    hours = SettingsService.get_business_hours(db, location.id)
    return _serialize_business_hours(hours)


@app.post("/api/admin/locations", response_model=LocationResponse, status_code=201)
def create_location(payload: LocationCreateRequest, db: Session = Depends(get_db)):
    location_data = payload.model_dump(exclude={"business_hours"}, exclude_none=True)
    location = SettingsService.create_location(db, location_data)

    if payload.business_hours is not None:
        _write_business_hours(db, location.id, payload.business_hours)

    hours = SettingsService.get_business_hours(db, location.id)
    return _serialize_location(location, hours)


@app.put("/api/admin/locations/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int, payload: LocationUpdateRequest, db: Session = Depends(get_db)
):
    location_data = payload.model_dump(exclude={"business_hours"}, exclude_unset=True)

    if location_data:
        location = SettingsService.update_location(db, location_id, location_data)
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")
    else:
        location = SettingsService.get_location(db, location_id)
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    if payload.business_hours is not None:
        _write_business_hours(db, location_id, payload.business_hours)

    hours = SettingsService.get_business_hours(db, location_id)
    return _serialize_location(location, hours)


@app.put("/api/admin/locations/{location_id}/hours", response_model=LocationResponse)
def update_location_hours(
    location_id: int,
    entries: List[BusinessHourEntry],
    db: Session = Depends(get_db),
):
    location = SettingsService.get_location(db, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    _write_business_hours(db, location_id, entries)
    hours = SettingsService.get_business_hours(db, location_id)
    return _serialize_location(location, hours)


@app.delete("/api/admin/locations/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)):
    try:
        deleted = SettingsService.delete_location(db, location_id)
    except ValueError as exc:  # e.g., deleting primary or only location
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"success": True}


@app.get("/api/providers", response_model=ProvidersSummaryResponse)
def get_providers_summary(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    service = ProviderAnalyticsService(db)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    summaries = service.get_all_providers_summary(start_date=start_date, end_date=end_date)
    return {"providers": summaries, "period_days": days}


@app.get("/api/providers/summary", response_model=ProvidersSummaryResponse)
def get_providers_summary_alias(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    return get_providers_summary(days=days, db=db)


@app.get("/api/providers/{provider_id}", response_model=ProviderDetailResponse)
def get_provider_detail(provider_id: str, db: Session = Depends(get_db)):
    provider = SettingsService.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _serialize_provider(provider)


@app.get("/api/providers/{provider_id}/metrics", response_model=ProviderMetricsResponse)
def get_provider_metrics(
    provider_id: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    provider = SettingsService.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    analytics = ProviderAnalyticsService(db)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    summaries = analytics.get_all_providers_summary(start_date=start_date, end_date=end_date)
    summary = next((item for item in summaries if item["provider_id"] == provider_id), None)
    if not summary:
        summary = {
            "provider_id": provider_id,
            "name": provider.name,
            "email": provider.email,
            "avatar_url": provider.avatar_url,
            "specialties": provider.specialties or [],
            "total_consultations": 0,
            "successful_bookings": 0,
            "conversion_rate": 0.0,
            "total_revenue": 0.0,
            "avg_satisfaction_score": None,
        }

    trends = {
        "conversion_rate": analytics.get_provider_performance_trend(
            provider_id, metric="conversion_rate", days=days
        ),
        "revenue": analytics.get_provider_performance_trend(
            provider_id, metric="revenue", days=days
        ),
    }

    outcomes = analytics.get_consultation_outcomes_breakdown(provider_id, days=days)
    service_perf = analytics.get_service_performance(provider_id, days=days)

    return {
        "summary": summary,
        "trends": trends,
        "outcomes": outcomes,
        "service_performance": service_perf,
        "period_days": days,
    }


@app.get("/api/providers/{provider_id}/insights", response_model=ProviderInsightsResponse)
def get_provider_insights(
    provider_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    provider = SettingsService.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    insights_service = AIInsightsService(db)
    insights = insights_service.get_provider_insights(provider_id, limit=limit)
    return {"insights": [_serialize_insight(insight) for insight in insights]}


@app.get(
    "/api/providers/{provider_id}/consultations",
    response_model=ProviderConsultationsResponse,
)
def get_provider_consultations(
    provider_id: str,
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    provider = SettingsService.get_provider(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    consultations = (
        db.query(InPersonConsultation)
        .filter(InPersonConsultation.provider_id == uuid.UUID(provider_id))
        .order_by(InPersonConsultation.created_at.desc())
        .limit(limit)
        .all()
    )

    return {"consultations": [_serialize_consultation(c) for c in consultations]}

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    credential_status = check_calendar_credentials()
    app.state.calendar_credentials = credential_status
    if credential_status.get("ok"):
        logger.info("Google Calendar credentials validated at startup")
    else:
        logger.warning(
            "Google Calendar credentials require attention: %s", credential_status
        )
    print(f"{settings.APP_NAME} started successfully!")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ==================== Voice WebSocket Endpoint ====================


@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(
    websocket: WebSocket, session_id: str, db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for voice communication with OpenAI Realtime API.

    Args:
        websocket: WebSocket connection
        session_id: Unique session identifier
        db: Database session
    """
    await websocket.accept()
    active_connections[session_id] = websocket

    # DUAL-WRITE: Create both legacy call_session and new conversation
    # Legacy schema (for backward compatibility during migration)
    call_session = AnalyticsService.create_call_session(
        db=db, session_id=session_id, phone_number=None  # Will be updated if collected
    )

    # New omnichannel schema
    conversation = AnalyticsService.create_conversation(
        db=db,
        customer_id=None,  # Will be updated if identified
        channel="voice",
        metadata={
            "session_id": session_id,
            "legacy_call_session_id": str(call_session.id),
        },
    )

    # Initialize OpenAI Realtime client
    realtime_client = RealtimeClient(
        session_id=session_id, db=db, conversation=conversation
    )

    session_finalized = False
    finalize_lock = asyncio.Lock()
    disconnect_performed = False

    async def finalize_session(reason: str) -> None:
        nonlocal session_finalized, disconnect_performed

        async with finalize_lock:
            if session_finalized:
                return

            session_finalized = True
            print(f"🔚 Finalizing session {session_id} ({reason})")

            # Remove active connection reference if present
            active_connections.pop(session_id, None)

            session_data = realtime_client.get_session_data()
            transcript_entries = session_data.get("transcript", [])
            print(
                f"🧾 Transcript entries captured for {session_id}: {len(transcript_entries)}"
            )
            if not transcript_entries:
                print("🧾 Transcript data (empty or missing)")
            else:
                preview = transcript_entries[-3:]
                print(f"🧾 Transcript preview: {preview}")

            try:
                # DUAL-WRITE: Update both legacy and new schemas

                # Extract customer data once for reuse
                customer_data = session_data.get("customer_data", {})

                # 1. Update legacy call_session (this also looks up/links customer)
                updated_call_session = AnalyticsService.end_call_session(
                    db=db,
                    session_id=session_id,
                    transcript=session_data.get("transcript", []),
                    function_calls=session_data.get("function_calls", []),
                    customer_data=customer_data,
                )

                # 2. Update new conversation schema
                # Extract customer ID from the updated call_session
                # (end_call_session already looked up customer by phone)
                customer_id = (
                    updated_call_session.customer_id if updated_call_session else None
                )

                # Update conversation with customer ID if identified
                if customer_id:
                    conversation.customer_id = customer_id
                    print(
                        f"🔗 Linked conversation {conversation.id} to customer {customer_id}"
                    )
                    db.commit()
                else:
                    print(f"⚠️  No customer linked for session {session_id}")

                # Add message with human-readable summary (not raw JSON)
                # The actual transcript goes in voice_details.transcript_segments
                import json

                summary_text = (
                    f"Voice call - {len(transcript_entries)} transcript segments"
                )
                if transcript_entries:
                    # Include first and last message for context
                    first_msg = (
                        transcript_entries[0].get("text", "")
                        if transcript_entries
                        else ""
                    )
                    summary_text = f"Voice call starting with: {first_msg[:100]}..."

                message = AnalyticsService.add_message(
                    db=db,
                    conversation_id=conversation.id,
                    direction="inbound",
                    content=summary_text,  # Human-readable summary, not JSON dump
                    sent_at=conversation.initiated_at,
                    metadata={
                        "customer_interruptions": customer_data.get("interruptions", 0),
                        "ai_clarifications_needed": 0,
                        "transcript_entry_count": len(transcript_entries),
                    },
                )

                # Add voice call details
                duration = (
                    int(
                        (
                            datetime.utcnow()
                            - conversation.initiated_at.replace(tzinfo=None)
                        ).total_seconds()
                    )
                    if conversation.initiated_at
                    else 0
                )
                AnalyticsService.add_voice_details(
                    db=db,
                    message_id=message.id,
                    duration_seconds=duration,
                    transcript_segments=transcript_entries,
                    function_calls=session_data.get("function_calls", []),
                    interruption_count=session_data.get("customer_data", {}).get(
                        "interruptions", 0
                    ),
                )

                # Complete conversation
                AnalyticsService.complete_conversation(db, conversation.id)

                # Score conversation satisfaction (AI analysis)
                AnalyticsService.score_conversation_satisfaction(db, conversation.id)

                print(f"✅ Dual-write complete for session {session_id}")

            except Exception as e:
                print(f"Error ending call session: {e}")
            finally:
                if not disconnect_performed:
                    disconnect_performed = True
                    try:
                        await realtime_client.disconnect()
                    except Exception as disconnect_exc:  # noqa: BLE001
                        logger.warning(
                            "Failed to disconnect realtime client: %s", disconnect_exc
                        )
                realtime_client.close()

    try:
        # Connect to OpenAI Realtime API
        await realtime_client.connect()
        # Send greeting to kick off conversation
        await realtime_client.send_greeting()

        # DUAL-WRITE: Log session start to both schemas
        # Legacy schema
        AnalyticsService.log_call_event(
            db=db,
            call_session_id=call_session.id,
            event_type="session_started",
            data={"session_id": session_id},
        )
        # New schema
        AnalyticsService.add_communication_event(
            db=db,
            conversation_id=conversation.id,
            event_type="session_started",
            details={"session_id": session_id},
        )
        print("✅ Session logged to both schemas, about to define audio_callback")

        # Define callback for audio output
        print("✅ Defining audio_callback function")

        async def audio_callback(audio_b64: str):
            """Send audio from OpenAI back to client."""
            if websocket.client_state != WebSocketState.CONNECTED:
                print("📤 Skipping audio send; websocket no longer connected")
                return

            print(
                f"📤 Audio callback called, sending {len(audio_b64)} chars to browser"
            )
            await websocket.send_json({"type": "audio", "data": audio_b64})
            print("📤 Audio sent to browser")

        print("✅ audio_callback defined, about to define handle_client_messages")

        # Handle messages from both client and OpenAI
        async def handle_client_messages():
            """Handle incoming messages from client."""
            print("📱 Starting client message handler...")
            try:
                while True:
                    message = await websocket.receive_json()
                    msg_type = message.get("type")
                    print(f"📱 Received from client: {msg_type}")

                    if msg_type == "audio":
                        # Forward audio to OpenAI
                        audio_b64 = message.get("data")
                        await realtime_client.send_audio(audio_b64, commit=False)

                    elif msg_type == "commit":
                        print("📱 Client requested audio buffer commit")
                        await realtime_client.commit_audio_buffer()

                    elif msg_type == "interrupt":
                        print("✋ Client interrupted assistant")
                        await realtime_client.cancel_response()

                    elif msg_type == "end_session":
                        print("📱 Client requested end session")
                        try:
                            await websocket.close(code=1000)
                        except Exception as close_err:
                            print(
                                f"📱 Error closing client websocket after end_session: {close_err}"
                            )
                        break

                    elif msg_type == "ping":
                        payload = message.get("data") or {}
                        await websocket.send_json(
                            {
                                "type": "pong",
                                "data": {
                                    "client_sent_at": payload.get("client_sent_at"),
                                    "server_received_at": datetime.utcnow().isoformat(),
                                },
                            }
                        )

            except WebSocketDisconnect:
                print("📱 Client WebSocket disconnected")
            except Exception as e:
                print(f"📱 Error in client handler: {e}")
                import traceback

                traceback.print_exc()
            finally:
                print(
                    "📱 Client handler exiting; realtime client will be closed during finalization"
                )

        print(
            "✅ handle_client_messages defined, about to define handle_openai_messages"
        )

        async def handle_openai_messages():
            """Handle incoming messages from OpenAI."""
            print("🤖 Starting OpenAI message handler...")
            try:
                await realtime_client.handle_messages(audio_callback)
            except asyncio.CancelledError:
                print("🤖 OpenAI handler task cancelled")
                raise
            except Exception as e:
                print(f"🤖 Error in OpenAI handler: {e}")
                import traceback

                traceback.print_exc()

        print(
            "✅ handle_openai_messages defined, about to import asyncio and start handlers"
        )

        try:
            client_task = asyncio.create_task(handle_client_messages())
            openai_task = asyncio.create_task(handle_openai_messages())

            done, pending = await asyncio.wait(
                {client_task, openai_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            done_tasks = set(done)
            pending_tasks = set(pending)

            if pending_tasks:
                # Give pending tasks (typically the OpenAI handler) a grace period to flush events
                grace_start = asyncio.get_event_loop().time()
                grace_timeout = 3.0
                while pending_tasks:
                    remaining = grace_timeout - (
                        asyncio.get_event_loop().time() - grace_start
                    )
                    if remaining <= 0:
                        break
                    done_extra, pending_tasks = await asyncio.wait(
                        pending_tasks, timeout=min(0.5, remaining)
                    )
                    done_tasks.update(done_extra)

            # Ensure OpenAI connection is torn down once either side completes
            results = []
            for task in done_tasks:
                try:
                    results.append(task.result())
                except Exception as task_err:
                    results.append(task_err)

            for task in pending_tasks:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    results.append("cancelled")
                except Exception as task_err:
                    results.append(task_err)

            print(f"✅ Handlers completed with results: {results}")
        except Exception as orchestration_error:
            print(f"❌ Error orchestrating realtime handlers: {orchestration_error}")
            import traceback

            traceback.print_exc()
            raise
    except Exception as orchestration_error:
        print(f"❌ Unhandled error in voice_websocket: {orchestration_error}")
        import traceback

        traceback.print_exc()
        await finalize_session("exception")
        raise
    finally:
        await finalize_session("closed")
        print(f"🧹 Cleaning up session {session_id}")
        try:
            await realtime_client.disconnect()
        except Exception as cleanup_err:
            print(f"⚠️  Error during realtime client cleanup: {cleanup_err}")


# ==================== Customer Management Endpoints ====================


@app.post("/api/customers")
async def create_customer(
    name: str, phone: str, email: Optional[str] = None, db: Session = Depends(get_db)
):
    """Create a new customer."""
    # Check if customer exists
    existing = db.query(Customer).filter(Customer.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Customer with this phone already exists"
        )

    customer = Customer(name=name, phone=phone, email=email)
    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get customer details."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


@app.get("/api/customers/{customer_id}/history")
async def get_customer_history(customer_id: int, db: Session = Depends(get_db)):
    """Get customer's appointment and call history."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    appointments = (
        db.query(Appointment)
        .filter(Appointment.customer_id == customer_id)
        .order_by(Appointment.appointment_datetime.desc())
        .all()
    )

    calls = (
        db.query(CallSession)
        .filter(CallSession.customer_id == customer_id)
        .order_by(CallSession.started_at.desc())
        .all()
    )

    return {"customer": customer, "appointments": appointments, "calls": calls}


# ==================== Admin Dashboard Endpoints ====================


@app.get("/api/admin/metrics/overview")
async def get_metrics_overview(
    period: str = Query("today", regex="^(today|week|month)$"),
    db: Session = Depends(get_db),
):
    """Get overview metrics for dashboard."""
    return AnalyticsService.get_dashboard_overview(db, period)


@app.get("/api/admin/calls")
async def get_call_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: str = Query(
        "started_at", regex="^(started_at|duration_seconds|satisfaction_score)$"
    ),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Get paginated call history."""
    return AnalyticsService.get_call_history(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@app.get("/api/admin/calls/{call_id}")
async def get_call_details(call_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific call."""
    call = db.query(CallSession).filter(CallSession.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Get associated customer
    customer = None
    if call.customer_id:
        customer = db.query(Customer).filter(Customer.id == call.customer_id).first()

    # Get call events
    from database import CallEvent

    events = (
        db.query(CallEvent)
        .filter(CallEvent.call_session_id == call_id)
        .order_by(CallEvent.timestamp.asc())
        .all()
    )

    import json

    transcript = json.loads(call.transcript) if call.transcript else []

    return {
        "call": {
            "id": call.id,
            "session_id": call.session_id,
            "started_at": call.started_at,
            "ended_at": call.ended_at,
            "duration_seconds": call.duration_seconds,
            "phone_number": call.phone_number,
            "satisfaction_score": call.satisfaction_score,
            "sentiment": call.sentiment,
            "outcome": call.outcome,
            "escalated": call.escalated,
            "escalation_reason": call.escalation_reason,
        },
        "customer": customer,
        "transcript": transcript,
        "events": events,
    }


@app.get("/api/admin/calls/{call_id}/transcript")
async def get_call_transcript(call_id: int, db: Session = Depends(get_db)):
    """Get call transcript."""
    call = db.query(CallSession).filter(CallSession.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    import json

    transcript = json.loads(call.transcript) if call.transcript else []

    return {"call_id": call_id, "transcript": transcript}


@app.get("/api/admin/analytics/daily")
async def get_daily_analytics(
    days: int = Query(30, ge=1, le=90), db: Session = Depends(get_db)
):
    """Get daily analytics for the specified number of days."""
    from datetime import timedelta

    from database import DailyMetric

    start_date = datetime.utcnow().date() - timedelta(days=days)

    metrics = (
        db.query(DailyMetric)
        .filter(DailyMetric.date >= start_date)
        .order_by(DailyMetric.date.asc())
        .all()
    )

    return {
        "metrics": [
            {
                "date": m.date.isoformat(),
                "total_calls": m.total_calls,
                "appointments_booked": m.appointments_booked,
                "avg_satisfaction_score": m.avg_satisfaction_score,
                "conversion_rate": m.conversion_rate,
                "avg_call_duration_minutes": round(m.avg_call_duration_seconds / 60, 2),
            }
            for m in metrics
        ]
    }


@app.get("/api/admin/analytics/timeseries")
async def get_timeseries_analytics(
    period: str = Query("week", regex="^(today|week|month)$"),
    interval: str = Query("hour", regex="^(hour|day)$"),
    db: Session = Depends(get_db),
):
    """Get time-series metrics for charting."""
    return AnalyticsService.get_timeseries_metrics(
        db=db, period=period, interval=interval
    )


@app.get("/api/admin/analytics/funnel")
async def get_conversion_funnel(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db),
):
    """Get conversion funnel metrics."""
    return AnalyticsService.get_conversion_funnel(db=db, period=period)


@app.get("/api/admin/analytics/peak-hours")
async def get_peak_hours(
    period: str = Query("week", regex="^(week|month)$"), db: Session = Depends(get_db)
):
    """Get peak hours heatmap data."""
    return AnalyticsService.get_peak_hours(db=db, period=period)


@app.get("/api/admin/analytics/channel-distribution")
async def get_channel_distribution(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db),
):
    """Get channel distribution data."""
    return AnalyticsService.get_channel_distribution(db=db, period=period)


@app.get("/api/admin/analytics/outcome-distribution")
async def get_outcome_distribution(
    period: str = Query("week", regex="^(today|week|month)$"),
    db: Session = Depends(get_db),
):
    """Get outcome distribution data."""
    return AnalyticsService.get_outcome_distribution(db=db, period=period)


@app.get("/api/admin/customers")
async def get_customers_list(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get customers list with search and pagination."""
    from sqlalchemy import case

    # Build subquery for conversation counts (optimized - single query instead of N queries)
    conversation_counts = (
        db.query(
            Conversation.customer_id,
            func.count(Conversation.id).label("conversation_count"),
            func.sum(
                case((Conversation.outcome == "appointment_scheduled", 1), else_=0)
            ).label("booking_count"),
        )
        .group_by(Conversation.customer_id)
        .subquery()
    )

    # Main query with left join to get counts
    query = db.query(
        Customer,
        func.coalesce(conversation_counts.c.conversation_count, 0).label(
            "conversation_count"
        ),
        func.coalesce(conversation_counts.c.booking_count, 0).label("booking_count"),
    ).outerjoin(conversation_counts, Customer.id == conversation_counts.c.customer_id)

    # Apply search filter - handle potential null values
    if search:
        query = query.filter(
            (Customer.name.ilike(f"%{search}%"))
            | (Customer.phone.ilike(f"%{search}%"))
            | (Customer.email.ilike(f"%{search}%"))
        )

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    results = (
        query.order_by(Customer.created_at.desc()).offset(offset).limit(page_size).all()
    )

    # Serialize results
    serialized = []
    for customer, conversation_count, booking_count in results:
        serialized.append(
            {
                "id": customer.id,
                "name": customer.name or "",
                "phone": customer.phone or "",
                "email": customer.email,
                "created_at": (
                    customer.created_at.isoformat() if customer.created_at else None
                ),
                "conversation_count": int(conversation_count),
                "booking_count": int(booking_count),
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "customers": serialized,
    }


@app.get("/api/admin/customers/{customer_id}/timeline")
async def get_customer_timeline(
    customer_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get conversation timeline for a specific customer."""
    try:
        return AnalyticsService.get_customer_timeline(
            db=db, customer_id=customer_id, limit=limit
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== Appointments Endpoints ====================


@app.get("/api/appointments")
async def get_appointments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get appointments with optional filters."""
    query = db.query(Appointment)

    if start_date:
        # Replace 'Z' with '+00:00' for Python 3.8 compatibility
        start_date_normalized = start_date.replace("Z", "+00:00")
        start = datetime.fromisoformat(start_date_normalized)
        query = query.filter(Appointment.appointment_datetime >= start)

    if end_date:
        # Replace 'Z' with '+00:00' for Python 3.8 compatibility
        end_date_normalized = end_date.replace("Z", "+00:00")
        end = datetime.fromisoformat(end_date_normalized)
        query = query.filter(Appointment.appointment_datetime <= end)

    if status:
        query = query.filter(Appointment.status == status)

    appointments = query.order_by(Appointment.appointment_datetime.desc()).all()
    return {"appointments": appointments}


# ==================== Omnichannel Communications Endpoints (Phase 2) ====================


@app.get("/api/admin/communications")
async def get_communications(
    customer_id: Optional[int] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """
    Get conversations with filtering and pagination.
    Replaces /api/admin/calls for omnichannel support.
    """
    from sqlalchemy.orm import joinedload

    from database import Conversation, Customer

    query = db.query(Conversation).options(joinedload(Conversation.customer))

    # Apply filters
    if customer_id:
        query = query.filter(Conversation.customer_id == customer_id)
    if channel:
        query = query.filter(Conversation.channel == channel)
    if status:
        query = query.filter(Conversation.status == status)

    # Get total count
    total = query.count()

    # Apply pagination and sorting
    offset = (page - 1) * page_size
    conversations = (
        query.order_by(Conversation.last_activity_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Serialize conversations
    serialized = []
    for conv in conversations:
        serialized.append(
            {
                "id": str(conv.id),
                "customer_id": conv.customer_id,
                "customer_name": conv.customer.name if conv.customer else None,
                "customer_phone": conv.customer.phone if conv.customer else None,
                "channel": conv.channel,
                "status": conv.status,
                "initiated_at": (
                    conv.initiated_at.isoformat() if conv.initiated_at else None
                ),
                "last_activity_at": (
                    conv.last_activity_at.isoformat() if conv.last_activity_at else None
                ),
                "completed_at": (
                    conv.completed_at.isoformat() if conv.completed_at else None
                ),
                "satisfaction_score": conv.satisfaction_score,
                "sentiment": conv.sentiment,
                "outcome": conv.outcome,
                "subject": conv.subject,
                "ai_summary": conv.ai_summary,
                "metadata": conv.custom_metadata,
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "conversations": serialized,
    }


@app.get("/api/admin/communications/{conversation_id}")
async def get_conversation_detail(conversation_id: str, db: Session = Depends(get_db)):
    """
    Get full conversation with all messages, events, and channel-specific details.
    """
    from uuid import UUID

    from sqlalchemy.orm import joinedload

    from database import Conversation

    try:
        conv_uuid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID format")

    conversation = (
        db.query(Conversation)
        .options(
            joinedload(Conversation.messages),
            joinedload(Conversation.events),
            joinedload(Conversation.customer),
        )
        .filter(Conversation.id == conv_uuid)
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Serialize messages with channel-specific details
    messages = []
    for msg in sorted(conversation.messages, key=lambda m: m.sent_at):
        msg_data = {
            "id": str(msg.id),
            "direction": msg.direction,
            "content": msg.content,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "processed": msg.processed,
            "metadata": msg.custom_metadata,
        }

        # Add channel-specific details
        if conversation.channel == "voice" and msg.voice_details:
            msg_data["voice"] = {
                "duration_seconds": msg.voice_details.duration_seconds,
                "recording_url": msg.voice_details.recording_url,
                "transcript_segments": msg.voice_details.transcript_segments,
                "function_calls": msg.voice_details.function_calls,
                "interruption_count": msg.voice_details.interruption_count,
            }
        elif conversation.channel == "sms" and msg.sms_details:
            msg_data["sms"] = {
                "from_number": msg.sms_details.from_number,
                "to_number": msg.sms_details.to_number,
                "provider_message_id": msg.sms_details.provider_message_id,
                "delivery_status": msg.sms_details.delivery_status,
                "segments": msg.sms_details.segments,
                "delivered_at": (
                    msg.sms_details.delivered_at.isoformat()
                    if msg.sms_details.delivered_at
                    else None
                ),
            }
        elif conversation.channel == "email" and msg.email_details:
            msg_data["email"] = {
                "subject": msg.email_details.subject,
                "from_address": msg.email_details.from_address,
                "to_address": msg.email_details.to_address,
                "body_html": msg.email_details.body_html,
                "attachments": msg.email_details.attachments,
                "opened_at": (
                    msg.email_details.opened_at.isoformat()
                    if msg.email_details.opened_at
                    else None
                ),
            }

        messages.append(msg_data)

    # Serialize events
    events = []
    for event in sorted(conversation.events, key=lambda e: e.timestamp):
        events.append(
            {
                "id": str(event.id),
                "event_type": event.event_type,
                "timestamp": event.timestamp.isoformat() if event.timestamp else None,
                "details": event.details,
                "message_id": str(event.message_id) if event.message_id else None,
            }
        )

    return {
        "conversation": {
            "id": str(conversation.id),
            "customer": (
                {
                    "id": conversation.customer.id,
                    "name": conversation.customer.name,
                    "phone": conversation.customer.phone,
                    "email": conversation.customer.email,
                }
                if conversation.customer
                else None
            ),
            "channel": conversation.channel,
            "status": conversation.status,
            "initiated_at": (
                conversation.initiated_at.isoformat()
                if conversation.initiated_at
                else None
            ),
            "last_activity_at": (
                conversation.last_activity_at.isoformat()
                if conversation.last_activity_at
                else None
            ),
            "completed_at": (
                conversation.completed_at.isoformat()
                if conversation.completed_at
                else None
            ),
            "satisfaction_score": conversation.satisfaction_score,
            "sentiment": conversation.sentiment,
            "outcome": conversation.outcome,
            "subject": conversation.subject,
            "ai_summary": conversation.ai_summary,
            "metadata": conversation.custom_metadata,
        },
        "messages": messages,
        "events": events,
    }


# ==================== Webhook Endpoints (Phase 2) ====================


@app.post("/api/webhooks/twilio/sms")
async def handle_twilio_sms(request: Request, db: Session = Depends(get_db)):
    """
    Twilio SMS webhook handler.
    Receives incoming SMS, finds or creates conversation, generates AI response.
    """
    # TODO: Implement Twilio SMS handling
    # 1. Parse incoming SMS from Twilio webhook
    # 2. Find or create customer by phone number
    # 3. Find active SMS conversation or create new one
    # 4. Add inbound message
    # 5. Generate AI response (use GPT-4 or similar)
    # 6. Send outbound SMS via Twilio
    # 7. Add outbound message to conversation
    # 8. If conversation complete, score satisfaction

    from twilio.twiml.messaging_response import MessagingResponse

    # Placeholder response
    resp = MessagingResponse()
    resp.message("Thank you for contacting us! This feature is coming soon.")

    return Response(content=str(resp), media_type="application/xml")


@app.post("/api/webhooks/sendgrid/email")
async def handle_sendgrid_email(request: Request, db: Session = Depends(get_db)):
    """
    SendGrid inbound email webhook handler.
    Receives incoming emails, finds or creates conversation, generates AI response.
    """
    # TODO: Implement SendGrid email handling
    # 1. Parse incoming email from SendGrid webhook
    # 2. Find or create customer by email address
    # 3. Find email thread or create new conversation
    # 4. Add inbound message
    # 5. Generate AI response
    # 6. Send outbound email via SendGrid
    # 7. Add outbound message to conversation
    # 8. If conversation complete, score satisfaction

    return {"status": "received", "message": "Email webhook handler coming soon"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
