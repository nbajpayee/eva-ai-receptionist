# Architecture Review & Pre-Pilot Assessment (November 2025)

**Date:** November 28, 2025
**Status:** Production-ready for pilot
**Overall Grade:** B+ (Strong foundation with clear optimization path)

## Executive Summary

The Eva AI receptionist system has undergone significant architectural improvements (Milestones 1-5 completed). The current architecture is **sufficient for pilot launch** with minor hardening required.

**Key Achievement:** Successfully migrated from fragmented booking logic to a unified `BookingOrchestrator` with typed contracts, deterministic slot selection, and comprehensive metrics.

## Architecture Assessment

### ✅ Strengths

1. **Domain-Driven Booking Layer**
   - `BookingOrchestrator` provides single entry point for all channels
   - Typed contracts (`BookingContext`, `BookingResult`, `CheckAvailabilityResult`)
   - `SlotSelectionManager` enforces deterministic booking (prevents double-bookings)
   - 37/37 tests passing including deterministic booking suite

2. **Omnichannel Conversation Schema**
   - Unified `conversations` table supporting voice/SMS/email
   - Polymorphic message details (voice_call_details, sms_details, email_details)
   - Event sourcing via `communication_events` for full audit trails
   - Legacy `call_sessions` removed - clean cutover complete

3. **Production-Ready Patterns**
   - Centralized AI configuration (`ai_config.py`)
   - Comprehensive metrics (`record_tool_execution`, `record_calendar_error`)
   - Health endpoints for k8s probes (`/health/live`, `/health/ready`)
   - Structured logging with conversation context

4. **Testing Culture**
   - Golden scenarios regression suite prevents prompt drift
   - Contract tests ensure voice/messaging parity
   - Cross-channel booking tests validate deterministic behavior

### ⚠️ Critical Issues for Pilot (P0 - Must Fix)

#### 1. Database Performance (Est: 2-3 days)

**Problem:** Missing compound indexes will cause admin dashboard timeouts

**Required Indexes:**
```sql
-- Conversations queries (admin dashboard)
CREATE INDEX idx_conv_customer_channel_status
  ON conversations(customer_id, channel, status);

CREATE INDEX idx_conv_initiated_desc_status
  ON conversations(initiated_at DESC, status);

-- Appointments queries (N+1 prevention)
CREATE INDEX idx_appointments_customer_id
  ON appointments(customer_id);

-- JSONB metadata queries (slot selection)
CREATE INDEX idx_conv_metadata_gin
  ON conversations USING gin(metadata);
```

**Impact:** First pilot user with 50+ customers will experience 5-10s page loads → poor UX

#### 2. Calendar Circuit Breaker (Est: 2 days)

**Problem:** Google Calendar downtime (99.9% SLA = 43 min/month) crashes entire app

**Required Implementation:**
```python
from tenacity import retry, stop_after_attempt, wait_exponential

class GoogleCalendarService:
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def get_available_slots(self, ...):
        try:
            return self._fetch_from_google(...)
        except HttpError as e:
            if e.resp.status >= 500:
                logger.error("Google Calendar unavailable, using fallback")
                return self._get_cached_or_fallback(...)
            raise
```

**Impact:** Calendar API outage during pilot = zero bookings = pilot failure

#### 3. PII Redaction in Logs (Est: 1 day)

**Problem:** Customer phone numbers/emails in logs = GDPR/CCPA violation

**Required Implementation:**
```python
import re
import logging

class PIIRedactingFormatter(logging.Formatter):
    def format(self, record):
        msg = super().format(record)
        msg = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', msg)
        msg = re.sub(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', '[EMAIL]', msg)
        return msg
```

**Impact:** Privacy-conscious customer complaint → trust damage → pilot failure

#### 4. Rate Limiting (Est: 1 day)

**Problem:** Public endpoints (`/api/config/services`) can be spammed

**Required Implementation:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/config/services")
@limiter.limit("100/minute")
def get_config_services(...):
    ...
