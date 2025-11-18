"""Create Supabase database schema from SQLAlchemy models.

Usage:
    python backend/scripts/create_supabase_schema.py

This script loads environment variables, verifies the DATABASE_URL points to
Supabase (non-SQLite), and executes Base.metadata.create_all against the
configured engine. It is idempotent and safe to rerun.
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
from database import Base, engine  # noqa: E402


def main() -> None:
    settings = get_settings()

    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL points to SQLite. Update .env to use the Supabase "
            "connection string before running this script."
        )
        sys.exit(1)

    print("Creating tables on Supabase at:")
    print(f"  {settings.DATABASE_URL}")

    Base.metadata.create_all(bind=engine)
    print("✔️  Schema creation completed. Tables are created if they did not exist.")


if __name__ == "__main__":
    main()
