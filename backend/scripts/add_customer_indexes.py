"""
Add database indexes for customer-related queries.

This script creates indexes on frequently queried fields to improve performance:
- customer.phone (used in search, duplicate checks)
- customer.email (used in search, duplicate checks)
- customer.created_at (used in sorting, filtering by date)
- conversation.customer_id (used in joins, timeline queries)
- appointment.customer_id (used in joins, stats queries)
"""

from sqlalchemy import text, inspect
from database import engine, get_db


def index_exists(conn, table_name: str, index_name: str) -> bool:
    """Check if an index already exists."""
    inspector = inspect(engine)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def create_customer_indexes():
    """Create indexes for customer-related queries."""

    indexes_to_create = [
        # Customer table indexes
        ("customers", "idx_customer_phone", "CREATE INDEX IF NOT EXISTS idx_customer_phone ON customers(phone)"),
        ("customers", "idx_customer_email", "CREATE INDEX IF NOT EXISTS idx_customer_email ON customers(email)"),
        ("customers", "idx_customer_created_at", "CREATE INDEX IF NOT EXISTS idx_customer_created_at ON customers(created_at DESC)"),
        ("customers", "idx_customer_is_new_client", "CREATE INDEX IF NOT EXISTS idx_customer_is_new_client ON customers(is_new_client)"),

        # Conversation table indexes for customer queries
        ("conversations", "idx_conversation_customer_id", "CREATE INDEX IF NOT EXISTS idx_conversation_customer_id ON conversations(customer_id)"),
        ("conversations", "idx_conversation_customer_channel", "CREATE INDEX IF NOT EXISTS idx_conversation_customer_channel ON conversations(customer_id, channel)"),
        ("conversations", "idx_conversation_last_activity", "CREATE INDEX IF NOT EXISTS idx_conversation_last_activity ON conversations(last_activity_at DESC)"),

        # Appointment table indexes for customer queries
        ("appointments", "idx_appointment_customer_id", "CREATE INDEX IF NOT EXISTS idx_appointment_customer_id ON appointments(customer_id)"),
        ("appointments", "idx_appointment_customer_status", "CREATE INDEX IF NOT EXISTS idx_appointment_customer_status ON appointments(customer_id, status)"),
        ("appointments", "idx_appointment_updated_at", "CREATE INDEX IF NOT EXISTS idx_appointment_updated_at ON appointments(updated_at DESC)"),
    ]

    with engine.connect() as conn:
        created_count = 0
        skipped_count = 0

        for table_name, index_name, create_sql in indexes_to_create:
            try:
                # PostgreSQL and SQLite both support CREATE INDEX IF NOT EXISTS
                conn.execute(text(create_sql))
                conn.commit()
                print(f"✓ Created index: {index_name} on {table_name}")
                created_count += 1
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  Skipped (already exists): {index_name}")
                    skipped_count += 1
                else:
                    print(f"✗ Error creating {index_name}: {e}")

        print(f"\n📊 Summary:")
        print(f"   Created: {created_count} indexes")
        print(f"   Skipped: {skipped_count} indexes (already existed)")
        print(f"   Total: {created_count + skipped_count} indexes")


def analyze_tables():
    """Run ANALYZE on tables to update statistics for query planner."""
    tables = ["customers", "conversations", "appointments"]

    with engine.connect() as conn:
        print("\n📈 Updating table statistics...")
        for table in tables:
            try:
                # ANALYZE works in PostgreSQL, ANALYZE is a no-op in SQLite
                conn.execute(text(f"ANALYZE {table}"))
                conn.commit()
                print(f"✓ Analyzed table: {table}")
            except Exception as e:
                print(f"  Note: Could not analyze {table}: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("Creating Customer Performance Indexes")
    print("=" * 60)

    try:
        create_customer_indexes()
        analyze_tables()

        print("\n✅ Index creation completed successfully!")
        print("\n💡 Performance Tips:")
        print("   - These indexes will speed up customer searches by phone/email")
        print("   - Timeline queries will be faster with customer_id indexes")
        print("   - Sorting by created_at and last_activity will be optimized")
        print("   - Run this script periodically or add to deployment pipeline")

    except Exception as e:
        print(f"\n❌ Error creating indexes: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
