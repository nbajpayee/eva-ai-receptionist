# Supabase Migration Plan

## Overview
Migrate the Med Spa Voice AI analytics data from the local SQLite database to a managed Supabase Postgres instance so the admin dashboard and backend analytics are powered by hosted infrastructure.

## Prerequisites
1. Supabase project created (`hbvhllmbmjqfqdbziign`).
2. Backend `.env` updated with:
   - `DATABASE_URL=postgresql://...` (Supabase connection string)
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `SUPABASE_URL=...`
3. Local SQLite snapshot available at `ava_database.db` for backfill.
4. Docker optional (only required for Supabase CLI local diff commands).

## Migration Steps

### 1. Prepare Tooling
- Install Supabase CLI (`brew install supabase/tap/supabase`).
- Ensure Python virtualenv is active with project dependencies.
- Optional: add Alembic for future migrations (`pip install alembic`).

### 2. Generate Postgres Schema
Two options:

**Option A – SQLAlchemy Metadata Create (recommended for parity)**
1. Temporarily point `DATABASE_URL` to Supabase and run a helper script that calls `Base.metadata.create_all(bind=engine)`. This creates tables identical to the SQLAlchemy models.
2. Capture the generated schema by running `supabase db diff` (requires Docker) to generate a migration file for future reproducibility.

**Option B – Manual SQL Migration**
1. Translate each model (`Customer`, `Appointment`, `CallSession`, `CallEvent`, `DailyMetric`) into Postgres DDL.
2. Save the SQL statements in `supabase/migrations/<timestamp>_init.sql`.
3. Apply using `supabase db push`.

### 3. Data Backfill Script
1. Create `backend/scripts/migrate_sqlite_to_supabase.py`.
2. Script workflow:
   - Load environment variables.
   - Open SQLite session (source).
   - Open Supabase Postgres session (target) using SQLAlchemy.
   - Copy tables in dependency order:
     1. `customers`
     2. `appointments`
     3. `call_sessions`
     4. `call_events`
     5. `daily_metrics`
   - Use bulk inserts with batched commits (e.g., 500 rows per batch).
   - Handle `NULL` vs empty values explicitly (Postgres is stricter).
3. Include `--dry-run` flag to print counts without writing.
4. Include idempotency guard (skip if target already has rows unless `--force` flag supplied).

### 4. Validation Checklist
- Run FastAPI admin endpoints against Supabase:
  - `GET /api/admin/metrics/overview`
  - `GET /api/admin/calls`
- Compare record counts between SQLite and Supabase (expect 1:1).
- Spot-check recent call sessions for identical data.
- Confirm dashboard UI loads metrics and call log via Supabase-backed API.
- Enable SSL enforcement in Supabase database settings (already recommended).

### 5. Post-migration Cleanup
- Remove or archive `ava_database.db` once confident in Supabase data.
- Update deployment scripts / documentation to reference Supabase Postgres.
- Plan Row Level Security policies before direct client access (dashboard uses server proxy for now).
- Schedule regular backups via Supabase dashboard.

## Outstanding Tasks
- [ ] Implement schema creation script/command.
- [ ] Implement SQLite → Supabase copy script.
- [ ] Automate validation steps (optional pytest/CLI).
- [ ] Configure Supabase RLS policies once client access is required.

## References
- Supabase CLI docs: https://supabase.com/docs/guides/cli
- SQLAlchemy migrations with Alembic: https://alembic.sqlalchemy.org
