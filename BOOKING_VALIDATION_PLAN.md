# Booking Validation Plan (Voice, SMS, Email)

_Last updated: Nov 22, 2025_

This document defines how we will validate that **booking is deterministic and reliable** across channels (voice, SMS, email) while still supporting natural, non-booking conversations.

Focus order:

1. Voice
2. SMS (via messaging console)
3. Email (later, same patterns as SMS)

The plan combines **automated tests** (pytest) with **manual, channel-agnostic validation** using the existing consoles.

---

## 1. Goals

- **Deterministic booking:**
  - Given enough information (service, time, contact), the system reliably books *exactly one* appointment, without stalls or double-bookings.
- **Channel-agnostic behavior:**
  - The same logical flow works via voice and SMS (and later email) with consistent outcomes.
- **Resilience to natural language:**
  - Handles vague or evolving requests ("sometime next week", "actually make it Wednesday") gracefully.
- **Safe non-booking conversations:**
  - FAQ and general chats never accidentally create appointments.
- **Robust failure paths:**
  - Calendar rejections and cross-channel conflicts are handled explicitly and predictably.

---

## 2. Voice Booking Test Matrix

These scenarios are exercised in `backend/tests/test_voice_booking.py`,
`backend/tests/integration/test_voice_booking_flows.py`, and manual tests via
the voice console.

### 2.1 Happy Paths

**V1 – Straightforward booking**
- Flow:
  - User: "I’d like to book Botox sometime next week."
  - Assistant clarifies date/time → user picks one → provides name + phone (+ optional email).
- Expected:
  - `check_availability` is called once for the relevant date/service.
  - `book_appointment` executes once.
  - One appointment exists for the chosen slot.
  - Conversation status: booked/completed.

**V2 – User picks from offered slots**
- Flow:
  - Assistant offers multiple slots.
  - User: "Let’s do the first one" / "the Wednesday slot" / "the 3pm one".
- Expected:
  - Slot resolution picks the correct offered slot.
  - Exactly one booking.

**V3 – Reschedule existing appointment**
- Flow:
  - User: "Can we move my Botox on Friday to next Tuesday?"
- Expected:
  - If prior appointment exists:
    - Old appointment marked rescheduled/canceled.
    - New appointment created for Tuesday.
  - No extra appointments created.

### 2.2 Non‑Booking Conversations

**V4 – FAQ only**
- Flow:
  - User asks about services, pricing, hours, providers, etc.
- Expected:
  - No booking calls.
  - No appointments created.

**V5 – Booking intent withdrawn**
- Flow:
  - User: "I want to book Botox" → assistant starts flow.
  - Later: "Actually, never mind, I’ll call later."
- Expected:
  - No appointment created.
  - Any pending offer state is cleared.

### 2.3 Edge Cases

**V6 – Ambiguous time clarified later**
- Flow:
  - "Sometime Friday afternoon" → assistant offers specific times → user selects one.
- Expected:
  - Booking only after explicit selection.
  - One appointment for the final explicit slot.

**V7 – Conflicting updates**
- Flow:
  - "Next Monday at 3" then "Actually make it Wednesday at 4."
- Expected:
  - Final choice wins.
  - Either:
    - Single appointment at Wednesday 4pm, or
    - Monday appointment replaced by Wednesday appointment (if booking already executed).

**V8 – Double confirmation**
- Flow:
  - Assistant confirms booking.
  - User: "Okay that works" … later "Yes that’s perfect".
- Expected:
  - No second booking; deterministic path must detect already-booked state.

---

## 3. SMS Booking Test Matrix (via Messaging Console)

These scenarios are exercised in `backend/tests/integration/test_sms_booking_flows.py`
(for SMS flows), `backend/tests/integration/test_cross_channel_flows.py` (for
cross-channel SMS pieces), and manually through the messaging console
simulating SMS.

### 3.1 Happy Paths

**S1 – Stepwise SMS conversation**
- Messages from user:
  1. "Hi, I want Botox."
  2. "Next Thursday."
  3. "Afternoon."
  4. "Neeraj, 555-123-4567."
- Expected:
  - Same deterministic pipeline: one availability check, one booking.
  - One appointment linked to the `conversation` and `customer`.

**S2 – Single long SMS**
- Message:
  - "Hi, can you book me a Botox appointment next Thursday around 3pm? My name is Neeraj and my phone is 555‑123‑4567."
