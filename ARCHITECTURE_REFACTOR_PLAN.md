# Architecture Refactor Plan (Booking / Messaging / Voice / Analytics)

This document tracks the medium-term refactor to make booking, messaging,
voice, and analytics flows easier to reason about, safer to change, and
consistent across channels. _Last updated: Nov 28, 2025._

The plan is deliberately incremental and PR-sized. Each milestone should be
landed with tests passing before moving to the next.

## Goals

- **Single booking brain** shared by voice and messaging.
- **Smaller, focused messaging modules** behind a stable `MessagingService` façade.
- **Typed tool contracts** for booking-related operations.
- **Centralized AI configuration** for all OpenAI usage.
- **Structured tool + calendar metrics** for observability.
- **Hard cut to the new `conversations` schema** (no ongoing dual-write).

## System Architecture Overview

- **Domain layer (`backend/booking`, `backend/settings_service.py`)**
  - Owns booking logic, slot selection, and service/provider configuration.
  - Exposes a typed `BookingOrchestrator` and `BookingContext` used by all channels.
- **Channel layer (`MessagingService`, `RealtimeClient`, future web/staff UIs)**
  - Adapts channel-specific UX (SMS wording, voice prompts) onto the shared domain.
  - Manages conversation state, customer records, and tool call lifecycles.
- **Integration layer (calendar, OpenAI, Twilio, persistence)**
  - `calendar_service` abstracts Google Calendar.
  - `ai_config` (and existing analytics services) centralize OpenAI configuration.
  - `database` + `AnalyticsService` provide durable storage and reporting surfaces.

## Codebase Structure (high level)

- **`backend/booking/`** – Slot management, booking orchestration, time utilities.
- **`backend/messaging_service.py`** – Omnichannel messaging brain and tool routing.
- **`backend/realtime_client.py`** – Voice Realtime client, tool execution, and session state.
- **`backend/analytics.py`** – Core analytics, conversation/appointment persistence, sentiment.
- **`backend/ai_config.py`** – Shared OpenAI client factory and model configuration.
- **`backend/settings_service.py`** – Provider/service configuration for all channels.
- **`backend/calendar_service.py`** – Calendar abstraction for availability and bookings.

## Design Principles

- **Deterministic booking flows** – A booking is only valid if it comes from a previously
  offered slot; idempotent guards prevent duplicate bookings across channels.
- **Channel-agnostic core, thin adapters** – `BookingOrchestrator` and shared types encode
  business rules once; messaging/voice adapt UX without forking booking logic.
- **Strong observability** – Tool + calendar metrics, structured errors, and conversation
  metadata are first-class to support debugging and pilot SLOs.
- **Incremental, test-driven refactor** – Each milestone is PR-sized, keeps behavior stable,
  and lands with focused unit/integration coverage.

## Progress Snapshot (Nov 28, 2025)

- ✅ **Booking domain types + orchestrator shipped:** `backend/booking/orchestrator_types.py` and `backend/booking/orchestrator.py` now provide the typed surface plus slot-selection enforcement, with coverage in `backend/tests/booking/test_orchestrator.py`.
- ✅ **Deterministic slot governance in messaging:** `MessagingService` routes all booking tools (`check_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`) through `BookingOrchestrator`, records slot offers, enforces slot reuse, and applies a single metadata contract for `last_appointment`.
- ✅ **Voice booking path on orchestrator + shared helpers:** `RealtimeClient` uses `BookingContext` + `BookingOrchestrator` for `check_availability` / `book_appointment` and shared helpers (`_BookingContextFactory`, `_VoiceSessionState`) for booking/reschedule/cancel metadata, preserving existing error handling, spoken confirmations, and cross-channel metadata.
- ✅ **AI config migration completed for core services:** `backend/ai_config.py` powers the shared OpenAI client for `analytics.py`, `messaging_service.py`, `ai_insights_service.py`, and `consultation_service.py`; only tests/dev helpers use the raw OpenAI module directly.
- ✅ **Tool/calendar metrics + schema cutover shipped:** Metrics helper (`backend/analytics_metrics.py`), booking tool/calendar logging in messaging + voice, and the hard cut to `conversations` (legacy `call_sessions` removed, legacy scripts marked [LEGACY]) are all in place.