```

**Impact:** Competitor scraping or DDoS → API overload → pilot downtime

### 📋 Pre-Pilot Sprint (2 Weeks)

**Week 1: Critical Fixes**
- Day 1-2: Add database indexes + test performance
- Day 3-4: Implement calendar circuit breaker + retry logic
- Day 5: Add PII redaction formatter

**Week 2: Hardening**
- Day 1: Add rate limiting (slowapi)
- Day 2-3: Load test (100 customers, 500 conversations, 50 concurrent calls)
- Day 4: Fix any performance bottlenecks discovered
- Day 5: Deploy to staging, full smoke test

**Then:** Ship pilot ✅

## Post-Pilot Roadmap

### Month 1: Performance Tuning
- Optimize slow queries discovered during pilot
- Add caching for frequently-accessed data (services, providers)
- Dashboard performance monitoring (Datadog/Grafana)

### Month 2: Code Quality
- Refactor `RealtimeClient` (1,642 lines → 4 focused classes)
- Add API versioning (`/api/v1/...` for public beta)
- Improve test coverage for edge cases found in pilot

### Month 3: Architecture Evolution (If Scaling)
- Extract pure domain layer (if scaling to 10+ med spas)
- Consider hexagonal architecture (if team grows to 3+ backend devs)
- Evaluate microservices (if scaling to 100+ med spas)

## Alternative Architectures Considered

### Option 1: Microservices (Event-Driven)
**Verdict:** ⛔ Too complex for current scale (revisit at 100+ med spas)
- Pros: Independent scaling, fault isolation
- Cons: Operational complexity, distributed transactions, network latency

### Option 2: Modular Monolith (Hexagonal Architecture)
**Verdict:** ⭐ BEST long-term, but defer until post-pilot
- Pros: Pure domain logic (100% testable), swappable infrastructure
- Cons: Learning curve, more files (but cleaner separation)
- **Recommendation:** Adopt after pilot validates product-market fit

### Option 3: Serverless (Event-Sourced)
**Verdict:** ⛔ Overkill for 1K requests/day
- Pros: Auto-scaling, pay-per-use
- Cons: Vendor lock-in, cold starts, debugging complexity

### Option 4: Current Layered Refactor
**Verdict:** ✅ Sufficient for pilot
- Pros: Pragmatic, incremental, low risk
- Cons: Not as clean as hexagonal, but good enough

## Decision: Ship Current Architecture

### Why Current State is Sufficient

1. ✅ **Booking brain is unified** (BookingOrchestrator working)
2. ✅ **Deterministic slot enforcement** (prevents double-bookings)
3. ✅ **Comprehensive metrics** (tool execution + calendar errors tracked)
4. ✅ **37/37 tests passing** (including deterministic booking suite)
5. ✅ **Conversations schema live** (legacy removed, clean data model)

### Why Hexagonal Refactor Can Wait

**Code quality debt is cheap when you have revenue.**
**Opportunity cost of delayed pilots is expensive.**

The perfect architecture for 0 customers may be the wrong architecture once you discover what customers actually need. Ship, validate, iterate.

## Risk Assessment

| Scenario | Risk Level | Impact | Mitigation |
|----------|-----------|--------|------------|
| Ship pilot with P0 fixes | 🟢 Low | Stable, performant pilot | **Recommended** |
| Ship pilot without fixes | 🟡 Medium | Slow dashboard, occasional errors | Unacceptable |
| Refactor to hexagonal first | 🔴 High | 2-3 month delay, lost momentum | Don't do this |

## Success Metrics

### Pilot Success Criteria
- ✅ Voice calls work reliably → **Have this** (deterministic booking)
- ✅ Bookings don't fail → **Have this** (orchestrator + slot enforcement)
- ✅ Dashboard shows data → **Have this** (conversations schema)
- ⚠️ No crashes under load → **Need P0 fixes** (1-2 weeks)

### Post-Pilot KPIs (Month 1-3)
- Booking success rate: ≥90% (conversations with intent → scheduled appointment)
- Calendar error rate: ≤2% (tool executions with calendar failures)
- P95 booking latency: <3s (messaging), <5s (voice)
- Dashboard load time: <500ms (admin customer list)

## Conclusion

**Current architecture grade: B+ (Production-ready with minor hardening)**

**Action Plan:**
1. Complete 2-week pre-pilot sprint (P0 fixes)
2. Ship pilot
3. Collect feedback for 2-4 weeks
4. Refactor based on validated learnings (not speculation)

The codebase is well-architected, tested, and documented. With the P0 fixes above, it's ready for real-world validation.

---

**Next Review:** Post-pilot retrospective (estimate: January 2026)
