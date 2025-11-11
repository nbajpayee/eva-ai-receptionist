# Med Spa Voice AI - Project Tracker

**Last Updated:** November 10, 2025
**Current Phase:** Phase 1B - Omnichannel Communications Migration

---

## 📋 Project Overview

Building an AI-powered voice receptionist for medical spas with appointment scheduling, customer interaction tracking, and analytics dashboard.

### Tech Stack (Updated)
- **Frontend:** Next.js 14 + TypeScript + Shadcn/ui + TailwindCSS
- **Backend:** FastAPI (Python) + Next.js API routes
- **Database:** Supabase (PostgreSQL with real-time features)
- **Voice AI:** OpenAI Realtime API
- **Calendar:** Google Calendar API (→ Boulevard later)
- **SMS:** Twilio
- **Hosting:** TBD (Vercel for Next.js, Railway/Render for FastAPI)

---

## ✅ COMPLETED

### Initial Planning & Architecture
- [x] Created comprehensive project specification (voice-ai-plan.md)
- [x] Defined system architecture
- [x] Selected initial tech stack
- [x] Created project structure
- [x] **ARCHITECTURE CHANGE:** Decided to use Next.js + Shadcn + Supabase (Nov 7)

### Phase 1A - Backend Core (Python/FastAPI)
- [x] Created FastAPI application structure (main.py)
- [x] Built database models with SQLAlchemy (database.py)
  - Customer model
  - Appointment model
  - CallSession model with analytics
  - CallEvent model
  - DailyMetric model
- [x] Implemented Google Calendar integration (calendar_service.py)
  - Availability checking
  - Appointment booking
  - Cancellation/rescheduling
- [x] Built OpenAI Realtime API client (realtime_client.py)
  - WebSocket connection management
  - Function calling for appointments
  - Audio streaming
  - Conversation handling
- [x] Created analytics service (analytics.py)
  - Call session tracking
  - AI-powered satisfaction scoring with GPT-4
  - Sentiment analysis
  - Daily metrics aggregation
  - Dashboard API endpoints
- [x] Configured services & prompts (config.py)
  - 9 med spa services with pricing/details
  - 3 provider profiles
  - AI personality & conversation prompts
- [x] Enforced Ava receptionist persona + scripted greeting in realtime client (Nov 7)
- [x] Set up Docker Compose for PostgreSQL
- [x] Created environment configuration (.env.example)
- [x] Wrote comprehensive documentation (README.md)

### Phase 1A - Frontend Prototype
- [x] Built vanilla HTML/JS voice test interface
  - WebSocket client
  - Audio capture and playback
  - Real-time transcript display
  - Connection status indicators

### DevOps & Documentation
- [x] Created .gitignore
- [x] Documented all API endpoints
- [x] Setup instructions in README
- [x] Created TODO tracking system (this file)
- [x] Created CLAUDE.md for future AI development sessions (Nov 8)
- [x] Created TESTING_VOICE_CALLS.md troubleshooting guide (Nov 8)

### Voice Call Transcript & Quality Fixes (Nov 8, 2025)

#### Round 1: Initial Fixes
- [x] **Fixed transcript logging issue** - Transcripts now properly captured in Supabase
  - Added missing "commit" message handler in backend/main.py
  - Backend now commits audio buffer when frontend requests it
  - Fixed timedelta import in realtime_client.py
- [x] **Optimized VAD (Voice Activity Detection)** - Better interruption vs background noise handling
  - Increased threshold from 0.35 to 0.5 (less sensitive to background noise)
  - Increased prefix_padding_ms from 200 to 300 (better speech capture)
  - Increased silence_duration_ms from 400 to 500 (more natural pauses)
- [x] **Enhanced transcript logging & debugging**
  - Added debug prints for user speech deltas/completions
  - Added debug prints for assistant speech deltas/completions
  - Better handling of empty/null transcripts
  - Console now shows transcript preview at call end
- [x] **Verified Ava persona enforcement**
  - Confirmed SYSTEM_PROMPT properly enforces identity
  - Confirmed greeting sent at session start
  - Confirmed identity_instructions sent with each response

#### Round 2: User Speech Capture Fix (Nov 8 PM)
- [x] **Fixed transcription model** - Changed from incorrect model to proper Whisper
  - Changed from `gpt-4o-mini-transcribe` to `whisper-1`
  - This is the correct model for OpenAI Realtime API transcription
