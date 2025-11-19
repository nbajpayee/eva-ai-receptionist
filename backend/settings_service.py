"""
Settings service for managing med spa configuration.
Provides CRUD operations for settings, locations, services, and providers.
"""

from datetime import time
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import BusinessHours, Location, MedSpaSettings, Provider, Service


class SettingsService:
    """Service for managing med spa settings."""

    _services_version = 0
    _providers_version = 0

    @classmethod
    def _bump_services_version(cls) -> None:
        cls._services_version += 1

    @classmethod
    def _bump_providers_version(cls) -> None:
        cls._providers_version += 1

    @classmethod
    def get_services_version(cls) -> int:
        return cls._services_version

    @classmethod
    def get_providers_version(cls) -> int:
        return cls._providers_version

    @staticmethod
    def get_settings(db: Session) -> Optional[MedSpaSettings]:
        """Get med spa settings (singleton)."""
        return db.query(MedSpaSettings).first()

    @staticmethod
    def update_settings(db: Session, settings_data: dict) -> MedSpaSettings:
        """Update med spa settings."""
        settings = db.query(MedSpaSettings).first()

        if not settings:
            # Create if doesn't exist
            settings = MedSpaSettings(id=1, **settings_data)
            db.add(settings)
        else:
            # Update existing
            for key, value in settings_data.items():
                if hasattr(settings, key):
                    setattr(settings, key, value)

        db.commit()
        db.refresh(settings)
        return settings

    @staticmethod
    def get_primary_location(db: Session) -> Optional[Location]:
        """Get the primary location."""
        return db.query(Location).filter(Location.is_primary == True).first()

    @staticmethod
    def get_all_locations(db: Session, active_only: bool = False) -> List[Location]:
        """Get all locations."""
        query = db.query(Location)
        if active_only:
            query = query.filter(Location.is_active == True)
        return query.order_by(Location.is_primary.desc(), Location.id).all()

    @staticmethod
    def get_location(db: Session, location_id: int) -> Optional[Location]:
        """Get a single location by ID."""
        return db.query(Location).filter(Location.id == location_id).first()

    @staticmethod
    def create_location(db: Session, location_data: dict) -> Location:
        """Create a new location."""
        # If this is set as primary, unset other primaries
        if location_data.get("is_primary"):
            db.query(Location).update({"is_primary": False})

        location = Location(**location_data)
        db.add(location)
        db.commit()
        db.refresh(location)
        return location

    @staticmethod
    def update_location(
        db: Session, location_id: int, location_data: dict
    ) -> Optional[Location]:
        """Update a location."""
        location = db.query(Location).filter(Location.id == location_id).first()
        if not location:
            return None

        # If this is set as primary, unset other primaries
        if location_data.get("is_primary") and not location.is_primary:
            db.query(Location).filter(Location.id != location_id).update(
                {"is_primary": False}
            )

        for key, value in location_data.items():
            if hasattr(location, key):
                setattr(location, key, value)

        db.commit()
        db.refresh(location)
        return location

    @staticmethod
    def delete_location(db: Session, location_id: int) -> bool:
        """Delete a location (soft delete by setting inactive)."""
        location = db.query(Location).filter(Location.id == location_id).first()
        if not location:
            return False

        # Don't allow deleting the only location or primary location
        active_count = (
            db.query(func.count(Location.id))
            .filter(Location.is_active == True)
            .scalar()
        )
        if active_count <= 1:
            raise ValueError("Cannot delete the only active location")

        if location.is_primary:
            raise ValueError(
                "Cannot delete primary location. Set another location as primary first."
            )

        location.is_active = False
        db.commit()
        return True

    @staticmethod
    def get_business_hours(db: Session, location_id: int) -> List[BusinessHours]:
        """Get business hours for a location."""
        return (
            db.query(BusinessHours)
            .filter(BusinessHours.location_id == location_id)
            .order_by(BusinessHours.day_of_week)
            .all()
        )

    @staticmethod
    def update_business_hours(
        db: Session, location_id: int, hours_data: List[dict]
    ) -> List[BusinessHours]:
        """Update business hours for a location (bulk update)."""
        # Delete existing hours
        db.query(BusinessHours).filter(
            BusinessHours.location_id == location_id
        ).delete()

        # Create new hours
        hours = []
        for hour_data in hours_data:
            hour = BusinessHours(location_id=location_id, **hour_data)
            db.add(hour)
            hours.append(hour)

        db.commit()
        return hours

    @staticmethod
    def get_all_services(
        db: Session, active_only: bool = False, category: Optional[str] = None
    ) -> List[Service]:
        """Get all services."""
        query = db.query(Service)

        if active_only:
            query = query.filter(Service.is_active == True)

        if category:
            query = query.filter(Service.category == category)

        return query.order_by(Service.display_order, Service.name).all()

    @staticmethod
    def get_service(db: Session, service_id: int) -> Optional[Service]:
        """Get a single service by ID."""
        return db.query(Service).filter(Service.id == service_id).first()

    @staticmethod
    def get_service_by_slug(db: Session, slug: str) -> Optional[Service]:
        """Get a service by slug."""
        return db.query(Service).filter(Service.slug == slug).first()

    @staticmethod
    def create_service(db: Session, service_data: dict) -> Service:
        """Create a new service."""
        # Generate slug if not provided
        if "slug" not in service_data:
            name = service_data.get("name", "")
            service_data["slug"] = name.lower().replace(" ", "_").replace("-", "_")

        # Set display_order to max + 1 if not provided
        if "display_order" not in service_data:
            max_order = db.query(func.max(Service.display_order)).scalar() or 0
            service_data["display_order"] = max_order + 1

        service = Service(**service_data)
        db.add(service)
        db.commit()
        db.refresh(service)
        SettingsService._bump_services_version()
        return service

    @staticmethod
    def update_service(
        db: Session, service_id: int, service_data: dict
    ) -> Optional[Service]:
        """Update a service."""
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return None

        for key, value in service_data.items():
            if hasattr(service, key):
                setattr(service, key, value)

        db.commit()
        db.refresh(service)
        SettingsService._bump_services_version()
        return service

    @staticmethod
    def delete_service(db: Session, service_id: int) -> bool:
        """Delete a service (soft delete by setting inactive)."""
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return False

        service.is_active = False
        db.commit()
        SettingsService._bump_services_version()
        return True

    @staticmethod
    def reorder_services(db: Session, service_orders: List[dict]) -> bool:
        """
        Reorder services.
        service_orders: List of {id: int, display_order: int}
        """
        for item in service_orders:
            service = db.query(Service).filter(Service.id == item["id"]).first()
            if service:
                service.display_order = item["display_order"]

        db.commit()
        SettingsService._bump_services_version()
        return True

    @staticmethod
    def get_all_providers(db: Session, active_only: bool = False) -> List[Provider]:
        """Get all providers."""
        query = db.query(Provider)

        if active_only:
            query = query.filter(Provider.is_active == True)

        return query.order_by(Provider.name).all()

    @staticmethod
    def get_provider(db: Session, provider_id: str) -> Optional[Provider]:
        """Get a single provider by ID (UUID string)."""
        try:
            import uuid as uuid_lib

            provider_uuid = uuid_lib.UUID(provider_id)
            return db.query(Provider).filter(Provider.id == provider_uuid).first()
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def create_provider(db: Session, provider_data: dict) -> Provider:
        """Create a new provider."""
        # Note: Provider model uses UUID and has these fields:
        # name, email, phone, specialties, hire_date, avatar_url, bio, is_active
        valid_fields = {
            "name",
            "email",
            "phone",
            "specialties",
            "bio",
            "is_active",
            "hire_date",
            "avatar_url",
        }
        filtered_data = {k: v for k, v in provider_data.items() if k in valid_fields}

        provider = Provider(**filtered_data)
        db.add(provider)
        db.commit()
        db.refresh(provider)
        SettingsService._bump_providers_version()
        return provider

    @staticmethod
    def update_provider(
        db: Session, provider_id: str, provider_data: dict
    ) -> Optional[Provider]:
        """Update a provider."""
        try:
            import uuid as uuid_lib

            provider_uuid = uuid_lib.UUID(provider_id)
            provider = db.query(Provider).filter(Provider.id == provider_uuid).first()
        except (ValueError, AttributeError):
            return None

        if not provider:
            return None

        # Only update fields that exist in main Provider model
        valid_fields = {
            "name",
            "email",
            "phone",
            "specialties",
            "bio",
            "is_active",
            "hire_date",
            "avatar_url",
        }
        for key, value in provider_data.items():
            if key in valid_fields and hasattr(provider, key):
                setattr(provider, key, value)

        db.commit()
        db.refresh(provider)
        SettingsService._bump_providers_version()
        return provider

    @staticmethod
    def delete_provider(db: Session, provider_id: str) -> bool:
        """Delete a provider (soft delete by setting inactive)."""
        try:
            import uuid as uuid_lib

            provider_uuid = uuid_lib.UUID(provider_id)
            provider = db.query(Provider).filter(Provider.id == provider_uuid).first()
        except (ValueError, AttributeError):
            return False

        if not provider:
            return False

        provider.is_active = False
        db.commit()
        SettingsService._bump_providers_version()
        return True

    @staticmethod
    def get_services_dict(db: Session) -> Dict[str, Any]:
        """
        Get services in the same format as config.SERVICES for backward compatibility.
        Returns dict keyed by slug with service details.
        """
        services = SettingsService.get_all_services(db, active_only=True)
        services_dict = {}

        for service in services:
            services_dict[service.slug] = {
                "id": service.id,
                "name": service.name,
                "duration_minutes": service.duration_minutes,
                "price_range": (
                    service.price_display
                    or f"${service.price_min}-${service.price_max}"
                    if service.price_min
                    else "Contact for pricing"
                ),
                "description": service.description,
                "prep_instructions": service.prep_instructions or "",
                "aftercare": service.aftercare_instructions or "",
            }

        return services_dict

    @staticmethod
    def get_providers_dict(db: Session) -> List[Dict[str, Any]]:
        """
        Get providers in a structured format for the AI.
        Returns list of provider details (compatible with main branch Provider model).
        """
        providers = SettingsService.get_all_providers(db, active_only=True)
        providers_list = []

        for provider in providers:
            providers_list.append(
                {
                    "id": str(provider.id),
                    "name": provider.name,
                    "email": provider.email,
                    "phone": provider.phone,
                    "specialties": provider.specialties or [],
                    "bio": provider.bio or "",
                }
            )

        return providers_list
