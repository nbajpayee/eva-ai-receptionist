# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Ava**, a voice AI receptionist for medical spas built with FastAPI (backend), Next.js 14 (admin dashboard), and OpenAI's Realtime API. The system handles appointment scheduling via Google Calendar, tracks call analytics with AI-powered satisfaction scoring, and provides a comprehensive admin dashboard for monitoring conversations and metrics.

**Current Status (Nov 9, 2025)**: Phase 1A is production-ready. The vanilla frontend (`frontend/index.html`) has complete voice functionality with smart commits and interruption handling. The Next.js frontend needs the interruption logic updated to match the vanilla implementation.

**Key Architecture**:
- **Backend**: FastAPI + Supabase PostgreSQL (fully migrated from SQLite)
- **Frontend**: Next.js 14 admin dashboard + vanilla HTML voice interface (being consolidated)
- **Voice**: Hybrid client-side + server-side VAD with dual-speed commits (300ms/120ms)
- **Interruption**: Client-side audio source tracking with immediate cutoff

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
1. Next.js frontend calls `/api/admin/*` routes (Next.js API routes)
2. Next.js proxy routes forward requests to `http://localhost:8000/api/admin/*` (FastAPI)
3. FastAPI queries Supabase PostgreSQL
4. Data flows back through proxy to Next.js components

### Database Schema

**Core Tables**:
- `customers`: Customer profiles (name, phone, email, medical screening flags)
- `appointments`: Scheduled appointments linked to customers and Google Calendar events
- `call_sessions`: Voice call metadata, transcripts, satisfaction scores, sentiment
- `call_events`: Timestamped events within calls (intent detection, function calls, escalations)
- `daily_metrics`: Aggregated daily stats for dashboard analytics

**Key Relationships**:
- `Customer` 1:N `Appointment`
- `Customer` 1:N `CallSession`
- `CallSession` 1:N `CallEvent`

All models use SQLAlchemy ORM defined in `backend/database.py`.

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
- Google Calendar OAuth2 integration
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

2. **Token.json refresh**: Google Calendar token expires. Delete `backend/token.json` and re-authenticate if you get auth errors.

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

Per `TODO.md`, the project is in **Sprint 1 (Nov 7-14)**:
- Migrating to Supabase from SQLite
- Building Next.js admin dashboard with live data
- Connecting dashboard to FastAPI backend via proxy routes
- Next: SMS confirmations via Twilio, enhanced analytics visualizations

**Not yet implemented**:
- Row Level Security (RLS) policies in Supabase
- Authentication for admin dashboard
- Twilio SMS integration
- Boulevard scheduling (still using Google Calendar)
- Multi-language support

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

## Deployment Considerations

**Backend (FastAPI)**:
- Requires Python 3.9+
- Must have `credentials.json` for Google Calendar API
- Ensure `DATABASE_URL` points to Supabase (not SQLite) in production
- Use production ASGI server (uvicorn with multiple workers)

**Frontend (Next.js)**:
- Build with `npm run build` in `admin-dashboard/`
- Set `NEXT_PUBLIC_BACKEND_URL` if FastAPI is on different domain
- Vercel deployment recommended

**WebSocket**:
- Ensure WebSocket protocol is supported (wss:// for HTTPS)
- Configure load balancer to support WebSocket upgrades (sticky sessions)

**Security**:
- Enable HTTPS/WSS in production
- Implement authentication for admin dashboard
- Add RLS policies in Supabase for multi-tenant support
- Never commit `.env`, `credentials.json`, `token.json`
- HIPAA compliance required for production med spa use (encryption at rest, BAAs, audit logs)
