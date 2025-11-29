# Pre-Pilot Readiness Checklist

**Last Updated:** November 27, 2025 (Updated based on GPT-4 feedback)
**Target:** Production-ready for 3-10 clinic pilot with <50 concurrent calls
**Current Status:** 🟡 In Progress (55% Complete - recalibrated with new P0 items)

---

## Executive Summary

This checklist covers the **minimum viable hardening** needed to responsibly run a paid pilot, based on combined guidance from Claude Code and GPT-4 architectural reviews.

**Key Principle:** We're optimizing for:
- ✅ **Operational safety** (can debug issues, won't lose data)
- ✅ **Customer trust** (professional error handling, no crashes)
- ❌ **NOT optimizing for:** Enterprise scale, 1000+ users, microservices

**Timeline:**
- **This Week (Before Demo):** P0 items - must complete
- **Next Month (After Demo):** P1 items - complete after proving pilot demand
- **Next Quarter (Before Scaling):** P2 items - only if you hit 100+ clinics

---

## P0 - CRITICAL (Complete This Week Before Demo)

### A. Observability & Error Visibility

#### ✅ 1. Structured Logging (COMPLETED)
**Status:** Done - replaced runtime `print()` with `logging` calls

**What Was Done:**
- ✅ `main.py`: All WebSocket lifecycle, session finalization, dual-write, errors → `logger.info/debug/warning/error`
- ✅ `realtime_client.py`: OpenAI API events, audio streaming, transcription → `logger.debug/info/warning`
- ✅ `api_messaging.py`: Messaging satisfaction scoring failures → `logger.warning`
- ✅ `analytics.py`: Customer creation, sentiment analysis, errors → `logger.info/error`
- ✅ All loggers include contextual data (session_id, customer_id, conversation_id)
- ✅ Left `print()` in CLI/migration scripts (appropriate for dev tools)

**What's Left:**
- 🔲 **[MANDATORY]** Configure log level via environment variable for production
  - Add to `.env`: `LOG_LEVEL=INFO` (use `DEBUG` for local dev)
  - Update logging config in `config.py` or `main.py` startup

**Why This Is Mandatory (GPT-4):**
> "You will use logs heavily during the pilot when something odd happens on a call. Having a simple LOG_LEVEL env that can be flipped between INFO and DEBUG is a huge safety valve."

**Implementation:**
```python
# Step 1: Add to backend/config.py
class Settings(BaseSettings):
    # ... existing fields
    LOG_LEVEL: str = "INFO"  # Add this line

# Step 2: In backend/main.py (add after imports, before app creation)
import logging
from config import get_settings

settings = get_settings()

# Configure logging with environment-based level
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler()  # Stdout for Railway/Render/Docker logs
    ]
)

# Suppress noisy third-party loggers
logging.getLogger("websockets").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
```

**Step 3: Add to .env:**
```bash
# For production
LOG_LEVEL=INFO

# For debugging issues
# LOG_LEVEL=DEBUG
```

**Estimated Time:** 15 minutes
**Priority:** 🔴 **P0 MANDATORY** - Complete before demo

---

#### 🔲 2. Global Exception Handler (STRONGLY RECOMMENDED)
**Status:** NOT IMPLEMENTED - FastAPI default doesn't log exceptions

**Current Behavior:**
- FastAPI returns 500 with stack trace in DEBUG mode
- Returns generic 500 in production (when DEBUG=False)
- ⚠️ **BUT: Exceptions are NOT logged automatically**

**Why This Matters (GPT-4):**
> "A simple app.exception_handler(Exception) that logs exc_info=True is ~10-15 minutes. It guarantees any weird edge case is logged with a stack trace and extra context (path/method). Big debugging payoff."

**Implementation:**
```python
# In backend/main.py (add after app creation, before routes)
from fastapi import Request
from fastapi.responses import JSONResponse
import sys

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to ensure all errors are logged.
    This runs AFTER route-specific error handling fails.
    """
    # Log with full context
    logger.error(
        "Unhandled exception: %s %s",
        request.method,
        request.url.path,
        exc_info=True,
        extra={
            "path": str(request.url.path),
            "method": request.method,
            "client_host": request.client.host if request.client else None,
            "exception_type": type(exc).__name__
        }
    )

    # Return generic error (don't leak internals)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": str(uuid.uuid4())  # For debugging
        }
    )
```

**Estimated Time:** 15 minutes
**Priority:** 🟡 **P0 STRONGLY RECOMMENDED** - Small effort, huge debugging value

---

#### ✅ 3. WebSocket Exception Handling (COMPLETED)
**Status:** Done - `main.py` WebSocket handler has comprehensive try/except

**Evidence:**
- Lines 1362-1546 in `main.py` wrap entire WebSocket lifecycle
- `finally` block ensures cleanup via `finalize_session()`
- Graceful disconnect handling for both client and OpenAI sides

---

### B. Health Checks & Monitoring

#### ✅ 4. Health Endpoints (COMPLETED)
**Status:** Done - all three endpoints implemented

**What Was Done:**
- ✅ `GET /health/live` - Simple liveness probe (process is up)
- ✅ `GET /health/ready` - Readiness probe with DB connectivity check
- ✅ `GET /health` - Backward-compatible alias to `/health/live`

**Evidence:** `main.py` lines 1156-1169

**What's Left:**
- 🔲 **[UPGRADED TO P0]** Configure hosting platform to use health checks
  - **Depends on deployment target** (see Deployment Context section below)

**Why This Is Now P0 (GPT-4):**
> "For a paid pilot I'd treat 'Platform configured to probe /health/ready and auto-restart on failures' as P0 or P0.5, not P1. It's usually 15-30 minutes of UI clicking and is high ROI."

**Estimated Time:** 15-30 minutes (varies by platform)
**Priority:** 🔴 **P0** - Must configure before demo

---

#### 🔲 5. Basic Monitoring Setup (UPGRADED TO P0)
**Status:** NOT STARTED

**What's Needed:**
- 🔲 **[MANDATORY]** Confirm hosting platform has alerts for:
  - Process crashes/restarts
  - Health check failures (`/health/ready` returns 503)
  - 5xx error spike (optional but strongly recommended)

**Why This Is P0 (GPT-4):**
> "Some form of alert on repeated restarts / 5xx spike is high ROI. Usually 15-30 minutes of UI clicking."

**Implementation Steps:**
1. **If using Railway:**
   - Dashboard → Project → Settings → Health Checks
   - Set path to `/health/ready`
   - Enable restart on failure

2. **If using Render:**
   - Service → Settings → Health Check Path: `/health/ready`

3. **If using AWS ECS/Fargate:**
   - Task Definition → Health Check
   - Command: `CMD-SHELL, curl -f http://localhost:8000/health/ready || exit 1`

**Estimated Time:** 15-30 minutes
**Deployment Context Needed:** Where is backend deployed?

---

### C. External API Robustness

#### 🔲 6. Enhanced Google Calendar Error Handling
**Status:** PARTIAL - basic error handling exists, needs user-friendly messages

**Current State:**
- ✅ `calendar_service.py` catches `HttpError` exceptions
- ⚠️ Returns generic error messages, doesn't distinguish failure types

**What's Left:**
- 🔲 Add specific error branches for common failures:
  - Calendar API rate limit exceeded
  - Calendar not found (invalid GOOGLE_CALENDAR_ID)
  - Network timeout
  - Invalid credentials

**Implementation:**
```python
# In backend/realtime_client.py, handle_function_call method
# Around lines 430-453 (check_availability) and 471-554 (book_appointment)

from googleapiclient.errors import HttpError

try:
    if function_name == "check_availability":
        availability = handle_check_availability(...)
        # ... existing code
except HttpError as e:
    status_code = e.resp.status
    logger.error(
        "Google Calendar API error during %s: %s",
        function_name,
        status_code,
        exc_info=True,
        extra={"function": function_name, "status": status_code}
    )

    if status_code == 404:
        user_message = "I'm having trouble accessing the calendar. Let me transfer you to our staff."
    elif status_code == 429:
        user_message = "Our calendar system is experiencing high demand. Can you try again in a moment?"
    elif status_code >= 500:
        user_message = "The calendar service is temporarily unavailable. Let me take your information and have someone call you back."
    else:
        user_message = "I'm having trouble checking availability right now. Would you like to speak with our receptionist?"

    return {
        "success": False,
        "error": "calendar_unavailable",
        "error_code": status_code,
        "user_message": user_message
    }
except Exception as e:
    logger.error(
        "Unexpected error in %s",
        function_name,
        exc_info=True,
        extra={"function": function_name}
    )
    return {
        "success": False,
        "error": "internal_error",
        "user_message": "Something went wrong. Let me transfer you to our team."
    }
```

**Estimated Time:** 1-2 hours
**Priority:** HIGH - critical for professional error handling

---

#### 🔲 7. OpenAI API Error Handling
**Status:** PARTIAL - basic handling exists, needs retry logic

**Current State:**
- ✅ `realtime_client.py` handles WebSocket disconnects gracefully
- ✅ Error events from OpenAI are logged (lines 905-920)
- ⚠️ No retry logic for transient failures
- ⚠️ No timeout handling for slow responses

**What's Left:**
- 🔲 Add connection retry logic with exponential backoff
- 🔲 Add timeout for OpenAI API calls (GPT-4 sentiment analysis)
- 🔲 Handle specific OpenAI error codes gracefully

**Implementation:**
```python
# In backend/analytics.py, analyze_call_sentiment method (around line 194)

import time
from openai import OpenAI, APIError, RateLimitError

def analyze_call_sentiment(transcript: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not transcript:
        return {"sentiment": "neutral", "satisfaction_score": 5.0}

    conversation_text = "\n".join([...])

    max_retries = 3
    base_delay = 1.0

    for attempt in range(max_retries):
        try:
            response = openai_client.chat.completions.create(
                model=settings.OPENAI_SENTIMENT_MODEL,
                messages=[...],
                timeout=30.0  # 30 second timeout
            )
            # ... parse response
            break

        except RateLimitError as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(
                    "OpenAI rate limit hit, retrying in %s seconds (attempt %s/%s)",
                    delay, attempt + 1, max_retries
                )
                time.sleep(delay)
            else:
                logger.error("OpenAI rate limit exceeded after %s retries", max_retries)
                return {"sentiment": "neutral", "satisfaction_score": 5.0}

        except APIError as e:
            logger.error("OpenAI API error during sentiment analysis", exc_info=True)
            return {"sentiment": "neutral", "satisfaction_score": 5.0}

        except Exception as e:
            logger.error("Unexpected error in sentiment analysis", exc_info=True)
            return {"sentiment": "neutral", "satisfaction_score": 5.0}
```

**Estimated Time:** 1 hour
**Priority:** MEDIUM - AI analysis is not critical path for pilot

---

### D. Database Safety

#### 🔲 8. Verify Database Backups Exist
**Status:** NOT VERIFIED

**What's Needed:**
- 🔲 Confirm automated backups are enabled
- 🔲 Document restore procedure
- 🔲 Test restore once (recommended but optional for pilot)

**Implementation Steps:**

**If using Supabase (recommended per CLAUDE.md):**
1. Log into Supabase Dashboard
2. Navigate to: Project → Database → Backups
3. Verify:
   - ✅ Daily backups enabled (default on paid plans)
   - ✅ Point-in-time recovery (PITR) enabled if on Pro plan
   - ✅ Backup retention: at least 7 days
4. Document restore procedure:
   ```
   1. Dashboard → Database → Backups → Select backup
   2. Click "Restore"
   3. Confirm restore point
   4. Wait 5-10 minutes for restore to complete
   5. Verify data integrity via /health/ready endpoint
   ```

**If using self-hosted Postgres:**
1. Check cron jobs for pg_dump:
   ```bash
   crontab -l | grep pg_dump
   ```
2. Verify backup files exist:
   ```bash
   ls -lh /backups/ava_db_*.sql.gz
   ```
3. Add backup script if missing:
   ```bash
   # Add to crontab: crontab -e
   0 2 * * * pg_dump -U ava_user ava_db | gzip > /backups/ava_db_$(date +\%Y\%m\%d).sql.gz

   # Retention: keep 30 days
   0 3 * * * find /backups -name "ava_db_*.sql.gz" -mtime +30 -delete
   ```

**Estimated Time:** 30 minutes
**Priority:** HIGH - critical for data safety

**Deployment Context Needed:** Supabase or self-hosted? What plan?

---

#### ✅ 9. Schema Migration Freeze
**Status:** NEEDS ACTION - `_ensure_schema_upgrades()` should be disabled

**Current State:**
- ⚠️ `database.py` lines 1095-1184 contains `_ensure_schema_upgrades()`
- ⚠️ This runs on every app startup (called from `init_db()`)
- ⚠️ Can cause race conditions with multiple workers

**Action Required:**
```python
# In backend/database.py

def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

    # TEMPORARILY DISABLED FOR PILOT
    # Run this manually once in staging/prod, then remove
    # _ensure_schema_upgrades()

    print("Database tables created successfully!")
```

**Then manually run once:**
```bash
# In production environment
python -c "from backend.database import _ensure_schema_upgrades, engine, SessionLocal; \
           db = SessionLocal(); \
           _ensure_schema_upgrades(); \
           print('Schema upgrades applied')"
```

**After Pilot (P1):** Implement proper Alembic migrations

**Estimated Time:** 10 minutes
**Priority:** HIGH - prevents race conditions

---

### E. Pre-Demo Testing

#### 🔲 10. Golden Path Smoke Tests (EXPANDED)
**Status:** NOT DONE

**What's Needed:**
Test **canonical flows** end-to-end in your **actual deployment environment** (not localhost).

**GPT-4 Recommendation:**
> "Explicitly list 3-5 canonical flows you'll run before any demo. This ties into your existing TODO on improving planner_priya so she reliably completes booking instead of looping."

---

#### **Test 1: Standard Voice Booking (Happy Path)**
**Flow:**
1. Call Twilio number
2. Customer: "I'd like to book a Botox appointment for tomorrow at 2 PM"
3. AI: Checks availability, confirms time, collects contact info
4. Customer provides: Name, phone, email
5. AI: Books appointment, confirms details

**Success Criteria:**
- ✅ AI completes booking **without looping or re-checking availability**
- ✅ No hesitation like "Let me re-check that for you"
- ✅ Appointment appears in Google Calendar:
  - Service: "Botox"
  - Duration: 30 minutes (correct from services table)
  - Customer details in description
- ✅ Conversation in admin dashboard shows:
  - Full transcript (both customer and assistant)
  - Satisfaction score (1-10)
  - Outcome: "appointment_scheduled"
  - Function calls logged: `check_availability`, `book_appointment`

---

#### **Test 2: Reschedule Existing Appointment**
**Setup:** Book an appointment first (Test 1)

**Flow:**
1. Call back
2. Customer: "I need to reschedule my Botox appointment"
3. AI: Looks up appointment, offers new times
4. Customer: Selects new time
5. AI: Reschedules, confirms

**Success Criteria:**
- ✅ AI finds existing appointment by phone number
- ✅ Offers alternative times from `check_availability`
- ✅ Calendar event is updated (not duplicated)
- ✅ Customer receives confirmation
- ✅ Outcome: "rescheduled"

---

#### **Test 3: No Availability (Graceful Degradation)**
**Setup:** Book all slots for tomorrow (or use date far in past)

**Flow:**
1. Call Twilio number
2. Customer: "I need a Hydrafacial tomorrow at 3 PM"
3. AI: Checks availability, finds nothing

**Success Criteria:**
- ✅ AI responds: "We're fully booked tomorrow. Let me check other days..."
- ✅ AI offers next available times (e.g., "We have openings Thursday at 2 PM or Friday at 10 AM")
- ✅ Does NOT say: "I can book you for 3 PM tomorrow" (lying)
- ✅ Conversation logs show: `check_availability` returned empty slots
- ✅ Outcome: "browsing" or "info_only" (not "booked")

---

#### **Test 4: Planner Priya Baseline (Reliable Completion)**
**Context:** Your TODO.md mentions improving planner_priya to reliably complete bookings.

**Flow:**
1. Call with specific provider preference
2. Customer: "I'd like to see Priya for a consultation next week"
3. AI: Checks Priya's availability, offers times
4. Customer: "How about Wednesday at 4 PM?"
5. AI: Books with Priya

**Success Criteria:**
- ✅ AI matches provider name "Priya" to provider in database
- ✅ Books appointment with correct provider_id
- ✅ Calendar event includes provider name in description
- ✅ **No looping** - books on first attempt after customer confirms time
- ✅ Outcome: "appointment_scheduled"

---

#### **Test 5: SMS → Booked Appointment (Cross-Channel)**
**Flow:**
1. Send SMS: "Hi, I need a laser hair removal appointment"
2. AI: Asks for preferred date/time
3. Customer: "Next Tuesday around 11 AM"
4. AI: Checks availability, offers "11:00 AM or 11:30 AM"
5. Customer: "11 AM works"
6. AI: Collects name/phone (if not already on file), books

**Success Criteria:**
- ✅ Same deterministic booking logic as voice
- ✅ No "let me re-check" after customer selects time
- ✅ Appointment in Google Calendar
- ✅ Conversation in admin dashboard shows:
  - Channel: "sms"
  - Full message thread
  - Outcome: "appointment_scheduled"

---

#### **Test 6: Error Recovery - Calendar API Failure**
**Setup:** Temporarily break Google Calendar credentials (rename `token.json`)

**Flow:**
1. Call Twilio number
2. Customer: "I want to book a Botox appointment"
3. AI: Attempts `check_availability` → fails
4. AI should gracefully handle error

**Success Criteria:**
- ✅ AI says: "I'm having trouble accessing the calendar right now. Would you like me to take your information and have someone call you back?"
- ✅ Error logged with full stack trace:
  - Log level: ERROR
  - Context: session_id, function_name, error_code
- ✅ No crash or 500 error
- ✅ WebSocket stays connected (customer can continue conversation)
- ✅ Conversation outcome: "escalated" or "failed"

**Cleanup:** Restore `token.json` after test

---

#### **Test 7: OpenAI API Failure Simulation**
**Setup:** Not easy to simulate without mock, but verify code handles it

**Manual Code Review:**
1. Check `analytics.py` sentiment analysis has try/except
2. Check `realtime_client.py` handles WebSocket disconnect gracefully
3. Verify fallback behavior when OpenAI is unreachable

**Success Criteria:**
- ✅ Code has retry logic with backoff (see Section C.7)
- ✅ Fallback to neutral sentiment if analysis fails
- ✅ Logged appropriately

---

**Estimated Time:** 2-3 hours for all 7 tests
**Priority:** 🔴 **P0 CRITICAL** - Must pass before demo

**Deployment Context Needed:**
- Twilio phone number
- Backend URL (for SMS webhook)
- Admin dashboard URL (to verify conversations appear)

---

#### 🔲 11. Basic Load Test
**Status:** NOT IMPLEMENTED

**What's Needed:**
Simulate 50 concurrent voice calls to verify system doesn't crash under moderate load.

**Implementation:**
```python
# Create: backend/tests/load/test_concurrent_calls.py

import asyncio
import websockets
import json
import uuid
from datetime import datetime

async def simulate_voice_call(session_num: int, base_url: str):
    """Simulate one voice call session."""
    session_id = f"load-test-{uuid.uuid4()}"
    uri = f"{base_url}/ws/voice/{session_id}"

    try:
        async with websockets.connect(uri) as ws:
            # Wait for greeting
            greeting = await asyncio.wait_for(ws.recv(), timeout=10)

            # Send 5 audio chunks (simulating ~5 seconds of speech)
            for i in range(5):
                await ws.send(json.dumps({
                    "type": "audio",
                    "data": "AAAA"  # Dummy base64 audio
                }))
                await asyncio.sleep(0.1)

            # Commit audio buffer
            await ws.send(json.dumps({"type": "commit"}))

            # Wait for response
            response = await asyncio.wait_for(ws.recv(), timeout=15)

            # End session
            await ws.send(json.dumps({"type": "end_session"}))

            print(f"✅ Call {session_num} completed successfully")
            return True

    except Exception as e:
        print(f"❌ Call {session_num} failed: {e}")
        return False

async def load_test(num_calls: int = 50, base_url: str = "ws://localhost:8000"):
    """Run load test with N concurrent calls."""
    print(f"Starting load test: {num_calls} concurrent calls")
    start_time = datetime.now()

    tasks = [simulate_voice_call(i, base_url) for i in range(num_calls)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    success_count = sum(1 for r in results if r is True)
    fail_count = num_calls - success_count

    print(f"\n{'='*50}")
    print(f"Load Test Results:")
    print(f"  Total calls: {num_calls}")
    print(f"  Successful: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Duration: {duration:.2f}s")
    print(f"  Calls/sec: {num_calls/duration:.2f}")
    print(f"{'='*50}\n")

    return success_count >= num_calls * 0.9  # 90% success threshold

if __name__ == "__main__":
    # For local testing
    asyncio.run(load_test(num_calls=50, base_url="ws://localhost:8000"))

    # For production testing - ONLY run during off-hours
    # asyncio.run(load_test(num_calls=50, base_url="wss://api.getevaai.com"))
```

**How to Run:**
```bash
cd backend
python tests/load/test_concurrent_calls.py
```

**What to Monitor During Test:**
- CPU usage (should stay < 80%)
- Memory usage (should not grow unbounded)
- Database connections (check Supabase dashboard)
- Any errors in logs

**Success Criteria:**
- ✅ 90%+ calls complete successfully
- ✅ No memory leaks (memory stabilizes after test)
- ✅ Response latency < 2 seconds for audio chunks

**Estimated Time:** 2-3 hours (write test + run + analyze)
**Priority:** HIGH - critical for confidence before demo

**Deployment Context Needed:** What's your production WebSocket URL?

---

### F. Configuration & Deployment Context

#### 🔲 12. Deployment Information Needed
**Status:** REQUIRED TO COMPLETE OTHER ITEMS

**Questions for You:**

1. **Where is the backend deployed?**
   - [ ] Railway
   - [ ] Render
   - [ ] AWS ECS/Fargate
   - [ ] Self-hosted VM
   - [ ] Other: __________

2. **What database are you using?**
   - [ ] Supabase (what plan: Free/Pro/Enterprise?)
   - [ ] Self-hosted Postgres
   - [ ] AWS RDS
   - [ ] Other: __________

3. **How many workers/processes run the backend?**
   - Single instance or multiple?
   - If multiple, how do you handle WebSocket session state?

4. **What's your production backend URL?**
   - HTTP: __________
   - WebSocket: __________

5. **What's your Twilio phone number?**
   - For manual smoke tests: __________

**Priority:** BLOCKING - need answers to complete other P0 items

---

## P1 - IMPORTANT (Complete Next Month After Demo)

These items should be tackled **after** you've successfully demoed to a pilot customer and received initial feedback. Don't let these block your demo.

**Important Note:** Some of these items (especially schema management) should be completed **before making any post-pilot schema changes**. Treat them as prerequisites for evolution, not blockers for launch.

---

### G. Schema Management & Data Migration

#### 🔲 13. Implement Alembic Migrations (BLOCKING FOR SCHEMA CHANGES)
**Status:** NOT STARTED

**Why This Is Elevated Priority (from Claude Review):**
> "Currently using Base.metadata.create_all() which can't handle schema changes. Manual _ensure_schema_upgrades() is risky in production. No rollback capability for bad migrations."

**Why This Matters:**
- Currently using `Base.metadata.create_all()` which can't handle schema changes
- Manual `_ensure_schema_upgrades()` is risky in production
- No rollback capability for bad migrations

**Implementation:**
```bash
# Install Alembic
pip install alembic
pip freeze > backend/requirements.txt

# Initialize Alembic
cd backend
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "initial schema"

# Apply migration
alembic upgrade head
```

**Configuration:**
```python
# backend/alembic/env.py
from backend.database import Base
target_metadata = Base.metadata
```

**Benefits:**
- **Safe schema evolution** - can roll back failed migrations
- **Team confidence** - developers can propose schema changes without fear
- **Audit trail** - know exactly what changed and when
- **Staging → Production** - same migration runs in both environments

**When to Do This:**
- ✅ **Not blocking demo** - current schema is stable
- ⚠️ **BLOCKING any post-pilot schema changes** - must complete before adding new columns/tables
- Recommended timeline: **Week 2-3 after pilot launch**

**Estimated Time:** 4-6 hours (setup + test + migrate existing schema)
**Priority:** 🟡 **P1 HIGH** - Complete before making any schema changes

**Detailed Implementation Plan:**
```bash
# Phase 1: Install and Initialize (30 min)
pip install alembic
pip freeze > backend/requirements.txt

cd backend
alembic init alembic

# Phase 2: Configure (30 min)
# Edit backend/alembic/env.py:
from backend.database import Base, engine
target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", str(engine.url))

# Phase 3: Create Baseline Migration (1 hour)
# This captures your current schema as "revision 1"
alembic revision --autogenerate -m "baseline schema - all existing tables"

# Review the generated migration in backend/alembic/versions/xxxx_baseline_schema.py
# Verify it matches your current database structure

# Phase 4: Mark Database as Migrated (30 min)
# Since your database already has these tables, stamp it without running migration
alembic stamp head

# Phase 5: Test Forward Migration (1 hour)
# Make a test change (e.g., add a column to Customer table)
# In backend/database.py:
class Customer(Base):
    # ... existing columns
    loyalty_points = Column(Integer, default=0)  # New column

# Generate migration:
alembic revision --autogenerate -m "add loyalty points to customer"

# Review generated migration
# Apply to local dev database:
alembic upgrade head

# Verify column exists:
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='customers';"

# Phase 6: Test Rollback (30 min)
alembic downgrade -1  # Rollback one revision
# Verify loyalty_points column is gone

alembic upgrade head  # Re-apply
# Verify column is back

# Phase 7: Production Rollout (1 hour)
# 1. Test migration in staging first
# 2. Backup production database
# 3. Run: alembic upgrade head
# 4. Verify application still works
# 5. Monitor for errors

# Phase 8: Update Deployment Process (30 min)
# Add to your deployment script/CI:
# - Run alembic upgrade head before starting app
# - Or run manually as separate step before deploy
```

**Success Criteria:**
- ✅ Can generate migrations from model changes
- ✅ Can apply migrations forward and backward
- ✅ Production database stamped at current revision
- ✅ Team knows how to create and apply migrations

---

#### 🔲 14. Complete Dual-Write Cutover (DATA INTEGRITY CRITICAL)
**Status:** IN PROGRESS - dual-write active, no cutover plan

**Current Risk (from Claude Review):**
> "Dual-write pattern is correct for production migration, but you need: (1) Cutover timeline, (2) Data validation, (3) Rollback plan"

**Current State (historical  dual-write phase, now completed):**
- Dual-write implemented (`call_sessions` + `conversations`)
- No validation that both schemas stay in sync
- No timeline for dropping legacy `call_sessions` table

**Detailed Cutover Plan:**

**Phase 1: Data Validation (Week 1-2 post-pilot)**
```python
# Create: backend/scripts/validate_dual_write.py

from database import SessionLocal, CallSession, Conversation
from datetime import datetime, timedelta

def validate_dual_write():
    """
    Compare legacy call_sessions vs new conversations tables.
    Report any discrepancies in counts, data consistency.
    """
    db = SessionLocal()

    # Count comparison
    total_call_sessions = db.query(CallSession).count()
    total_voice_conversations = db.query(Conversation).filter(
        Conversation.channel == "voice"
    ).count()

    print(f"CallSessions: {total_call_sessions}")
    print(f"Voice Conversations: {total_voice_conversations}")

    if total_call_sessions != total_voice_conversations:
        print(f"⚠️  COUNT MISMATCH: {abs(total_call_sessions - total_voice_conversations)} difference")

    # Sample spot checks
    recent_calls = db.query(CallSession).order_by(
        CallSession.started_at.desc()
    ).limit(100).all()

    mismatches = []
    for call in recent_calls:
        # Find matching conversation by session_id in metadata
        conversation = db.query(Conversation).filter(
            Conversation.custom_metadata['session_id'].astext == call.session_id
        ).first()

        if not conversation:
            mismatches.append(f"Missing conversation for call_session {call.id}")
            continue

        # Verify key fields match
        if call.customer_id != conversation.customer_id:
            mismatches.append(
                f"Customer ID mismatch: call={call.customer_id}, conv={conversation.customer_id}"
            )

        if call.satisfaction_score != conversation.satisfaction_score:
            mismatches.append(
                f"Satisfaction score mismatch for session {call.session_id}"
            )

    if mismatches:
        print(f"\n❌ Found {len(mismatches)} data mismatches:")
        for m in mismatches[:10]:  # Show first 10
            print(f"  - {m}")
    else:
        print("\n✅ All spot checks passed - data is consistent")

    return len(mismatches) == 0

if __name__ == "__main__":
    validate_dual_write()
```

**Run daily for 2 weeks:**
```bash
# Add to cron or run manually
python backend/scripts/validate_dual_write.py
```

**Phase 2: Switch Reads to New Schema (Week 3)**
If validation passes consistently:

1. **Update all read queries** to use `conversations` table:
```python
# In backend/analytics.py, main.py, etc.
# OLD:
calls = db.query(CallSession).filter(...)

# NEW:
conversations = db.query(Conversation).filter(
    Conversation.channel == "voice"
).filter(...)
```

2. **Keep dual-write active** (safety net for rollback)

3. **Deploy and monitor** for 1 week

**Phase 3: Remove Dual-Write (Week 4)**
If no issues after 1 week of read cutover:

1. **Stop writing to `call_sessions`** table:
```python
# In backend/main.py, remove lines 1192-1194:
# call_session = AnalyticsService.create_call_session(...)  # DELETE
# Only keep:
conversation = AnalyticsService.create_conversation(...)
```

2. **Archive `call_sessions` data** (don't drop yet):
```sql
-- Rename table for safety
ALTER TABLE call_sessions RENAME TO call_sessions_archived_2025_12;
ALTER TABLE call_events RENAME TO call_events_archived_2025_12;
```

3. **Monitor for 1 more week**

**Phase 4: Final Cleanup (Week 5+)**
If absolutely no issues:

1. **Remove legacy code:**
   - Delete `CallSession` and `CallEvent` models from `database.py`
   - Remove `AnalyticsService.create_call_session()` method
   - Remove all references to `call_sessions` table

2. **Drop archived tables** (after backup):
```sql
-- Backup first!
pg_dump -t call_sessions_archived_2025_12 > call_sessions_backup.sql

-- Then drop
DROP TABLE call_sessions_archived_2025_12 CASCADE;
DROP TABLE call_events_archived_2025_12 CASCADE;
```

**Rollback Plan:**
If issues found at any phase:
1. Switch reads back to `call_sessions` table
2. Keep dual-write running
3. Debug discrepancies
4. Fix and restart from Phase 1

**Estimated Time:** 4-5 weeks (validation + phased cutover + monitoring)
**Priority:** 🟡 **P1 MEDIUM** - Complete within 2 months of pilot launch
**Blocker:** Must complete Alembic setup first (Item #13)

---

### H. Enhanced Monitoring

#### 🔲 15. Add Error Tracking (Sentry)
**Status:** NOT STARTED

**Why This Matters:**
- Logs are reactive (you have to look for problems)
- Error tracking is proactive (alerts you to issues)
- Provides stack traces + context for debugging

**Implementation:**
```bash
pip install sentry-sdk[fastapi]
```

```python
# In backend/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        traces_sample_rate=0.1,  # 10% of requests for performance monitoring
        integrations=[FastApiIntegration()]
    )
```

**Setup:**
1. Create free Sentry account: https://sentry.io
2. Create new project (FastAPI)
3. Copy DSN to `.env`: `SENTRY_DSN=https://...`

**Estimated Time:** 1 hour
**Cost:** Free tier (5K errors/month) is sufficient for pilot
**Priority:** High value, low effort

---

#### 🔲 16. Add Request Logging Middleware
**Status:** NOT STARTED

**What's Needed:**
Log every API request with:
- Request path + method
- Response status code
- Duration (latency)
- User/session ID

**Implementation:**
```python
# In backend/main.py
import time
from starlette.middleware.base import BaseHTTPMiddleware

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        logger.info(
            "%s %s - %s (%0.3fs)",
            request.method,
            request.url.path,
            response.status_code,
            duration,
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration * 1000
            }
        )
        return response

app.add_middleware(RequestLoggingMiddleware)
```

**Estimated Time:** 30 minutes
**Priority:** Helpful for debugging, not critical for pilot

---

### I. Performance Optimization

#### 🔲 17. Add Caching for Services/Providers
**Status:** NOT STARTED

**Current Problem:**
```python
# realtime_client.py lines 76-84
def _get_services(self) -> Dict[str, Any]:
    if self._services_dict is None:
        self._services_dict = SettingsService.get_services_dict(self.db)
    return self._services_dict
```

This caches per-instance, but each WebSocket connection creates a new instance → DB query on every call.

**Solution:**
```python
# In backend/settings_service.py
from functools import lru_cache
from datetime import datetime, timedelta

_services_cache = None
_services_cache_time = None
CACHE_TTL = timedelta(minutes=5)

@staticmethod
def get_services_dict(db: Session) -> Dict[str, Any]:
    global _services_cache, _services_cache_time

    now = datetime.utcnow()
    if _services_cache is None or \
       _services_cache_time is None or \
       now - _services_cache_time > CACHE_TTL:

        # Refresh cache
        services = db.query(Service).filter(Service.is_active == True).all()
        _services_cache = {s.slug: {...} for s in services}
        _services_cache_time = now
        logger.debug("Services cache refreshed")

    return _services_cache
```

**Alternative (Better for Multi-Process):**
Use Redis for shared cache once you have >1 backend instance.

**Estimated Time:** 1 hour
**Priority:** Low for pilot (single process), High for scale

---

#### 🔲 18. Add Database Indexes
**Status:** PARTIAL - some indexes exist, likely missing optimizations

**Current Indexes:**
Based on `database.py`, you have indexes on:
- `customers.phone` (unique)
- `customers.email` (unique)
- `call_sessions.session_id` (unique)
- `conversations.customer_id`
- `conversations.channel`
- `conversations.initiated_at`

**Missing Indexes (Likely):**
```sql
-- For dashboard queries
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at DESC);
CREATE INDEX idx_conversations_status ON conversations(status);

-- For customer lookups
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- For analytics
CREATE INDEX idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX idx_appointments_status_datetime ON appointments(status, appointment_datetime);
```

**How to Add:**
```python
# In database.py, add to model definition
class Conversation(Base):
    # ... existing columns

    __table_args__ = (
        # ... existing constraints
        Index('idx_conversations_last_activity', 'last_activity_at'),
        Index('idx_conversations_status', 'status'),
    )
```

**Estimated Time:** 2 hours (analyze query patterns + add indexes)
**Priority:** Medium - do this if dashboard feels slow

---

## P2 - BEFORE SCALING (Complete Next Quarter)

These items only matter when you're approaching **100+ clinics** or **500+ concurrent calls**. Don't worry about them for pilot.

---

### J. Architecture Refactoring (Addressing Monolithic Concerns)

**Context from Claude Review:**
> "The biggest architectural problem is the monolithic design: main.py at 2,318 lines, realtime_client.py at 1,326 lines, database.py at 1,186 lines. This creates a 371-line WebSocket handler with 10+ responsibilities that's impossible to test in isolation and dangerous to refactor."

**Important Note:** These refactorings are **NOT needed for pilot**. They become critical when:
- Team grows beyond 3 developers (merge conflicts increase)
- Feature velocity slows (changes touch too many files)
- Bug fixes cause regressions (tight coupling makes testing hard)

---

#### 🔲 19. Extract VoiceSessionService from main.py (MONOLITHIC CONCERN #1)
**Status:** NOT STARTED

**The Problem (from Claude Review):**
```python
# main.py lines 1175-1546 (371 lines!)
@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(...):
    # Massive function with 10+ responsibilities:
    # 1. WebSocket connection management
    # 2. Database session management
    # 3. Conversation creation (dual-write logic)
    # 4. OpenAI client initialization
    # 5. Audio streaming coordination
    # 6. Message routing (audio, commit, interrupt)
    # 7. Transcript streaming to client
    # 8. Session finalization
    # 9. Analytics/satisfaction scoring
    # 10. Error handling and cleanup
```

**Why This Is a Problem:**
- **Cannot unit test** - logic tightly coupled to FastAPI WebSocket lifecycle
- **Cannot reuse** - all voice logic is locked inside HTTP endpoint
- **Risky to change** - any modification could break unrelated features
- **Hard to debug** - 371 lines means finding bugs is like searching a maze

**The Solution:**
```python
# Create: backend/services/voice_session_service.py
class VoiceSessionService:
    def __init__(self, db: Session, session_id: str):
        self.db = db
        self.session_id = session_id
        self.realtime_client = None
        self.conversation = None

    async def start_session(self):
        """Initialize session, create conversation record."""
        pass

    async def handle_client_message(self, message: dict):
        """Route client messages (audio, commit, interrupt)."""
        pass

    async def finalize_session(self):
        """Cleanup, save transcript, score satisfaction."""
        pass

# Then in main.py:
@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    service = VoiceSessionService(db, session_id)
    await service.start_session()
    # ... delegate to service methods
```

**Benefits:**
- Testable in isolation (no FastAPI dependency)
- Reusable (could support multiple transport layers)
- Easier to refactor/optimize

**Migration Strategy:**
Don't do a big-bang rewrite. Instead:
1. Extract ONE method at a time from the 371-line function
2. Move it to VoiceSessionService
3. Test it works
4. Repeat

**Example First Step:**
```python
# Extract session finalization logic first (smallest, clearest responsibility)

# In backend/services/voice_session_service.py
class VoiceSessionService:
    async def finalize_session(
        self,
        realtime_client: RealtimeClient,
        conversation: Conversation
    ):
        """Handle session cleanup and analytics."""
        # Wait for OpenAI to flush events
        await asyncio.sleep(2.0)

        # Get session data
        session_data = realtime_client.get_session_data()

        # Extract relevant data
        transcript = session_data.get("transcript", [])
        function_calls = session_data.get("function_calls", [])
        customer_data = session_data.get("customer_data", {})

        # Link customer if identified
        if customer_data.get("phone"):
            customer = self._get_or_create_customer(customer_data)
            conversation.customer_id = customer.id

        # Determine outcome
        conversation.outcome = self._determine_outcome(function_calls)

        # Analyze sentiment
        if transcript:
            sentiment_analysis = AnalyticsService.analyze_call_sentiment(transcript)
            conversation.sentiment = sentiment_analysis["sentiment"]
            conversation.satisfaction_score = sentiment_analysis["satisfaction_score"]

        conversation.ended_at = datetime.utcnow()
        self.db.commit()

        return conversation

# Then in main.py:
from services.voice_session_service import VoiceSessionService

@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(...):
    # ... existing code ...

    # OLD (371 lines in finally block):
    # await asyncio.sleep(2.0)
    # session_data = realtime_client.get_session_data()
    # ... 50+ lines of finalization logic ...

    # NEW (2 lines!):
    service = VoiceSessionService(db, session_id)
    await service.finalize_session(realtime_client, conversation)
```

**Estimated Time:**
- First extraction (finalization logic): 4-6 hours
- Full refactor (all 10 responsibilities): 1-2 weeks
- Do incrementally over 2-3 months

**Priority:** 🟢 **P2 LOW** - Only when codebase feels unmaintainable or team >3 devs
**Trigger:** Merge conflicts happen weekly, or developers afraid to touch `main.py`

---

#### 🔲 20. Split Database Models into Domain Modules (MONOLITHIC CONCERN #2)
**Status:** NOT STARTED

**The Problem:**
```python
# database.py is 1,186 lines with 17 different models:
class Customer(Base):  # Lines 100-150
class Service(Base):  # Lines 200-250
class Appointment(Base):  # Lines 300-400
class CallSession(Base):  # Lines 500-600
class Conversation(Base):  # Lines 700-850
class Provider(Base):  # Lines 900-950
# ... 11 more models
```

**Why This Is a Problem:**
- **Cognitive overload** - developers must scroll through 1,186 lines to find one model
- **Merge conflicts** - multiple devs editing same file causes conflicts
- **Circular imports** - models can't import from each other cleanly
- **No domain boundaries** - customer logic mixed with booking logic mixed with analytics

**The Solution (Domain-Driven Design):**
```
backend/
  /domain
    /customer
      customer_model.py    # Customer, CustomerNote models
      customer_service.py  # Business logic
    /booking
      booking_model.py     # Appointment, Service, Provider models
      booking_service.py   # BookingService (already exists!)
      slot_manager.py      # SlotSelectionManager (already exists!)
    /communication
      conversation_model.py   # Conversation, Message, VoiceCallDetails, etc.
      analytics_service.py    # AnalyticsService (move here)
    /settings
      settings_model.py    # Settings, BusinessHours models
      settings_service.py  # SettingsService (already exists!)
  /infrastructure
    /persistence
      base.py           # SQLAlchemy Base, engine, SessionLocal
      migrations/       # Alembic migrations
```

**Migration Steps:**
1. Create new domain structure (empty files)
2. Move ONE model at a time (start with least-coupled, like Settings)
3. Update imports across codebase
4. Test everything still works
5. Repeat for next model

**Estimated Time:** 2-3 weeks (doing it carefully, with tests)
**Priority:** 🟢 **P2 VERY LOW** - Only for 10+ developers or enterprise clients
**Trigger:** Team complains about `database.py` merge conflicts

---

#### 🔲 21. Add Redis for Session State (HORIZONTAL SCALING)

---

#### 🔲 20. Add Redis for Session State
**Status:** NOT NEEDED YET

**When You Need This:**
- Running multiple backend processes/workers
- WebSocket connections need to reconnect to different instances
- Session data needs to persist across process restarts

**Why Not Now:**
- Single process handles 100-200 concurrent WebSocket connections fine
- In-memory state is faster and simpler
- Redis adds operational complexity (another service to monitor)

**Implementation (Future):**
```python
# When you need it:
pip install redis aioredis

# Store session state:
import aioredis
redis = await aioredis.create_redis_pool('redis://localhost')
await redis.set(f"session:{session_id}", json.dumps(session_data))

# Retrieve on reconnect:
session_data = json.loads(await redis.get(f"session:{session_id}"))
```

**Estimated Time:** 2-3 days (setup + migration + testing)
**Trigger:** When you deploy 2+ backend instances

---

#### 🔲 21. Domain-Driven Design Refactor
**Status:** NOT NEEDED FOR PILOT

**Current Structure:**
```
backend/
  main.py (2318 lines)
  database.py (1186 lines)
  realtime_client.py (1326 lines)
  analytics.py
  calendar_service.py
  messaging_service.py
```

**Target Structure (For Scale):**
```
backend/
  /domain
    /voice
      voice_session.py          # Domain model
      voice_session_service.py  # Business logic
      voice_repository.py       # Data access
    /booking
      booking_service.py
      slot_selection_manager.py  # ✅ You already have this!
    /analytics
      analytics_service.py
  /infrastructure
    /api
      voice_routes.py    # Thin FastAPI routes
      booking_routes.py
    /persistence
      repositories.py
    /external
      openai_client.py
      calendar_client.py
  /tests
    /domain
    /integration
```

**Benefits:**
- Clear ownership (teams can own domains)
- Testable (mock infrastructure, test domain logic)
- Scalable (extract domains into microservices later)

**Estimated Time:** 2-3 weeks
**Trigger:** When 5+ developers working on codebase

---

### K. Advanced Monitoring

#### 🔲 22. Add Metrics (Prometheus/DataDog)
**Status:** NOT NEEDED FOR PILOT

**What's Missing:**
- Real-time metrics (calls/sec, booking rate, error rate)
- Performance metrics (p95 latency, DB query time)
- Business metrics (conversion rate, revenue)

**When You Need This:**
- Debugging performance issues
- Capacity planning
- SLA monitoring

**Estimated Time:** 1 week
**Cost:** DataDog starts at $15/host/month
**Trigger:** When you have on-call rotation

---

#### 🔲 23. Add Distributed Tracing
**Status:** NOT NEEDED UNTIL MICROSERVICES

**What It Does:**
Trace a single request across multiple services (e.g., API → Booking Service → Calendar API)

**Tools:**
- OpenTelemetry + Jaeger
- DataDog APM
- AWS X-Ray

**Estimated Time:** 1 week
**Trigger:** When you split into microservices

---

## Summary Status

### P0 (This Week Before Demo)
**Completion: 50%** (recalibrated with GPT-4 upgrades)

- ✅ **DONE (7 items):**
  1. Structured logging in runtime paths
  2. WebSocket exception handling
  3. Health endpoints (`/health/live`, `/health/ready`)
  4. Schema migration freeze (will disable `_ensure_schema_upgrades()`)

- 🔲 **TODO (10 items):**
  1. 🔴 **MANDATORY:** Configure `LOG_LEVEL` environment variable (15 min)
  2. 🟡 **STRONGLY RECOMMENDED:** Global exception handler (15 min)
  3. 🔴 **MANDATORY:** Configure platform health checks (15-30 min)
  4. 🔴 **MANDATORY:** Set up process crash/restart alerts (15-30 min)
  5. 🔴 **HIGH:** Enhanced Google Calendar error handling (1-2 hours)
  6. 🟡 **MEDIUM:** OpenAI API retry logic (1 hour)
  7. 🔴 **HIGH:** Verify database backups exist (30 min)
  8. 🔴 **CRITICAL:** Golden path smoke tests - 7 scenarios (2-3 hours)
  9. 🔴 **HIGH:** Basic load test - 50 concurrent calls (2-3 hours)
  10. ⚠️ **BLOCKING:** Provide deployment context (5 min)

**Total Estimated Time: 8-11 hours**

---

### P1 (Next Month After Pilot)
**Completion: 0%**

- 🔲 **Schema Management (BLOCKING FOR FUTURE CHANGES):**
  1. Implement Alembic migrations (4-6 hours) - **Do in week 2-3**
  2. Complete dual-write cutover (4-5 weeks phased rollout)

- 🔲 **Enhanced Monitoring:**
  1. Add Sentry error tracking (1 hour)
  2. Add request logging middleware (30 min)

- 🔲 **Performance:**
  1. Add caching for services/providers (1 hour)
  2. Add missing database indexes (2 hours)

**When to Start:** After demo success, prioritize Alembic before making any schema changes

---

### P2 (Next Quarter Before Scaling)
**Completion: 0%**

**Note:** These are architectural refactorings addressing Claude's "monolithic concerns." Only tackle when:
- Team >3 developers OR
- Merge conflicts happen weekly OR
- Feature velocity noticeably slows OR
- Approaching 100+ clinics / 500+ concurrent calls

- 🔲 **Architecture Refactoring (Monolithic Concerns):**
  1. Extract VoiceSessionService from `main.py` (1-2 weeks incremental)
  2. Split `database.py` models into domain modules (2-3 weeks)
  3. Add Redis for session state (2-3 days) - **Only when deploying 2+ backend instances**
  4. Domain-Driven Design full refactor (2-3 weeks) - **Only for 10+ developers**

- 🔲 **Advanced Monitoring:**
  1. Add metrics (Prometheus/DataDog) (1 week)
  2. Add distributed tracing (1 week) - **Only for microservices**

**When to Start:** Q1 2026 or when hitting 100+ clinics

---

## Action Plan: What to Do Next

### ⚡ IMMEDIATE (Do Right Now - 30 minutes)

**Goal:** Unblock other P0 items and knock out quick wins

1. **Answer Deployment Questions (Section F.12) - 5 minutes**
   - ⚠️ **BLOCKER** - Many P0 items depend on this
   - Questions:
     - Where is backend deployed? (Railway/Render/AWS/etc.)
     - What database are you using? (Supabase plan? Self-hosted?)
     - Production URLs? (HTTP + WebSocket)
     - Twilio phone number?

2. **Configure LOG_LEVEL - 15 minutes**
   - Section A.1 has exact code
   - Add to `backend/config.py` → `backend/main.py` → `.env`
   - **Priority: 🔴 MANDATORY** (GPT-4: "Safety valve for debugging")

3. **Add Global Exception Handler - 15 minutes**
   - Section A.2 has exact code
   - Copy-paste into `backend/main.py`
   - **Priority: 🟡 STRONGLY RECOMMENDED** (GPT-4: "Huge debugging payoff")

**Estimated Time: 35 minutes**
**Do this first thing today**

---

### 📅 TODAY (2-3 hours of focused work)

**Goal:** Complete critical error handling and monitoring setup

4. **Enhanced Google Calendar Error Handling - 1-2 hours**
   - Section C.6 has implementation code
   - Add specific error branches for 404/429/5xx
   - Test by temporarily breaking credentials
   - **Priority: 🔴 HIGH**

5. **Configure Platform Health Checks - 15-30 minutes**
   - Section B.4 and B.5 (requires deployment context from step 1)
   - Set up `/health/ready` probes
   - Enable crash/restart alerts
   - **Priority: 🔴 MANDATORY** (GPT-4 upgraded to P0)

6. **Verify Database Backups - 30 minutes**
   - Section D.8 has steps for Supabase vs self-hosted
   - Document restore procedure
   - **Priority: 🔴 HIGH**

**Estimated Time: 2-3 hours**
**Complete by end of day**

---

### 📅 TOMORROW (4-6 hours of focused work)

**Goal:** Thorough testing before demo

7. **OpenAI API Retry Logic - 1 hour**
   - Section C.7 has implementation
   - Add exponential backoff for rate limits
   - Add timeout handling
   - **Priority: 🟡 MEDIUM** (not critical path but good to have)

8. **Golden Path Smoke Tests - 2-3 hours**
   - Section E.10 has 7 detailed test scenarios
   - Run against **actual deployment** (not localhost)
   - Document results in checklist
   - **Priority: 🔴 CRITICAL** (GPT-4: "Ties into planner_priya baseline")

9. **Basic Load Test - 2-3 hours**
   - Section E.11 has complete Python script
   - Simulate 50 concurrent WebSocket calls
   - Monitor CPU/memory/DB connections
   - **Priority: 🔴 HIGH**

**Estimated Time: 5-7 hours**
**Complete day before demo**

---

### 🎯 DEMO DAY

10. **Final Verification Checklist**
    - [ ] All 7 golden path tests passed
    - [ ] Load test showed 90%+ success rate
    - [ ] Health checks configured and showing green
    - [ ] Backups verified within last 24 hours
    - [ ] Logs viewable in hosting dashboard
    - [ ] Error alerts configured
    - [ ] Have backup plan (manual booking) if system fails

**Estimated Time: 30 minutes final checks**

---

### 📊 AFTER DEMO (Next Month)

**Only if demo is successful:**

11. **Week 2-3: Implement Alembic** (Section G.13)
    - **Critical:** Must complete BEFORE any schema changes
    - Estimated: 4-6 hours

12. **Week 3-5: Dual-Write Validation** (Section G.14)
    - Run validation script daily
    - Phased cutover plan
    - Estimated: 4-5 weeks monitoring

13. **Optional: Sentry + Monitoring** (Section H.15-16)
    - High value, low effort
    - Estimated: 1.5 hours total

---

## Time Budget Summary

| Phase | Time Required | Deadline |
|-------|---------------|----------|
| **Immediate (Today Morning)** | 35 minutes | Now |
| **Today Afternoon** | 2-3 hours | EOD today |
| **Tomorrow** | 5-7 hours | Day before demo |
| **Demo Day Final Checks** | 30 minutes | Morning of demo |
| **TOTAL TO DEMO-READY** | **8-11 hours** | **This week** |

---

## Recommendation

**If you have limited time before demo:**

**Minimum Viable Hardening (4 hours):**
1. ✅ Deployment context + LOG_LEVEL (30 min)
2. ✅ Health checks + alerts (30 min)
3. ✅ Verify backups (30 min)
4. ✅ Golden path tests 1-3 only (1 hour)
5. ✅ Basic load test (2 hours)

**This gets you to "responsibly demo-able" state.**

**Full P0 Completion (8-11 hours):**
- Everything above +
- Global exception handler
- Enhanced error handling
- All 7 golden path tests
- OpenAI retry logic

**This gets you to "production pilot-ready" state.**

---

**What's your timeline to demo? Let me know and I can adjust the plan accordingly.**
