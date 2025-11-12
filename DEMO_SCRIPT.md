# Ava Demo Script for {{MED_SPA_NAME}}

> Target duration: 10–12 minutes

## Pre-Demo Checklist (5 minutes before)

- [ ] Backend running: `cd backend && source .venv/bin/activate && uvicorn main:app --reload`
- [ ] Admin dashboard running: `cd admin-dashboard && npm run dev`
- [ ] Browser tabs open:
  1. Voice interface – http://localhost:3000/voice
  2. Admin dashboard – http://localhost:3000
  3. Google Calendar – https://calendar.google.com (demo calendar)
- [ ] Microphone tested and unmuted
- [ ] Internet connection verified
- [ ] Phone silenced / notifications off (Do Not Disturb on)
- [ ] Demo data seeded today (`python scripts/seed_supabase.py --force`)

## Demo Flow

### 1. Opening Context (≈1 minute)

**Talking points**

- "Most med spas lose 15–20 hours/week answering phones or calling back missed leads."
- "Every missed call can cost $200–$500 in lost bookings."
- "Ava handles inbound calls, answers questions, and books appointments without interrupting treatments."

### 2. Live Voice Call (≈4 minutes)

1. Open voice interface tab, start the call.
2. Confirm Ava’s greeting and tone.
3. Run two scenarios (pick based on audience):
   - **Scenario A – New Botox client**
     - Prompt: "Hi, I’m interested in Botox for my forehead lines."
     - Provide fake details when asked: "Sarah Johnson, 555-123-4567, sarah@email.com"
     - Ask: "Do you take insurance?" and ensure new prompt guidance fires.
     - Book tomorrow at 2:00 PM.
   - **Scenario B – Price shopper**
     - Prompt: "How much does Botox cost?"
     - Follow-up: "Can I use my HSA?" / "Do you offer financing?"
     - Share interest but don’t schedule to showcase info-only path.
   - **Scenario C – Medical screening**
     - Prompt: "I’m on blood thinners—can I still do laser hair removal?"
     - Confirm Ava defers to consultation per medical screening rules.
4. End the call cleanly; highlight Ava’s closing recap and cancellation policy mention.

### 3. Calendar Sync (≈1 minute)

- Switch to Google Calendar tab.
- Refresh; point out the newly booked event matching the call details.
- Highlight zero manual data entry and synced service metadata in event description.

### 4. Dashboard Walkthrough (≈3 minutes)

- Navigate to dashboard tab.
- Show hero cards: total calls (~25 past two weeks), conversion (~60%), satisfaction (~8.2).
- Scroll recent sessions table; call out color-coded channel + sentiment badges.
- Open the call from the live demo:
  - Review transcript snippet, satisfaction score, outcome.
  - Note escalation markers if scenario triggered.
- Optional: show omnichannel messaging console with realistic seeded threads.

### 5. ROI Summary (≈1 minute)

**Talking points**

- "Ava costs $X/month, replacing ~0.5 FTE receptionist."
- "Handles 80–100 calls per month; even a few extra bookings cover the fee."
- "Consistent, professional experience even after hours."

### 6. Call to Action (≈1 minute)

- Offer a 2-week pilot: forward phones, load services/pricing, Ava trains on their tone.
- Weekly check-ins to review calls and fine-tune.
- Confirm next steps: calendar invite for onboarding, gather service menu.

## FAQ Cheat Sheet

| Question | Suggested Response |
| --- | --- |
| "What if Ava doesn’t understand someone?" | Ava politely asks for clarification, can switch to text/email, or take a message for staff. |
| "Can it handle reschedules/cancellations?" | Yes—Ava reads your live calendar and can reschedule or cancel within policy. |
| "How do we customize it for our spa?" | 30-minute onboarding: provide services, pricing, tone. We preload FAQs and policies (insurance, cancellation). |
| "What about medical emergencies?" | Ava listens for urgent keywords and escalates immediately to staff while logging the call. |
| "Does it integrate with our CRM?" | Today: Google Calendar + CSV export. Roadmap: direct integration once pilot validates. |

## Post-Demo Follow-Up

- Email recap with calendar booking + pricing one-pager.
- Share highlight reel (transcript snippet + satisfaction metrics).
- Schedule onboarding if green-lit.