- Expected:
  - Model/tooling extracts service, date/time, name, phone from a single message.
  - One appointment created, with no follow‑up retries needed.

### 3.2 Non‑Booking SMS

**S3 – Info only**
- Messages:
  - "What’s your address?"
  - "What do you charge for Botox?"
- Expected:
  - No booking calls.
  - No appointments created.

**S4 – Cancel mid‑flow**
- Messages:
  - "I want to book"
  - Assistant asks date/time.
  - User: "Actually, I’ll think about it."
- Expected:
  - No booking.
  - Flow terminates cleanly.

### 3.3 Edge Cases

**S5 – Vague, then precise**
- Messages:
  - "Sometime next month" → later "Actually, next Thursday at 3pm."
- Expected:
  - Booking only after the precise time is given.
  - No appointment tied to the vague phrase.

**S6 – Slot change after offer**
- Messages:
  - Assistant offers three times.
  - User: "Let’s do the 5pm" then "wait, 3pm is better."
- Expected:
  - Final choice (3pm) is booked.
  - No ghost 5pm appointment.

**S7 – Confirmation vs new booking**
- Messages:
  - After booking exists: "Just to confirm, my Thursday appointment is at 3pm, right?"
- Expected:
  - Assistant replies using existing appointment.
  - No additional appointment created.

---

## 4. Cross‑Channel Scenarios (Voice + SMS)

These are covered in `backend/tests/test_cross_channel_booking.py` and
`backend/tests/integration/test_cross_channel_flows.py`, plus a combination of
voice + messaging console manual tests.

**XS1 – Voice starts, SMS finishes**
- Flow:
  - Voice call collects intent and offers slots but user disconnects before final confirmation.
  - Later, user texts in same conversation: "Let’s confirm the 3pm Thursday slot you mentioned."
- Expected:
  - System uses existing pending slot metadata from voice.
  - Exactly one appointment created corresponding to that slot.

**XS2 – SMS starts, voice finishes**
- Flow:
  - User starts booking over SMS (service + rough day).
  - Later calls and finishes the flow via voice.
- Expected:
  - Deterministic booking logic unifies metadata.
  - Only one final appointment exists.

---

## 5. Automated Test Implementation

### 5.1 Voice Tests

- **Modules:**
  - `backend/tests/test_voice_booking.py`
  - `backend/tests/integration/test_voice_booking_flows.py`
- **Approach:**
  - Use the same service layer that the realtime voice pipeline uses (e.g.
    `messaging_service` and `SlotSelectionManager`).
  - For each scenario (V1–V8):
    - Simulate the sequence of user messages/utterances as text.
    - Assert:
      - The number of `Appointment` records affected.
      - Fields on the booked appointment (service, slot, customer linkage).
      - Conversation metadata (status, satisfaction flags if relevant).
  - Additional deterministic checks are implemented in
    `test_voice_booking_flows.py` to assert exactly one booking call and that
    FAQ-only flows never hit `check_availability`.

### 5.2 SMS / Messaging Tests

- **Modules:**
  - `backend/tests/integration/test_sms_booking_flows.py` (SMS flows)
  - `backend/tests/integration/test_cross_channel_flows.py` (XS1/XS2 and other
    cross-channel flows)
- **Approach:**
  - Call the messaging service entrypoints that the console uses to
    send/receive messages.
  - For each scenario (S1–S7, XS1–XS2):
    - Feed user message sequences.
    - Assert appointments and conversation state exactly as for voice.
  - Additional deterministic checks assert that SMS happy-path booking triggers
    exactly one booking call and that informational SMS threads never trigger
    availability checks.

### 5.3 Running the Tests

From repo root:

```bash
cd backend

# Core booking logic + slot selection
pytest tests/test_booking_handlers.py tests/booking/test_slot_selection.py

# Voice + SMS booking flows (includes deterministic + info-only guards)
pytest tests/integration/test_voice_booking_flows.py \
       tests/integration/test_sms_booking_flows.py

# Cross-channel XS1/XS2 deterministic booking flows
pytest tests/integration/test_cross_channel_flows.py::TestCrossChannelBooking::test_voice_offers_sms_books_single_appointment \
       tests/integration/test_cross_channel_flows.py::TestCrossChannelBooking::test_sms_offers_voice_books_single_appointment
```

These commands should be run before enabling real Twilio SMS or phone numbers.

---

## 6. Manual Channel‑Agnostic Validation (Voice & Messaging Consoles)

