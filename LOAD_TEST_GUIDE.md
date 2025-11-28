# Load Testing Guide for Eva Voice AI

**Purpose:** Systematically test Eva's ability to handle concurrent voice calls before production demo.

**Time Required:** 2-3 hours (including analysis and fixes)

**Environment:** Run against **actual deployment** (https://api.getevaai.com)

---

## Quick Start

```bash
# 1. Quick connectivity test (30 seconds)
cd backend
python tests/load/test_concurrent_calls.py --quick --url wss://api.getevaai.com

# 2. Light load test (2 minutes)
python tests/load/test_concurrent_calls.py --calls 10 --url wss://api.getevaai.com

# 3. Full load test (5 minutes)
python tests/load/test_concurrent_calls.py --calls 50 --url wss://api.getevaai.com

# 4. Stress test (10 minutes) - only if light/full tests pass
python tests/load/test_concurrent_calls.py --calls 100 --duration 20 --url wss://api.getevaai.com
```

---

## Pre-Test Setup

### **1. Verify Prerequisites**

**Check backend is healthy:**
```bash
curl https://api.getevaai.com/health/ready
# Expected output:
# {"status":"ready","database":"connected"}

# If you get 503 or connection refused:
# - Check Railway dashboard to verify service is running
# - Check Railway logs for startup errors
```

**Check Railway project is running:**
1. Go to: https://railway.app
2. Navigate to your Eva project
3. Verify backend service shows "Active" status
4. Note current metrics:
   - CPU: Should be ~5-10% at idle
   - Memory: Should be ~200-500MB at idle

**Check Supabase database is accessible:**
1. Go to: https://supabase.com/dashboard
2. Select your Eva project
3. Navigate to Database → Tables
4. Verify you can see tables: `customers`, `appointments`, `call_sessions`, etc.

### **2. Install Dependencies**

```bash
cd backend

# Install websockets library (required for load test)
pip install websockets

# Verify installation
python -c "import websockets; print('✅ websockets installed')"
```

### **3. Set Up Monitoring (Highly Recommended)**

**Before running load tests, open these tabs:**

1. **Railway Logs** (live tail):
   - Railway dashboard → Your Project → backend service → Deployments → View Logs
   - Set filter to show ERROR and WARNING levels

2. **Railway Metrics**:
   - Railway dashboard → Metrics tab
   - Watch CPU and Memory graphs in real-time

3. **Supabase Database Connections**:
   - Supabase dashboard → Database → Database
   - SQL Editor → Run this query (refresh during test):
   ```sql
   SELECT count(*) AS active_connections
   FROM pg_stat_activity
   WHERE datname = 'postgres';
   ```

---

## Load Test Scenarios

### **Scenario 1: Quick Connectivity Test (30 seconds)**

**Purpose:** Verify load test script can connect to production WebSocket

**Command:**
```bash
python tests/load/test_concurrent_calls.py --quick --url wss://api.getevaai.com
```

**Expected Output:**
```
======================================================================
QUICK CONNECTIVITY TEST
Target: wss://api.getevaai.com
======================================================================

  Call   1: Connected, received greeting
  Call   1: Received AI response

✅ SUCCESS: WebSocket connection working
```

**What This Tests:**
- WebSocket endpoint is accessible
- SSL/TLS connection works (wss://)
- Server responds to audio chunks
- OpenAI Realtime API integration is working

**Pass Criteria:**
- ✅ Connection established within 10 seconds
- ✅ Greeting received from Ava
- ✅ AI response received after sending audio

**Troubleshooting:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Railway service down | Check Railway dashboard, restart service |
| `SSL: CERTIFICATE_VERIFY_FAILED` | SSL cert issue | Update Python's CA certificates: `pip install --upgrade certifi` |
| `Timeout waiting for greeting` | Backend slow or crashed | Check Railway logs for errors |
| `Timeout waiting for AI response` | OpenAI API issue | Check OpenAI API status page |

---

### **Scenario 2: Light Load Test (2 minutes)**

**Purpose:** Verify system can handle 10 concurrent calls without issues

**Command:**
```bash
python tests/load/test_concurrent_calls.py --calls 10 --url wss://api.getevaai.com
```

**Expected Output:**
```
======================================================================
LOAD TEST: 10 concurrent voice calls
Target: wss://api.getevaai.com
Call duration: 10 seconds
======================================================================

  Call   1: Connected, received greeting
  Call   2: Connected, received greeting
  ...
  Call  10: Connected, received greeting
  Call   1: Received AI response
  Call   2: Received AI response
  ...
  Call  10: Received AI response

======================================================================
LOAD TEST RESULTS:
  Total calls:     10
  Successful:      10 (100.0%)
  Failed:          0 (0.0%)
  Duration:        12.34s
  Calls/sec:       0.81
======================================================================

✅ PASS: 100.0% success rate (threshold: 90%)
```

**What to Monitor During Test:**

**Railway Metrics:**
- CPU: Should peak at ~30-50%
- Memory: Should increase by ~100-200MB, then stabilize

**Railway Logs:**
- Look for 10x "WebSocket connection established" messages
- Look for 10x "Call session ended" messages
- Should see NO ERROR level logs

**Supabase Connections:**
- Should increase from ~3 to ~10-15 connections
- Should return to baseline (~3) after test completes

**Pass Criteria:**
- ✅ 90%+ success rate (9-10 calls succeed)
- ✅ No ERROR logs in Railway (WARNING logs for OpenAI retries are OK)
- ✅ CPU stays below 80%
- ✅ Memory stabilizes (doesn't continuously grow)
- ✅ Database connections return to baseline after test

**Failure Investigation:**

If success rate < 90%:
```bash
# Check error breakdown in load test output
# Example:
ERROR BREAKDOWN:
    5x Timeout waiting for AI response
    2x WebSocket error: Connection reset by peer

# Then investigate in Railway logs:
# 1. Search for "Timeout" or "Connection reset"
# 2. Look for errors around the same timestamp
# 3. Check if OpenAI API was down (search for "OpenAI API error")
```

---

### **Scenario 3: Full Load Test (5 minutes)**

**Purpose:** Verify system can handle expected demo-day load (50 concurrent calls)

**Command:**
```bash
python tests/load/test_concurrent_calls.py --calls 50 --url wss://api.getevaai.com
```

**Expected Output:**
```
======================================================================
LOAD TEST: 50 concurrent voice calls
Target: wss://api.getevaai.com
Call duration: 10 seconds
======================================================================

  Call   1: Connected, received greeting
  Call   2: Connected, received greeting
  ...
  Call  50: Connected, received greeting

  [Progress updates as responses arrive]

======================================================================
LOAD TEST RESULTS:
  Total calls:     50
  Successful:      47 (94.0%)
  Failed:          3 (6.0%)
  Duration:        15.67s
  Calls/sec:       3.19
======================================================================

ERROR BREAKDOWN:
    2x Timeout waiting for AI response
    1x WebSocket error: Connection closed unexpectedly

======================================================================
✅ PASS: 94.0% success rate (threshold: 90%)
```

**What to Monitor During Test:**

**Minute 0-1 (Ramp-up):**
- Railway CPU: Will spike to 60-80% (normal)
- Railway Memory: Will increase by 300-500MB (normal)
- Railway Logs: Should see 50x "WebSocket connection established" bursts
- Supabase Connections: Will jump from ~3 to ~30-50

**Minute 1-2 (Steady State):**
- Railway CPU: Should stabilize at 60-75%
- Railway Memory: Should level off (not continuously growing)
- Railway Logs: Should see mix of "check_availability", "book_appointment" function calls
- Supabase Connections: Should stay steady at ~30-50

**Minute 2-3 (Wind-down):**
- Railway CPU: Should drop back to ~10-20%
- Railway Memory: Should drop by ~200-300MB (some retained for caching is normal)
- Railway Logs: Should see 50x "WebSocket disconnected" messages
- Supabase Connections: Should return to baseline (~3-5)

**Pass Criteria:**
- ✅ 90%+ success rate (45-50 calls succeed)
- ✅ No CRITICAL level logs in Railway
- ✅ ERROR logs < 5% of total log lines
- ✅ CPU peaked below 85%
- ✅ Memory returned to within 20% of baseline
- ✅ Database connections returned to baseline within 1 minute

**Red Flags (Immediate Investigation Required):**

```bash
# 🚨 CRITICAL: Database connection pool exhausted
ERROR - FATAL: remaining connection slots are reserved
→ Action: Increase connection pool size or add PgBouncer

# 🚨 CRITICAL: Memory leak detected
# Railway Memory graph shows continuous upward slope, never levels off
→ Action: Check for unclosed WebSocket connections in realtime_client.py

# 🚨 CRITICAL: CPU pinned at 100%
# Railway CPU graph flatlines at 100% for > 2 minutes
→ Action: Profile code for CPU bottleneck, likely audio processing

# ⚠️ WARNING: High error rate
ERROR BREAKDOWN:
   25x Timeout waiting for AI response
→ Action: Check OpenAI API status, verify API key has quota
```

---

### **Scenario 4: Stress Test (10 minutes) - OPTIONAL**

**⚠️ Only run this if Scenarios 1-3 all passed!**

**Purpose:** Find system breaking point (100 concurrent calls)

**Command:**
```bash
python tests/load/test_concurrent_calls.py --calls 100 --duration 20 --url wss://api.getevaai.com
```

**Expected Outcome:**
- Success rate may drop to 70-80% (acceptable for stress test)
- System should degrade gracefully (not crash)
- Railway should recover after test completes

**What This Tests:**
- System failure modes
- Resource limits (CPU, memory, database connections)
- Recovery behavior after overload

**Pass Criteria (More Lenient):**
- ✅ Success rate > 70%
- ✅ Railway service stays running (doesn't crash)
- ✅ System recovers to normal state within 2 minutes after test
- ✅ Error messages are graceful (not stack traces exposed to clients)

**If Stress Test Fails:**
- This is OK for MVP! You don't need to handle 100 concurrent calls for demo
- Document the failure threshold (e.g., "System handles up to 50 concurrent calls")
- Plan scaling improvements for P1 (add more Railway instances, load balancer)

---

## Interpreting Results

### **Success Metrics**

**Green Zone (System Ready for Demo):**
```
✅ Quick test: 100% success rate
✅ Light test (10 calls): 100% success rate
✅ Full test (50 calls): 90-100% success rate
✅ No database connection errors
✅ CPU < 80% sustained
✅ Memory returns to baseline after test
✅ Railway logs show < 5% ERROR level entries
```

**Yellow Zone (Needs Tuning, Can Demo with Caution):**
```
⚠️ Full test: 80-89% success rate
⚠️ Some "Timeout waiting for AI response" errors (OpenAI rate limiting)
⚠️ CPU spikes to 85-95% during peak load
⚠️ Memory drops to 80% of baseline after test (some leak)
⚠️ Railway logs show 5-10% ERROR level entries

Action Items:
1. Reduce expected demo load (plan for < 30 concurrent calls)
2. Monitor closely during demo with Railway logs open
3. Have backup plan (pre-recorded demo video)
4. Fix issues after demo in P1
```

**Red Zone (Not Ready for Demo):**
```
❌ Full test: < 80% success rate
❌ "Database connection pool exhausted" errors
❌ Railway service crashes during test
❌ Memory leak (memory never returns to baseline)
❌ CPU sustained > 95% (system unresponsive)
❌ Railway logs show > 15% ERROR level entries

Action Required:
1. DO NOT proceed to demo
2. Investigate root cause (see troubleshooting section)
3. Fix critical issues
4. Re-run load tests until passing
```

### **Performance Targets**

| Metric | Target | Acceptable | Unacceptable |
|--------|--------|-----------|--------------|
| **Success Rate** | > 95% | 90-95% | < 90% |
| **Response Latency (P95)** | < 1s | 1-2s | > 2s |
| **CPU Usage (Peak)** | < 70% | 70-85% | > 85% |
| **Memory Growth** | < 10% | 10-20% | > 20% |
| **DB Connections (Peak)** | < 60% of pool | 60-80% | > 80% |
| **Error Rate** | < 1% | 1-5% | > 5% |

---

## Troubleshooting Common Issues

### **Issue 1: High Failure Rate (< 90% success)**

**Symptoms:**
```
LOAD TEST RESULTS:
  Total calls:     50
  Successful:      35 (70.0%)
  Failed:          15 (30.0%)

ERROR BREAKDOWN:
   10x Timeout waiting for AI response
    5x WebSocket error: Connection reset by peer
```

**Diagnosis Steps:**

**Step 1: Check OpenAI API status**
```bash
# Visit: https://status.openai.com
# Look for incidents with Realtime API or Assistants API

# Check Railway logs for OpenAI errors:
# Search for: "OpenAI API error"
```

**Step 2: Check Railway resource limits**
```bash
# In Railway dashboard → Metrics:
# - If CPU is at 100% → CPU bottleneck
# - If Memory is at limit → OOM kills
# - If Network is maxed → Bandwidth throttling
```

**Step 3: Check database connection pool**
```sql
-- Run in Supabase SQL Editor during failed test:
SELECT count(*) FROM pg_stat_activity WHERE datname = 'postgres';

-- If count > 90% of your pool size:
-- → Database connection pool exhausted
```

**Solutions (Priority Order):**

1. **If OpenAI API is down:** Wait for OpenAI to resolve, or test against staging environment

2. **If CPU bottleneck:**
   ```bash
   # Short-term: Upgrade Railway plan (more CPU cores)
   # Railway dashboard → Settings → Change Plan

   # Long-term: Profile code to find bottleneck
   # Add to backend/main.py:
   import cProfile
   # Profile slow endpoints
   ```

3. **If database connection pool exhausted:**
   ```python
   # In backend/config.py, increase pool size:
   class Settings(BaseSettings):
       SQLALCHEMY_POOL_SIZE: int = 50  # Increase from 20
       SQLALCHEMY_MAX_OVERFLOW: int = 20  # Allow burst capacity

   # Then redeploy to Railway
   ```

4. **If memory limit:**
   ```bash
   # Upgrade Railway plan for more memory
   # OR
   # Check for memory leaks in realtime_client.py
   # Verify WebSocket cleanup in finally block
   ```

---

### **Issue 2: "Timeout waiting for AI response"**

**Symptoms:**
```
ERROR BREAKDOWN:
   20x Timeout waiting for AI response
```

**Root Causes:**

1. **OpenAI rate limiting** (most common)
   - Check Railway logs for: `RateLimitError` or `429 Too Many Requests`
   - Solution: OpenAI retry logic is already implemented (P0), should auto-recover

2. **OpenAI API slow response**
   - Check Railway logs for slow response times: `OpenAI response took 15.3s`
   - Solution: Increase timeout in load test script:
     ```python
     # In test_concurrent_calls.py line 65:
     response = await asyncio.wait_for(ws.recv(), timeout=30)  # Increase from 15 to 30
     ```

3. **Backend processing bottleneck**
   - Check Railway CPU metrics: If pinned at 100%, backend is overloaded
   - Solution: Reduce concurrent calls or upgrade Railway plan

**Verification:**
```bash
# Run light test (10 calls) to isolate issue:
python tests/load/test_concurrent_calls.py --calls 10 --url wss://api.getevaai.com

# If light test passes but full test (50 calls) fails:
# → Load-dependent issue (rate limiting or resource exhaustion)

# If even light test fails:
# → OpenAI API issue or backend configuration problem
```

---

### **Issue 3: "Database connection pool exhausted"**

**Symptoms in Railway Logs:**
```
ERROR - sqlalchemy.exc.OperationalError: (psycopg2.OperationalError)
FATAL: remaining connection slots are reserved for non-replication superuser connections
```

**Root Cause:** Too many concurrent database connections

**Diagnosis:**
```sql
-- Run in Supabase SQL Editor:
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Supabase free tier limit: 20 connections
-- Supabase pro tier limit: 100 connections

-- If total_connections is near limit during test:
-- → Connection pool exhausted
```

**Solutions (Choose One):**

**Option 1: Increase connection pool size (Quick Fix)**
```python
# In backend/config.py:
class Settings(BaseSettings):
    SQLALCHEMY_POOL_SIZE: int = 50  # Default is 20
    SQLALCHEMY_MAX_OVERFLOW: int = 20  # Allow burst
    SQLALCHEMY_POOL_TIMEOUT: int = 30  # Wait for connection

# Redeploy to Railway
```

**Option 2: Add PgBouncer (Recommended for Production)**
```bash
# PgBouncer is a connection pooler that sits between app and database
# Allows hundreds of app connections to share 20 database connections

# 1. Enable in Supabase dashboard:
#    Settings → Database → Connection Pooling → Enable

# 2. Update DATABASE_URL in Railway to use pooler:
#    Original: postgres://user:pass@db.supabase.co:5432/postgres
#    Pooler:   postgres://user:pass@db.supabase.co:6543/postgres
#                                                  ^^^^
#    (Note port change: 5432 → 6543)

# 3. Redeploy Railway service
```

**Option 3: Upgrade Supabase plan (Long-term)**
```bash
# Free tier: 20 connections
# Pro tier ($25/mo): 100 connections
# Team tier ($599/mo): 200 connections

# Supabase dashboard → Settings → Billing → Upgrade
```

---

### **Issue 4: Memory Leak (Memory Never Returns to Baseline)**

**Symptoms:**
```
# Railway memory graph:
Before test: 300MB
During test: 800MB
After test (5 min later): 750MB  ← Should return to ~300MB

# Memory continuously grows with each test run
```

**Diagnosis:**
```python
# Add memory tracking to backend/main.py:
import psutil
import os

@app.get("/debug/memory")
def debug_memory():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    return {
        "rss_mb": mem_info.rss / 1024 / 1024,  # Resident Set Size
        "vms_mb": mem_info.vms / 1024 / 1024,  # Virtual Memory Size
    }

# Call before and after test:
curl https://api.getevaai.com/debug/memory
```

**Common Causes:**

1. **WebSocket connections not closing properly**
   ```python
   # Check backend/realtime_client.py
   # Ensure cleanup happens in finally block:

   async def handle_session(self, websocket: WebSocket):
       try:
           # ... session logic
       finally:
           # CRITICAL: Must clean up resources
           if self.openai_ws:
               await self.openai_ws.close()
           self.session_data.clear()  # Clear transcript/data
   ```

2. **Large transcript accumulation**
   ```python
   # In backend/realtime_client.py, limit transcript size:

   def add_to_transcript(self, message):
       self.session_data['transcript'].append(message)

       # Limit to 1000 messages (prevent unbounded growth)
       if len(self.session_data['transcript']) > 1000:
           self.session_data['transcript'] = self.session_data['transcript'][-1000:]
   ```

3. **SQLAlchemy session leaks**
   ```python
   # In backend/main.py, ensure database sessions are closed:

   @app.websocket("/ws/voice/{session_id}")
   async def voice_endpoint(websocket: WebSocket, session_id: str):
       db = SessionLocal()
       try:
           # ... logic
       finally:
           db.close()  # CRITICAL: Must close
   ```

**Verification After Fix:**
```bash
# 1. Redeploy to Railway with fix
# 2. Re-run load test
# 3. Wait 5 minutes after test completes
# 4. Check Railway memory metric:
#    Should return to within 10% of baseline
```

---

## Post-Test Analysis

### **Collecting Test Evidence**

After each load test run, save these artifacts for your records:

**1. Load test output:**
```bash
# Redirect output to file:
python tests/load/test_concurrent_calls.py --calls 50 --url wss://api.getevaai.com | tee load_test_$(date +%Y%m%d_%H%M%S).log

# Example: load_test_20251127_143022.log
```

**2. Railway metrics screenshot:**
- Railway dashboard → Metrics
- Screenshot showing CPU and Memory graphs during test
- Save as: `railway_metrics_20251127_143022.png`

**3. Railway logs:**
- Railway dashboard → Logs
- Export or copy logs from test timeframe
- Search for ERROR and WARNING level entries
- Save as: `railway_logs_20251127_143022.txt`

**4. Supabase connection stats:**
```sql
-- Run before and after test:
SELECT
  count(*) AS total_connections,
  max(backend_start) AS oldest_connection_started
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Save results to: supabase_connections_20251127_143022.txt
```

### **Test Report Template**

Create a summary after each test run:

```markdown
# Load Test Report: [Date]

## Test Configuration
- **Target URL:** wss://api.getevaai.com
- **Concurrent Calls:** 50
- **Call Duration:** 10 seconds
- **Timestamp:** 2025-11-27 14:30:22 UTC

## Results
- **Success Rate:** 94.0% (47/50 calls)
- **Duration:** 15.67 seconds
- **Calls/sec:** 3.19
- **Pass/Fail:** ✅ PASS (threshold: 90%)

## Error Breakdown
- 2x Timeout waiting for AI response (likely OpenAI rate limiting)
- 1x WebSocket error: Connection closed unexpectedly

## Resource Usage
- **CPU Peak:** 72%
- **Memory Peak:** 750MB (baseline: 300MB)
- **DB Connections Peak:** 42 (pool size: 50)
- **Recovery Time:** 2 minutes to baseline

## Observations
- [Any unusual behavior during test]
- [Performance bottlenecks noticed]
- [Recommendations for improvement]

## Next Steps
- [ ] Fix identified issues (if any)
- [ ] Re-run test to verify fixes
- [ ] Update demo plan based on confirmed capacity

## Attachments
- load_test_20251127_143022.log
- railway_metrics_20251127_143022.png
- railway_logs_20251127_143022.txt
```

---

## Load Test Checklist

### **Before First Test:**
- [ ] Install websockets: `pip install websockets`
- [ ] Verify backend health: `curl https://api.getevaai.com/health/ready`
- [ ] Open Railway logs tab (live tail)
- [ ] Open Railway metrics tab
- [ ] Open Supabase SQL Editor tab
- [ ] Note baseline metrics (CPU, memory, DB connections)

### **Run Tests in Order:**
- [ ] Quick test (30s): `--quick --url wss://api.getevaai.com`
- [ ] Light test (2min): `--calls 10 --url wss://api.getevaai.com`
- [ ] Full test (5min): `--calls 50 --url wss://api.getevaai.com`
- [ ] Stress test (optional): `--calls 100 --url wss://api.getevaai.com`

### **After Each Test:**
- [ ] Record success rate
- [ ] Screenshot Railway metrics
- [ ] Save error logs if any failures
- [ ] Verify system returned to baseline (CPU, memory, DB connections)
- [ ] Wait 5 minutes before next test (allow full recovery)

### **Final Verification:**
- [ ] Full test passed with > 90% success rate
- [ ] No database connection pool errors
- [ ] CPU stayed below 80%
- [ ] Memory returned to within 20% of baseline
- [ ] Railway service stayed running (no crashes)
- [ ] Document test results in load test report

---

## Decision Matrix: Are You Ready for Demo?

| Scenario | Action |
|----------|--------|
| ✅ All tests passed (> 90% success) | **READY FOR DEMO** - Proceed with confidence |
| ⚠️ Light test passed, Full test 80-89% success | **CAUTIOUS GO** - Demo with 10-20 concurrent calls max, monitor closely |
| ⚠️ Full test passed but stress test failed | **READY FOR DEMO** - You don't need to handle 100 calls for MVP |
| ❌ Light test < 90% success | **NOT READY** - Fix critical issues before demo |
| ❌ Full test < 80% success | **NOT READY** - System cannot handle expected load |
| ❌ Database connection errors | **NOT READY** - Fix connection pool or upgrade Supabase plan |
| ❌ Railway service crashed during test | **NOT READY** - Memory leak or critical bug, must fix |

---

## Emergency Load Reduction Plan

If load tests show system can't handle 50 concurrent calls, reduce expected demo load:

### **Option 1: Limit Concurrent Calls (Quick Fix)**

Add rate limiting to backend:

```python
# In backend/main.py:
from fastapi import HTTPException
import asyncio

# Global semaphore to limit concurrent WebSocket sessions
MAX_CONCURRENT_SESSIONS = 20  # Adjust based on load test results
session_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SESSIONS)

@app.websocket("/ws/voice/{session_id}")
async def voice_endpoint(websocket: WebSocket, session_id: str):
    if session_semaphore.locked():
        await websocket.close(code=1008, reason="Server at capacity, please try again")
        return

    async with session_semaphore:
        # ... existing logic
```

### **Option 2: Queue Incoming Calls (Better UX)**

Implement a waiting queue:

```python
# In backend/main.py:
from collections import deque
from fastapi.responses import JSONResponse

call_queue = deque(maxlen=100)

@app.websocket("/ws/voice/{session_id}")
async def voice_endpoint(websocket: WebSocket, session_id: str):
    queue_position = len(call_queue)

    if queue_position > 50:
        await websocket.close(code=1008, reason="Call volume high, please try again in 5 minutes")
        return

    if queue_position > 0:
        await websocket.send_text(f"You are caller #{queue_position} in queue, please wait...")

    call_queue.append(session_id)

    try:
        # ... existing logic
    finally:
        call_queue.remove(session_id)
```

### **Option 3: Demo Plan Adjustment (No Code Change)**

Simply plan for lower concurrency during demo:
- Schedule demo during off-peak hours
- Limit number of simultaneous demo participants
- Have backup pre-recorded video if live demo fails

---

## Summary

**You've successfully load tested Eva!** 🎉

**Key Takeaways:**
1. Always run tests in order: Quick → Light → Full → Stress
2. Monitor Railway metrics and logs during tests
3. Aim for > 90% success rate on Full test (50 calls)
4. Document results and save evidence
5. Fix critical issues before demo day

**Next Steps:**
1. ✅ Complete load testing (this guide)
2. ⏭️ Run smoke tests (SMOKE_TEST_CHECKLIST.md)
3. ⏭️ Set up monitoring alerts (MONITORING_GUIDE.md)
4. ⏭️ Verify database backups
5. ⏭️ Final pre-demo verification checklist

**Demo Day Readiness:**
- [ ] Load test passed with > 90% success rate
- [ ] System handles expected concurrent calls (10-50)
- [ ] Resource usage stays in green zone
- [ ] Error handling is graceful (no stack traces exposed)
- [ ] Recovery is automatic (system returns to baseline)

You're now ready to confidently demo Eva to clients! 🚀
