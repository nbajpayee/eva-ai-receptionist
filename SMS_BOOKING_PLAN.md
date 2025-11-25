# SMS Booking Orchestrator Pilot Plan

## 1. Goals

- **Unify** SMS bookings into the same deterministic booking/tooling stack used by the messaging console.
- **Leverage the LLM** only for intent understanding and natural replies, while enforcing booking policy and correctness in the backend.
- **Ensure bookings are correct and secure** (right service, time, customer, and confirmations, no double-booking, no missing fields).
- **Make SMS UX world‑class**: concise, clear, low‑friction, and robust to messy user input.
- **Create a reusable pattern** that we can later apply to Email and Voice with minimal changes to core logic.

---

## 2. Current State (SMS & Bookings)

- **Twilio SMS webhook**
  - `backend/main.py` → `@app.post("/api/webhooks/twilio/sms")`
  - Currently a **TODO** placeholder that simply returns a static TwiML response.

- **Console messaging API (already live path)**
  - `backend/api_messaging.py` → `send_message`:
    - Creates/loads `Conversation` & `Customer`.
    - Stores inbound message via `MessagingService.add_customer_message`.
    - Captures slot selections via `SlotSelectionManager.capture_selection`.
    - Calls `MessagingService.generate_ai_response` to get an LLM response.
    - Executes any LLM **tool calls** via `MessagingService._execute_tool_call`, including:
      - `check_availability`
      - `book_appointment`
      - `reschedule_appointment`
      - `cancel_appointment`
      - etc.
    - Uses `MessagingService.generate_followup_response` to continue conversation after tools.
    - Logs analytics & satisfaction, persists outbound assistant message.

- **Booking tool handlers (deterministic layer)**
  - `backend/booking_handlers.py`:
    - `handle_check_availability` builds **availability windows**, summary text, and suggested slots.
    - `handle_book_appointment` enforces:
      - valid time format
      - future date/time
      - service type exists and has a configured duration
      - requested start matches an available slot
      - performs calendar booking and returns structured metadata.

- **Messaging service tool execution**
  - `backend/messaging_service.py`:
    - `_execute_tool_call` orchestrates booking tools, updates conversation/customer state, and records slot offers via `SlotSelectionManager`.
    - Already contains key building blocks of a **deterministic booking orchestrator**.

**Conclusion:**
We already have most of the deterministic tooling and partial orchestration. For SMS, the main gaps are:

- Fully wiring **Twilio SMS** into this pipeline.
- Tightening the contract between the LLM and booking tools.
- Optimizing the SMS‑specific UX and prompts.
- Adding tests and metrics specific to SMS bookings.

---

## 3. Target Architecture for SMS Pilot

- **Single booking orchestrator path**
  - SMS Twilio webhook → normalized into the same flow as console messaging:
    - Map Twilio inbound to a `Conversation` (channel = `"sms"`).
    - Reuse `MessagingService.generate_ai_response` + tool execution path.

- **LLM responsibilities in SMS**
  - Parse user messages into clear intents (new booking / reschedule / cancel / general question).
  - Gradually collect missing fields (service, date, time window, flexibility, contact details).
  - Decide when to **ask for clarification** vs **call tools**.
  - Phrase responses **for SMS**: concise, low‑latency, 1–2 questions max.

- **Backend responsibilities**
  - Enforce all booking rules via `booking_handlers` and `SlotSelectionManager`.
  - Prevent bookings without:
    - a known `Customer`
    - a valid availability‑verified slot
    - required service and contact fields.
  - Make booking actions idempotent.
  - Persist structured metadata for analytics and future channels.

- **Reusability**
  - The SMS‑specific bits live mostly in prompts, channel formatting, and any SMS‑only analytics.
  - Booking logic, tools, and orchestrator should be shared with Email and Voice.

---

## 4. Phases & Checklists

Each phase includes a set of tasks with checkboxes so we can track progress.

### Phase 0 – Baseline and Metrics

**Objectives:** Understand current SMS usage (if any), ensure we can measure success before and after the pilot.

- [ ] **Inventory current SMS flows**
  - [ ] Confirm if any production SMS traffic is currently hitting `/api/webhooks/twilio/sms`.
  - [ ] Confirm how the messaging console currently sends SMS (which provider, which API path).

- [ ] **Define SMS booking success metrics**
  - [ ] Booking conversion rate for SMS conversations (conversations that lead to `book_appointment` success).
  - [ ] Time‑to‑booking (first user message → booking confirmation).
  - [ ] Error rate of booking tool calls (invalid arguments, slot mismatches, etc.).

