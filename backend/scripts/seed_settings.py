#!/usr/bin/env python3
"""
Seed med spa settings from config.py into database.
This script migrates hardcoded configuration values to the database.
"""
import sys
from datetime import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import CANCELLATION_POLICY, PROVIDERS, SERVICES, get_settings
from database import (
    BusinessHours,
    Location,
    MedSpaSettings,
    Provider,
    Service,
    SessionLocal,
)


def seed_med_spa_settings():
    """Seed general med spa settings."""
    settings = get_settings()
    db = SessionLocal()

    try:
        # Check if settings already exist
        existing = db.query(MedSpaSettings).first()
        if existing:
            print("⚠ Med spa settings already exist, skipping...")
            return

        settings_record = MedSpaSettings(
            id=1,
            name=settings.MED_SPA_NAME,
            phone=settings.MED_SPA_PHONE,
            email=settings.MED_SPA_EMAIL,
            website="",  # Not in current config
            timezone="America/New_York",
            ai_assistant_name=settings.AI_ASSISTANT_NAME,
            cancellation_policy=CANCELLATION_POLICY,
        )

        db.add(settings_record)
        db.commit()
        print(f"✓ Created med spa settings: {settings.MED_SPA_NAME}")

    except Exception as e:
        db.rollback()
        print(f"✗ Error creating settings: {e}")
        raise
    finally:
        db.close()


def seed_locations():
    """Seed primary location."""
    settings = get_settings()
    db = SessionLocal()

    try:
        # Check if location already exists
        existing = db.query(Location).first()
        if existing:
            print("⚠ Locations already exist, skipping...")
            return

        location = Location(
            name="Main Location",
            address=settings.MED_SPA_ADDRESS,
            phone=settings.MED_SPA_PHONE,
            is_primary=True,
            is_active=True,
        )

        db.add(location)
        db.commit()
        print(f"✓ Created location: {location.name}")

        # Create business hours for this location
        seed_business_hours(db, location.id)

    except Exception as e:
        db.rollback()
        print(f"✗ Error creating location: {e}")
        raise
    finally:
        db.close()


def seed_business_hours(db, location_id):
    """Seed business hours from MED_SPA_HOURS."""
    # Parse "Monday-Friday: 9am-7pm, Saturday: 10am-5pm, Sunday: Closed"
    # For simplicity, we'll create a default schedule
    # This can be customized later through the UI

    hours_schedule = [
        # Monday-Friday: 9am-7pm
        (0, time(9, 0), time(19, 0), False),  # Monday
        (1, time(9, 0), time(19, 0), False),  # Tuesday
        (2, time(9, 0), time(19, 0), False),  # Wednesday
        (3, time(9, 0), time(19, 0), False),  # Thursday
        (4, time(9, 0), time(19, 0), False),  # Friday
        # Saturday: 10am-5pm
        (5, time(10, 0), time(17, 0), False),  # Saturday
        # Sunday: Closed
        (6, None, None, True),  # Sunday
    ]

    for day, open_time, close_time, is_closed in hours_schedule:
        hours = BusinessHours(
            location_id=location_id,
            day_of_week=day,
            open_time=open_time,
            close_time=close_time,
            is_closed=is_closed,
        )
        db.add(hours)

    db.commit()
    print(f"✓ Created business hours for location {location_id}")


def seed_services():
    """Seed services from SERVICES dict in config.py."""
    db = SessionLocal()

    try:
        # Check if services already exist
        existing = db.query(Service).first()
        if existing:
            print("⚠ Services already exist, skipping...")
            return

        # Service categories mapping
        category_map = {
            "botox": "injectables",
            "dermal_fillers": "injectables",
            "laser_hair_removal": "body",
            "hydrafacial": "skincare",
            "chemical_peel": "skincare",
            "microneedling": "skincare",
            "coolsculpting": "body",
            "prp_facial": "skincare",
            "consultation": "other",
        }

        display_order = 0
        for slug, service_data in SERVICES.items():
            service = Service(
                name=service_data["name"],
                slug=slug,
                description=service_data["description"],
                duration_minutes=service_data["duration_minutes"],
                price_display=service_data["price_range"],
                prep_instructions=service_data["prep_instructions"],
                aftercare_instructions=service_data["aftercare"],
                category=category_map.get(slug, "other"),
                is_active=True,
                display_order=display_order,
            )

            # Parse price_range if it's in format "$X-$Y"
            price_range = service_data["price_range"]
            if price_range != "Complimentary" and "$" in price_range:
                try:
                    # Extract numbers from "$300-$600" or "$600-$1200 per syringe"
                    price_part = price_range.split("per")[0].strip()
                    if "-" in price_part:
                        min_str, max_str = price_part.split("-")
                        service.price_min = float(
                            min_str.replace("$", "").replace(",", "")
                        )
                        service.price_max = float(
                            max_str.replace("$", "").replace(",", "")
                        )
                except:
                    pass  # Keep as None if parsing fails

            db.add(service)
            display_order += 1

        db.commit()
        print(f"✓ Created {len(SERVICES)} services")

    except Exception as e:
        db.rollback()
        print(f"✗ Error creating services: {e}")
        raise
    finally:
        db.close()


def seed_providers():
    """Seed providers from PROVIDERS dict in config.py."""
    db = SessionLocal()

    try:
        # Check if providers already exist
        existing = db.query(Provider).first()
        if existing:
            print("⚠ Providers already exist, skipping...")
            return

        for provider_id, provider_data in PROVIDERS.items():
            # Map config.py fields to actual Provider model fields
            # Provider model (main branch) has: name, email, phone, specialties, hire_date, avatar_url, bio, is_active
            # Config has: name, title, specialties, credentials
            # We'll store title and credentials in the bio field for now

            bio_parts = []
            if provider_data.get("title"):
                bio_parts.append(provider_data["title"])
            if provider_data.get("credentials"):
                bio_parts.append(provider_data["credentials"])

            # Generate email from name (temporary solution until real emails are provided)
            email = (
                provider_data["name"]
                .lower()
                .replace(" ", ".")
                .replace("dr.", "")
                .replace("nurse", "")
                .replace("esthetician", "")
                + "@luxurymedspa.com"
            )

            provider = Provider(
                name=provider_data["name"],
                email=email,
                phone=None,  # Not in config
                specialties=provider_data["specialties"],
                bio=" | ".join(bio_parts) if bio_parts else "",
                is_active=True,
                hire_date=None,
                avatar_url=None,
            )

            db.add(provider)

        db.commit()
        print(f"✓ Created {len(PROVIDERS)} providers")

    except Exception as e:
        db.rollback()
        print(f"✗ Error creating providers: {e}")
        raise
    finally:
        db.close()


def main():
    """Run all seed functions."""
    print("🌱 Seeding med spa settings from config.py...\n")

    seed_med_spa_settings()
    seed_locations()
    seed_services()
    seed_providers()

    print("\n✅ Settings seeded successfully!")
    print("You can now manage these values through the admin dashboard.")


if __name__ == "__main__":
    main()