---

## Milestone 1 – BookingOrchestrator types & service _(Status: ✅ Completed)_

**Objective:** Introduce a single booking orchestration service without changing
observable behavior.

### 1.1 Define booking domain types _(Done)_

- Add `backend/booking/orchestrator_types.py`:
  - `BookingChannel` enum (`voice`, `sms`, `email`, `staff_console`, etc.).
  - `BookingContext` (conversation, customer, channel, time zone, metadata).
  - Result models for booking operations:
    - `CheckAvailabilityResult` (success, error, availability, windows,
      slot_offers, suggested_slots, service_type, provider, adjustments).
    - `BookingResult` (success, error, event_id, start_time, service,
      service_type, provider, duration_minutes, was_auto_adjusted).

### 1.2 Implement BookingOrchestrator _(Done)_

- Add `backend/booking/orchestrator.py`:
  - `BookingOrchestrator` class with methods:
    - `check_availability(context, date, service_type, provider=None)`.
    - `book_appointment(context, params)`.
    - `reschedule_appointment(context, params)`.
    - `cancel_appointment(context, params)`.
  - Implementation details:
    - Use `SlotSelectionManager` to manage slot offers and enforce
      "+must come from offered slot+" invariants.
    - Call into existing `booking_handlers` functions and convert dict
      responses to typed results.

### 1.3 Tests _(Done)_

- Add focused tests under `backend/tests/booking/test_orchestrator.py`:
  - Happy path: availability + booking for both voice and messaging
    contexts.
  - Failure modes: calendar errors, invalid dates, unknown services.

---

## Milestone 2 – Integrate BookingOrchestrator with messaging & voice _(Status: ✅ Completed)_

**Objective:** Route all booking tool calls for voice + messaging through
`BookingOrchestrator` while keeping public APIs unchanged.

### 2.1 Messaging integration _(Done)_

- `MessagingService` constructs a `BookingContext` for the current
  conversation/customer and delegates all booking tools
  (`check_availability`, `book_appointment`, `reschedule_appointment`,
  `cancel_appointment`) to `BookingOrchestrator`.
- Customer/contact normalization is centralized in
  `MessagingService._update_customer_from_arguments`.
- Deterministic booking behavior and slot selection semantics are
  enforced via `SlotSelectionManager` plus a single `last_appointment`
  metadata contract.

### 2.2 Voice integration _(Done)_

- `RealtimeClient.handle_function_call` constructs a `BookingContext`
  using the current voice conversation and delegates
  `check_availability` / `book_appointment` to `BookingOrchestrator` via
  `_BookingContextFactory`.
- Reschedule and cancel flows continue to call the calendar service
  directly but now share a unified `_VoiceSessionState` helper for
  applying `last_appointment` metadata, keeping voice + messaging
  aligned for analytics.

### 2.3 Regression tests

- Extend or add tests to cover:
  - Cross-channel behavior (messaging vs. voice) for availability and
  - Slot selection + no double-booking invariants.
- Add contract tests that ensure both `MessagingService` and
  `RealtimeClient` emit identical metadata structures when bookings
  succeed, ensuring channel parity for subsequent analytics.

---

## Milestone 3 – AI configuration module _(Status: ✅ Completed)_

**Objective:** Centralize OpenAI client configuration and model selection.

### 3.1 Shared AI config

- Add `backend/ai_config.py`:
  - Central `get_openai_client()` factory using `OPENAI_API_KEY`.
  - Model constants for messaging, analytics/sentiment, and realtime
    voice.
  - Helper functions:
    - `analyze_call_sentiment(transcript)`.
    - `score_conversation_satisfaction(conversation)`.

### 3.2 Migrate call-sites

- Update `analytics.py` to:
  - Use `ai_config.get_openai_client()` instead of constructing
    `OpenAI` directly.
  - Replace direct sentiment/satisfaction calls with helpers where
    appropriate.