- [x] **Further optimized VAD for background noise**
  - Increased threshold from 0.5 to 0.6 (even less sensitive)
  - Increased silence_duration_ms from 500 to 600ms
  - Added `create_response: True` for auto-response generation
- [x] **Comprehensive event logging for debugging**
  - All non-audio events now logged with full data
  - Transcription events show complete event structure
  - Conversation item processing shows role, speaker, and extracted text
  - Text extraction shows exactly what's being captured from each content type
  - Finalization shows whether text is captured or empty
- [x] **Enhanced user speech capture with multiple pathways**
  - Added handler for `conversation.item.input_audio_transcription.delta`
  - Improved `conversation.item.input_audio_transcription.completed` handler
  - Enhanced text extraction to handle multiple content types
  - Better handling of audio transcripts in conversation items
- [x] **Created diagnostic documentation**
  - QUICK_FIX_SUMMARY.md with testing checklist
  - Updated TESTING_VOICE_CALLS.md with debugging guide
  - Clear patterns to identify why user speech might not be captured

#### Round 3: Critical Configuration Fixes (Nov 8 PM)
- [x] **Identified root causes from user logs**
  - Found 3 configuration errors preventing transcription
  - Invalid voice "nova" causing API errors
  - Missing "type" field in conversation items
  - Transcript field always returning null
- [x] **Fixed invalid voice parameter**
  - Changed from "nova" to "alloy" (valid voice)
  - Eliminates invalid_value error on session creation
- [x] **Fixed missing conversation item types**
  - Added `"type": "message"` to system message
  - Added `"type": "message"` to greeting message
  - Eliminates missing_required_parameter errors
