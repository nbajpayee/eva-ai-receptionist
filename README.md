# Eva AI - Med Spa Voice AI Receptionist

An intelligent voice AI application that serves as a virtual receptionist for medical spas. The app handles appointment scheduling, answers common customer inquiries, and tracks conversation quality with analytics.

**🚀 LIVE IN PRODUCTION:** https://getevaai.com

## Quick Links
- **Marketing Site:** https://getevaai.com
- **Admin Dashboard:** https://dashboard.getevaai.com
- **Backend API:** https://api.getevaai.com

## Features

### Phase 1 (Current - Production Ready)
- ✅ Voice-to-voice conversation using OpenAI Realtime API
- ✅ Smart commit strategy with client-side VAD (dual-speed: 300ms/120ms)
- ✅ Real-time interruption handling with immediate audio cutoff
- ✅ Appointment scheduling with Google Calendar integration (requires Google credentials; mock calendar removed)
- ✅ FAQ responses (services, pricing, hours, providers)
- ✅ Full transcript logging (both customer and assistant speech)
- ✅ AI-powered satisfaction scoring and sentiment analysis
- ✅ Analytics and metrics collection with Supabase integration
- ✅ Admin API endpoints for dashboard
- ✅ Next.js admin dashboard with live metrics & call history
- ✅ Role-specific greeting and persona enforcement for Ava receptionist
- ✅ End-to-end appointment booking tested and verified

### Phase 2 (Complete - Nov 11, 2025) ✅
- ✅ **Omnichannel Communications Schema**: Full support for voice, SMS, and email
- ✅ **Unified Customer Timeline**: All conversations in one database schema
- ✅ **Cross-Channel AI Scoring**: GPT-4 satisfaction analysis works for all channels
- ✅ **Dual-Write Migration**: Voice calls write to both legacy and new schema
- ✅ **85+ Conversations**: 77 historical migrated + 8 validated test calls
- ✅ **100% Production Validated**: All core features and edge cases tested
  - New customer creation
  - Existing customer reuse
  - Anonymous call handling
  - Message creation & scoring
  - Dashboard functionality
- ✅ **Admin Dashboard Updated**: Shows conversations from all channels
- ✅ **Multi-Message Threading**: Supports SMS/email conversations with N messages
- 🚧 **Messaging Console** (Next): Testing interface for SMS/email before Twilio/SendGrid
- ⏳ **Twilio/SendGrid Integration**: Planned for production (post-MVP)

**Migration Details**: See `OMNICHANNEL_MIGRATION.md`, `IMPLEMENTATION_COMPLETE.md`, `MIGRATION_SUCCESS.md`, `DUAL_WRITE_VALIDATION.md`, and `CUSTOMER_LINKAGE_TEST.md` for full documentation.

### Phase 2.5 (Complete - Nov 18, 2025) ✅ **Deterministic Booking Flow**
- ✅ **Problem Solved**: AI hesitation causing infinite loops and failed bookings
- ✅ **Deterministic Availability Checking**: System preemptively calls `check_availability` when booking intent detected
- ✅ **Deterministic Booking Execution**: System automatically calls `book_appointment` when slot selected + contact details complete
- ✅ **Tool Call History Persistence**: Results injected into conversation history so AI has full context
- ✅ **100% Reliable Bookings**: No retry loops, no AI hesitation, immediate confirmation
- ✅ **Comprehensive Testing**: 37/37 tests passing including new `TestDeterministicBooking` suite
- ✅ **Production Ready**: Handles all edge cases (duplicate bookings, failures, expiry)

**Technical Details**: See `backend/messaging_service.py` lines 244-382, `FINAL_SOLUTION_DETERMINISTIC_TOOL_EXECUTION.md`, `TOOL_CALL_HISTORY_PERSISTENCE_FIX.md`

### Phase 2.7 (Complete - Nov 18, 2025) ✅ **Advanced Enterprise Features**
- ✅ **Settings Management System**: Dynamic med spa configuration (5 tables, 20+ API endpoints)
  - Business information, locations, hours, services, providers
  - No code changes needed - all managed through admin UI
