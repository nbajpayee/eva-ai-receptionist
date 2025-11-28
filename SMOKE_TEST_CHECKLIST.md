# Smoke Test Checklist for Pre-Pilot Demo

**Purpose:** Systematically test all 7 golden path scenarios before demo day.

**Time Required:** 2-3 hours
**Environment:** Run against **actual deployment** (not localhost)

---

## Pre-Test Setup

### **1. Gather Required Information**
- [ ] Production backend URL: https://___________________
- [ ] Production WebSocket URL: wss://___________________
- [ ] Twilio phone number: ___________________
- [ ] Test phone number (your phone): ___________________
- [ ] Test email: ___________________
- [ ] Google Calendar ID: ___________________
- [ ] Admin dashboard URL: https://___________________

### **2. Verify Prerequisites**
- [ ] Backend is running and healthy (`curl https://YOUR_URL/health/ready`)
- [ ] Google Calendar credentials are valid
- [ ] Twilio webhook is configured correctly
- [ ] Admin dashboard is accessible
- [ ] You have Supabase/database access to verify records

### **3. Prepare Test Data**
- [ ] Clear any test appointments from yesterday (or use future dates)
- [ ] Have a calendar open to verify appointments appear
- [ ] Have admin dashboard open in another tab

---

## Test 1: Standard Voice Booking (Happy Path)

### **Objective:** Verify AI can complete booking without looping or hesitation

### **Steps:**
1. Call Twilio number: ___________________
2. Wait for greeting: "Hi, thanks for calling..."
3. Say: **"I'd like to book a Botox appointment for tomorrow at 2 PM"**
4. When asked for name, say: **"John Smith"**
5. When asked for phone, say: **"555-123-4567"**
6. When asked for email, say: **"john@example.com"**
7. Wait for confirmation

### **Pass Criteria:**
- [ ] AI checks availability **without asking to "re-check"**
- [ ] AI collects all required info (name, phone, email)
- [ ] AI confirms booking with **specific date and time**
- [ ] No hesitation or looping ("Let me double-check that for you...")

### **Verification:**
- [ ] Appointment appears in Google Calendar with:
  - Service: "Botox"
  - Duration: 30 minutes
  - Customer: john@example.com in description
- [ ] Conversation appears in admin dashboard with:
  - Full transcript (both customer and assistant)
  - Satisfaction score (1-10)
  - Outcome: "appointment_scheduled"
  - Function calls logged: `check_availability`, `book_appointment`

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Test 2: Reschedule Existing Appointment

### **Objective:** Verify AI can find and reschedule without creating duplicate

### **Prerequisites:**
- [ ] Must have completed Test 1 (or manually create appointment first)

### **Steps:**
1. Call Twilio number again from same phone: ___________________
2. Say: **"I need to reschedule my Botox appointment"**
3. AI should look up by phone number
4. Say: **"Can we move it to Thursday at 4 PM instead?"**
5. Wait for confirmation

