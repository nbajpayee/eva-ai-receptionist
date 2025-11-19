"""Create Provider Analytics database schema in Supabase.

This script creates the tables for:
- providers: Med spa staff/practitioners
- in_person_consultations: Voice recordings and transcripts of in-person consultations
- ai_insights: AI-generated coaching insights and best practices
- provider_performance_metrics: Aggregated performance metrics by time period

Usage:
    python backend/scripts/create_provider_analytics_schema.py

This script is idempotent and safe to rerun.
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

# Ensure project root is on sys.path before importing application modules
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Load environment variables from project root .env before importing settings
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from config import get_settings  # noqa: E402
from database import (  # noqa: E402
    AIInsight,
    Base,
    InPersonConsultation,
    Provider,
    ProviderPerformanceMetric,
    engine,
)


def main() -> None:
    settings = get_settings()

    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL points to SQLite. Update .env to use the Supabase "
            "connection string before running this script."
        )
        sys.exit(1)

    print("Creating Provider Analytics tables on Supabase at:")
    print(f"  {settings.DATABASE_URL}")

    # Create only the provider analytics tables
    tables = [
        Provider.__table__,
        InPersonConsultation.__table__,
        AIInsight.__table__,
        ProviderPerformanceMetric.__table__,
    ]

    for table in tables:
        print(f"  Creating table: {table.name}")

    Base.metadata.create_all(bind=engine, tables=tables)
    print("✔️  Provider Analytics schema creation completed.")


if __name__ == "__main__":
    main()