- [ ] **Add/verify analytics hooks** specific to SMS
  - [ ] Ensure inbound and outbound SMS are tagged consistently in analytics.
  - [ ] Ensure booking tool outcomes for SMS are tracked (success/fail + error code).

---

### Phase 1 – SMS Booking Orchestrator (within existing stack)

**Objectives:** Make the SMS booking path deterministic and explicit, using the existing `MessagingService`/`booking_handlers` structure.

- [ ] **Clarify BookingSession / conversation metadata model**
  - [ ] Decide whether to introduce a first‑class `BookingSession` abstraction or continue using `Conversation.custom_metadata` as the main store.
  - [ ] Enumerate the key fields per SMS conversation:
    - [ ] `intent_type` (new_booking / reschedule / cancel / general_question)
    - [ ] `service_type`
    - [ ] `date`, `time_window`, `flexibility`
    - [ ] `pending_slot_offers`, `selected_slot`
    - [ ] `pending_booking_intent` flag
    - [ ] required customer fields (`name`, `phone`, `email` as applicable)

- [ ] **Align `SlotSelectionManager` with SMS expectations**
  - [ ] Validate that `capture_selection` and `enforce_booking` correctly handle natural language replies like "Any time after 3pm" or "Actually, can we do Thursday?".
  - [ ] Ensure `pending_slot_offers` and `pending_booking_intent` are kept up‑to‑date on every new inbound SMS.

- [ ] **Define SMS booking state transitions** (or state machine semantics) attached to `Conversation`:
  - [ ] `idle` → `collecting_requirements` (user expresses booking intent).
  - [ ] `collecting_requirements` → `offering_slots` (once we have service + date or equivalent info).
  - [ ] `offering_slots` → `awaiting_confirmation` (slots offered; waiting for user choice or free‑form time).
  - [ ] `awaiting_confirmation` → `ready_to_book` (slot selected + required customer fields present).
  - [ ] `ready_to_book` → `booked` / `failed` (depending on `book_appointment` outcome).

- [ ] **Codify when to call which tool** (in prompts + backend validation):
  - [ ] Only call `check_availability` when we have at least `service_type` + a target date/time window.
  - [ ] Only call `book_appointment` when:
    - [ ] A slot has been confirmed in `SlotSelectionManager` / conversation metadata.
    - [ ] Required customer fields are present.
  - [ ] If requirements are missing, **LLM must ask a question**, not force a tool call.

---

### Phase 2 – SMS LLM Contract & Prompts

**Objectives:** Define a clear contract between the SMS LLM agent and the orchestrator and tune prompts for SMS UX.

- [ ] **Define SMS agent I/O schema**
  - [ ] Agent input should include:
    - [ ] Last N messages (user + assistant) from the conversation.
    - [ ] A compact serialization of the booking state/metadata.
    - [ ] Description of available tools (`check_availability`, `book_appointment`, etc.) and when to use them.
  - [ ] Agent output should be structured (e.g., JSON) with:
    - [ ] `assistant_message_text` (string)
    - [ ] `proposed_updates` (fields to update in booking metadata)
    - [ ] Optional `proposed_action` (e.g., `"offer_slots"`, `"confirm_booking"`).

- [ ] **Review and tune the SMS system prompt** used by `MessagingService.generate_ai_response`
  - [ ] Emphasize:
    - [ ] Concise SMS responses.
    - [ ] Asking **one clear question at a time** when information is missing.
    - [ ] Using `check_availability` only when enough info is present.
    - [ ] Using `book_appointment` only after explicit confirmation.
  - [ ] Add few‑shot examples that cover:
    - [ ] User gives partial info (e.g., "Can I book a massage sometime Friday afternoon?").
    - [ ] User changes their mind mid‑flow (new date/time or service).
    - [ ] No availability for the requested time (LLM should gracefully suggest alternatives using availability windows).

- [ ] **Ensure tool arguments are predictable and normalized**
  - [ ] Validate `_normalize_tool_arguments` paths for SMS usage.
  - [ ] Guarantee that `service_type`, `date`, `start_time` fields are always in canonical formats before hitting tools.

---

### Phase 3 – Twilio Webhook Integration for SMS

**Objectives:** Route live Twilio SMS traffic into the orchestrated booking flow.

