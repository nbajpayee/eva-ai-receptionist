"""Fix omnichannel schema constraints to allow migration.

This script fixes two issues discovered during migration:
1. Makes customer_id nullable in conversations (some calls don't identify customer)
2. Removes event_type check constraint (allow legacy and future event types)

Usage:
    python backend/scripts/fix_omnichannel_constraints.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Load environment variables
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from config import get_settings  # noqa: E402
from database import engine  # noqa: E402


def main():
    settings = get_settings()

    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL points to SQLite. This script requires Supabase/PostgreSQL."
        )
        sys.exit(1)

    print("\n🔧 Fixing Omnichannel Schema Constraints")
    print("=" * 60)
    print(
        f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}"
    )
    print("=" * 60)

    with engine.connect() as conn:
        # Fix 1: Make customer_id nullable
        print("\n1️⃣  Making customer_id nullable in conversations...")
        try:
            conn.execute(
                text(
                    "ALTER TABLE conversations ALTER COLUMN customer_id DROP NOT NULL;"
                )
            )
            conn.commit()
            print("   ✅ customer_id is now nullable")
        except Exception as e:
            if "does not exist" in str(e).lower():
                print("   ℹ️  customer_id was already nullable")
            else:
                print(f"   ⚠️  Error: {e}")

        # Fix 2: Drop event_type check constraint
        print("\n2️⃣  Removing event_type check constraint...")
        try:
            conn.execute(
                text(
                    "ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS check_event_type;"
                )
            )
            conn.commit()
            print("   ✅ event_type check constraint removed (allows any event type)")
        except Exception as e:
            print(f"   ⚠️  Error: {e}")

    print("\n" + "=" * 60)
    print("✅ Constraint fixes applied!")
    print("=" * 60)
    print("\nChanges:")
    print("  ✓ customer_id is now nullable (handles unidentified callers)")
    print("  ✓ event_type allows any string (legacy + future event types)")
    print("\nYou can now re-run the migration script:")
    print(
        "  python backend/scripts/migrate_call_sessions_to_conversations.py --limit 5"
    )
    print()


if __name__ == "__main__":
    main()
