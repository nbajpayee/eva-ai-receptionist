# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Ava**, a voice AI receptionist for medical spas built with FastAPI (backend), Next.js 14 (admin dashboard), and OpenAI's Realtime API. The system handles appointment scheduling via Google Calendar, tracks call analytics with AI-powered satisfaction scoring, and provides a comprehensive admin dashboard for monitoring conversations and metrics.

**Current Status (Nov 21, 2025)**: **DEPLOYED TO PRODUCTION** ✅
- **Marketing Site**: https://getevaai.com (Vercel)
- **Admin Dashboard**: https://dashboard.getevaai.com (Vercel)
- **Backend API**: https://api.getevaai.com (Railway)

Phase 1A is production-ready. Voice interface complete with smart commits and interruption handling. **Phase 2 (Omnichannel Migration) is COMPLETE** ✅ - Backend now supports SMS and email communications with multi-message threading. All 77 historical call sessions migrated successfully. **Phase 2.6 (Dashboard Enhancements) is COMPLETE** ✅ - Full analytics visualizations, customer management, live status monitoring. See deployment details in `DEPLOYMENT.md`.

**Key Architecture**:
- **Backend**: FastAPI + Supabase PostgreSQL (fully migrated from SQLite)
- **Frontend**: Next.js 14 admin dashboard + vanilla HTML voice interface (being consolidated)
- **Voice**: Hybrid client-side + server-side VAD with dual-speed commits (300ms/120ms)
- **Interruption**: Client-side audio source tracking with immediate cutoff
- **Omnichannel (Phase 2 - COMPLETE)**: Conversations schema supporting voice, SMS, and email with:
  - Unified customer timeline across all channels
  - Multi-message threading for SMS/email
  - Cross-channel AI satisfaction scoring (GPT-4)
  - Dual-write migration strategy (writes to both legacy + new schemas)
  - Admin dashboard updated to display conversations

**Booking Refactor (Nov 2025)**
- Shared helpers live in `backend/booking/` with `SlotSelectionCore` and `SlotSelectionManager` facades.
- `booking.time_utils` owns Eastern Time normalization and formatting for all channels.
- `messaging_service.py` and `realtime_client.py` delegate slot offer tracking, transcript capture, and enforcement to the manager.
- Voice transcripts persist via conversation metadata, preserving selections across channels.
- Regression suites: `backend/tests/test_voice_booking.py`, `backend/tests/booking/test_slot_selection.py`, `backend/tests/test_cross_channel_booking.py`.

**Deterministic Booking Flow (Nov 18, 2025)** ✅ **PRODUCTION-READY**
- **Problem Solved**: AI was hesitating to book appointments, asking to "re-check availability" even after user provided all details
- **Solution**: Deterministic tool execution for both `check_availability` AND `book_appointment`
- **How it works**:
  1. When booking intent detected → System calls `check_availability` preemptively (before AI generates response)
  2. When slot selected + contact details complete → System calls `book_appointment` automatically
  3. Results injected into conversation history so AI sees tool context across messages
- **Architecture**: `messaging_service.py` lines 244-382 (readiness detection + execution), lines 1342-1362 (integration)
- **Benefits**: 100% reliable booking completion, no AI hesitation, no retry loops, immediate confirmation
- **Documentation**: See `FINAL_SOLUTION_DETERMINISTIC_TOOL_EXECUTION.md`, `TOOL_CALL_HISTORY_PERSISTENCE_FIX.md`, `COMPLETE_CONVERSATION_SUMMARY.md`
- **Tests**: 37/37 passing including new `TestDeterministicBooking` suite