- ✅ **Provider Analytics & Consultation Recording**: AI-powered coaching system
  - Record in-person consultations with audio transcription
  - GPT-4 analysis for coaching insights and best practices
  - Performance metrics and provider comparison
- ✅ **Research & Outbound Campaigns**: Customer segmentation and multi-channel outreach
  - SMS, Email, Voice campaign execution
  - AI agent configuration and response tracking
  - Campaign analytics dashboard

### Phase 2.6 (Complete - Nov 18, 2025) ✅ **Dashboard Enhancements**
- ✅ **Analytics Visualizations**: 4 Recharts components (call volume, satisfaction trends, conversion rate, call duration)
- ✅ **Customer Management**: Full CRUD interface with search, filters, medical screening badges
- ✅ **Real-time Call Status**: Live monitoring with 5-second auto-polling, active calls indicator
- ✅ **Silero VAD Infrastructure**: 95%+ speech detection accuracy (ready for integration)

### Phase 3 (Complete - Nov 18-21, 2025) ✅ **Production Deployment**
- ✅ **Marketing Site**: https://getevaai.com (Vercel)
- ✅ **Admin Dashboard**: https://dashboard.getevaai.com (Vercel)
- ✅ **Backend API**: https://api.getevaai.com (Railway)
- ✅ **Google Calendar Integration**: Credentials configured via Railway secrets
- ✅ **WebSocket Support**: Enabled for voice calls
- ✅ **CORS Configuration**: Secured for dashboard domain