- Update `messaging_service.py` (and any other modules) to import the
  shared client or helpers from `ai_config` instead of importing a
  module-global client from `analytics`.

---

## Milestone 4 – Tool & calendar metrics _(Status: ✅ Completed)_

**Objective:** Provide a thin, consistent surface for tracking tool and
calendar health.

### 4.1 Metrics helper _(Done)_

- Add a small helper in `analytics.py` or a sibling module, e.g.
  `backend/analytics_metrics.py`:
  - `record_tool_execution(tool_name, channel, success, latency_ms, error_code=None)`.
  - `record_calendar_error(reason, http_status=None, channel=None)`.

### 4.2 Wire into booking flows _(Done)_

- `MessagingService._execute_tool_call` records tool execution metrics
  for booking tools, tagged with conversation/channel context.
- `RealtimeClient.handle_function_call` records both tool execution and
  calendar error metrics for voice `check_availability` and
  `book_appointment` flows.
- Admin endpoint `/api/admin/health/booking` exposes a lightweight
  booking health snapshot for pilot monitoring.

---

## Milestone 5 – Hard cut to `conversations` schema _(Status: ✅ Completed)_

**Objective:** Stop writing to legacy `call_sessions` and rely fully on the
`conversations` schema.

### 5.1 Remove legacy call_sessions schema

- Physically removed `CallSession` and `CallEvent` models from
  `database.py`, along with `Customer.call_sessions` relationships.
- Deleted `AnalyticsService` helpers that depended on `CallSession` /
  `CallEvent` (`create_call_session`, `end_call_session`,
  `log_call_event`, `update_daily_metrics`, `get_call_history`).
- Simplified `voice_websocket` in `main.py` to be
  **conversations-only**, using `AnalyticsService.create_conversation`,
  `add_message`, `add_voice_details`, and
  `score_conversation_satisfaction`.
- Updated `get_customer_history` to return conversations instead of
  legacy call_sessions.
- Updated `/api/admin/calls*` endpoints in `main.py` to delegate to the
  conversations-based admin API in `api_admin.py`.

### 5.2 Clean-up & follow-ups

- Ensure admin dashboard views and analytics pages use the
  conversations-based APIs.
- Marked legacy migration/seed scripts that relied on
  `call_sessions`/`call_events` (e.g.
  `backend/scripts/migrate_call_sessions_to_conversations.py`,
  `backend/scripts/seed_supabase.py`,
  `backend/scripts/migrate_sqlite_to_supabase.py`) as **[LEGACY]** and
  disabled execution with a top-level `SystemExit` and explanatory
  message.
- Future data tooling should be built directly on the
  conversations-based schema and new metrics/event tables.

---

## Milestone 6 – Pilot-readiness hardening & channel parity

**Objective:** Ensure the unified booking brain behaves identically across channels, auto-heals degraded states, and exposes a clear runbook before inviting pilot customers.

### 6.1 Deterministic booking watchdogs

- Add background checks that alert if a booking tool call bypasses 
  `SlotSelectionManager` enforcement (e.g., instrumentation in
  orchestrator + metrics layer).
- Persist argument adjustments + idempotent handling details for audits.
- Added cross-channel tests to ensure:
  - Messaging auto-booking writes `last_appointment` metadata in a
    deterministic shape after successful bookings.
  - Voice `RealtimeClient.handle_function_call('book_appointment')`
    writes matching `last_appointment` metadata and clears
    `pending_booking_intent`.
  - Slot selection mismatches in voice return a structured
    `slot_selection_mismatch` error with a user-facing message that
    prompts the AI to re-check availability.
- Implemented a lightweight booking health helper
  `AnalyticsService.get_booking_health_window` and corresponding admin
  endpoint `/api/admin/health/booking` that report recent conversation
  volume, AI-booked appointments, cancellations, and conversion rate for
  pilot monitoring.

### 6.2 Voice client refactor

- Moved `RealtimeClient` booking tool handling onto shared service
  objects:
  - `_BookingContextFactory` to hydrate context + services/providers
    cache for voice.
  - `_VoiceSessionState` to persist AI/customer metadata (including
    `last_appointment`) in the same shape as messaging
    `conversation.custom_metadata`.
