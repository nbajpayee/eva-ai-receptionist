# Monitoring Dashboard Guide for Production Demo

**Purpose:** Understand how to monitor your Eva backend during load testing and live demos.

**Time Required:** 15 minutes to set up, continuous monitoring during demo

---

## Quick Reference: What to Monitor

| Metric | Green Zone | Yellow Zone | Red Zone | Where to Check |
|--------|-----------|-------------|----------|----------------|
| **CPU Usage** | < 60% | 60-80% | > 80% | Hosting dashboard |
| **Memory Usage** | < 70% | 70-85% | > 85% | Hosting dashboard |
| **Response Time** | < 500ms | 500ms-2s | > 2s | Application logs |
| **Error Rate** | < 1% | 1-5% | > 5% | Error tracking |
| **DB Connections** | < 80% of pool | 80-95% | > 95% | Supabase dashboard |
| **WebSocket Sessions** | < 50 concurrent | 50-100 | > 100 | Application logs |

---

## Pre-Demo Monitoring Checklist

### **1. Verify Health Endpoints (5 minutes)**

**Step 1: Test liveness probe**
```bash
# Should return {"status": "ok"} immediately
curl https://api.getevaai.com/health/live

# Expected output:
{"status":"ok"}
```

**Step 2: Test readiness probe**
```bash
# Should return {"status": "ready", "database": "connected"}
curl https://api.getevaai.com/health/ready

# Expected output:
{"status":"ready","database":"connected"}

# If database is down:
{"status":"not_ready","database":"disconnected","error":"Connection refused"}
```

**Step 3: Set up monitoring dashboard bookmark**

Create a bookmark folder with these URLs for quick access during demo:

```
📁 Eva Monitoring (Demo Day)
  ├─ 🚂 Railway Logs: https://railway.app/project/{PROJECT_ID}/service/{SERVICE_ID}/logs
  ├─ 🗄️ Supabase Dashboard: https://supabase.com/dashboard/project/{PROJECT_ID}/database/tables
  ├─ 📊 Admin Dashboard: https://dashboard.getevaai.com
  └─ 🩺 Health Check: https://api.getevaai.com/health/ready
```

---

## Platform-Specific Monitoring

### **Railway (Recommended for FastAPI)**

**Accessing Logs:**
1. Go to Railway dashboard: https://railway.app
2. Select your project → backend service
3. Click "Deployments" → Latest deployment
4. Click "View Logs"

**What to Look For:**
```bash
# Good signs (normal operation):
INFO - 172.18.0.1:58392 - "GET /health/ready HTTP/1.1" 200 OK
INFO - WebSocket connection established for session abc-123
INFO - Call session xyz-789 ended successfully

# Warning signs (investigate but not critical):
WARNING - OpenAI rate limit hit, retrying in 2 seconds (attempt 2/3)
WARNING - High DB connection pool usage: 45/50 connections

# Bad signs (immediate attention needed):
ERROR - Unhandled exception: NoneType object has no attribute 'customer_id'
ERROR - Google Calendar API error during check_availability: HTTP 500
CRITICAL - Database connection pool exhausted (50/50 active)
```

**Monitoring Metrics:**
- Click "Metrics" tab in Railway dashboard
- Key metrics:
  - **CPU Usage**: Should stay below 80% during load test
  - **Memory**: Should stabilize (not grow unbounded)
  - **Network**: Spikes are normal during active calls

**Setting Up Alerts (5 minutes):**
1. Railway dashboard → Service → Settings → Alerts
2. Add alert for:
   - CPU > 85% for 5 minutes
   - Memory > 90% for 5 minutes
   - Service crash/restart
3. Configure notification: Email or Slack webhook

---

### **Render (Alternative to Railway)**

**Accessing Logs:**
1. Render dashboard: https://dashboard.render.com
2. Select your web service
3. Click "Logs" tab
4. Use log level filter: ERROR, WARNING, INFO

**Monitoring Metrics:**
1. Click "Metrics" tab
2. Key charts:
   - **CPU**: Should be < 80%
   - **Memory**: Check for memory leaks (ever-growing line)
   - **Response Time (P95)**: Should be < 2 seconds