**Architecture Refactor (Nov 28, 2025)** ✅ **COMPLETE**
- **Goal**: Single booking brain shared by voice and messaging; typed contracts; centralized AI config; comprehensive metrics
- **What Changed**:
  - ✅ **BookingOrchestrator**: Single entry point for all booking operations (`backend/booking/orchestrator.py`)
  - ✅ **Typed Contracts**: `BookingContext`, `CheckAvailabilityResult`, `BookingResult` replace `Dict[str, Any]`
  - ✅ **Type Safety**: `BookingContext` now uses proper types (`Session`, `Conversation`, `Customer`, `CalendarService`)
  - ✅ **AI Config Module**: `backend/ai_config.py` provides model constants and shared OpenAI client
  - ✅ **Realtime Config**: `backend/realtime_config.py` expanded with VAD settings, audio formats, temperature options
  - ✅ **Comprehensive Metrics**: All 4 booking tools (check/book/reschedule/cancel) tracked in both voice and messaging
  - ✅ **Legacy Schema Removed**: `CallSession`/`CallEvent` models deleted, conversations-only architecture
- **Test Coverage**: 21/21 booking tests passing, 34/39 integration tests passing
- **See**: `ARCHITECTURE_REFACTOR_PLAN.md`, `BOOKING_ARCHITECTURE.md` for full details

## Development Commands

### Backend (FastAPI)
```bash
# Start backend server (from root directory)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Initialize Supabase schema
python backend/scripts/create_supabase_schema.py

# Seed sample data for dashboard testing
python backend/scripts/seed_supabase.py --force

# Migrate legacy SQLite data to Supabase (if needed)
python backend/scripts/migrate_sqlite_to_supabase.py

# Omnichannel migration scripts (Phase 2 - COMPLETED Nov 10, 2025)
python backend/scripts/create_omnichannel_schema.py  # Create conversations schema
python backend/scripts/migrate_call_sessions_to_conversations.py  # Migrate data (already done)
python backend/scripts/fix_omnichannel_constraints.py  # Fix schema constraints (if needed)
```

### Admin Dashboard (Next.js)
```bash
# Start Next.js dev server (from root directory)
cd admin-dashboard
npm run dev          # Runs on http://localhost:3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # Run ESLint
```

### Database
```bash
# Start local PostgreSQL via Docker (optional - only if not using Supabase)
docker-compose up -d postgres
docker-compose down
```

### Testing Voice Interface
Open `frontend/index.html` in a browser to test the legacy voice interface prototype. This is a simple WebSocket client for development/debugging.

## High-Level Architecture

### System Components
```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │ Voice Interface  │              │ Admin Dashboard  │    │
│  │ (index.html)     │              │ (Next.js)        │    │
│  └────────┬─────────┘              └────────┬─────────┘    │
└───────────┼──────────────────────────────────┼──────────────┘
            │                                  │
            │ WebSocket                        │ HTTP/REST
            │ /ws/voice/{session_id}          │ /api/admin/*
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────┐
│                   FastAPI Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ main.py      │  │ realtime_    │  │ analytics.py │     │
│  │ (WebSocket)  │  │ client.py    │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────────┐
│ OpenAI Realtime │  │   Google    │  │     Supabase     │
│      API        │  │  Calendar   │  │   (PostgreSQL)   │
│  (Voice I/O)    │  │     API     │  │                  │
└─────────────────┘  └─────────────┘  └──────────────────┘
```

### Data Flow

**Voice Call Flow**:
1. Browser connects to `/ws/voice/{session_id}` WebSocket
2. FastAPI creates `CallSession` record in database
3. FastAPI establishes WebSocket connection to OpenAI Realtime API
4. Audio streams bidirectionally: Browser ↔ FastAPI ↔ OpenAI
5. OpenAI may call functions (e.g., `book_appointment`) which trigger Google Calendar API calls
6. On disconnect, FastAPI:
   - Stores full transcript
   - Calls GPT-4 for satisfaction scoring/sentiment analysis
   - Updates `CallSession` with analytics
   - Aggregates daily metrics

**Admin Dashboard Flow**:
1. Next.js frontend calls relative `/api/admin/*` routes (Next.js API routes) on the same origin as the dashboard.
2. Each proxy route uses the Supabase server client to read the current session and, if present, forwards `Authorization: Bearer <access_token>` and JSON payloads to `${NEXT_PUBLIC_API_BASE_URL}/api/admin/*` (FastAPI).
3. FastAPI decodes the Supabase JWT, attaches current user/role context, and queries Supabase PostgreSQL.
4. Data flows back through the proxy to Next.js components.

