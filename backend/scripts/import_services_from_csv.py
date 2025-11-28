#!/usr/bin/env python3
"""Import med spa services from a CSV file into the Service table.

Usage:
    PYTHONPATH=backend python scripts/import_services_from_csv.py path/to/Category-Service-Description-Price-Length.csv

This script will:
- DELETE all existing Service rows (hard replace), then
- Insert one Service per CSV row, mapping Category/Service/Description/Price/Length

It is intended for local/dev use to align the service catalog with a
single CSV source of truth.
"""
from __future__ import annotations

import csv
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional, Tuple

# Add backend root to path for imports
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import SessionLocal, Service  # noqa: E402
from settings_service import SettingsService  # noqa: E402


EXPECTED_HEADERS = {"Category", "Service", "Description", "Price", "Length"}


def _parse_duration_minutes(length_str: str) -> int:
    """Parse a length like "30 min" into an integer minute value."""
    text = (length_str or "").strip().lower()
    match = re.search(r"(\d+)", text)
    if not match:
        return 30
    try:
        return int(match.group(1))
    except ValueError:
        return 30


def _parse_price(
    price_str: str,
    name: str,
    category_raw: str,
    description: str,
) -> Tuple[str, Optional[Decimal], Optional[Decimal]]:
    """Map CSV price into (price_display, price_min, price_max).

    - $0.00 for true consults -> "Complimentary" (no numeric min/max)
    - $0.00 for treatments with text like "cost determined" ->
      "Cost determined at appointment" (no numeric min/max)
    - Non-zero price -> fixed price (min=max=amount)
    """
    raw = (price_str or "").strip()
    desc_lower = (description or "").lower()
    category = (category_raw or "").upper().strip()

    zeroish = raw in {"$0.00", "$0", "0", "0.00", ""}

    if zeroish:
        if category == "CONSULTATION" or "consult" in name.lower():
            return "Complimentary", None, None
        if "cost determined" in desc_lower or "determined at appointment" in desc_lower:
            return "Cost determined at appointment", None, None
        # Fallback for unknown zero pricing
        return "Contact for pricing", None, None

    # Non-zero: treat as a fixed price
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        # If parsing fails, fall back to display-only
        return raw, None, None

    # Display as integer dollars when appropriate
    if amount == amount.to_integral():
        display = f"${int(amount)}"
    else:
        display = f"${amount:.2f}"

    return display, amount, amount


def _slug_for_name(name: str) -> str:
    """Generate a URL-friendly slug from a service name."""
    base = name.strip().lower()
    # Replace common punctuation with spaces
    base = re.sub(r"[&+/]", " ", base)
    # Collapse non-alphanumeric characters to underscores
    base = re.sub(r"[^a-z0-9]+", "_", base)
    base = base.strip("_")
    return base or "service"


# Override slugs for backward compatibility with existing code/tests
SLUG_OVERRIDES = {
    # Keep "botox" as the canonical key used throughout tests and prompts
    "Wrinkle Relaxer - (Botox/Dysport/Xeomin/Jeuveau)": "botox",
    # Preserve legacy slugs where possible
    "Dermal Filler": "dermal_fillers",
    "HydraFacial": "hydrafacial",
    "Chemical Peel": "chemical_peel",
    # Generic consultation slug will be created from the first matching row
}


CATEGORY_MAP = {
    "CONSULTATION": "consultation",
    "INJECTABLES": "injectables",
    "SKIN REJUVENATION": "skin_rejuvenation",
    "SPA SERVICES": "spa_services",
    "WELLNESS": "wellness",
}


def import_services(csv_path: Path) -> None:
    db = SessionLocal()
    try:
        # Hard replace: clear existing services
        deleted = db.query(Service).delete()
        db.commit()
        print(f"⚠ Deleted {deleted} existing services")

        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            headers = {h.strip() for h in (reader.fieldnames or [])}
            if not EXPECTED_HEADERS.issubset(headers):
                raise RuntimeError(
                    f"CSV missing expected headers. Found {headers}, expected at least {EXPECTED_HEADERS}"
                )

            display_order = 0
            used_slugs: set[str] = set()
            created = 0

            for row in reader:
                category_raw = (row.get("Category") or "").strip()
                name = (row.get("Service") or "").strip()
                description = (row.get("Description") or "").strip()
                price_str = (row.get("Price") or "").strip()
                length_str = (row.get("Length") or "").strip()

                if not name:
                    continue

                duration_minutes = _parse_duration_minutes(length_str)
                price_display, price_min, price_max = _parse_price(
                    price_str, name, category_raw, description
                )

                # Category normalization
                category = CATEGORY_MAP.get(
                    category_raw.upper().strip(), category_raw.lower().strip()
                ) or None

                # Slug with overrides and uniqueness enforcement
                slug = SLUG_OVERRIDES.get(name) or _slug_for_name(name)
                base_slug = slug
                suffix = 2
                while slug in used_slugs:
                    slug = f"{base_slug}_{suffix}"
                    suffix += 1
                used_slugs.add(slug)

                service_data = {
                    "name": name,
                    "slug": slug,
                    "description": description,
                    "duration_minutes": duration_minutes,
                    "price_display": price_display,
                    "category": category,
                    "is_active": True,
                    "display_order": display_order,
                }

                if price_min is not None:
                    service_data["price_min"] = float(price_min)
                if price_max is not None:
                    service_data["price_max"] = float(price_max)

                SettingsService.create_service(db, service_data)
                display_order += 1
                created += 1

        print(f"✓ Imported {created} services from {csv_path}")

    finally:
        db.close()


def main(argv: list[str]) -> None:
    if len(argv) != 2:
        print(
            "Usage: PYTHONPATH=backend python scripts/import_services_from_csv.py "
            "path/to/Category-Service-Description-Price-Length.csv",
        )
        sys.exit(1)

    csv_path = Path(argv[1]).expanduser()
    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}")
        sys.exit(1)

    import_services(csv_path)


if __name__ == "__main__":  # pragma: no cover - script entrypoint
    main(sys.argv)