- [ ] **Implement `/api/webhooks/twilio/sms` end‑to‑end**
  - [ ] Parse inbound Twilio webhook payloads (from, to, body, message SID, etc.).
  - [ ] Look up or create a `Customer` using the phone number.
  - [ ] Find or create an active `Conversation` with `channel = "sms"`.
  - [ ] Add inbound message to the conversation using `MessagingService.add_customer_message`.
  - [ ] Trigger the same AI + tool pipeline as `api_messaging.send_message`.
  - [ ] Get the assistant response text.
  - [ ] Return a TwiML `MessagingResponse` with that text.

- [ ] **Outbound SMS plumbing (if not already fully wired)**
  - [ ] Ensure that assistant messages for SMS conversations trigger actual outbound SMS via Twilio.
  - [ ] Centralize outbound SMS sending in a helper that:
    - [ ] Applies rate limiting / throttling.
    - [ ] Logs analytics and errors.

- [ ] **Session continuity**
  - [ ] Ensure repeated SMS from the same number map to the correct active conversation.
  - [ ] Decide on session timeout / inactivity rules (when to start a new conversation).

---

### Phase 4 – Robustness, Testing, and Metrics

**Objectives:** Verify that the SMS bookings flow is reliable and measurable.

- [ ] **Integration tests for SMS booking flows**
  - [ ] Happy path: new client books an appointment via SMS, from first message to confirmation.
  - [ ] Partial information (missing service or date): system asks clarifying questions and then books.
  - [ ] User changes requested time after seeing availability; final booking matches latest choice.
  - [ ] No availability at requested time; assistant proposes alternatives and books one.
  - [ ] Booking errors (e.g., calendar failure) are surfaced clearly and gracefully.

- [ ] **Edge‑case tests**
  - [ ] Ambiguous messages (e.g., "Next Thursday afternoon or Friday morning").
  - [ ] User switches topics mid‑conversation (booking → general question → booking again).
  - [ ] Multiple booking attempts within a single SMS thread (ensure no double‑booking).

- [ ] **Metrics and monitoring**
  - [ ] Dashboards for:
    - [ ] SMS booking conversion.
    - [ ] Average number of messages per booking.
    - [ ] Tool error distribution (by error type).
  - [ ] Alerts for:
    - [ ] Spikes in tool failures.
    - [ ] Sudden drop in SMS booking success rate.

---

### Phase 5 – Security and Policy Hardening

**Objectives:** Make the SMS booking flow robust to abuse and safe with respect to PII and business rules.

- [ ] **Customer identification & linking**
  - [ ] Enforce consistent mapping from phone number → `Customer` → `Conversation`.
  - [ ] Handle number reuse or mis‑typed numbers gracefully where possible.

- [ ] **Idempotency & double‑booking protection**
  - [ ] Ensure `book_appointment` is idempotent for the same conversation + slot + customer.
  - [ ] Prevent multiple bookings from accidental retries or duplicated Twilio webhooks.

- [ ] **PII and data handling**
  - [ ] Avoid logging full message bodies and phone numbers where not necessary.
  - [ ] Review and mask sensitive fields in analytics where appropriate.

- [ ] **Policy & guardrails**
  - [ ] Implement configurable business rules (e.g., max bookings per day, cut‑off times).
  - [ ] Validate that the LLM cannot bypass these rules (backend enforces them regardless of tool arguments).

---

## 5. Rollout Strategy

- [ ] **Internal dry‑run**
  - [ ] Use a test Twilio number and internal accounts to simulate real SMS bookings across common scenarios.

- [ ] **Soft launch for a subset of providers**
  - [ ] Enable SMS bookings for a small cohort, monitor metrics and logs closely.

- [ ] **Full rollout**
  - [ ] Expand to all providers once metrics and error rates are acceptable.
  - [ ] Freeze major behavior changes and focus on prompt fine‑tuning and small UX improvements.

---

## 6. Future Extensions (Email & Voice)

Once SMS is stable and proven, reuse the same booking orchestrator and tool stack for other channels:

- **Email:**
  - Reuse the same booking metadata model.
  - Adjust prompts for longer, summarizing responses and richer context.

- **Voice:**
  - Use the same tools and state machine, but:
    - Prioritize brevity and turn‑based clarification.
    - Use availability **ranges** (e.g., "I have openings from 11am to 3pm") rather than long option lists.

This plan file should be kept up to date as we progress. Mark checkboxes as tasks are completed and add any newly discovered work under the appropriate phase.