### Database Schema

**Core Tables** (Phase 1  legacy, pre-conversations refactor):
- `customers`: Customer profiles (name, phone, email, medical screening flags)
- `appointments`: Scheduled appointments linked to customers and Google Calendar events
- `call_sessions`: Voice call metadata, transcripts, satisfaction scores, sentiment
- `call_events`: Timestamped events within calls (intent detection, function calls, escalations)
- `daily_metrics`: Aggregated daily stats for dashboard analytics

**Key Relationships** (Phase 1  legacy):
- `Customer` 1:N `Appointment`
- `Customer` 1:N `CallSession`
- `CallSession` 1:N `CallEvent`

All models use SQLAlchemy ORM defined in `backend/database.py`.

### Omnichannel Communications Migration (Phase 2 - In Progress)

**Status**: Design complete, implementation starting Nov 10, 2025

**Goal**: Expand backend to support SMS and email communications with multi-message threading, unified customer timelines, and cross-channel AI satisfaction scoring.

**New Schema** (see `OMNICHANNEL_MIGRATION.md` for full details):
- `conversations`: Top-level container for communication threads (replaces call_sessions)
  - Fields: customer_id, channel (voice/sms/email), status, satisfaction_score, sentiment, outcome, ai_summary
- `communication_messages`: Individual messages within conversations
  - Voice: 1 message per call (entire transcript)
  - SMS/Email: N messages per thread (multi-message support)
- `voice_call_details`: Voice-specific metadata (1:1 with message)
  - recording_url, duration_seconds, transcript_segments, function_calls, interruption_count
- `email_details`: Email-specific metadata (1:1 with message)
  - subject, body_html, from/to addresses, attachments, delivery tracking
- `sms_details`: SMS-specific metadata (1:1 with message)
  - from/to numbers, Twilio SID, delivery_status, segments, media_urls
- `communication_events`: Generalized event tracking (replaces call_events)
  - Supports all channels: intent_detected, function_called, escalation_requested, etc.

**Migration Strategy**:
1. Create new schema alongside existing tables (backward compatible)
2. Backfill call_sessions → conversations + voice_call_details
3. Dual-write period (write to both schemas)
4. Update analytics.py for multi-channel satisfaction scoring
5. Update dashboard APIs to use conversations
6. Cutover (switch all reads to new schema)
7. Cleanup (archive/drop old tables after validation)

**Key Changes**:
- `analytics.py`: New methods for create_conversation, add_message, score_conversation_satisfaction
- `main.py`: New webhook handlers for Twilio SMS and SendGrid email
- Dashboard APIs: `/api/admin/communications` (replaces `/api/admin/calls`)
- Unified customer timeline: See all voice/SMS/email in one view

**Timeline**: 5 weeks (Nov 10 - Dec 15, 2025)

### Key Modules

**backend/realtime_client.py**:
- Manages WebSocket connection to OpenAI Realtime API
- Handles audio streaming, function calling (e.g., `book_appointment`, `check_availability`)
- Enforces Ava persona with scripted greeting from `config.py`
- Maintains session data (transcript, function calls, customer data)

**backend/analytics.py**:
- Creates and ends call sessions
- AI-powered satisfaction scoring using GPT-4 (analyzes transcripts for sentiment, frustration, success)
- Calculates daily metrics aggregation
- Provides dashboard data via `AnalyticsService` methods

**backend/calendar_service.py**:
- Google Calendar OAuth2 integration (mock fallback removed; production credentials required in all environments)
- Availability checking, appointment booking, rescheduling, cancellation
- Uses `credentials.json` and `token.json` for authentication

**backend/config.py**:
- Environment settings via Pydantic
- Med spa services dictionary (9 services with pricing, duration, prep/aftercare)
- Provider profiles (3 providers with specialties)
- `SYSTEM_PROMPT` and `OPENING_SCRIPT` for Ava's persona and identity enforcement

