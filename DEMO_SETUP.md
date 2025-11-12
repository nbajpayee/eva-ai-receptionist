# Demo Environment Setup

## Environment Variables (.env)

Customize these for each prospect:

```bash
MED_SPA_NAME="Radiant Renewal Med Spa"
MED_SPA_PHONE="+1XXXYYYZZZZ"
MED_SPA_ADDRESS="123 Wellness Blvd, Suite 200, Your City"
MED_SPA_HOURS="Mon–Fri 9am–7pm, Sat 10am–4pm"
MED_SPA_EMAIL="hello@radiantrenewal.com"
GOOGLE_CALENDAR_ID="clinic-calendar@group.calendar.google.com"
OPENAI_API_KEY="sk-..."            # Confirm not expired
DATABASE_URL="postgresql://ava_user:ava_password@localhost:5432/ava_db"
```

Optional overrides:
- `OPENAI_MESSAGING_MODEL`, `OPENAI_SENTIMENT_MODEL` if testing offline.
- `MED_SPA_SERVICES_JSON` for bespoke pricing (if implemented).

## Local Services

1. **Postgres / Supabase**
   - Ensure database is running and accessible.
   - If using Docker: `docker-compose up db` (or leverage Supabase project).

2. **Python backend**
   ```bash
   cd backend
   source .venv/bin/activate
   pip install -r requirements.txt   # only if deps changed
   uvicorn main:app --reload
   ```

3. **Admin dashboard (Next.js)**
   ```bash
   cd admin-dashboard
   npm install      # once
   npm run dev
   ```

4. **Voice test interface**
   - Legacy static demo available under `frontend/`. Not required once dashboard voice console is used, but keep ready as fallback (`npm install --global serve && serve frontend`).

## Google Calendar Credentials

- Files required in `backend/`:
  - `credentials.json` (Desktop OAuth client, download from Google Cloud Console)
  - `token.json` (generated after running `python -c "from calendar_service import GoogleCalendarService; GoogleCalendarService()"` in the venv)
- Verify calendar ID matches `.env` before demo.

## Pre-Demo Validation (30 min before)

1. **Voice Flow Smoke Test**
   - Open http://localhost:3000/voice → Start Call.
   - Ask "What services do you offer?" and confirm natural response.
   - Hang up; ensure session closes cleanly.

2. **Calendar Check**
   ```bash
   cd backend
   source .venv/bin/activate
   python -c "from calendar_service import GoogleCalendarService; from datetime import datetime, timedelta; svc = GoogleCalendarService(); tomorrow = datetime.now() + timedelta(days=1); print(svc.get_available_slots(tomorrow, 'Botox')[:3])"
   ```
   - Should print upcoming slots.

3. **Seed Data Refresh**
   ```bash
   python scripts/seed_supabase.py --force
   ```
   - Expected output: "✅ Supabase seeded with 26 call sessions…"

4. **Dashboard Metrics Spot-Check**
   - Visit http://localhost:3000
   - Confirm hero cards show ~25 calls, ~60% conversion, ~8.2 satisfaction.
   - Open a few sessions; verify transcripts + sentiment coloring.

5. **Messaging Console (optional)**
   - Browse omnichannel inbox, ensure seeded email/SMS threads look realistic.

## Demo Day Setup Tips

- Close non-essential apps; enable Do Not Disturb.
- Use Chrome or Edge (Safari occasionally blocks WebRTC permissions).
- Have headphones + mic ready; test audio levels.
- Keep Google Calendar tab preloaded and filtered to the demo calendar.
- Printed/second-screen copy of `DEMO_SCRIPT.md` for quick prompts.
- Water nearby—lots of speaking.

## Troubleshooting Cheatsheet

| Issue | Quick Fix |
| --- | --- |
| Voice UI says "Microphone access denied" | Refresh and allow mic permissions; check System Preferences > Privacy > Microphone. |
| Calendar booking fails | Re-auth: `python -c "from calendar_service import GoogleCalendarService; GoogleCalendarService()"`, ensure token.json regenerates. |
| Dashboard empty | Rerun seed script, confirm DATABASE_URL points to demo DB. |
| OpenAI errors | Verify `OPENAI_API_KEY`, check rate limits, fall back to canned messaging (`settings.DEBUG=True`). |
| Next.js 500s | Restart `npm run dev`, clear `.next/` if needed. |

## Post-Demo Cleanup

- Remove test appointments from calendar.
- Reset seeded data if prospect wants custom info.
- Rotate API key if demo environment shared externally.