**Health Check Configuration:**
1. Service → Settings → Health Check Path
2. Set to: `/health/ready`
3. Health check interval: 30 seconds
4. Unhealthy threshold: 3 consecutive failures

---

### **Supabase (Database Monitoring)**

**Accessing Dashboard:**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to "Database" → "Database" (left sidebar)

**Key Metrics to Watch:**

**1. Database Connections (Critical):**
- Location: Database → Settings → Connection Pooling
- Free tier limit: 20 connections
- Pro tier limit: 100+ connections
- **Warning if connections > 80% of limit**

**How to Check Current Connections:**
```sql
-- Run this in SQL Editor
SELECT count(*) AS current_connections
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Expected during load test (50 concurrent calls):
-- ~15-30 connections (depends on pool configuration)
```

**2. Query Performance:**
- Location: Database → Reports → Slow Queries
- Check if any queries take > 1 second
- Most common slow query: Complex joins in analytics

**3. Storage Usage:**
- Location: Database → Database → Table Sizes
- Monitor growth rate during load test
- Expected: ~1KB per call session

**4. Real-Time Activity:**
- Location: Database → Database → Logs
- Watch for errors during booking/scheduling
- Common errors to ignore:
  - `relation "spatial_ref_sys" does not exist` (PostGIS, safe to ignore)

---

## Application-Level Monitoring

### **Viewing Backend Logs**

**Good Log Examples (What Success Looks Like):**
```
2025-11-27 10:15:23 - main - INFO - [main.py:145] - WebSocket connection established for session voice-abc-123
2025-11-27 10:15:25 - realtime_client - INFO - [realtime_client.py:89] - Sent greeting for session voice-abc-123
2025-11-27 10:15:45 - realtime_client - INFO - [realtime_client.py:438] - check_availability called: date=2025-11-28, service=Botox
2025-11-27 10:15:46 - calendar_service - INFO - [calendar_service.py:112] - Found 5 available slots for Botox on 2025-11-28
2025-11-27 10:16:10 - realtime_client - INFO - [realtime_client.py:512] - book_appointment called for customer_name=John Smith
2025-11-27 10:16:12 - calendar_service - INFO - [calendar_service.py:203] - Created appointment abc-xyz-789
2025-11-27 10:16:15 - analytics - INFO - [analytics.py:89] - Call session ended: satisfaction=8.5, sentiment=positive
```

**Bad Log Examples (What Problems Look Like):**
```
# Critical: Database connection pool exhausted
ERROR - [database.py:45] - FATAL: remaining connection slots are reserved for non-replication superuser connections
→ Action: Reduce concurrent load or increase connection pool size

# Critical: Unhandled exception (global exception handler caught it)
ERROR - Unhandled exception: GET /api/admin/metrics/overview
ERROR - KeyError: 'total_calls'
→ Action: Check if database seed script ran successfully

# Warning: Google Calendar API failure
ERROR - Google Calendar API error during check_availability: HTTP 429
ERROR - Rate limit exceeded for calendar API
→ Action: Implement exponential backoff (already done in P0 implementation)

# Warning: OpenAI retry exhausted
WARNING - OpenAI rate limit hit, retrying in 4 seconds (attempt 3/3)
ERROR - OpenAI rate limit exceeded after 3 retries
→ Action: Check OpenAI API quota/billing, or reduce concurrent calls

# Info: Normal disconnects (not errors)
INFO - WebSocket disconnected for session voice-abc-123: 1000 (normal closure)
→ Action: None (expected behavior)
```

---

## During Load Test Monitoring

### **Before Starting Load Test**

**Pre-Flight Checklist:**
```bash
# 1. Verify backend is healthy
curl https://api.getevaai.com/health/ready

# 2. Check current database connections (should be near 0)
# Run in Supabase SQL Editor:
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';

# 3. Note baseline metrics (write these down)
# - CPU: _____% (should be ~5-10% at idle)
# - Memory: _____MB (should be ~200-500MB at idle)
# - Active connections: _____ (should be 1-3)
```