- OpenAI Realtime prompt/response shaping remains inline in
  `RealtimeClient` for now; if future channels (web chat, staff console
  co-pilot) are introduced, this can be extracted into a composable
  module.

### 6.3 Operational runbook for pilot

- **Core SLOs (initial targets)**
  - **Booking success rate:** ≥ 90% of conversations with clear booking
    intent should result in a scheduled appointment. Measured via
    appointments with `booked_by="ai"` over recent `N` conversations.
  - **Calendar error rate:** ≤ 2% of booking attempts should hit
    calendar-related failures (4xx/5xx, rate limits). Measured via
    `record_calendar_error` counts vs. booking tool executions.
  - **Latency:** P95 end-to-end booking tool latency
    (tool call → confirmation) under 3 seconds for messaging and under
    5 seconds for voice.

- **Metrics & endpoints to watch**
  - `/api/admin/metrics/overview` – high-level conversion and
    satisfaction trends.
  - `/api/admin/health/booking` – recent-window snapshot of:
    - `total_conversations`
    - `ai_appointments_scheduled`
    - `appointments_cancelled`
    - `conversion_rate`
  - Logs emitted via `analytics_metrics.record_tool_execution` and
    `record_calendar_error` for detailed debugging.

- **Recovery procedures (playbook)**
  - **Calendar API outage / 4xx/5xx spikes**
    - Symptoms: `/api/admin/health/booking` shows sharp drop in
      `ai_appointments_scheduled` and spike in errors; logs contain
      `calendar_error` entries.
    - Actions:
      1. Verify Google Calendar status / credentials (service account,
         calendar ID).
      2. Switch bookings to staff-only handling by temporarily
         disabling AI booking (feature flag) while leaving information
         flows enabled.
      3. Once resolved, re-enable AI booking and monitor
         `conversion_rate` + error counts for the next 1–2 hours.

  - **Slot selection corruption**
    - Symptoms: repeated `slot_selection_mismatch` errors even after
      presenting fresh availability.
    - Actions:
      1. Inspect recent conversations for malformed
         `pending_slot_offers` metadata.
      2. Clear corrupted offers by manually resetting
         `conversation.custom_metadata.pending_slot_offers` for the
         affected conversation(s).
      3. Re-run availability checks and confirm new metadata is
         well-formed.

  - **Twilio / Realtime disconnects**
    - Symptoms: frequent dropped calls or websocket disconnects.
    - Actions:
      1. Check Twilio/Realtimes service status dashboards.
      2. Verify network connectivity from the deployment environment to
         OpenAI and Twilio endpoints.
      3. Temporarily route calls to human reception or voicemail if the
         issue persists.

- **Pilot readiness checklist**
  - Data: seed representative conversations/appointments if needed for
    dashboards (using conversations-based tooling only).
  - Environment: verify correct `.env` for staging vs. production,
    including separate calendars and Twilio numbers.
  - Observability: ensure logs and metrics are flowing to the chosen
    dashboard/alerting system, even if full dashboards (Milestone 7.2)
    are not yet built.

---

## Milestone 7 – Unified insights & analytics surface

**Objective:** Turn instrumented booking + messaging data into actionable insights for both internal debugging and customer-facing dashboards.

### 7.1 AI insights consolidation

- Rework `analytics.py`, `ai_insights_service.py`, and future reporting
  modules to consume a single `ai_config` client + shared prompt
  templates.
- All GPT chat calls for sentiment/scoring/insights now use the shared
  `openai_client` from `ai_config` (no direct `openai` usage).
- Store sentiment/satisfaction outputs alongside booking actions to
  correlate AI quality with conversion rate per channel.

### 7.2 Observability dashboards

- Ship Looker/Grafana (or Superset) dashboards sourced from the new
  metrics helper:
  - Tool execution funnel (availability → booking → confirmation)
  - Calendar error taxonomy with recency
  - Conversation schema adoption progress
- Provide saved filters that let engineers drill into a pilot customer’s
  recent conversations with one click.