### Phase 4 (Coming Soon)
- Boulevard scheduling integration
- Supabase Auth for admin dashboard
- Advanced customer insights
- Multi-language support
- Twilio SMS production integration

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│  ┌────────────────────┐         ┌──────────────────────────────┐   │
│  │  Voice Interface   │         │   Admin Dashboard (Next.js)  │   │
│  │  (WebSocket)       │         │   + Marketing Site           │   │
│  └─────────┬──────────┘         └──────────────┬───────────────┘   │
└────────────┼────────────────────────────────────┼───────────────────┘
             │                                    │
             │ WebSocket                          │ HTTP/REST
             │ /ws/voice/{session_id}            │ /api/admin/*
             │                                    │
┌────────────▼────────────────────────────────────▼───────────────────┐
│                      FastAPI Backend (Railway)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Channel Layer                              │  │
│  │  ┌─────────────────┐              ┌─────────────────────┐   │  │
│  │  │ RealtimeClient  │              │ MessagingService    │   │  │
│  │  │ (Voice)         │              │ (SMS/Email)         │   │  │
│  │  └────────┬────────┘              └──────────┬──────────┘   │  │
│  └───────────┼──────────────────────────────────┼──────────────┘  │
│              │                                   │                  │
│  ┌───────────▼───────────────────────────────────▼──────────────┐  │
│  │                   Domain Layer                                │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │          BookingOrchestrator (Shared)                │   │  │
│  │  │  • check_availability()                              │   │  │
│  │  │  • book_appointment()                                │   │  │
│  │  │  • reschedule_appointment()                          │   │  │
│  │  │  • cancel_appointment()                              │   │  │
│  │  │                                                       │   │  │
│  │  │  Uses: SlotSelectionManager (enforces slot reuse)    │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                  Integration Layer                            │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │  │
│  │  │ Calendar   │  │Analytics │  │ AI Config│  │ Database  │ │  │
│  │  │ Service    │  │ Service  │  │ (OpenAI) │  │ (ORM)     │ │  │
│  │  └─────┬──────┘  └─────┬────┘  └────┬─────┘  └─────┬─────┘ │  │
│  └────────┼───────────────┼────────────┼──────────────┼────────┘  │
└───────────┼───────────────┼────────────┼──────────────┼───────────┘
            │               │            │              │
            ▼               ▼            ▼              ▼
┌───────────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐
│ Google        │  │   OpenAI     │  │ OpenAI   │  │  Supabase   │
│ Calendar API  │  │   GPT-4      │  │ Realtime │  │ PostgreSQL  │
│               │  │ (Sentiment)  │  │   API    │  │             │
└───────────────┘  └──────────────┘  └──────────┘  └─────────────┘
```

### Data Flow

**Voice Call Flow**:
1. Browser connects to `/ws/voice/{session_id}` WebSocket
2. `RealtimeClient` creates conversation record in database
3. Establishes WebSocket to OpenAI Realtime API
4. Audio streams bidirectionally: Browser ↔ FastAPI ↔ OpenAI
5. When AI calls booking functions → `BookingOrchestrator` → `CalendarService` → Google Calendar API
6. On disconnect:
   - Stores transcript and metadata
   - Calls GPT-4 for satisfaction scoring/sentiment
   - Updates conversation with analytics

**SMS/Email Flow**:
1. Incoming message triggers `MessagingService`
2. Creates/retrieves conversation for customer
3. AI generates response using `OpenAI` chat completion
4. If booking intent detected → `BookingOrchestrator` (same as voice)
5. Deterministic tool execution ensures reliable bookings
6. Response sent back via SMS/Email provider

### Booking Architecture (Implemented Nov 2025)

**Unified Booking Layer**: All channels (voice, SMS, email) now use shared `backend/booking/` package:

- **`BookingOrchestrator`** (`backend/booking/orchestrator.py`): Single entry point for all booking operations
  - `check_availability()` - Fetches slots and registers offers
  - `book_appointment()` - Books with slot enforcement
  - `reschedule_appointment()` - Reschedules existing bookings
  - `cancel_appointment()` - Cancels bookings

- **`BookingContext`** (`backend/booking/orchestrator_types.py`): Typed context passed from channels
  - Contains: db session, conversation, customer, channel, calendar service, services dict
  - Enables channel-agnostic business logic

- **`SlotSelectionManager`** (`backend/booking/manager.py`): Enforces deterministic booking flow
  - Records slot offers in conversation metadata
  - Validates booking requests match previously offered slots
  - Prevents double-booking race conditions

- **Channel Adapters**:
  - `RealtimeClient` (voice) → constructs `BookingContext` → calls `BookingOrchestrator`
  - `MessagingService` (SMS/email) → constructs `BookingContext` → calls `BookingOrchestrator`
  - Both channels write identical metadata structures for analytics

- **Time Normalization**: `booking.time_utils` standardizes on Eastern Time across all channels

- **Test Coverage**: 21 passing tests in `backend/tests/booking/`, plus integration tests

**Key Benefits**:
- ✅ Single source of truth for booking logic across all channels
- ✅ Type-safe contracts between layers (no more `Dict[str, Any]` everywhere)
- ✅ Deterministic slot enforcement prevents race conditions
- ✅ Channel-specific UX without forking business rules
- ✅ Comprehensive metrics for monitoring (tool execution + calendar errors)

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Voice AI**: OpenAI Realtime API
- **Calendar**: Google Calendar API (production credentials required)
- **Database**: Supabase Postgres (managed) + SQLite fallback for local tests
- **Frontend**: Next.js 14 (App Router) + TypeScript + Shadcn/ui + TailwindCSS

## Setup Instructions

### Prerequisites

- Python 3.9+
- PostgreSQL (or use Docker)
- OpenAI API key
- Google Cloud project with Calendar API enabled

### 1. Clone and Install Dependencies

```bash
cd ~/Coding/Ava
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
cd ~/Coding/Ava/backend
cp ../.env.example .env
# Edit .env and add your API keys
```

Required environment variables:
- `OPENAI_API_KEY`: Get from https://platform.openai.com/api-keys
- `GOOGLE_CALENDAR_ID`: Your Google Calendar ID
- `DATABASE_URL`: Supabase Postgres connection string (e.g. `postgresql://...supabase.co:5432/postgres`)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Public anon key (for future frontend usage)
- `SUPABASE_SERVICE_ROLE_KEY`: Service key for backend tasks (keep secret)

### 3. Initialize Supabase schema

```bash
python backend/scripts/create_supabase_schema.py
```

Creates tables on Supabase using SQLAlchemy metadata.

### 4. Seed sample dashboard data (optional)

```bash
python backend/scripts/seed_supabase.py --force
```

Populates Supabase with representative customers, call sessions, and daily metrics.

### 5. Set Up Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop app)
5. Download credentials and save as `backend/credentials.json`
6. Generate an OAuth token by running any backend flow once; the app no longer falls back to a mock calendar if credentials are missing.

### 6. Start Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will start at http://localhost:8000

### 7. Start Admin Dashboard (Next.js)

```bash
cd ~/Coding/Ava/admin-dashboard
npm install
npm run dev
```

App will be available at http://localhost:3000 and fetch data from the FastAPI backend via `/api/admin/*` proxy routes.

### 8. Test Voice Interface (Legacy Prototype)

1. Open `frontend/index.html` in your browser
2. Click "Start Call"
3. Allow microphone access
4. Start speaking with the AI receptionist!

## API Endpoints

### Voice
- `WS /ws/voice/{session_id}` - WebSocket for voice communication

### Customers
- `POST /api/customers` - Create customer
- `GET /api/customers/{id}` - Get customer details
- `GET /api/customers/{id}/history` - Get customer history
- `GET /api/admin/customers` - Admin customer list with pagination, search, and basic stats
- `GET /api/admin/customers/{id}` - Admin customer detail (profile plus related appointments and conversations)
- `GET /api/admin/customers/{id}/timeline` - Admin customer interaction timeline (conversations, calls, appointments)

### Admin Analytics
- `GET /api/admin/metrics/overview?period=today|week|month` - Dashboard metrics
- `GET /api/admin/calls` - Call history (paginated)
- `GET /api/admin/calls/{id}` - Call details
- `GET /api/admin/calls/{id}/transcript` - Call transcript
- `GET /api/admin/analytics/daily?days=30` - Daily analytics

### Appointments
- `GET /api/appointments` - List appointments
- `GET /api/admin/appointments/requests` - List pending appointment requests/booking intents for review in the admin dashboard
- `PATCH /api/admin/appointments/requests/{id}` - Update appointment request status, link to an appointment, and attach internal notes

### Booking Config (Admin Dashboard)
- `GET /api/config/services` - Returns service configuration map (name, duration, price_range, description, prep/aftercare) for booking UI
- `GET /api/config/providers` - Returns provider configuration map (name, title, specialties) for booking UI

## Project Structure

```
Ava/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── database.py             # Database models
│   ├── config.py               # Configuration & settings
│   ├── realtime_client.py      # OpenAI Realtime API client
│   ├── calendar_service.py     # Google Calendar integration (no mock fallback)
│   ├── analytics.py            # Call tracking & analytics
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Environment variables (create from .env.example)
│
├── frontend/
│   ├── index.html              # Voice test interface (legacy)
│   └── app.js                  # WebSocket client
│
├── admin-dashboard/
│   ├── src/app/page.tsx        # Dashboard overview (metrics + call log)
│   ├── src/app/api/            # Next.js API proxy routes → FastAPI
│   └── src/components/         # Shadcn-based UI components
│
├── docker-compose.yml          # Docker services
├── .env.example                # Environment template
└── README.md                   # This file
```

### Supabase utilities
- `backend/scripts/create_supabase_schema.py` — idempotent table creation on Supabase
- `backend/scripts/migrate_sqlite_to_supabase.py` — optional legacy data import
- `backend/scripts/seed_supabase.py` — sample analytics seeding for demos

## Configuration

### Services

Edit services in `backend/config.py` under the `SERVICES` dictionary. Each service includes:
- Name, duration, price range
- Description
- Preparation instructions
- Aftercare instructions

### Providers

Edit providers in `backend/config.py` under the `PROVIDERS` dictionary with:
- Name, title, credentials
- Specialties

### Med Spa Info

Update your med spa information in `.env`:
- MED_SPA_NAME
- MED_SPA_PHONE
- MED_SPA_ADDRESS
- MED_SPA_HOURS

### Assistant identifies as ChatGPT
- Ensure the backend is restarted after updating `.env` or `config.py`
- Confirm the `SYSTEM_PROMPT` in `backend/config.py` still contains the Ava persona instructions
- Verify `AI_ASSISTANT_NAME` and med spa details are set in `.env`
- Clear browser tab and reconnect to refresh the realtime session

## Database Schema

### Current Schema (Phase 1)
- **customers**: Customer information
- **appointments**: Appointment bookings
- **call_sessions**: Voice call tracking (being migrated to conversations schema)
- **call_events**: Events within calls (being migrated to communication_events)
- **daily_metrics**: Aggregated analytics

### New Omnichannel Schema (Phase 2 - ✅ COMPLETED Nov 10, 2025)
**See OMNICHANNEL_MIGRATION.md, IMPLEMENTATION_COMPLETE.md, and MIGRATION_SUCCESS.md for full details**

- **conversations**: Top-level container for any communication (voice/SMS/email)
  - Includes satisfaction score, sentiment, outcome, AI summary
  - UUID primary keys for distributed systems
- **communication_messages**: Individual messages within conversations
  - 1 message for voice calls (entire call)
  - N messages for SMS/email threads
- **voice_call_details**: Voice-specific metadata (recording URL, transcript segments, function calls)
- **email_details**: Email-specific metadata (subject, attachments, delivery tracking)
- **sms_details**: SMS-specific metadata (Twilio SID, delivery status, segments)
- **communication_events**: Generalized event tracking across all channels

**Migration Status**: ✅ Complete (Nov 10, 2025)
- 77 historical call sessions migrated successfully
- Dual-write enabled (voice calls write to both schemas)
- Admin dashboard updated to use conversations API
- 100% backward compatible

## Testing

### Golden Scenario Regression Layer (Nov 26, 2025)

In addition to the main unit/integration suites, there is a thin
"golden scenario" layer to lock in high-value behavioral invariants for
the AI assistant:

- **Data fixture:** `backend/tests/fixtures/golden_scenarios.json`
  - ~30 curated conversation sketches across information, booking,
    appointment management, operational/account, sales, post-appointment,
    and admin intents.
  - Each scenario includes high-level `success_criteria` flags (for
    example, `no_preemptive_check`, `no_post_booking_recheck`,
    `escalation_offered`).
- **Tests:** `backend/tests/test_golden_scenarios.py`
  - Currently enforces that vague long-range relative dates ("next week",
    "in 3 weeks", "in a few months") **do not** trigger preemptive
    availability enforcement, and that once an appointment is recorded as
    scheduled, neutral acknowledgements like "ok" **do not** cause
    another forced availability check.
  - This is the right place to add future behavior-focused regression
    tests (e.g. Liam 3 PM bug, indecisive service choice, multi-
    appointment reschedule disambiguation) as the system evolves.

### Test Voice Conversation
1. Open `frontend/index.html` in browser
2. Start a call
3. Try these scenarios:
   - "I'd like to book a Botox appointment"
   - "What services do you offer?"
   - "What are your hours?"
   - "Tell me about Dr. Smith"
   - "Who are you?" → Assistant should respond as Ava, the med spa receptionist

### Test API Endpoints
```bash
# Health check
curl http://localhost:8000/health

# Get metrics
curl http://localhost:8000/api/admin/metrics/overview?period=today

# Get conversations (omnichannel - NEW)
curl "http://localhost:8000/api/admin/communications?page=1&page_size=20"

# Get conversation detail by ID
curl "http://localhost:8000/api/admin/communications/{conversation_id}"

# Filter by channel
curl "http://localhost:8000/api/admin/communications?channel=voice"

# Legacy call history (still works during migration)
curl http://localhost:8000/api/admin/calls
```

## Analytics Features

### Call Tracking
- Full transcript logging
- Duration tracking
- Function call monitoring
- Customer identification

### Satisfaction Scoring
- AI-powered sentiment analysis using GPT-4
- 0-10 satisfaction score
- Sentiment classification (positive/neutral/negative/mixed)
- Frustration indicators
- Success markers

### Metrics
- Total calls
- Talk time
- Appointments booked
- Conversion rate
- Average satisfaction score
- Escalation rate

## Development Roadmap

### Phase 1 ✅ (Completed - Nov 2025)
- Core voice functionality with smart commit strategy
- Real-time interruption handling
- Appointment scheduling with Google Calendar
- Call analytics with AI satisfaction scoring
- Next.js admin dashboard with Supabase integration
- API endpoints and proxy routes

### Phase 2 ✅ (Completed - Nov 2025)
**Omnichannel Communications Migration**
- ✅ Implement new conversations schema (voice/SMS/email)
- ✅ Multi-message threading support for SMS and email
- ✅ Migrate call_sessions data to conversations (77 calls migrated)
- ✅ Cross-channel AI satisfaction scoring
- ✅ Unified customer timeline in dashboard
- ✅ Messaging console for testing (SMS/email simulation)
- ✅ Enhanced dashboard with channel filtering

### Phase 2.5 ✅ (Completed - Nov 18, 2025)
**Deterministic Booking Flow**
- ✅ Preemptive availability checking
- ✅ Automatic booking execution when ready
- ✅ Tool call history persistence
- ✅ 100% reliable bookings (no AI hesitation)

### Phase 2.6 ✅ (Completed - Nov 18, 2025)
**Dashboard Enhancements**
- ✅ Analytics visualizations (4 chart components)
- ✅ Customer management (full CRUD)
- ✅ Real-time call status monitoring
- ✅ Silero VAD infrastructure (ready for integration)

### Phase 3 ✅ (Completed - Nov 21, 2025)
**Production Deployment**
- ✅ Marketing site deployed (https://getevaai.com)
- ✅ Admin dashboard deployed (https://dashboard.getevaai.com)
- ✅ Backend API deployed (https://api.getevaai.com)
- ✅ Google Calendar credentials configured
- ✅ WebSocket support enabled
- ✅ CORS configuration secured

### Phase 4 - Auth & Messaging (In Progress - Nov 22, 2025)
- ✅ Supabase Auth for admin dashboard (email/password login, Supabase session cookies)
- ✅ Baseline Row Level Security (RLS) policies for Supabase auth/profiles (fine-grained policies TBD)
- Twilio SMS production integration
- SendGrid email integration
- Boulevard scheduling integration
- Advanced analytics visualizations and BI
- Enhanced customer insights
- Multi-language support

### Phase 5 (Future)
- Voice biometrics for customer identification
- Proactive appointment reminders
- Package recommendations
- Video consultation support
- WhatsApp integration

## Troubleshooting

### WebSocket Connection Fails
- Ensure backend is running on port 8000
- Check firewall settings
- Verify CORS configuration

### No Audio Output
- Check browser microphone permissions
- Ensure audio context is initialized
- Verify OpenAI API key is valid

### Google Calendar Auth Issues
- Ensure credentials.json is in backend folder
- Delete token.json and re-authenticate
- Check Calendar API is enabled in Google Cloud

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists

## Security Notes

### Current (Development)
- HTTPS recommended for production
- Environment variables for secrets
- Input validation on all endpoints

### Required for HIPAA (Phase 2+)
- Database encryption at rest
- Audit logging
- BAA agreements with vendors
- Consent recording
- PHI access controls

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved

## Support

For technical support or questions:
- Email: support@example.com
- Docs: [Internal Wiki]

---

**Note**: This is Phase 1. The admin dashboard UI and advanced features are coming in Phase 2.