### **During Load Test (Monitor Every 30 Seconds)**

**Run Load Test:**
```bash
# Start load test in one terminal
cd backend
python tests/load/test_concurrent_calls.py --calls 50 --url wss://api.getevaai.com

# Keep these tabs open:
# Tab 1: Railway logs (live tail)
# Tab 2: Supabase dashboard (database connections)
# Tab 3: Load test output
```

**What to Watch (Real-Time):**

**Minute 0-1 (Ramp-up):**
- Railway logs: Should see 50x "WebSocket connection established" messages
- CPU: Spike to 40-60% (normal)
- Memory: Gradual increase (normal)
- Database connections: Should increase from ~3 to ~20-40

**Minute 1-2 (Steady State):**
- CPU: Should stabilize at 50-70%
- Memory: Should level off (not continuously growing)
- Response times: Check load test output for "Timeout" errors
- Error logs: Should be minimal (< 5% failure rate)

**Minute 2-3 (Wind-down):**
- WebSocket disconnects: Should see 50x "WebSocket disconnected" messages
- CPU: Should drop back to ~10-20%
- Database connections: Should return to baseline (3-5)

**Success Criteria:**
```
✅ PASS if:
- Load test reports > 90% success rate
- No CRITICAL or ERROR logs (except expected OpenAI retries)
- CPU peaked < 80%
- Memory stabilized (no unbounded growth)
- Database connections returned to baseline after test

❌ FAIL if:
- Success rate < 90%
- Multiple "Database connection pool exhausted" errors
- CPU sustained > 90% (indicates CPU-bound bottleneck)
- Memory continuously growing (memory leak)
- Database connections stuck high after test ends
```

---

## During Live Demo Monitoring

### **Setup (5 Minutes Before Demo)**

**1. Open Monitoring Tabs:**
```
Tab 1: Railway logs (live tail, filter: ERROR, WARNING)
Tab 2: Supabase dashboard → Database → Logs
Tab 3: Admin dashboard → Live Calls (if implemented)
Tab 4: Health check URL (auto-refresh every 10s)
```

**2. Set Up Auto-Refresh for Health Check:**
```html
<!-- Bookmark this URL or use browser extension -->
https://api.getevaai.com/health/ready

<!-- Browser console (run once):
setInterval(() => location.reload(), 10000);  // Refresh every 10s
-->
```

**3. Prepare Backup Plan:**
```
IF service goes down during demo:
1. Check Railway logs for error message
2. Check Supabase dashboard for database status
3. If database down → Show pre-recorded demo video
4. If backend down → Restart Railway service (takes ~30 seconds)
5. If Calendar API down → "We're experiencing high demand, let me take your info manually"
```

### **What to Watch During Demo**

**Critical (Must Monitor):**
- Railway logs ERROR level (should be zero during demo)
- Health check status (must return 200 OK)
- Supabase connection count (should be < 50% of limit)

**Nice to Have (Glance Occasionally):**
- CPU usage (should be < 50% for single call)
- Response latency in logs (should be < 2s)
- Admin dashboard live calls view

**Red Flags (Stop Demo Immediately):**
```
🚨 CRITICAL ISSUES:
- Health check returns 503 Service Unavailable
- Railway logs show "Database connection pool exhausted"
- Multiple ERROR logs in 30-second window
- Supabase dashboard shows "Connection failed"

⚠️ WARNING ISSUES (Can Continue Demo):
- Single ERROR log (might be transient)
- CPU spike to 80% (single call shouldn't cause this, but not fatal)
- OpenAI retry warnings (retry logic will handle it)
```

---

## Post-Demo Health Check

**After demo completes, verify system returned to normal:**