- [x] **Attempted transcription fix (didn't work)**
  - Tried empty object for auto-selection: `"input_audio_transcription": {}`
  - OpenAI requires explicit model parameter
- [x] **Added session configuration logging**
  - Session.updated event now logged
  - Shows whether transcription is enabled
  - Displays voice and VAD configuration
- [x] **Created critical fixes documentation**
  - CRITICAL_FIXES_ROUND3.md with detailed explanation
  - Shows exactly what errors were found in logs
  - Explains what to look for after fixes

#### Round 4: Final Configuration Fixes (Nov 8 PM - FINAL)
- [x] **Analyzed second set of user logs**
  - Found 2 more errors after Round 3 fixes
  - Empty transcription object not accepted
  - Wrong content type for message items
- [x] **Fixed transcription model requirement**
  - Re-added explicit model: `"model": "whisper-1"`
  - OpenAI API requires this parameter (can't be empty)
- [x] **Fixed content type errors**
  - Changed `"input_text"` to `"text"` in system message
  - Changed `"input_text"` to `"text"` in greeting message
  - API requires `"text"` for message content
- [x] **Improved text extraction**
  - Unified handling of all text variants
  - Now handles: "text", "input_text", "output_text"
  - More robust extraction from conversation items
- [x] **Updated documentation**
  - Added Round 4 section to CRITICAL_FIXES_ROUND3.md
  - Documented exact error messages and fixes
  - Provided clear testing checklist

#### Round 5: Architectural Fix - Removed Manual Commit Workflow (Nov 8 PM - CRITICAL)
- [x] **Identified root cause of transcription failure**
  - Manual commit workflow was interfering with OpenAI's server-side VAD
  - Frontend was sending manual "commit" messages that were being ignored
  - Backend had `commit=False` hardcoded, preventing commits entirely
- [x] **Removed manual commit workflow from frontend**
  - Removed `commitTimeout` and `COMMIT_DELAY_MS` variables from app.js
  - Removed `scheduleCommit()` function
  - Removed `sendCommit()` function
  - Removed all calls to commit functions
  - Frontend now only streams audio continuously
- [x] **Verified server-side VAD configuration**
  - Confirmed `"type": "server_vad"` enabled in realtime_client.py
  - Confirmed `"create_response": True` for automatic response generation
  - With these settings, OpenAI auto-commits on silence detection
  - No manual commits needed or wanted
- [x] **Architectural decision documented**
  - OpenAI's Realtime API with server VAD handles turn-taking automatically
  - Manual commits interfere with this process
  - Simpler, more reliable system by trusting OpenAI's VAD

#### Round 6: GPT-5 Smart Commit Strategy + Interruption Handling (Nov 9 - PRODUCTION READY)
- [x] **Re-introduced smart commit strategy with client-side VAD**
  - Server-side VAD with auto-commit alone was too slow for natural conversation
  - Implemented GPT-5's dual-speed commit strategy:
    - **Normal commits (300ms)**: Scheduled after each audio chunk streamed
    - **Fast commits (120ms)**: Triggered when client VAD detects user stopped speaking
  - Client-side VAD using RMS (Root Mean Square) calculation with threshold 0.005
  - Backend commit handler re-added to process client commit requests
- [x] **Fixed greeting not playing issue**
  - Changed from `conversation.item.create` to `response.create` method
  - `response.create` is correct way to trigger proactive assistant speech
  - Removed manual `_request_response()` call which caused hallucination
- [x] **Fixed assistant talking to itself**
  - Removed duplicate system message in conversation items
  - System instructions already in session config, no need to send twice
- [x] **Fixed frontend audio processing**
  - Audio processor wasn't connected to destination, so `onaudioprocess` never fired
  - Added silent gain node (value=0) to prevent feedback while keeping processing active
  - Signal chain: `microphone → processor → silentGain → destination`
- [x] **Implemented full interruption handling**
  - **Client-side tracking**: Added `activeAudioSources` array to track all playing audio
  - **Immediate audio stop**: Created `stopAllAudio()` function to stop playback instantly
  - **Interruption detection**: When user speaks during assistant audio:
    1. Client VAD detects user speech
    2. Checks if assistant is currently speaking
    3. Calls `stopAllAudio()` to halt all playback
    4. Sends interrupt message to backend
    5. Backend calls OpenAI `response.cancel`
  - **Graceful error handling**: Backend now differentiates expected errors:
    - `response_cancel_not_active`: User interrupted after response finished (expected)
    - `input_audio_buffer_commit_empty`: Commit with no audio (expected)
    - Other errors: Logged as unexpected issues
- [x] **Production-ready features verified**
  - ✅ Both customer and assistant speech captured in transcripts
  - ✅ Real-time interruption working (audio stops immediately)
  - ✅ Function calling working (search customer, check availability, book appointment)
  - ✅ Database integration with Supabase
  - ✅ Analytics and sentiment analysis
  - ✅ End-to-end appointment booking flow tested successfully
- [x] **Created comprehensive testing documentation**
  - TESTING_SMART_COMMITS.md with full testing guide
  - Documents both vanilla and Next.js frontend approaches
  - Provides troubleshooting steps for VAD tuning
  - Shows expected log patterns for verification

---

## 🚧 IN PROGRESS

### Phase 1B - Omnichannel Communications Migration (Nov 10, 2025)
**See OMNICHANNEL_MIGRATION.md for detailed architecture and migration plan**

- [ ] **Week 1: Schema & Models**
  - [x] Create OMNICHANNEL_MIGRATION.md with full design
  - [ ] Add SQLAlchemy models to backend/database.py (Conversation, CommunicationMessage, VoiceCallDetails, EmailDetails, SMSDetails, CommunicationEvent)
  - [ ] Create backend/scripts/create_omnichannel_schema.py
  - [ ] Test schema creation on Supabase staging
  - [ ] Verify indexes and constraints

- [ ] **Week 1-2: Data Migration**
  - [ ] Create backend/scripts/migrate_call_sessions_to_conversations.py
  - [ ] Test migration on subset of data
  - [ ] Run full migration on staging
  - [ ] Validate data integrity (counts, relationships)

- [ ] **Week 2: Analytics Update**
  - [ ] Update backend/analytics.py with conversation methods (create_conversation, add_message, score_conversation_satisfaction)
  - [ ] Implement dual-write for voice calls (write to both call_sessions and conversations)
  - [ ] Test satisfaction scoring on conversations
  - [ ] Update daily metrics aggregation for multi-channel

- [ ] **Week 2-3: Voice Integration**
  - [ ] Update WebSocket handler in backend/main.py to use conversations schema
  - [ ] Test voice calls create conversations correctly
  - [ ] Verify transcript storage and voice details
  - [ ] Test event tracking

- [ ] **Week 3: Dashboard API**
  - [ ] Create /api/admin/communications endpoints (GET list, GET detail)
  - [ ] Update Next.js proxy routes in admin-dashboard/src/app/api/
  - [ ] Test filtering and pagination
  - [ ] Update frontend components to use new API

- [ ] **Week 4: SMS/Email Foundations**
  - [ ] Implement Twilio webhook handler (/api/webhooks/twilio/sms)
  - [ ] Implement SendGrid webhook handler (/api/webhooks/sendgrid/email)
  - [ ] Create SMS/email response generation logic (AI-powered)
  - [ ] Test end-to-end SMS/email flow

- [ ] **Week 5: Cutover & Cleanup**
  - [ ] Switch all reads to conversations schema
  - [ ] Stop dual-writes
  - [ ] Monitor for issues (1 week)
  - [ ] Archive/drop call_sessions table (after 30 days)

### Phase 1A - Voice Interface Finalization
- [x] **Applied vanilla frontend logic to Next.js** (Nov 9, 2025)
  - [x] Smart commit strategy with dual-speed (300ms/120ms) already implemented
  - [x] Add interruption handling (activeAudioSources tracking)
  - [x] Add interrupt message sending to backend
  - [x] Update audio playback to track assistant speaking state
  - [x] Add silent gain node to prevent feedback
  - [x] Update cleanup function
  - [ ] Test end-to-end with Next.js interruptions

### Phase 1A-R (Refactor) - Migration to Next.js + Supabase
- [x] **Set up Next.js 14 project with TypeScript**
  - [x] Initialize Next.js with App Router
  - [x] Configure TailwindCSS
  - [x] Install and configure Shadcn/ui
  - [x] Set up project structure

- [ ] **Migrate to Supabase**
  - [x] Create Supabase project + connection strings
  - [x] Migrate database schema to Supabase (SQLAlchemy helper)
  - [ ] *(Deferred post-MVP)* Set up Supabase authentication
  - [ ] *(Deferred post-MVP)* Configure Row Level Security (RLS) policies
  - [x] Update backend to use Supabase Postgres
  - [ ] Test real-time subscriptions
  - [x] Seed sample dashboard data (scripts/seed_supabase.py)

- [ ] **Build Next.js Frontend**
  - [x] Create voice call interface with Shadcn components
  - [x] Build admin dashboard layout
  - [x] Implement dashboard overview page
  - [x] Create call history table wired to live API
  - [ ] Add analytics visualizations (charts)
  - [ ] Build customer management interface

- [ ] **Backend Integration**
  - [x] Keep FastAPI for voice/calendar logic (decision made)
  - [x] Proxy FastAPI dashboard metrics & call history through Next.js API routes
  - [x] Update API endpoints to run against Supabase database
  - [ ] *(Deferred post-MVP)* Implement authentication flow
  - [ ] Add temporary authentication/session guard for voice console access

---

## 📅 UP NEXT

### Phase 1B - Core Features Completion
- [ ] **SMS Confirmations (Twilio)**
  - [ ] Integrate Twilio SDK
  - [ ] Send appointment confirmations
  - [ ] Send appointment reminders (24h before)
  - [ ] Handle SMS replies (optional)

- [ ] **Enhanced Voice Features**
  - [x] Improve interruption handling (Nov 9, 2025)
  - [x] Add voice activity detection tuning (Nov 9, 2025)
  - [ ] **Upgrade to Silero VAD** (Planned for Phase 1B)
    - [ ] Install @ricky0123/vad-web package
    - [ ] Integrate Silero VAD with existing audio pipeline
    - [ ] Keep RMS as pre-filter for efficiency
    - [ ] Test accuracy improvement vs current RMS-based VAD
    - [ ] Add adaptive threshold learning
    - [ ] Benchmark: Target 95%+ accuracy vs 70-80% current
  - [ ] Implement call transfer to human
  - [ ] Add hold music/messages
  - [x] Surface connection diagnostics (retries, latency)
  - [x] Add live session timer, indicators, and retry controls

- [ ] **Customer Management**
  - [ ] Customer creation from calls
  - [ ] Update customer profiles
  - [ ] Medical history screening questions
  - [ ] Allergy/contraindication tracking

### Phase 1B - Admin Dashboard Enhancements (Next)
- [ ] Build shadcn-powered sidebar navigation for Dashboard, Appointments, Voice, Reports
- [ ] **Messaging Tab & Omnichannel Comms**
  - [ ] Add "Messaging" navigation tab and `/messaging` page using shadcn layout components
  - [ ] Implement chat interface with message history, assistant responses, and channel metadata
  - [ ] Provide channel toggle (Email vs. Mobile text) to simulate source; store selection with each message
  - [ ] Create `/api/admin/messaging` route to forward messages to assistant and persist conversations
  - [ ] Update dashboard KPIs/analytics to surface communication source mix (voice, text, email)
  - [ ] Refactor call detail view to become a unified communication drawer showing voice, SMS, and email threads
- [ ] Build end-to-end voice console page in Next.js
  - [ ] Overview/metrics page
  - [x] Call history with filters
  - [x] Call detail view with transcript (Nov 9, 2025)
    - [x] Created API proxy route for call details
    - [x] Built full call detail page with transcript viewer
    - [x] Added metadata cards (call info, status, customer)
    - [x] Implemented timeline component
    - [x] Refactored with shadcn Card, Badge, Button components
  - [ ] Customer list and profiles
  - [x] Appointment calendar view (Nov 9, 2025)
    - [x] Created API proxy route for appointments
    - [x] Built custom month-view calendar using shadcn components
    - [x] Implemented date selection and appointment filtering
    - [x] Added appointment detail sidebar
    - [x] Color-coded status badges
    - [x] Navigation integration
  - [ ] Analytics & reports page

- [ ] **Dashboard Features**
  - [ ] Real-time call status indicator
  - [ ] Audio playback for call recordings
  - [ ] Export reports (CSV/PDF)
  - [ ] Date range filters
  - [ ] Search functionality
  - [ ] Sorting and pagination

- [ ] **Data Visualizations**
  - [ ] Call volume charts (line/bar)
  - [ ] Conversion funnel
  - [ ] Satisfaction score trends
  - [ ] Peak hours heatmap
  - [ ] Service popularity pie chart

---

## 🔮 FUTURE PHASES

### Phase 2 - Boulevard Integration
- [ ] Set up Boulevard sandbox account
- [ ] Implement Boulevard API client
- [ ] Migrate from Google Calendar to Boulevard
- [ ] Support multi-location scheduling
- [ ] Handle service packages
- [ ] Process appointment deposits

### Phase 3 - Advanced Features
- [ ] Multi-language support (Spanish, Mandarin)
- [ ] Voice biometrics for customer identification
- [ ] Proactive appointment reminders via voice
- [ ] Package recommendations based on goals
- [ ] SMS two-way conversation support
- [ ] Video consultation scheduling

### Phase 4 - Enterprise Features
- [ ] Multi-tenant support (multiple med spas)
- [ ] White-label options
- [ ] Advanced reporting & BI
- [ ] Integration marketplace
- [ ] Mobile app (React Native)
- [ ] HIPAA compliance certification

---

## 🐛 KNOWN ISSUES

### ✅ FIXED (Nov 8, 2025)

#### Round 1-2:
- **Transcript logging not working** - Fixed audio buffer commit handling in main.py
- **VAD too sensitive to background noise** - Optimized threshold and timing settings
- **Missing timedelta import** - Fixed import in realtime_client.py
- **Audio buffer not being committed** - Added "commit" message handler in backend

#### Round 3 (CRITICAL FIXES):
- **Invalid voice "nova"** - Changed to "alloy" (valid voice for Realtime API)
- **Missing item.type parameter** - Added `"type": "message"` to conversation items
- **Transcription configuration attempt** - Tried empty object (didn't work)
- **User speech never captured** - Errors were preventing transcription from working

#### Round 4 (FINAL FIXES):
- **Empty transcription object invalid** - OpenAI requires explicit model parameter
- **Re-added transcription model** - Set to `"model": "whisper-1"` (required)
- **Wrong content type "input_text"** - Changed to `"text"` for all message content
- **Fixed system message** - Content type `"input_text"` → `"text"`
- **Fixed greeting message** - Content type `"input_text"` → `"text"`
- **Unified text extraction** - Handles all text type variants (text, input_text, output_text)

#### Round 5 (ARCHITECTURAL FIX):
- **Manual commit workflow interfering with server VAD** - Removed all manual commit handling
- **Frontend sending ignored commit messages** - Removed commit functions from app.js
- **Backend commit parameter always False** - No longer needed, server VAD handles it
- **Transcription not captured in database** - Root cause was manual commits preventing auto-commit

### Active Issues
- None currently reported - Voice interface is production-ready with Round 6 smart commit + interruption handling
- Next.js frontend needs interruption logic update to match vanilla frontend

---

## 💡 FEATURE REQUESTS / IDEAS

### High Priority
- [ ] Add "Are you sure?" confirmation before booking
- [ ] Implement waitlist when slots are full
- [ ] Add cancellation fee handling
- [ ] Support group appointments

### Medium Priority
- [ ] Email confirmations (in addition to SMS)
- [ ] Customer portal for self-service
- [ ] Staff scheduling integration
- [ ] Inventory tracking for products

### Low Priority / Nice-to-Have
- [ ] Social media integration
- [ ] Review collection automation
- [ ] Loyalty program tracking
- [ ] Gift card purchases

---

## 🔄 TECHNICAL DEBT

- [ ] Add comprehensive error handling throughout
- [ ] Implement request rate limiting
- [ ] Add input validation middleware
- [ ] Create automated tests (unit + integration)
- [ ] Set up CI/CD pipeline
- [ ] Add logging and monitoring (Sentry?)
- [ ] Optimize database queries with indexes
- [ ] Add caching layer (Redis?)

---

## 📝 ARCHITECTURE DECISIONS

### November 7, 2025
**Decision:** Migrate to Next.js + Shadcn + Supabase

**Rationale:**
- Next.js provides better developer experience and SEO
- Shadcn/ui gives beautiful, accessible components out of the box
- Supabase offers real-time features, auth, and edge functions
- Easier deployment with Vercel
- Better integration between frontend and backend

**Impact:**
- Need to refactor database layer to use Supabase client
- Frontend prototype needs complete rebuild
- Opportunity to use Next.js API routes instead of separate FastAPI (decision pending)
- Can leverage Supabase real-time for live dashboard updates

**Open Questions:**
1. Keep FastAPI for complex voice/calendar logic or migrate to Next.js API routes?
2. Use Supabase Auth or custom auth with FastAPI?
3. Host voice WebSocket on FastAPI or create separate microservice?

### November 7, 2025 (Update)
**Decision:** Lock down realtime assistant identity to Ava with explicit system instructions and greeting

**Rationale:**
- Prevents the model from reverting to generic "I'm ChatGPT" responses
- Ensures every caller hears the same branded greeting
- Simplifies troubleshooting by centralizing persona settings in config/env

**Impact:**
- Added `identity_instructions` handling in `realtime_client.py`
- Updated `SYSTEM_PROMPT` with stronger identity requirements
- README now documents how to adjust the persona and validate behavior
- Introduced next-step initiatives for Sprint 1 groundwork, voice polish, stability, and Phase 1B prep
- Patched SQLite engine settings (`check_same_thread=False`) so FastAPI analytics endpoints run under Uvicorn reload without threading errors

### November 9, 2025 - Voice Interface Architecture (Round 6)
**Decision:** Hybrid approach - Client-side VAD + Server-side VAD with smart commits

**Rationale:**
- Server-side VAD alone (Round 5) was too slow for natural conversation
- Client-side VAD provides instant feedback and fast commits (120ms)
- Dual-speed commit strategy optimizes for responsiveness without sacrificing accuracy
- Client-side interruption detection provides immediate audio cutoff for natural conversation flow

**Implementation:**
- Client calculates RMS to detect speech start/stop
- Fast commits (120ms) when VAD detects silence
- Normal commits (300ms) scheduled after each audio chunk (fallback)
- Backend handles commit requests and differentiates expected vs unexpected errors
- Client tracks all playing audio sources for instant interruption

**Impact:**
- Vanilla frontend is production-ready with this approach
- Need to apply same logic to Next.js frontend for consistency
- This is the optimal balance between simplicity and performance
- Future improvements can focus on VAD threshold tuning per environment

### November 10, 2025 - Omnichannel Communications Architecture
**Decision:** Hybrid schema - conversations parent table + channel-specific detail tables

**Rationale:**
- Expanding to support SMS and email communications with multi-message threading
- Need unified customer timeline across all channels (voice, SMS, email)
- Want to apply AI satisfaction scoring to all channels, not just voice
- GPT-5 recommended conversations abstraction for threading support

**Implementation:**
- `conversations`: Top-level container (customer, channel, status, satisfaction, outcome)
- `communication_messages`: Individual messages within conversations (1 for voice, N for SMS/email)
- `voice_call_details`, `email_details`, `sms_details`: Channel-specific payloads
- `communication_events`: Generalized event tracking (replaces call_events)
- Migration strategy: Create new schema → backfill → dual-write → cutover → cleanup

**Impact:**
- Clean separation of concerns (shared metadata vs channel-specific data)
- Easy to add new channels (WhatsApp, chat, etc.)
- Dashboard can show unified timeline per customer
- Analytics can aggregate across all channels
- 5-week migration timeline with backward compatibility

### Next Steps Roadmap (Nov 7)
**Voice polish:**
- [x] ~~Evaluate alternative Realtime voices~~ (Using 'alloy' - works well)
- [ ] Add frontend control to restart session/greeting without full page refresh

**Stability & Observability:**
- [x] ~~Suppress routine error logs~~ (Now differentiating expected vs unexpected errors)
- [ ] Move persona config to `.env` and add reload helper script
- [ ] Add automated regression script for Supabase data seeding/migrations

**Phase 1B Prep:**
- [ ] Outline Twilio SMS confirmation flow (plan, endpoints, messaging)
- [ ] Draft Next.js dashboard wireframes (overview + call detail views)
- [ ] Define Supabase RLS policies + auth strategy for dashboard access

---

## 🎯 CURRENT SPRINT GOALS

### Sprint 1 (Nov 7-14) - COMPLETED
- [x] Set up Next.js 14 project with Shadcn/Tailwind
- [x] Create Supabase project and migrate schema to managed Postgres
- [x] Build dashboard overview with live metrics & call log data
- [x] Seed Supabase with representative analytics sample data
- [x] Implement voice interface in Next.js (proxy to FastAPI)
- [x] Connect Next.js/Supabase stack to FastAPI for remaining services

### Sprint 2 (Nov 10-17) - Omnichannel Migration Phase 1
**Goal:** Design and implement omnichannel schema for voice/SMS/email

- [x] Create OMNICHANNEL_MIGRATION.md with full architecture
- [ ] Add SQLAlchemy models for conversations schema
- [ ] Create Supabase schema creation script
- [ ] Test schema on staging environment
- [ ] Create migration script for call_sessions backfill
- [ ] Update analytics.py with conversation methods

### Sprint 3 (Nov 17-24) - Omnichannel Migration Phase 2
**Goal:** Integrate voice with new schema and build SMS/email foundations

- [ ] Update voice WebSocket to use conversations
- [ ] Test voice calls end-to-end with new schema
- [ ] Create /api/admin/communications endpoints
- [ ] Implement Twilio SMS webhook
- [ ] Implement SendGrid email webhook
- [ ] Test SMS threading

### Sprint 4 (Nov 24-Dec 1) - Dashboard & Cutover
**Goal:** Update dashboard and switch to new schema

- [ ] Update dashboard to show conversations (all channels)
- [ ] Build unified customer timeline view
- [ ] Switch all reads to conversations schema
- [ ] Monitor for issues and performance
- [ ] Complete admin dashboard pages
- [ ] Add analytics visualizations

---

## 📊 METRICS & GOALS

### Phase 1 Success Criteria
- [ ] Voice AI handles >80% of calls without escalation
- [ ] <5 second response time for voice
- [ ] >4.0/5.0 average satisfaction score
- [ ] >50% booking conversion rate
- [ ] Dashboard loads in <2 seconds

### Performance Targets
- API response time: <200ms
- WebSocket latency: <100ms
- Database queries: <50ms
- Page load time: <1.5s

---

## 🤝 TEAM NOTES

### For Future Claude Sessions
When picking up this project:
1. Read this TODO.md first to understand current status
2. Check the "IN PROGRESS" section for active work
3. Review "ARCHITECTURE DECISIONS" for context
4. Update this file after completing tasks
5. Add new requests to "FEATURE REQUESTS" section

### How to Update This File
- Move completed items from "IN PROGRESS" to "COMPLETED"
- Add new tasks to appropriate sections
- Update "Last Updated" date at top
- Document important decisions in "ARCHITECTURE DECISIONS"
- Keep "CURRENT SPRINT GOALS" section updated

---

**Status Summary:**
✅ Core backend complete
🚧 Migrating to Next.js + Supabase
⏳ Admin dashboard pending
⏳ SMS integration pending
