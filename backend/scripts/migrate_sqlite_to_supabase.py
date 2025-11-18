"""Backfill data from local SQLite DB to Supabase Postgres.

Usage examples:
    # Dry run, show counts only
    python backend/scripts/migrate_sqlite_to_supabase.py --dry-run

    # Copy data with default SQLite path
    python backend/scripts/migrate_sqlite_to_supabase.py

    # Force re-import even if target already has rows
    python backend/scripts/migrate_sqlite_to_supabase.py --force
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List, Tuple, Type

from dotenv import load_dotenv
from sqlalchemy import func, insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
DEFAULT_SQLITE_PATHS = [
    PROJECT_ROOT / "ava_database.db",
    BACKEND_ROOT / "ava_database.db",
]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

from sqlalchemy import create_engine  # noqa: E402

from config import get_settings  # noqa: E402
from database import (Appointment, Base, CallEvent, CallSession,  # noqa: E402
                      Customer, DailyMetric, engine)

MODELS_IN_ORDER: Tuple[Type[Base], ...] = (
    Customer,
    Appointment,
    CallSession,
    CallEvent,
    DailyMetric,
)

BATCH_SIZE = 500


def resolve_sqlite_path(cli_path: str | None) -> Path:
    if cli_path:
        path = Path(cli_path).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"SQLite database not found at {path}")
        return path

    for candidate in DEFAULT_SQLITE_PATHS:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "Could not locate SQLite database. Pass --sqlite-path explicitly."
    )


def make_sqlite_engine(sqlite_path: Path) -> Engine:
    url = f"sqlite:///{sqlite_path}"
    return create_engine(url, connect_args={"check_same_thread": False})


def count_rows(session: Session, model: Type[Base]) -> int:
    return session.execute(func.count(model.id)).scalar_one()


def fetch_batches(
    session: Session, model: Type[Base], batch_size: int
) -> Iterable[List[Base]]:
    total = count_rows(session, model)
    if total == 0:
        return

    print(f"  Fetching {total} rows from {model.__tablename__}")
    offset = 0
    while offset < total:
        rows = (
            session.query(model)
            .order_by(model.id)
            .offset(offset)
            .limit(batch_size)
            .all()
        )
        if not rows:
            break
        yield rows
        offset += len(rows)


def to_dict(row: Base) -> dict:
    data = {}
    for column in row.__table__.columns:  # type: ignore[attr-defined]
        data[column.name] = getattr(row, column.name)
    return data


def migrate_table(
    source_session: Session,
    target_session: Session,
    model: Type[Base],
    *,
    dry_run: bool,
    force: bool,
) -> None:
    source_count = count_rows(source_session, model)
    target_count = count_rows(target_session, model)

    table_name = model.__tablename__
    if source_count == 0:
        print(f"- {table_name}: no rows in source, skipping")
        return

    if target_count > 0 and not force:
        print(
            f"- {table_name}: target already has {target_count} rows, skipping (use --force to overwrite)"
        )
        return

    if dry_run:
        print(f"- {table_name}: would migrate {source_count} rows (dry-run)")
        return

    print(f"- {table_name}: migrating {source_count} rows")

    if target_count > 0 and force:
        print(f"  Clearing existing rows from {table_name} before import")
        target_session.execute(model.__table__.delete())
        target_session.commit()

    inserted = 0
    for batch in fetch_batches(source_session, model, BATCH_SIZE) or []:
        payload = [to_dict(row) for row in batch]
        target_session.execute(insert(model.__table__), payload)
        target_session.commit()
        inserted += len(payload)
        print(f"    Inserted {inserted}/{source_count} rows")

    print(f"  ✅ Completed {table_name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate data from SQLite to Supabase")
    parser.add_argument(
        "--sqlite-path", type=str, help="Path to source SQLite database"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Show counts without writing"
    )
    parser.add_argument(
        "--force", action="store_true", help="Overwrite existing target data"
    )
    args = parser.parse_args()

    sqlite_path = resolve_sqlite_path(args.sqlite_path)
    print(f"Source SQLite DB: {sqlite_path}")

    settings = get_settings()
    if settings.DATABASE_URL.startswith("sqlite"):
        print(
            "[ERROR] DATABASE_URL is still pointing to SQLite. Configure Supabase connection in .env first."
        )
        sys.exit(1)

    sqlite_engine = make_sqlite_engine(sqlite_path)
    source_session = sessionmaker(bind=sqlite_engine)()
    target_session = sessionmaker(bind=engine)()

    try:
        for model in MODELS_IN_ORDER:
            migrate_table(
                source_session,
                target_session,
                model,
                dry_run=args.dry_run,
                force=args.force,
            )
    finally:
        source_session.close()
        target_session.close()


if __name__ == "__main__":
    main()
