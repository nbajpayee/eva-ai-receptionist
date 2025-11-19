"""Create omnichannel communications schema on Supabase.

This script creates the new conversations, communication_messages, and related tables
for Phase 2 omnichannel support (voice, SMS, email). It is safe to run alongside
existing tables and is idempotent.

Usage:
    python backend/scripts/create_omnichannel_schema.py

See OMNICHANNEL_MIGRATION.md for full architecture details.
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

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
from database import CommunicationEvent  # noqa: E402
from database import (
    Base,
    CommunicationMessage,
    Conversation,
    EmailDetails,
    SMSDetails,
    VoiceCallDetails,
    engine,
)


def create_omnichannel_tables():
    """Create omnichannel schema tables."""
    print("\n📋 Creating Omnichannel Communications Schema...")
    print("=" * 60)

    # Create tables using SQLAlchemy metadata
    # This will create only the tables that don't exist yet
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Conversation.__table__,
            CommunicationMessage.__table__,
            VoiceCallDetails.__table__,
            EmailDetails.__table__,
            SMSDetails.__table__,
            CommunicationEvent.__table__,
        ],
    )

    print("\n✅ Tables created (if they didn't exist):")
    print("   - conversations")
    print("   - communication_messages")
    print("   - voice_call_details")
    print("   - email_details")
    print("   - sms_details")
    print("   - communication_events")


def create_additional_indexes():
    """Create additional performance indexes beyond SQLAlchemy defaults."""
    print("\n📊 Creating Additional Indexes...")
    print("=" * 60)

    with engine.connect() as conn:
        # Additional indexes for better query performance
        # These complement the indexes already defined in the SQLAlchemy models

        indexes = [
            # Composite indexes for common queries
            "CREATE INDEX IF NOT EXISTS idx_conversations_customer_last_activity ON conversations(customer_id, last_activity_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON communication_messages(conversation_id, sent_at ASC);",
            "CREATE INDEX IF NOT EXISTS idx_events_conversation_timestamp ON communication_events(conversation_id, timestamp ASC);",
            # Channel-specific queries
            "CREATE INDEX IF NOT EXISTS idx_conversations_channel_last_activity ON conversations(channel, last_activity_at DESC);",
            # Status-based queries
            "CREATE INDEX IF NOT EXISTS idx_conversations_status_initiated ON conversations(status, initiated_at DESC);",
        ]

        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                # Extract index name from SQL
                idx_name = (
                    idx_sql.split("idx_")[1].split(" ON")[0]
                    if "idx_" in idx_sql
                    else "unknown"
                )
                print(f"   ✓ idx_{idx_name}")
            except Exception as e:
                print(f"   ⚠️  Error creating index: {e}")

        conn.commit()

    print("\n✅ Additional indexes created")


def verify_schema():
    """Verify that all tables and key columns exist."""
    print("\n🔍 Verifying Schema...")
    print("=" * 60)

    with engine.connect() as conn:
        # Check if tables exist
        tables = [
            "conversations",
            "communication_messages",
            "voice_call_details",
            "email_details",
            "sms_details",
            "communication_events",
        ]

        for table in tables:
            result = conn.execute(
                text(
                    f"SELECT COUNT(*) FROM information_schema.tables "
                    f"WHERE table_name = '{table}'"
                )
            )
            count = result.scalar()

            if count > 0:
                print(f"   ✓ {table}")
            else:
                print(f"   ✗ {table} NOT FOUND")

    print("\n✅ Schema verification complete")


def main() -> None:
    settings = get_settings()

    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL points to SQLite. Update .env to use the Supabase "
            "connection string before running this script."
        )
        sys.exit(1)

    print("\n🚀 Omnichannel Schema Creation Script")
    print("=" * 60)
    print(
        f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}"
    )
    print("=" * 60)

    # Create tables
    create_omnichannel_tables()

    # Create additional indexes
    create_additional_indexes()

    # Verify schema
    verify_schema()

    print("\n" + "=" * 60)
    print("✨ Omnichannel schema creation complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run migration script to backfill call_sessions → conversations")
    print("2. Test voice calls create conversations correctly")
    print("3. Update analytics.py to use new schema")
    print("\nSee OMNICHANNEL_MIGRATION.md for full migration plan.")
    print()


if __name__ == "__main__":
    main()
