# Med Spa Voice AI Assistant

An intelligent voice AI application that serves as a virtual receptionist for medical spas. The app handles appointment scheduling, answers common customer inquiries, and tracks conversation quality with analytics.

## Features

### Phase 1 (Current - Production Ready)
- ✅ Voice-to-voice conversation using OpenAI Realtime API
- ✅ Smart commit strategy with client-side VAD (dual-speed: 300ms/120ms)
- ✅ Real-time interruption handling with immediate audio cutoff
- ✅ Appointment scheduling with Google Calendar integration
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

### Phase 3 (Coming Soon)
- Boulevard scheduling integration
- Advanced customer insights
- Multi-language support

## Architecture

```
Admin Dashboard (Next.js) → Next.js API Proxy → FastAPI Backend ↔ OpenAI Realtime API
                                                   ↓
                                          Google Calendar
                                                   ↓
                                            Supabase Postgres
```

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Voice AI**: OpenAI Realtime API
- **Calendar**: Google Calendar API
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

### Admin Analytics
- `GET /api/admin/metrics/overview?period=today|week|month` - Dashboard metrics
- `GET /api/admin/calls` - Call history (paginated)
- `GET /api/admin/calls/{id}` - Call details
- `GET /api/admin/calls/{id}/transcript` - Call transcript
- `GET /api/admin/analytics/daily?days=30` - Daily analytics

### Appointments
- `GET /api/appointments` - List appointments

## Project Structure

```
Ava/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── database.py             # Database models
│   ├── config.py               # Configuration & settings
│   ├── realtime_client.py      # OpenAI Realtime API client
│   ├── calendar_service.py     # Google Calendar integration
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

### Phase 2 🚧 (In Progress - Nov-Dec 2025)
**Omnichannel Communications Migration**
- Implement new conversations schema (voice/SMS/email)
- Multi-message threading support for SMS and email
- Migrate call_sessions data to conversations
- Cross-channel AI satisfaction scoring
- Unified customer timeline in dashboard
- Twilio SMS integration with two-way messaging
- SendGrid email integration
- Enhanced dashboard with channel filtering

See `OMNICHANNEL_MIGRATION.md` and `TODO.md` for detailed timeline.

### Phase 3 (Coming Q1 2026)
- Boulevard scheduling integration
- Advanced analytics visualizations and BI
- Enhanced customer insights
- Multi-language support

### Phase 4 (Future)
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