**admin-dashboard/src/app/api/admin/***:
- Next.js API routes that proxy to FastAPI
- Example: `/api/admin/metrics` → `http://localhost:8000/api/admin/metrics/overview`

## Important Configuration Details

### Environment Variables (.env)
The `.env` file must be in the **root directory** (not in `backend/`). FastAPI's `config.py` loads from parent directory. Required variables:
- `DATABASE_URL`: Supabase Postgres connection string
- `OPENAI_API_KEY`: OpenAI API key
- `GOOGLE_CALENDAR_ID`: Google Calendar ID
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `MED_SPA_NAME`, `MED_SPA_PHONE`, `MED_SPA_ADDRESS`, `MED_SPA_HOURS`
- `AI_ASSISTANT_NAME`: Default is "Ava"

### Admin Dashboard Authentication (Supabase)
- Admin dashboard uses Supabase Auth (email/password) against the production Supabase project.
- Frontend:
  - `admin-dashboard/src/lib/supabase/client.ts` uses `@supabase/ssr` `createBrowserClient`.
  - `admin-dashboard/src/contexts/auth-context.tsx` manages `user`, `session`, and `profile` (from the `profiles` table).
  - `admin-dashboard/src/components/layout/app-shell.tsx` plus `admin-dashboard/src/lib/supabase/middleware.ts` gate all routes except `/login`.
  - `/login` renders only the login module; all other pages show full dashboard chrome with `UserNav` avatar + logout.
- Server / API routes:
  - `admin-dashboard/src/lib/supabase/server.ts` wraps `createServerClient` for server components and API routes.
  - `admin-dashboard/src/app/api/admin/_auth.ts` reads the Supabase session and forwards `Authorization: Bearer <JWT>` to FastAPI.
  - All `/api/admin/*` Next.js routes that hit the backend now call `getBackendAuthHeaders()` and return `401` if unauthenticated.
- Backend:
  - `backend/auth.py` includes a Supabase-compatible JWT decoder (base64 payload parsing, signature verification currently relaxed).
  - `backend/scripts/create_auth_schema.sql` defines `profiles` and `user_role` plus RLS; recursion bugs in `profiles` policies have been fixed.
- Local dev:
  - `admin-dashboard/.env.local` must set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
  - Internal fetches from dashboard pages call relative URLs (e.g. `/api/admin/...`) instead of hardcoding `localhost:3000`, avoiding CORS when dev runs on an alternate port.

### Persona Identity Enforcement
The AI assistant **must always identify as Ava**, not ChatGPT. This is enforced via:
- `SYSTEM_PROMPT` in `config.py` includes explicit identity requirements
- `OPENING_SCRIPT` is sent as a greeting when sessions start
- `realtime_client.py` sends greeting via `send_greeting()` method

If the assistant reverts to "I'm ChatGPT", check:
1. `SYSTEM_PROMPT` in `config.py` has identity instructions
2. Backend was restarted after config changes
3. Browser cleared cache and reconnected

### Function Calling
The OpenAI Realtime API is configured with function definitions for:
- `book_appointment(datetime, service, customer_name, phone, email)`
- `check_availability(date, service)`
- `reschedule_appointment(appointment_id, new_datetime)`
- `cancel_appointment(appointment_id)`

These are defined in `realtime_client.py` and call `calendar_service.py` methods.

## Development Patterns

### Database Migrations
The project currently uses SQLAlchemy's `Base.metadata.create_all()` for schema initialization (no Alembic migrations yet). When adding new columns or tables:
1. Update models in `backend/database.py`
2. Run `python backend/scripts/create_supabase_schema.py` to apply changes to Supabase
3. Consider adding Alembic migrations in the future for production

### Adding New Services
To add a new med spa service:
1. Add entry to `SERVICES` dict in `backend/config.py`
2. Include: name, duration_minutes, price_range, description, prep_instructions, aftercare
3. Restart backend server (FastAPI must reload config)

### Adding New Endpoints
For new FastAPI endpoints:
1. Add route in `backend/main.py`
2. If admin dashboard needs it, create proxy route in `admin-dashboard/src/app/api/`
3. Use dependency injection: `db: Session = Depends(get_db)`

### WebSocket Connection Lifecycle
The voice WebSocket endpoint follows this pattern:
1. Accept WebSocket connection
2. Create `CallSession` in DB
3. Connect to OpenAI Realtime API
4. Send scripted greeting
5. Run concurrent tasks for client messages and OpenAI messages
6. On disconnect (either side), finalize session:
   - Wait grace period for OpenAI to flush events
   - Store transcript and function calls
   - Run satisfaction scoring (GPT-4 call)
   - Update database with analytics
7. Always ensure cleanup in `finally` block with `finalize_session()`

### Error Handling Patterns
- WebSocket disconnects are logged but not treated as errors (routine)
- Database operations use try/except with transaction rollback
- OpenAI API calls should handle rate limits and timeouts
- Calendar API calls return user-friendly error messages to the AI

## Testing Strategies

### Manual Testing Checklist
When testing voice calls, verify:
- "What services do you offer?" → AI lists services
- "What are your hours?" → AI provides `MED_SPA_HOURS`
- "I'd like to book a Botox appointment" → AI collects info and books via Calendar API
- "Who are you?" → AI responds as Ava (not ChatGPT)
- Check transcript is saved in database after call ends
- Verify satisfaction score appears in admin dashboard

### Golden Scenarios Regression Layer (Nov 26, 2025)

To keep Ava's behavior stable as prompts and booking logic evolve, there is a small
"golden scenarios" regression layer:

- **Data fixture:** `backend/tests/fixtures/golden_scenarios.json`
  - ~30 canonical scenarios across 7 MECE intent buckets (info, booking,
    management, operational, sales, post-appointment, admin).
  - Each scenario includes: `id`, description, channel, a short
    conversation sketch, and high-level `success_criteria` flags
    (e.g. `no_preemptive_check`, `no_post_booking_recheck`,
    `escalation_offered`).
- **Tests:** `backend/tests/test_golden_scenarios.py`
  - Currently enforces critical invariants for relative-date handling:
    - Bare "next week" / "coming week" **must not** trigger preemptive
      availability enforcement; Ava should first ask which day.
    - Long-range phrases like "in 3 weeks" / "in a few months" **must not**
      default to tomorrow; Ava should clarify a specific date or week.
  - This file is the right place to add future behavioral invariants,
    e.g. Liam 3 PM regression (no post-booking re-check), indecisive
    service selection (no auto-default to Botox), multi-appointment
    reschedule disambiguation, etc.

When modifying prompts or `messaging_service.py`, prefer to:

- Add/adjust scenarios in `golden_scenarios.json` for new edge cases.
- Extend `test_golden_scenarios.py` to assert new invariants, rather than
  only editing prompts in-place.

### API Testing
```bash
# Health check
curl http://localhost:8000/health

# Get dashboard metrics
curl "http://localhost:8000/api/admin/metrics/overview?period=today"

# Get call history
curl "http://localhost:8000/api/admin/calls?page=1&page_size=10"
```

## Known Issues & Gotchas

1. **SQLite threading**: If using SQLite for local testing, `check_same_thread=False` is set in `database.py` to prevent errors with Uvicorn's async workers.

2. **Token.json refresh**: Google Calendar token expires. Delete `backend/token.json` and re-authenticate if you get auth errors. Without valid credentials the app will now raise instead of falling back to a mock calendar.

3. **WebSocket disconnects**: Routine disconnects flood logs. Consider filtering `ClientDisconnected` messages.

4. **Next.js API proxy**: Proxy routes require backend running on `localhost:8000`. If backend port changes, update `admin-dashboard/src/app/api/admin/*/route.ts` files.

5. **Transcript empty**: If transcripts aren't saving, check `realtime_client.py` is accumulating messages in `session_data['transcript']` list during `handle_messages()`.

6. **Satisfaction scoring costs**: Every call ending triggers a GPT-4 API call for satisfaction analysis. Monitor OpenAI usage in production.

## Critical Architecture Decisions

### Hybrid VAD Architecture - Production Ready (Nov 9, 2025)

**CURRENT APPROACH**: Hybrid client-side + server-side VAD with smart dual-speed commits. This is the **production-ready** architecture after testing Rounds 1-6.

**How it works:**
1. **Client-side VAD** (`frontend/app.js`):
   - Calculates RMS (Root Mean Square) of audio buffer
   - Threshold: 0.005 (configurable based on environment noise)
   - Detects when user starts/stops speaking
   - **Fast commit (120ms)**: Triggered when VAD detects user stopped speaking
   - **Normal commit (300ms)**: Scheduled after each audio chunk as fallback

2. **Server-side VAD** (`backend/realtime_client.py`):
   - OpenAI's VAD still enabled as secondary detection
   - Threshold: 0.6 (less sensitive to background noise)
   - Silence duration: 600ms
   - Auto-response generation: True

3. **Backend commit handler** (`backend/main.py`):
   - Processes client commit requests
   - Calls `realtime_client.commit_audio_buffer()`
   - OpenAI processes commit and generates transcription

**Interruption Handling:**
- Client tracks all playing audio sources in `activeAudioSources` array
- When user speaks during assistant audio:
  1. Client VAD detects speech
  2. Calls `stopAllAudio()` to immediately halt playback
  3. Sends interrupt message to backend
  4. Backend calls OpenAI `response.cancel`
- Graceful error handling differentiates expected vs unexpected errors

**Configuration Files:**
- **Frontend**: `frontend/app.js` (vanilla - production ready)
- **Frontend**: `admin-dashboard/src/hooks/useVoiceSession.ts` (Next.js - needs update)
- **Backend**: `backend/realtime_client.py` (lines 403-410 for `cancel_response`)
- **Backend**: `backend/main.py` (lines 186-192 for commit/interrupt handlers)

**Why Hybrid (Not Server-Only):**
- Server-side VAD alone (Round 5) was too slow (600ms+ delay)
- Client-side fast commits (120ms) provide instant responsiveness
- Dual-speed strategy optimizes for natural conversation flow
- Interruption requires client-side detection for immediate audio cutoff

**Architecture Evolution:**
- **Round 1-4**: Configuration fixes, transcription model setup
- **Round 5**: Pure server VAD (too slow, removed manual commits)
- **Round 6**: Hybrid VAD with smart commits (production ready)

**See also:** `TESTING_SMART_COMMITS.md` for testing guide, `TODO.md` Round 6 section for full details.

## Current Sprint Focus

Per `TODO.md`, the project is in **Production Deployment Phase (Nov 18-21)**:
- ✅ Marketing site deployed to Vercel (https://getevaai.com)
- ✅ Admin dashboard deployed to Vercel (https://dashboard.getevaai.com)
- ✅ Backend API deployed to Railway (https://api.getevaai.com)
- ✅ Google Calendar credentials configured via Railway secrets
- ✅ Analytics visualizations (4 chart components)
- ✅ Customer management interface (full CRUD)
- ✅ Real-time call status monitoring
- ✅ Silero VAD infrastructure ready for integration

**Up Next**:
- Silero VAD integration into voice interface
- Authentication for admin dashboard (Supabase Auth)
- Row Level Security (RLS) policies in Supabase
- Twilio SMS production integration (console testing complete)
- Boulevard scheduling (currently using Google Calendar)
- Multi-language support

**Recent Backend Debugging (Nov 23, 2025)**
- Verified FastAPI is using Supabase Postgres as the single source of truth (`DATABASE_URL` confirmed) and reproduced DB reads via `SessionLocal`.
- Fixed admin customer detail 404s by adding `GET /api/admin/customers/{customer_id}` in `backend/main.py` (returns profile plus related appointments and conversations) and wiring it to the Next.js admin customer detail page.
- Implemented admin appointment request endpoints (`GET /api/admin/appointments/requests`, `PATCH /api/admin/appointments/requests/{request_id}`) and connected them to the Requests tab on the `/appointments` page via Next.js API proxy routes.
- Added unauthenticated booking config endpoints (`GET /api/config/services`, `GET /api/config/providers`) used by the Book Appointment dialog to load services/providers from the dynamic settings tables instead of hardcoded config.

## File Organization

```
Ava/
├── backend/                      # Python FastAPI backend
│   ├── main.py                   # FastAPI app, WebSocket endpoint, admin API routes
│   ├── database.py               # SQLAlchemy models (Customer, Appointment, CallSession, etc.)
│   ├── realtime_client.py        # OpenAI Realtime API WebSocket client
│   ├── calendar_service.py       # Google Calendar API integration
│   ├── analytics.py              # Call tracking, satisfaction scoring (GPT-4)
│   ├── config.py                 # Settings, services, providers, prompts
│   ├── requirements.txt          # Python dependencies
│   └── scripts/                  # Database utilities
│       ├── create_supabase_schema.py
│       ├── seed_supabase.py
│       └── migrate_sqlite_to_supabase.py
│
├── admin-dashboard/              # Next.js 14 admin interface
│   ├── src/app/
│   │   ├── page.tsx              # Dashboard overview (metrics, call log)
│   │   ├── api/admin/            # Proxy routes to FastAPI
│   │   ├── voice/                # Voice interface page (future)
│   │   └── layout.tsx            # Root layout
│   └── src/components/           # Shadcn UI components
│
├── frontend/                     # Legacy HTML/JS voice test interface
│   ├── index.html                # Simple WebSocket client for testing
│   └── app.js                    # Audio streaming, transcript display
│
├── .env.example                  # Template for environment variables
├── docker-compose.yml            # PostgreSQL container (optional, for local dev)
├── README.md                     # Comprehensive project documentation
└── TODO.md                       # Project tracker, sprint goals, architecture decisions
```

## Production Deployment (Nov 21, 2025)

**Current Deployment Status:** ✅ LIVE

### Deployed Services

1. **Marketing Site** (Vercel)
   - URL: https://getevaai.com
   - Tech: Next.js 14 + TailwindCSS
   - Features: Hero, features, testimonials, pricing, legal pages, Calendly integration

2. **Admin Dashboard** (Vercel)
   - URL: https://dashboard.getevaai.com
   - Tech: Next.js 14 + TypeScript + Shadcn/ui
   - Environment Variables:
     - `NEXT_PUBLIC_API_BASE_URL=https://api.getevaai.com`
     - `NEXT_PUBLIC_BACKEND_URL=https://api.getevaai.com`
   - Features: Analytics charts, customer management, live status, call history, appointments calendar

