"""
Add database indexes for analytics queries optimization.

This script creates composite indexes to improve performance of:
- Time-series queries (GROUP BY date_trunc)
- Conversion funnel analysis
- Peak hours heatmap
- Customer timeline queries
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import text, Index
from database import engine, Base, Conversation, CommunicationEvent, CommunicationMessage
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_indexes():
    """Create indexes for analytics queries."""

    with engine.connect() as conn:
        try:
            # Index 1: Conversations by initiated_at, channel, outcome
            # Used by: timeseries metrics, conversion funnel
            logger.info("Creating index: conversations_analytics_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS conversations_analytics_idx
                ON conversations (initiated_at, channel, outcome);
                """
            ))

            # Index 2: Conversations by customer_id and initiated_at
            # Used by: customer timeline queries
            logger.info("Creating index: conversations_customer_timeline_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS conversations_customer_timeline_idx
                ON conversations (customer_id, initiated_at DESC)
                WHERE customer_id IS NOT NULL;
                """
            ))

            # Index 3: CommunicationEvent by conversation_id, event_type, timestamp
            # Used by: conversion funnel (function_called events)
            logger.info("Creating index: communication_events_funnel_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS communication_events_funnel_idx
                ON communication_events (conversation_id, event_type, timestamp);
                """
            ))

            # Index 4: CommunicationEvent JSONB GIN index for details
            # Used by: funnel queries filtering on tool name
            logger.info("Creating index: communication_events_details_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS communication_events_details_idx
                ON communication_events USING GIN (details);
                """
            ))

            # Index 5: Conversations for peak hours analysis (day/hour extraction)
            # Used by: peak hours heatmap queries
            logger.info("Creating index: conversations_peak_hours_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS conversations_peak_hours_idx
                ON conversations (initiated_at)
                WHERE initiated_at IS NOT NULL;
                """
            ))

            # Index 6: CommunicationMessage by conversation_id and sent_at
            # Used by: customer timeline message counts
            logger.info("Creating index: communication_messages_timeline_idx...")
            conn.execute(text(
                """
                CREATE INDEX IF NOT EXISTS communication_messages_timeline_idx
                ON communication_messages (conversation_id, sent_at DESC);
                """
            ))

            conn.commit()
            logger.info("✅ All analytics indexes created successfully!")

        except Exception as e:
            logger.error(f"❌ Error creating indexes: {e}")
            conn.rollback()
            raise


def show_indexes():
    """Display all indexes on analytics tables."""

    with engine.connect() as conn:
        result = conn.execute(text(
            """
            SELECT
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN ('conversations', 'communication_events', 'communication_messages')
            ORDER BY tablename, indexname;
            """
        ))

        print("\n📊 Current Indexes:")
        print("-" * 100)
        for row in result:
            print(f"\nTable: {row.tablename}")
            print(f"Index: {row.indexname}")
            print(f"Definition: {row.indexdef}")
        print("-" * 100)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Add analytics database indexes")
    parser.add_argument("--show", action="store_true", help="Show existing indexes")
    args = parser.parse_args()

    if args.show:
        show_indexes()
    else:
        print("🔧 Adding analytics indexes to improve query performance...")
        create_indexes()
        print("\n🎉 Done! Run with --show to view all indexes.")