```bash
# 1. Check health endpoint
curl https://api.getevaai.com/health/ready
# Expected: {"status":"ready","database":"connected"}

# 2. Check active connections (Supabase SQL Editor)
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';
# Expected: 1-5 connections

# 3. Check recent errors (Railway logs, last 5 minutes)
# Filter: ERROR level
# Expected: 0 errors (or only expected OpenAI retries)

# 4. Verify test appointment created (Admin dashboard)
# Navigate to: https://dashboard.getevaai.com/appointments
# Expected: See appointment from demo call

# 5. Check Google Calendar
# Expected: Event exists with correct time/service/customer
```

---

## Common Issues & Troubleshooting

### **Issue 1: High CPU Usage (> 80%)**

**Symptoms:**
- Railway metrics show sustained CPU > 80%
- Slow response times in logs
- Load test reports timeouts

**Diagnosis:**
```bash
# Check number of active WebSocket sessions
# Look in Railway logs for count of:
grep "WebSocket connection established" | wc -l
grep "WebSocket disconnected" | wc -l

# If established >> disconnected, sessions aren't closing properly
```

**Solutions:**
1. **Short-term (Demo Day):** Reduce concurrent calls in load test (try 25 instead of 50)
2. **Medium-term (After Demo):** Upgrade Railway plan for more CPU cores
3. **Long-term (P1):** Profile code to find CPU bottlenecks (likely audio processing)

---

### **Issue 2: Database Connection Pool Exhausted**

**Symptoms:**
```
ERROR - FATAL: remaining connection slots are reserved for non-replication superuser connections
```

**Diagnosis:**
```sql
-- Run in Supabase SQL Editor to see active connections
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  state_change
FROM pg_stat_activity
WHERE datname = 'postgres'
ORDER BY state_change DESC;
```

**Solutions:**
1. **Immediate (During Demo):** Restart Railway service to clear stuck connections
2. **Short-term:** Increase `SQLALCHEMY_POOL_SIZE` in config.py (current: 20, try: 30)
3. **Long-term (P1):** Implement connection pooling with PgBouncer

**Configuration Change:**
```python
# In backend/config.py
class Settings(BaseSettings):
    SQLALCHEMY_POOL_SIZE: int = 30  # Increase from 20
    SQLALCHEMY_MAX_OVERFLOW: int = 10  # Allow temporary burst
```

---

### **Issue 3: Memory Leak (Ever-Growing Memory)**

**Symptoms:**
- Railway memory graph shows continuous upward slope
- Memory doesn't return to baseline after load test
- Eventually crashes with OOM (Out of Memory)

**Diagnosis:**
```bash
# Run load test and watch Railway memory metric
# If memory grows from 200MB → 500MB → 800MB → crash
# = Memory leak
```

**Solutions:**
1. **Immediate:** Restart Railway service before demo
2. **Investigation (After Demo):** Add memory profiling with `memory_profiler`
3. **Likely Culprit:** WebSocket sessions not properly closing, check `realtime_client.py` cleanup

---

### **Issue 4: 500 Errors in Admin Dashboard**

**Symptoms:**
- Admin dashboard shows "Failed to load metrics"
- Railway logs show ERROR: KeyError or AttributeError

**Diagnosis:**
```bash
# Check Railway logs for admin API errors
# Look for: "GET /api/admin/metrics/overview HTTP/1.1" 500
```

**Solutions:**
1. **Verify database seeded:** `python backend/scripts/seed_supabase.py --force`
2. **Check schema exists:** `python backend/scripts/create_supabase_schema.py`
3. **Verify environment variables:** Check Railway dashboard → Variables → `DATABASE_URL` is set

---

## Monitoring Command Reference

### **Quick Health Check**
```bash
# Full system health check (run before demo)
curl https://api.getevaai.com/health/ready && \
echo "\n✅ Backend healthy" || \
echo "\n❌ Backend unhealthy"

# Check if WebSocket endpoint is accessible
wscat -c wss://api.getevaai.com/ws/voice/test-123
# Expected: Connection established, receive greeting
```

### **Database Connection Check**
```sql
-- Run in Supabase SQL Editor

-- Current connection count
SELECT count(*) AS active_connections
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Connection details (who's connected)
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND state = 'active'
ORDER BY query_start DESC;
```