### **Pass Criteria:**
- [ ] AI finds existing appointment by phone number
- [ ] AI checks availability for new time
- [ ] AI updates appointment (doesn't create new one)
- [ ] AI confirms new date/time clearly

### **Verification:**
- [ ] Google Calendar shows **ONE appointment** (not two)
- [ ] Appointment time is updated to Thursday 4 PM
- [ ] Customer details remain the same
- [ ] Admin dashboard shows outcome: "rescheduled"

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Test 3: No Availability (Graceful Degradation)

### **Objective:** Verify AI handles empty availability gracefully

### **Setup:**
- [ ] Manually book all slots for tomorrow (or pick a date in the past)

### **Steps:**
1. Call Twilio number
2. Say: **"I need a Hydrafacial tomorrow at 3 PM"**
3. Wait for AI response

### **Pass Criteria:**
- [ ] AI responds: "We're fully booked tomorrow" (or similar)
- [ ] AI offers **alternative dates with specific times**
  - Example: "We have openings Thursday at 2 PM or Friday at 10 AM"
- [ ] AI does **NOT** say: "I can book you for 3 PM tomorrow" (lying!)

### **Verification:**
- [ ] No appointment created for tomorrow
- [ ] Conversation outcome: "browsing" or "info_only" (not "booked")
- [ ] Logs show `check_availability` returned empty slots

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Test 4: Planner Priya Baseline (Provider Selection)

### **Objective:** Verify AI handles provider preferences correctly

### **Steps:**
1. Call Twilio number
2. Say: **"I'd like to see Priya for a consultation next week"**
3. Wait for AI to check Priya's availability
4. When AI offers times, say: **"How about Wednesday at 4 PM?"**
5. Provide contact info when asked

### **Pass Criteria:**
- [ ] AI recognizes "Priya" as a provider
- [ ] AI checks availability specifically for Priya (if implemented)
- [ ] AI books appointment **without looping**
- [ ] Confirmation mentions provider name

### **Verification:**
- [ ] Google Calendar event includes provider in description
- [ ] Appointment marked with correct provider_id (if tracked)
- [ ] Admin dashboard shows provider: "Priya" (or provider ID)
- [ ] Outcome: "appointment_scheduled"

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________
- [ ] ⚠️ SKIP - Provider selection not implemented yet

---

## Test 5: SMS → Booked Appointment (Cross-Channel)

### **Objective:** Verify deterministic booking works via SMS

### **Steps:**
1. Send SMS to Twilio number: **"Hi, I need laser hair removal"**
2. Wait for AI response asking for date/time
3. Reply: **"Next Tuesday around 11 AM"**
4. Wait for AI to check availability and offer slots
5. Reply: **"11 AM works"**
6. Provide name/contact if asked

### **Pass Criteria:**
- [ ] Same deterministic booking logic as voice
- [ ] AI checks availability before offering times
- [ ] AI books immediately after customer selects time
- [ ] **No "let me re-check" after selection**

### **Verification:**
- [ ] Appointment in Google Calendar
- [ ] Conversation in admin dashboard with:
  - Channel: "sms"
  - Full message thread
  - Outcome: "appointment_scheduled"

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Test 6: Error Recovery - Calendar API Failure

### **Objective:** Verify graceful handling when Google Calendar is unavailable

### **Setup:**
```bash
# Temporarily break Google Calendar credentials
cd backend
mv token.json token.json.backup
```

### **Steps:**
1. Call Twilio number
2. Say: **"I want to book a Botox appointment"**
3. AI will attempt `check_availability` → **should fail**
4. Listen to AI response

### **Pass Criteria:**
- [ ] AI says: "I'm having trouble accessing the calendar right now..."
- [ ] AI offers alternative: "Would you like me to take your information and have someone call you back?"
- [ ] **No crash or 500 error**
- [ ] WebSocket stays connected (customer can continue conversation)

### **Verification:**
- [ ] Error logged in backend logs with:
  - Log level: ERROR
  - Context: session_id, function_name, error_code
  - Full stack trace
- [ ] Conversation outcome: "escalated" or "failed" (not "booked")
- [ ] Admin dashboard shows conversation (didn't crash mid-call)

### **Cleanup:**
```bash
# Restore credentials
cd backend
mv token.json.backup token.json
```

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Test 7: OpenAI API Failure Simulation

### **Objective:** Verify retry logic works (manual code review since hard to simulate)

### **Steps:**
This is primarily a **code review** rather than live test:

1. Open `backend/analytics.py` line 198-289
2. Verify retry logic exists:
   - [ ] `max_retries = 3`
   - [ ] `timeout=30.0` on OpenAI call
   - [ ] Exponential backoff: `delay = base_delay * (2 ** attempt)`
   - [ ] Catches `RateLimitError`, `Timeout`, `APIError`
   - [ ] Falls back to neutral sentiment on failure

3. Check logs from recent calls:
   - [ ] Search for "OpenAI" in logs
   - [ ] Verify no unhandled exceptions
   - [ ] Verify sentiment analysis completes or falls back gracefully

### **Pass Criteria:**
- [ ] Code has proper retry logic (confirmed)
- [ ] No unhandled OpenAI exceptions in production logs
- [ ] Recent calls have sentiment scores (not all null)

### **Result:**
- [ ] ✅ PASS
- [ ] ❌ FAIL - Reason: ___________________

---

## Summary

### **Test Results:**
| Test | Status | Notes |
|------|--------|-------|
| 1. Standard Booking | ⬜ | |
| 2. Reschedule | ⬜ | |
| 3. No Availability | ⬜ | |
| 4. Provider Selection | ⬜ | |
| 5. SMS Booking | ⬜ | |
| 6. Calendar Failure | ⬜ | |
| 7. OpenAI Retry | ⬜ | |

### **Overall Result:**
- [ ] ✅ **ALL TESTS PASSED** - Ready for demo
- [ ] ⚠️ **SOME TESTS FAILED** - Review failures and fix
- [ ] ❌ **MULTIPLE CRITICAL FAILURES** - Not ready for demo

### **Critical Issues Found:**
1. ___________________
2. ___________________
3. ___________________

### **Non-Critical Issues:**
1. ___________________
2. ___________________

---

## Post-Test Actions

### **If All Tests Passed:**
- [ ] Document any edge cases discovered
- [ ] Note any timing delays (if AI responses feel slow)
- [ ] Verify all 7 appointments are visible in admin dashboard
- [ ] Delete test appointments from Google Calendar
- [ ] Move to load testing

### **If Tests Failed:**
- [ ] Create GitHub issues for each failure
- [ ] Prioritize: Demo-blocking vs. nice-to-fix
- [ ] Fix critical issues
- [ ] Re-run failed tests
- [ ] Don't proceed to load test until smoke tests pass

---

## Tips for Effective Testing

1. **Test in order** - Some tests depend on previous ones
2. **Take notes** - Write down exact AI responses for failures
3. **Check logs immediately** - If test fails, check backend logs right away
4. **Use real data** - Don't use fake phone numbers, it affects logging
5. **Test end-to-end** - Don't stop at "appointment created", verify it in dashboard too
6. **Time yourself** - If tests take too long, demo might feel slow

---

## Ready for Demo Checklist

After completing all 7 smoke tests:

- [ ] All tests passed (or non-critical failures documented)
- [ ] Response time feels fast (<2 seconds for AI to start speaking)
- [ ] No crashes or 500 errors
- [ ] Appointments appear in Google Calendar correctly
- [ ] Admin dashboard shows conversations with transcripts
- [ ] Error messages are friendly and actionable
- [ ] You feel confident demoing the system live

**If all checked: Proceed to load testing!**