### 6.1 Voice Console

Using the existing voice console (web UI) that talks to the FastAPI realtime endpoint:

- Run a small set of **regression scenarios** from V1–V8:
  - Straightforward booking.
  - Reschedule.
  - FAQ/non-booking.
  - Cancellations mid-flow.
  - Conflicting updates and double confirmations.
- For each run:
  - Check database (or admin dashboard) for resulting appointment(s).
  - Confirm there is either exactly one appointment or none, as expected.
  - Note any places where assistant wording is confusing or where the AI tries to re-check availability unnecessarily.

### 6.2 Messaging Console (SMS/Email Simulation)

Using the admin dashboard messaging console:

- Simulate the SMS flows (S1–S7) using text messages.
- For later, mirror the same tests for **email** (same patterns; different channel flag).
- For each run:
  - Verify appointments and conversation records.
  - Compare behavior with equivalent voice scenarios to spot discrepancies.

### 6.3 Cross‑Channel Manual Tests

- Start a booking via voice, finish via SMS (XS1).
- Start via SMS, finish via voice (XS2).
- Confirm that:
  - Only one appointment is created.
  - Conversation history and status look coherent in the dashboard.

---

## 7. Failure‑Path Hardening

We want predictable behavior when things go wrong.

### 7.1 Calendar Rejection Scenarios

- **CR1 – Slot no longer available:**
  - Calendar returns a conflict (e.g., race condition or external booking).
  - Expected:
    - Assistant acknowledges the failure.
    - Offers alternative times or asks user to pick another slot.
    - No phantom appointment is recorded.

- **CR2 – Calendar API failure:**
  - Simulate network/credential error.
  - Expected:
    - Clear, non-technical apology to user.
    - No appointment created.
    - Error logged with sufficient context for debugging.

### 7.2 Conflicting Cross‑Channel Bookings

- **CC1 – Same user, overlapping bookings across channels:**
  - User books via voice, then tries to book overlapping time via SMS.
  - Expected:
    - Either prevented with a clear explanation, or treated as a reschedule; never two overlapping appointments for same user unless explicitly allowed.

Implementation detail for tests:
- Use seed/test data to simulate Calendar conflicts.
- Add dedicated pytest cases around the booking service to assert behavior for these failure modes.

---

## 8. Roles & Permissions Follow‑Through

Backend already supports user roles via Supabase (`profiles.user_role`). Next steps are **UI-level enforcement and tests**.

### 8.1 Role Definitions

- **Owner:**
  - Full access to analytics, customers, appointments, research, providers, settings.
- **Staff:**
  - Can view dashboards, customers, appointments, and messaging.
  - Limited access to settings (e.g., cannot change billing or core business identity fields).
- **Provider:**
  - Primarily views own consultations, performance metrics, and limited customer info.

### 8.2 UI Enforcement

- In the admin dashboard:
  - Use `useAuth().profile.role` to conditionally render navigation items and actions.
  - Hide or disable controls the current role is not allowed to use.
  - Optionally show a clear messaging banner when access is restricted.

### 8.3 Role-Aware Tests

- Add frontend integration tests (or at least unit-level tests on layout/nav components) to verify:
  - Owners see full nav and settings pages.
  - Staff and Providers see only appropriate subsets.
- Align with backend checks:
  - Backend endpoints already enforce role-based access where needed; UI should not contradict this.

---

## 9. Pre‑Flight Checklist Before Enabling Real SMS/Phone

1. **Automated tests**
   - `pytest tests/test_booking_handlers.py tests/booking/test_slot_selection.py`
   - `pytest tests/integration/test_voice_booking_flows.py tests/integration/test_sms_booking_flows.py`
   - `pytest tests/integration/test_cross_channel_flows.py::TestCrossChannelBooking::test_voice_offers_sms_books_single_appointment \
            tests/integration/test_cross_channel_flows.py::TestCrossChannelBooking::test_sms_offers_voice_books_single_appointment`
2. **Manual voice console runs** for V1–V8.
3. **Manual messaging console runs** for S1–S7 and XS1–XS2.
4. **Failure-path checks**:
   - Calendar rejection & conflict scenarios behave predictably.
5. **Role/permissions sanity check**:
   - Log in as at least two roles (Owner, Provider) and verify UI matches expectations.

Once all of the above are stable, it’s safe to start wiring in Twilio/SendGrid and eventually the live-status endpoint for real production monitoring.
