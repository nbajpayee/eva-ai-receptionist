#!/usr/bin/env python3
"""
Create med spa settings schema in Supabase.
This script creates the new tables for configuration management.
"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import inspect

from database import (
    Base,
    BusinessHours,
    Location,
    MedSpaSettings,
    Provider,
    Service,
    engine,
)


def create_settings_tables():
    """Create only the settings-related tables."""
    print("Creating med spa settings tables in Supabase...")

    # Get inspector to check existing tables
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # Tables we want to create
    settings_tables = [
        "med_spa_settings",
        "locations",
        "business_hours",
        "services",
        "providers",
    ]

    # Check which tables need to be created
    tables_to_create = [t for t in settings_tables if t not in existing_tables]

    if not tables_to_create:
        print("✓ All settings tables already exist!")
        return

    print(f"Creating tables: {', '.join(tables_to_create)}")

    # Create only the new tables
    for table_name in settings_tables:
        if table_name not in existing_tables:
            table = Base.metadata.tables[table_name]
            table.create(bind=engine, checkfirst=True)
            print(f"  ✓ Created table: {table_name}")

    print("\n✅ Med spa settings schema created successfully!")


if __name__ == "__main__":
    create_settings_tables()
