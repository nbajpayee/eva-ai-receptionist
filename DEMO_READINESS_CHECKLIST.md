# Eva Demo Readiness Checklist

**Purpose:** Final verification checklist before production demo.

**Your Deployment:**
- **Backend:** Railway (https://api.getevaai.com)
- **Database:** Supabase PostgreSQL
- **Admin Dashboard:** https://dashboard.getevaai.com

**Status:** All P0 coding tasks complete ✅ - Now complete remaining operational tasks.

---

## Quick Status Check

Run these commands to verify your current readiness:

```bash
# 1. Backend health check
curl https://api.getevaai.com/health/ready
# Expected: {"status":"ready","database":"connected"}

# 2. Quick connectivity test (30 seconds)
cd backend
python tests/load/test_concurrent_calls.py --quick --url wss://api.getevaai.com
# Expected: ✅ SUCCESS: WebSocket connection working

# 3. Data integrity check (1 minute)
python scripts/verify_backups.py --skip-supabase
# Expected: ✅ PASS: Database has data and appears healthy
```

**If all 3 commands pass:** You're 80% ready for demo! Continue with remaining tasks below.

**If any fail:** Review the error messages and consult the relevant guide (MONITORING_GUIDE.md or LOAD_TEST_GUIDE.md).

---

## P0 Tasks: Demo Readiness (Complete Before Demo)

### ✅ **Completed (7/7 Coding Tasks)**

These were implemented from PRE_PILOT_CHECKLIST.md:

- [x] LOG_LEVEL environment variable (backend/config.py)
- [x] Global exception handler (backend/main.py)
- [x] Disabled schema upgrades (backend/database.py)
- [x] Enhanced Google Calendar error handling (backend/realtime_client.py)
- [x] OpenAI API retry logic (backend/analytics.py)
- [x] Load test script (backend/tests/load/test_concurrent_calls.py)
- [x] Dual-write validation script (backend/scripts/validate_dual_write.py)

### 🔲 **Remaining (6 Operational Tasks)**

**Time Required:** 5-7 hours total

#### **Task 1: Configure Railway Health Checks (15-30 minutes)**

**Why:** Ensure Railway automatically restarts backend if it crashes.

**Steps:**
1. Go to Railway dashboard: https://railway.app
2. Navigate to your Eva project → backend service
3. Click "Settings" tab
4. Find "Health Check" section
5. Configure:
   - **Path:** `/health/ready`
   - **Interval:** 30 seconds
   - **Timeout:** 10 seconds
   - **Unhealthy Threshold:** 3 failures
   - **Healthy Threshold:** 1 success
6. Click "Save"
7. Verify health check is working:
   ```bash
   # Watch Railway logs for health check requests:
   # Should see: GET /health/ready 200 OK every 30 seconds
   ```

**Verification:**
```bash
# In Railway dashboard, check Metrics tab
# Health check graph should show green (all checks passing)
```

**Done when:**
- [ ] Health check configured in Railway settings
- [ ] Health check graph shows green for 5+ minutes
- [ ] Railway logs show successful health checks every 30 seconds

---

#### **Task 2: Set Up Crash/Restart Alerts (15-30 minutes)**

**Why:** Get notified immediately if backend crashes during demo.

**Option A: Railway Notifications (Recommended)**

1. Railway dashboard → Project Settings → Notifications
2. Enable "Deploy Notifications"
3. Enable "Crash Notifications"
4. Add your email or Slack webhook
5. Test:
   - Railway dashboard → backend service → Manual restart
   - Verify you receive notification

**Option B: Sentry Error Tracking (Advanced)**

```bash
# 1. Sign up: https://sentry.io (free tier is fine)
# 2. Create project: "Eva Backend"
# 3. Copy DSN

# 4. Install Sentry SDK
cd backend
pip install sentry-sdk[fastapi]

# 5. Add to .env:
echo "SENTRY_DSN=https://your-dsn@sentry.io/project-id" >> .env

# 6. Add to backend/main.py (after imports):
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment="production",
    )

# 7. Deploy to Railway
# 8. Test: Trigger error and verify Sentry receives it
```

**Done when:**
- [ ] Crash notifications configured
- [ ] Test notification received successfully
- [ ] Contact email/Slack verified

---

#### **Task 3: Verify Database Backups (30 minutes)**

**Why:** Ensure you can recover data if something goes wrong.

**Steps:**

1. **Check Supabase automatic backups:**
   ```bash
   # Run verification script:
   python backend/scripts/verify_backups.py --verbose

   # Then manually verify in Supabase dashboard:
   # 1. Go to: https://supabase.com/dashboard
   # 2. Select your Eva project
   # 3. Navigate to: Database → Backups
   # 4. Verify backups exist from last 7 days
   # 5. Note most recent backup timestamp
   ```

2. **Check Supabase plan tier:**
   - Supabase dashboard → Settings → Billing
   - **Free tier:** NO automatic backups (must create manual backups)
   - **Pro tier ($25/mo):** Daily backups, 7-day retention ✅
   - **Team/Enterprise:** Longer retention ✅

3. **If on Free tier, create manual backup:**
   ```bash
   # Install PostgreSQL client tools first:
   # macOS: brew install postgresql
   # Ubuntu: sudo apt-get install postgresql-client

   # Create backup:
   python backend/scripts/verify_backups.py --create-backup --verbose

   # Verify backup file created:
   ls -lh backups/
   # Expected: eva_backup_YYYYMMDD_HHMMSS.sql.gz
   ```

4. **Document restore procedure:**
   ```bash
   # Test restore procedure (dry-run, no actual restore):
   python backend/scripts/verify_backups.py --test-restore --verbose

   # Read the restore steps printed by the script
   # Ensure you understand how to restore if needed
   ```

**Done when:**
- [ ] Verified backups exist in Supabase dashboard (or manual backup created)
- [ ] Most recent backup is < 24 hours old
- [ ] Restore procedure documented and understood
- [ ] Backup verification script runs without errors

---

#### **Task 4: Run Golden Path Smoke Tests (2-3 hours)**

**Why:** Verify all critical user flows work end-to-end.

**Steps:**

Follow SMOKE_TEST_CHECKLIST.md for detailed instructions.

**Quick Reference (7 tests):**

1. ✅ **Standard Voice Booking** (10 min)
   - Call Twilio number, book Botox for tomorrow 2 PM
   - Verify appointment in Google Calendar
   - Check admin dashboard shows conversation

2. ✅ **Reschedule Existing Appointment** (5 min)
   - Call again, ask to reschedule to Thursday 4 PM
   - Verify calendar updated (not duplicate)

3. ✅ **No Availability Graceful Degradation** (5 min)
   - Request fully booked date
   - Verify AI offers alternative times (not lies)

4. ✅ **Provider Selection** (5 min)
   - Request appointment with specific provider (Priya)
   - Verify booking works

5. ✅ **SMS Booking** (10 min)
   - Send SMS to Twilio number
   - Book appointment via SMS thread
   - Verify same booking logic as voice

6. ✅ **Calendar API Failure** (10 min)
   - Temporarily break Google Calendar credentials
   - Verify graceful error message (no crash)

7. ✅ **OpenAI API Retry** (5 min)
   - Code review: Verify retry logic exists
   - Check logs for successful retries

**Done when:**
- [ ] All 7 tests passed
- [ ] Results documented in SMOKE_TEST_CHECKLIST.md summary table
- [ ] Any failures fixed and re-tested

---

#### **Task 5: Run Load Test (2-3 hours)**

**Why:** Verify system can handle concurrent calls during demo.

**Steps:**

Follow LOAD_TEST_GUIDE.md for detailed instructions.

**Quick Reference:**

```bash
cd backend

# 1. Quick connectivity test (30 seconds)
python tests/load/test_concurrent_calls.py --quick --url wss://api.getevaai.com
# Expected: ✅ SUCCESS

# 2. Light load test (2 minutes)
python tests/load/test_concurrent_calls.py --calls 10 --url wss://api.getevaai.com
# Expected: 100% success rate

# 3. Full load test (5 minutes) - CRITICAL
python tests/load/test_concurrent_calls.py --calls 50 --url wss://api.getevaai.com
# Expected: > 90% success rate

# 4. Monitor during test:
# - Railway dashboard → Metrics (CPU, Memory)
# - Railway logs (filter: ERROR)
# - Supabase database connections
```

**Monitoring Checklist:**
- [ ] Railway logs open (live tail, ERROR filter)
- [ ] Railway metrics tab open (CPU/Memory graphs)
- [ ] Supabase SQL Editor ready (connection count query)
- [ ] Baseline metrics noted before test

**Success Criteria:**
- [ ] Full test (50 calls) achieved > 90% success rate
- [ ] No "Database connection pool exhausted" errors
- [ ] CPU peak < 85%
- [ ] Memory returned to baseline within 5 minutes
- [ ] Railway service stayed running (no crashes)

**If test fails:**
- Review LOAD_TEST_GUIDE.md troubleshooting section
- Common fixes:
  - Increase database connection pool size
  - Upgrade Railway plan for more CPU/memory
  - Reduce expected concurrent calls during demo

**Done when:**
- [ ] Load test passed (> 90% success rate)
- [ ] Results documented (save logs and screenshots)
- [ ] System capacity limits understood

---

#### **Task 6: Demo Day Preparation (30 minutes)**

**Why:** Be ready to monitor and respond if issues occur during demo.

**Setup Checklist:**

**1. Bookmark monitoring URLs:**
```
Create browser bookmark folder: "Eva Demo Monitoring"
├─ Railway Logs: https://railway.app/project/YOUR_PROJECT/service/YOUR_SERVICE/logs
├─ Railway Metrics: https://railway.app/project/YOUR_PROJECT/metrics
├─ Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT
├─ Admin Dashboard: https://dashboard.getevaai.com
├─ Health Check: https://api.getevaai.com/health/ready
└─ Google Calendar: https://calendar.google.com/calendar/u/0/r
```

**2. Open monitoring tabs (5 minutes before demo):**
- [ ] Railway logs (live tail, filter: ERROR + WARNING)
- [ ] Railway metrics (CPU, Memory graphs)
- [ ] Admin dashboard (live calls view if implemented)
- [ ] Google Calendar (to verify bookings appear)

**3. Prepare emergency runbook:**

```markdown
# Emergency Procedures During Demo

## Issue: Backend returns 503 (Service Unavailable)
Action: Restart Railway service (30 second downtime)
1. Railway dashboard → Deployments → Redeploy latest

## Issue: "Database connection pool exhausted"
Action: Restart backend to clear connections
1. Railway dashboard → Redeploy

## Issue: Google Calendar API fails
Action: Gracefully recover
1. Let AI handle with friendly error message
2. Offer to "take information and have someone call back"
3. Manually create appointment in Google Calendar after demo

## Issue: Multiple ERROR logs appearing
Action: Stop demo, switch to backup plan
1. Show pre-recorded demo video instead
2. Investigate errors after demo

## Backup Plan: Pre-recorded Video
Location: [URL to video]
Duration: [X minutes]
Covers: [Key features shown]
```

**4. Emergency contact list:**
```
Primary On-Call: [Your name]
  Phone: [Your phone]
  Role: Backend engineer

Escalation: [Manager/CTO]
  Phone: [Their phone]

Important Credentials:
  Railway: [Login email]
  Supabase: [Login email]
  Google Calendar: [Service account email]
```

**Done when:**
- [ ] All monitoring URLs bookmarked
- [ ] Emergency runbook created
- [ ] Contact list filled out
- [ ] Backup plan prepared (pre-recorded video recommended)

---

## Final Pre-Demo Verification (1 hour before demo)

Run this checklist 1 hour before your demo starts:

```bash
# 1. Backend health check
curl https://api.getevaai.com/health/ready
# Expected: {"status":"ready","database":"connected"}

# 2. Quick connectivity test
cd backend
python tests/load/test_concurrent_calls.py --quick --url wss://api.getevaai.com
# Expected: ✅ SUCCESS

# 3. Check Railway status
# Railway dashboard → Verify service is "Active" and green

# 4. Check Supabase status
# Supabase dashboard → Verify database is "Healthy"

# 5. Check recent errors
# Railway logs → Filter ERROR → Last 1 hour
# Expected: No errors (or only expected OpenAI retries)

# 6. Verify Google Calendar credentials
# Make a test booking via voice interface
# Verify appointment appears in Google Calendar

# 7. Clear test data
# Admin dashboard → Appointments → Delete test appointments
# Google Calendar → Delete test events
```

**All checks passed?** ✅ You're ready for demo!

**Any checks failed?** ⚠️ Review errors and fix before demo starts.

---

## During Demo: Monitoring Checklist

**Every 2-3 minutes during demo:**

- [ ] Glance at Railway logs (ERROR filter)
  - Expected: No errors
  - Red flag: Multiple ERROR logs appearing

- [ ] Check Railway CPU/Memory metrics
  - Expected: CPU < 50%, Memory stable
  - Red flag: CPU > 80% or Memory continuously growing

- [ ] Verify health check status
  - Expected: Green (all checks passing)
  - Red flag: Red (checks failing)

**If red flags appear:**
- Follow emergency runbook procedures
- If multiple issues, switch to backup plan (pre-recorded video)

---

## Post-Demo: Cleanup and Retrospective

**Immediate (right after demo):**

```bash
# 1. Verify system returned to normal
curl https://api.getevaai.com/health/ready

# 2. Check for any errors during demo
# Railway logs → Last 1 hour → Filter ERROR

# 3. Verify demo appointments created successfully
# Admin dashboard → Appointments
# Google Calendar → Check for demo events

# 4. Clean up demo data (optional)
# Delete test appointments from Google Calendar
# Mark demo calls in database if needed
```

**Within 24 hours:**

1. **Create demo retrospective document:**
   ```markdown
   # Demo Retrospective: [Date]

   ## What Went Well
   - [List successes]

   ## Issues Encountered
   - [List any problems]

   ## Action Items
   - [ ] Fix issue X (Priority: High)
   - [ ] Improve Y for next demo (Priority: Medium)
   - [ ] Consider Z enhancement (Priority: Low)

   ## Metrics
   - Demo duration: [X minutes]
   - Number of calls demonstrated: [N]
   - Success rate: [X%]
   - Attendees: [Names/count]
   ```

2. **Review Railway metrics for the demo timeframe:**
   - Note peak CPU and memory usage
   - Check for any spikes or anomalies
   - Verify system recovered to baseline

3. **Document lessons learned:**
   - What would you do differently next time?
   - What monitoring was most useful?
   - What emergency procedures should be updated?

---

## Overall Readiness Score

| Category | Status | Tasks Remaining |
|----------|--------|-----------------|
| **P0 Coding** | ✅ Complete | 0/7 |
| **Health Checks** | 🔲 Pending | 1/1 |
| **Alerts** | 🔲 Pending | 1/1 |
| **Backups** | 🔲 Pending | 1/1 |
| **Smoke Tests** | 🔲 Pending | 1/1 |
| **Load Tests** | 🔲 Pending | 1/1 |
| **Demo Prep** | 🔲 Pending | 1/1 |

**Total Remaining:** 6 tasks (5-7 hours estimated)

---

## Time Budget to Demo Day

| Task | Time | Can Skip? |
|------|------|-----------|
| Configure health checks | 15-30 min | ⚠️ Risky |
| Set up alerts | 15-30 min | ⚠️ Risky |
| Verify backups | 30 min | ⚠️ Risky |
| Run smoke tests | 2-3 hours | ❌ Critical |
| Run load test | 2-3 hours | ❌ Critical |
| Demo day prep | 30 min | ⚠️ Risky |
| **TOTAL** | **5-7 hours** | |

**Recommendation:** Allocate 1 full day (8 hours) to complete all tasks with buffer time for issues.

---

## Quick Decision Matrix

**Question: How much time do I have before demo?**

### **< 4 hours (Emergency):**
- ❌ Not ready for live demo
- ✅ Show pre-recorded demo instead
- ✅ Or reschedule demo for tomorrow
- Reason: Not enough time to complete smoke tests + load test

### **4-8 hours (Tight):**
- ✅ Can demo, but skip optional tasks
- ✅ MUST DO: Smoke tests (2-3 hours)
- ✅ MUST DO: Light load test (30 min, skip full load test)
- ✅ MUST DO: Demo prep (30 min)
- ⏭️ SKIP: Health checks configuration (Railway default is OK)
- ⏭️ SKIP: Alerts setup (monitor manually during demo)
- ⏭️ SKIP: Backup verification (assume Supabase backups work)

### **8-24 hours (Comfortable):**
- ✅ Complete all 6 remaining tasks
- ✅ Run full load test (50 concurrent calls)
- ✅ Configure all monitoring and alerts
- ✅ Buffer time for fixing any issues found

### **> 24 hours (Ideal):**
- ✅ Complete all tasks at relaxed pace
- ✅ Run multiple load test iterations
- ✅ Fix any issues and re-test
- ✅ Create backup plan (pre-recorded video)
- ✅ Practice demo flow multiple times

---

## Key Success Metrics

**For demo to be considered successful:**

✅ **Technical:**
- [ ] 90%+ uptime during demo
- [ ] All demonstrated features work as expected
- [ ] No exposed errors or stack traces to audience
- [ ] System responds within 2 seconds

✅ **Business:**
- [ ] Audience understands Eva's value proposition
- [ ] Key features demonstrated successfully
- [ ] Questions answered confidently
- [ ] Next steps identified (pilot timeline, pricing discussion, etc.)

---

## Resources

**Documentation Created:**
- `PRE_PILOT_CHECKLIST.md` - Comprehensive P0/P1/P2 checklist (reference only)
- `IMPLEMENTATION_SUMMARY.md` - What was coded and what remains
- `DEPLOYMENT_CONTEXT.md` - Deployment information questionnaire
- `SMOKE_TEST_CHECKLIST.md` - 7 golden path test scenarios
- `MONITORING_GUIDE.md` - Railway/Supabase monitoring guide
- `LOAD_TEST_GUIDE.md` - Load testing procedures and interpretation
- `DEMO_READINESS_CHECKLIST.md` - This file (final checklist)

**Scripts Created:**
- `backend/tests/load/test_concurrent_calls.py` - Load test script
- `backend/scripts/validate_dual_write.py` - Dual-write validation
- `backend/scripts/verify_backups.py` - Backup verification

**Code Changes Made:**
- `backend/config.py` - Added LOG_LEVEL setting
- `backend/main.py` - Logging + global exception handler
- `backend/database.py` - Disabled auto schema upgrades
- `backend/realtime_client.py` - Enhanced Calendar error handling
- `backend/analytics.py` - OpenAI retry logic with backoff
- `.env.example` - Added LOG_LEVEL example

---

## Getting Help

**If you encounter issues:**

1. **Check relevant guide:**
   - Health check issues → MONITORING_GUIDE.md
   - Load test failures → LOAD_TEST_GUIDE.md
   - Smoke test failures → SMOKE_TEST_CHECKLIST.md
   - Backup questions → Run `python backend/scripts/verify_backups.py --verbose`

2. **Check Railway logs:**
   ```bash
   # Railway dashboard → Logs → Filter ERROR
   # Look for stack traces and error messages
   ```

3. **Check this summary:**
   - IMPLEMENTATION_SUMMARY.md (what was implemented)
   - PRE_PILOT_CHECKLIST.md (comprehensive reference)

4. **Emergency: System down during demo:**
   - Railway dashboard → Redeploy latest deployment (30s downtime)
   - Or switch to backup plan (pre-recorded video)

---

## Confidence Level Assessment

**Before starting remaining tasks:** 60% ready

**After completing all 6 tasks:** 95% ready

**Why not 100%?** There's always risk with live demos:
- Network connectivity issues
- Third-party API downtime (OpenAI, Google Calendar)
- Unexpected edge cases

**Mitigation:**
- Have backup plan (pre-recorded video)
- Monitor closely during demo
- Practice demo flow multiple times
- Know emergency procedures

---

## Final Checklist

**Before you start working on remaining tasks:**
- [ ] Reviewed this entire document
- [ ] Understand time budget (5-7 hours total)
- [ ] Have access to Railway dashboard
- [ ] Have access to Supabase dashboard
- [ ] Confirmed demo date and time
- [ ] Calendared time blocks for each task

**Ready to proceed?** Start with Task 1 (Configure Railway Health Checks) and work through tasks 1-6 in order.

**Good luck with your demo!** 🚀

---

**Questions or Issues?**
- Review PRE_PILOT_CHECKLIST.md for detailed implementation notes
- Check IMPLEMENTATION_SUMMARY.md for what was already done
- All necessary scripts and documentation are now in place