3. **Backend API** (Railway)
   - URL: https://api.getevaai.com
   - Tech: FastAPI + Python 3.11
   - Google Calendar credentials configured via Railway secrets (base64-encoded)
   - Environment variables configured for production
   - WebSocket support enabled for voice calls

### Deployment Configuration

**Google Calendar Credentials (Railway):**
- `GOOGLE_CREDENTIALS_BASE64`: Base64-encoded `credentials.json`
- `GOOGLE_TOKEN_BASE64`: Base64-encoded `token.json`
- Decoded on startup via `railway_setup_credentials.sh` script

**Next.js Build Configuration:**
- Admin dashboard uses Next.js proxy routes to forward requests to Railway backend
- `NEXT_PUBLIC_*` environment variables embedded at build time
- Requires redeployment when environment variables change

### Security Considerations

**Current (Production):**
- ✅ HTTPS/WSS enabled via Vercel and Railway
- ✅ CORS configured for dashboard.getevaai.com
- ✅ Environment variables properly secured
- ✅ Google Calendar credentials stored as Railway secrets

**To Implement:**
- [x] Authentication for admin dashboard (Supabase Auth wired into Next.js + Supabase sessions)
- [x] Baseline Row Level Security (RLS) policies in Supabase (profiles + roles; more granular policies TBD)
- [ ] Rate limiting for API endpoints
- [ ] HIPAA compliance for production med spa use (encryption at rest, BAAs, audit logs)

### Monitoring & Operations

**Health Checks:**
- Backend: `https://api.getevaai.com/health`
- Dashboard: Access dashboard UI directly
- Marketing: Access marketing site directly

**Logs:**
- Railway: Dashboard → Deployments → View Logs
- Vercel: Dashboard → Deployments → Function Logs

See `DEPLOYMENT.md` for full deployment guide and troubleshooting.