### **Recent Errors Check**
```bash
# In Railway logs, filter by ERROR level and last 1 hour
# Look for patterns:
grep "ERROR" | tail -20

# Count errors by type
grep "ERROR" | cut -d'-' -f4 | sort | uniq -c | sort -rn

# Example output:
#   15 OpenAI rate limit hit
#    3 Google Calendar API error
#    1 Unhandled exception
```

---

## Alerting Setup (Optional but Recommended)

### **Sentry Error Tracking (15 minutes)**

If you want real-time error notifications:

**1. Sign up for Sentry:**
- Go to: https://sentry.io
- Create project: "Eva Backend"
- Copy DSN

**2. Install Sentry SDK:**
```bash
cd backend
pip install sentry-sdk[fastapi]
echo "sentry-sdk[fastapi]" >> requirements.txt
```

**3. Add to backend/main.py:**
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

# Add after imports, before app creation
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,  # 10% of requests for performance monitoring
        environment="production",  # or "staging"
    )
```

**4. Add to .env:**
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**5. Configure Alerts:**
- Sentry dashboard → Alerts → Create Alert
- Trigger: "When an event is seen more than 5 times in 1 minute"
- Action: Email or Slack notification

---

## Summary: Monitoring Checklist

### **Before Demo (30 minutes):**
- [ ] Test `/health/ready` endpoint
- [ ] Open Railway logs tab (live tail, filter ERROR)
- [ ] Open Supabase dashboard (database connections view)
- [ ] Run load test to verify 90%+ success rate
- [ ] Bookmark all monitoring URLs
- [ ] Set up error alerts (Sentry or Railway)
- [ ] Write down baseline metrics (CPU, memory, connections)

### **During Demo (Continuous):**
- [ ] Glance at Railway logs (ERROR level) every 2 minutes
- [ ] Check health endpoint status (auto-refresh)
- [ ] Monitor CPU/memory in Railway metrics
- [ ] Have backup plan ready (pre-recorded video or manual booking)

### **After Demo (10 minutes):**
- [ ] Verify health check returns 200 OK
- [ ] Check database connections returned to baseline
- [ ] Review Railway logs for any missed errors
- [ ] Verify demo appointment created in calendar
- [ ] Document any issues for post-demo retrospective

---

## Key Metrics Summary

| What to Monitor | Tool | Threshold | Action if Exceeded |
|----------------|------|-----------|-------------------|
| Health Check | `curl /health/ready` | Must return 200 | Restart Railway service |
| CPU Usage | Railway Metrics | < 80% sustained | Reduce load or upgrade plan |
| Memory | Railway Metrics | < 85% | Restart service, investigate leak |
| DB Connections | Supabase SQL | < 80% of pool size | Increase pool size or add PgBouncer |
| Error Rate | Railway Logs | < 1% of requests | Investigate errors, fix root cause |
| Response Time | Application Logs | < 2s average | Profile slow queries, optimize |

---

## Emergency Contacts (Fill This Out)

```
Primary On-Call:
  Name: ___________________
  Phone: ___________________
  Role: Backend engineer

Secondary On-Call:
  Name: ___________________
  Phone: ___________________
  Role: DevOps/Infrastructure

Escalation (if both unavailable):
  Name: ___________________
  Phone: ___________________
  Role: Engineering manager

Important URLs:
  Railway Dashboard: https://railway.app/project/_____
  Supabase Dashboard: https://supabase.com/dashboard/project/_____
  Sentry Dashboard: https://sentry.io/organizations/_____/issues/
  Admin Dashboard: https://dashboard.getevaai.com
  Google Calendar: https://calendar.google.com/calendar/u/0/r
```

---

**You're now ready to monitor Eva during load testing and live demos!** 🎉

**Next Steps:**
1. Fill out DEPLOYMENT_CONTEXT.md (if not done yet)
2. Run SMOKE_TEST_CHECKLIST.md tests
3. Run load test while monitoring metrics
4. Set up error alerts (Sentry recommended)
5. Bookmark all monitoring URLs for quick access on demo day
