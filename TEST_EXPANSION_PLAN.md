# Test Expansion, Performance & Security Plan
## Eva AI Receptionist - Comprehensive Testing Strategy

**Created:** November 18, 2025
**Target:** 150+ tests | Performance benchmarks | HIPAA security audit
**Current State:** ~37 tests (25 booking + 12 from test classes)

---

## Executive Summary

This document outlines a comprehensive plan to expand test coverage from ~37 tests to 150+ tests, implement performance testing infrastructure, and conduct a thorough security audit for HIPAA compliance. The plan is organized into 5 phases over 6-8 weeks.

**Goals:**
- ✅ **150+ automated tests** covering all critical flows
- ✅ **Performance benchmarks** for voice sessions, API endpoints, and database queries
- ✅ **Security audit** addressing HIPAA compliance, authentication, and PII handling
- ✅ **CI/CD integration** with automated test runs on every commit

---

## Current Test Coverage Analysis

### Existing Tests (37 total)

#### 1. Booking Tests (25 tests)
- `test_voice_booking.py` - Voice-specific booking flows (4 tests)
- `test_ai_booking_integration.py` - End-to-end AI booking (12 tests)
- `test_cross_channel_booking.py` - Multi-channel booking (3 tests)
- `test_booking_handlers.py` - Booking tool handlers (2 tests)
- `test_booking_smoke.py` - Basic booking functionality (2 tests)
- `test_booking_time_utils.py` - Time zone utilities (1 test)
- `booking/test_slot_selection.py` - Slot selection logic (4 tests)

#### 2. Messaging Tests (2 tests)
- `test_messaging_service.py` - Basic messaging service tests (2 tests)

### Coverage Gaps Identified

❌ **Missing Critical Tests:**
- WebSocket connection management & lifecycle
- Voice interruption handling (VAD testing)
- SMS/Email threading and delivery
- Admin API endpoints (metrics, calls, appointments)
- Database query performance
- Error handling & edge cases
- Calendar API integration failures
- Customer data validation
- Analytics satisfaction scoring
- Cross-channel conversation threading
- Authentication & authorization
- Input validation & SQL injection protection

---

## Phase 1: Integration Tests for All Booking Flows
**Timeline:** Week 1-2 | **Tests Added:** 35 tests | **Priority:** HIGH

### 1.1 Voice Booking Flow (12 tests)
**File:** `backend/tests/integration/test_voice_booking_flows.py`

```python
class TestVoiceBookingFlow:
    - test_complete_booking_flow_new_customer()
    - test_complete_booking_flow_existing_customer()
    - test_booking_with_service_selection()
    - test_booking_with_provider_preference()
    - test_booking_with_special_requests()
    - test_booking_multiple_services_same_day()
    - test_booking_earliest_available_slot()
    - test_booking_specific_date_time()
    - test_booking_with_medical_screening()
    - test_booking_flow_interruption_recovery()
    - test_booking_slot_taken_during_conversation()
    - test_booking_past_business_hours()
```

### 1.2 SMS Booking Flow (8 tests)
**File:** `backend/tests/integration/test_sms_booking_flows.py`

```python
class TestSMSBookingFlow:
    - test_sms_complete_booking_flow()
    - test_sms_multi_message_booking()
    - test_sms_booking_with_confirmation_link()
    - test_sms_booking_cancellation()
    - test_sms_booking_rescheduling()
    - test_sms_slot_selection_by_number()
    - test_sms_slot_selection_by_time()
    - test_sms_threading_multiple_conversations()
```

### 1.3 Email Booking Flow (6 tests)
**File:** `backend/tests/integration/test_email_booking_flows.py`

```python
class TestEmailBookingFlow:
    - test_email_complete_booking_flow()
    - test_email_booking_with_attachments()
    - test_email_multi_recipient_handling()
    - test_email_html_body_parsing()
    - test_email_reply_threading()
    - test_email_booking_confirmation_sent()
```

### 1.4 Cross-Channel Booking (9 tests)
**File:** `backend/tests/integration/test_cross_channel_booking_flows.py`

```python
class TestCrossChannelBooking:
    - test_voice_to_sms_continuation()
    - test_sms_to_voice_escalation()
    - test_email_to_sms_reminder()
    - test_booking_history_unified_timeline()
    - test_customer_preference_persistence()
    - test_slot_selection_across_channels()
    - test_conversation_metadata_sync()
    - test_duplicate_booking_prevention()
    - test_channel_specific_formatting()
```

---

## Phase 2: Edge Case & Error Handling Tests
**Timeline:** Week 2-3 | **Tests Added:** 40 tests | **Priority:** HIGH

### 2.1 Failed Booking Scenarios (12 tests)
**File:** `backend/tests/edge_cases/test_booking_failures.py`

```python
class TestBookingFailures:
    - test_calendar_api_timeout()
    - test_calendar_api_unauthorized()
    - test_calendar_api_quota_exceeded()
    - test_invalid_service_type()
    - test_invalid_datetime_format()
    - test_booking_outside_business_hours()
    - test_booking_past_date()
    - test_incomplete_customer_details()
    - test_invalid_phone_number_format()
    - test_invalid_email_format()
    - test_database_connection_failure()
    - test_concurrent_booking_conflict()
```

### 2.2 Duplicate Appointment Prevention (8 tests)
**File:** `backend/tests/edge_cases/test_duplicate_appointments.py`

```python
class TestDuplicateAppointments:
    - test_same_customer_same_time_duplicate()
    - test_same_customer_overlapping_time()
    - test_same_slot_different_customers()
    - test_duplicate_detection_across_channels()
    - test_reschedule_vs_new_booking()
    - test_cancelled_appointment_rebooking()
    - test_customer_double_confirmation()
    - test_race_condition_handling()
```

### 2.3 Expired Slot Handling (6 tests)
**File:** `backend/tests/edge_cases/test_expired_slots.py`

```python
class TestExpiredSlots:
    - test_slot_expires_during_conversation()
    - test_business_hours_change_mid_booking()
    - test_slot_no_longer_available()
    - test_provider_unavailable_last_minute()
    - test_slot_timeout_after_30_minutes()
    - test_expired_slot_alternative_offered()
```

### 2.4 Customer Data Validation (8 tests)
**File:** `backend/tests/edge_cases/test_customer_validation.py`

```python
class TestCustomerValidation:
    - test_phone_international_formats()
    - test_phone_invalid_characters()
    - test_email_edge_cases()
    - test_name_special_characters()
    - test_name_too_long()
    - test_missing_required_fields()
    - test_pii_data_sanitization()
    - test_customer_merge_detection()
```

### 2.5 Calendar Integration Failures (6 tests)
**File:** `backend/tests/edge_cases/test_calendar_failures.py`

```python
class TestCalendarFailures:
    - test_token_refresh_failure()
    - test_credentials_expired()
    - test_calendar_deleted()
    - test_event_creation_failed()
    - test_event_update_conflict()
    - test_timezone_mismatch()
```

---

## Phase 3: Voice Interruption & VAD Testing
**Timeline:** Week 3-4 | **Tests Added:** 18 tests | **Priority:** HIGH

### 3.1 Voice Activity Detection (10 tests)
**File:** `backend/tests/voice/test_vad_detection.py`

```python
class TestVADDetection:
    - test_client_vad_speech_detection()
    - test_client_vad_silence_detection()
    - test_server_vad_speech_detection()
    - test_hybrid_vad_fast_commit()
    - test_hybrid_vad_fallback_commit()
    - test_vad_threshold_adjustment()
    - test_vad_background_noise_filtering()
    - test_vad_multiple_speakers()
    - test_vad_commit_timing_120ms()
    - test_vad_commit_timing_300ms()
```

### 3.2 Voice Interruption Handling (8 tests)
**File:** `backend/tests/voice/test_interruption_handling.py`

```python
class TestInterruptionHandling:
    - test_user_interrupts_ai_response()
    - test_ai_response_cancellation()
    - test_audio_source_tracking()
    - test_stopAllAudio_immediate_cutoff()
    - test_interrupt_message_to_backend()
    - test_graceful_vs_unexpected_errors()
    - test_multiple_rapid_interruptions()
    - test_interruption_transcript_preservation()
```

---

## Phase 4: SMS/Email Threading & Analytics Tests
**Timeline:** Week 4-5 | **Tests Added:** 25 tests | **Priority:** MEDIUM

### 4.1 SMS Threading (8 tests)
**File:** `backend/tests/messaging/test_sms_threading.py`

```python
class TestSMSThreading:
    - test_multi_message_thread_creation()
    - test_sms_reply_association()
    - test_twilio_sid_tracking()
    - test_sms_delivery_status_updates()
    - test_sms_media_urls()
    - test_sms_segments_count()
    - test_sms_conversation_timeout()
    - test_sms_customer_identification()
```

### 4.2 Email Threading (7 tests)
**File:** `backend/tests/messaging/test_email_threading.py`

```python
class TestEmailThreading:
    - test_email_reply_chain()
    - test_email_subject_preservation()
    - test_email_html_body_rendering()
    - test_email_attachments_handling()
    - test_email_from_to_tracking()
    - test_email_delivery_tracking()
    - test_email_bounce_handling()
```

### 4.3 Analytics & Satisfaction Scoring (10 tests)
**File:** `backend/tests/analytics/test_satisfaction_scoring.py`

```python
class TestSatisfactionScoring:
    - test_satisfaction_score_positive()
    - test_satisfaction_score_negative()
    - test_satisfaction_score_neutral()
    - test_sentiment_detection_frustrated()
    - test_sentiment_detection_happy()
    - test_sentiment_mixed_emotions()
    - test_outcome_detection_booked()
    - test_outcome_detection_info_only()
    - test_outcome_detection_escalated()
    - test_gpt4_satisfaction_call_count()
```

---

## Phase 5: Admin API & Database Tests
**Timeline:** Week 5-6 | **Tests Added:** 32 tests | **Priority:** MEDIUM

### 5.1 Admin Metrics API (8 tests)
**File:** `backend/tests/api/test_admin_metrics.py`

```python
class TestAdminMetricsAPI:
    - test_get_overview_today()
    - test_get_overview_week()
    - test_get_overview_month()
    - test_get_overview_custom_range()
    - test_metrics_calculation_accuracy()
    - test_metrics_aggregation_performance()
    - test_metrics_unauthorized_access()
    - test_metrics_rate_limiting()
```

### 5.2 Admin Calls API (6 tests)
**File:** `backend/tests/api/test_admin_calls.py`

```python
class TestAdminCallsAPI:
    - test_get_call_history_pagination()
    - test_get_call_by_id()
    - test_call_filtering_by_date()
    - test_call_filtering_by_outcome()
    - test_call_search_by_customer()
    - test_call_transcript_retrieval()
```

### 5.3 Admin Communications API (8 tests)
**File:** `backend/tests/api/test_admin_communications.py`

```python
class TestAdminCommunicationsAPI:
    - test_get_communications_all_channels()
    - test_get_communication_by_id()
    - test_filter_by_channel()
    - test_filter_by_customer()
    - test_communication_timeline_ordering()
    - test_message_threading_display()
    - test_satisfaction_scores_aggregation()
    - test_communication_export()
```

### 5.4 Database Query Performance (10 tests)
**File:** `backend/tests/database/test_query_performance.py`

```python
class TestQueryPerformance:
    - test_customer_lookup_by_phone()
    - test_appointment_query_by_date_range()
    - test_conversation_history_pagination()
    - test_metrics_aggregation_large_dataset()
    - test_index_effectiveness()
    - test_n_plus_one_query_prevention()
    - test_eager_loading_relationships()
    - test_bulk_insert_performance()
    - test_concurrent_read_performance()
    - test_transaction_rollback_performance()
```

---

## Performance Testing Plan
**Timeline:** Week 6 | **Tools:** Locust, pytest-benchmark | **Priority:** HIGH

### 6.1 Load Testing Infrastructure

**File:** `backend/tests/performance/locustfile.py`

```python
class VoiceSessionUser(HttpUser):
    """Simulate concurrent voice session connections"""
    - WebSocket connection establishment
    - Audio streaming (base64 encoded)
    - Concurrent sessions: 10, 50, 100, 500
    - Measure: connection time, latency, throughput

class SMSMessagingUser(HttpUser):
    """Simulate SMS webhook traffic"""
    - POST /api/messaging/sms
    - Concurrent webhooks: 20, 100, 500
    - Measure: response time, error rate

class AdminDashboardUser(HttpUser):
    """Simulate admin dashboard usage"""
    - GET /api/admin/metrics/overview
    - GET /api/admin/calls
    - GET /api/admin/communications
    - Concurrent users: 5, 20, 50
    - Measure: API response time, cache effectiveness
```

### 6.2 Database Query Optimization

**File:** `backend/tests/performance/test_db_optimization.py`

```python
class TestDatabaseOptimization:
    - test_query_execution_time_customers()
    - test_query_execution_time_appointments()
    - test_query_execution_time_conversations()
    - test_index_usage_analysis()
    - test_connection_pool_sizing()
    - test_query_plan_analysis()
```

**Target Benchmarks:**
- Customer lookup by phone: < 10ms
- Appointment query (30-day range): < 50ms
- Metrics aggregation (daily): < 100ms
- Conversation history (50 messages): < 75ms

### 6.3 API Response Time Benchmarking

**File:** `backend/tests/performance/test_api_benchmarks.py`

```python
@pytest.mark.benchmark
class TestAPIBenchmarks:
    - test_health_check_response_time()
    - test_admin_metrics_response_time()
    - test_booking_check_availability_time()
    - test_booking_book_appointment_time()
    - test_messaging_generate_ai_response_time()
    - test_satisfaction_scoring_time()
```

**Target Benchmarks:**
- Health check: < 5ms
- Admin metrics: < 200ms
- Check availability: < 300ms (includes Calendar API)
- Book appointment: < 500ms (includes Calendar API + DB writes)
- AI response generation: < 2000ms (includes OpenAI API)
- Satisfaction scoring: < 1500ms (includes GPT-4 call)

### 6.4 WebSocket Stress Testing

**File:** `backend/tests/performance/test_websocket_stress.py`

```python
class TestWebSocketStress:
    - test_concurrent_connections_10()
    - test_concurrent_connections_50()
    - test_concurrent_connections_100()
    - test_connection_lifecycle_timing()
    - test_message_throughput()
    - test_memory_usage_under_load()
    - test_graceful_degradation()
```

**Target Metrics:**
- Support 100 concurrent voice sessions
- Connection establishment: < 100ms
- Audio chunk processing: < 50ms
- Memory per session: < 50MB

---

## Security Audit Plan
**Timeline:** Week 7-8 | **Priority:** CRITICAL (HIPAA compliance required)

### 7.1 HIPAA Compliance Review

**File:** `SECURITY_AUDIT.md`

#### 7.1.1 PHI Data Handling Checklist
- [ ] **Encryption at Rest**
  - Database encryption enabled (Supabase encryption)
  - Verify all columns with PII are encrypted
  - Backup encryption verification

- [ ] **Encryption in Transit**
  - HTTPS enforced for all API endpoints
  - WSS (WebSocket Secure) for voice connections
  - TLS 1.2+ required

- [ ] **Access Controls**
  - Role-Based Access Control (RBAC) implementation
  - Admin authentication required for all /api/admin/* routes
  - Row Level Security (RLS) policies in Supabase

- [ ] **Audit Logging**
  - All PHI access logged (who, what, when)
  - Log retention policy (7 years per HIPAA)
  - Audit log integrity verification

- [ ] **Data Minimization**
  - Only collect necessary PHI
  - Automatic data expiration policies
  - Patient data deletion on request

- [ ] **Business Associate Agreements (BAAs)**
  - OpenAI BAA signed
  - Supabase BAA signed
  - Twilio BAA signed
  - SendGrid BAA signed
  - Google Workspace BAA signed

#### 7.1.2 HIPAA Security Test Suite

**File:** `backend/tests/security/test_hipaa_compliance.py`

```python
class TestHIPAACompliance:
    - test_phi_fields_identified()
    - test_database_encryption_at_rest()
    - test_https_enforced()
    - test_wss_enforced()
    - test_access_logging_enabled()
    - test_unauthorized_access_blocked()
    - test_audit_trail_integrity()
    - test_data_retention_policy()
    - test_patient_data_deletion()
    - test_baa_verification()
```

### 7.2 Input Validation Testing

**File:** `backend/tests/security/test_input_validation.py`

```python
class TestInputValidation:
    - test_sql_injection_customer_name()
    - test_sql_injection_phone_number()
    - test_sql_injection_email()
    - test_xss_customer_notes()
    - test_xss_special_requests()
    - test_command_injection_service_type()
    - test_path_traversal_recording_url()
    - test_json_injection_metadata()
    - test_phone_number_validation()
    - test_email_validation()
    - test_datetime_validation()
    - test_service_type_whitelist()
```

### 7.3 SQL Injection Vulnerability Scan

**File:** `backend/tests/security/test_sql_injection.py`

```python
class TestSQLInjection:
    - test_customer_query_injection()
    - test_appointment_query_injection()
    - test_conversation_query_injection()
    - test_raw_sql_usage_audit()
    - test_parameterized_queries_enforced()
    - test_orm_query_safety()
    - test_stored_procedure_injection()
    - test_union_based_injection()
```

### 7.4 Authentication & Authorization Gaps

**File:** `backend/tests/security/test_auth_authz.py`

```python
class TestAuthenticationAuthorization:
    - test_admin_api_requires_auth()
    - test_admin_api_jwt_validation()
    - test_admin_api_token_expiration()
    - test_customer_data_isolation()
    - test_rbac_role_enforcement()
    - test_session_hijacking_prevention()
    - test_csrf_protection()
    - test_rate_limiting_enabled()
    - test_brute_force_protection()
    - test_password_complexity_requirements()
```

### 7.5 PII Data Handling Review

**File:** `backend/tests/security/test_pii_handling.py`

```python
class TestPIIHandling:
    - test_pii_fields_identified()
    - test_pii_logging_masked()
    - test_pii_in_error_messages_redacted()
    - test_pii_in_urls_prevented()
    - test_pii_in_query_params_prevented()
    - test_pii_data_export_controls()
    - test_pii_data_anonymization()
    - test_pii_data_pseudonymization()
    - test_customer_consent_tracking()
    - test_right_to_erasure_implementation()
```

### 7.6 Penetration Testing Checklist

**Tools:** OWASP ZAP, Burp Suite, SQLMap

```bash
# Automated scans
owasp-zap -quickscan http://localhost:8000
sqlmap -u "http://localhost:8000/api/admin/customers?id=1"

# Manual testing
- IDOR vulnerabilities
- Broken authentication
- Sensitive data exposure
- XXE attacks
- Broken access control
- Security misconfiguration
- Using components with known vulnerabilities
- Insufficient logging & monitoring
```

---

## Test Infrastructure & CI/CD

### Test Configuration

**File:** `pytest.ini`

```ini
[pytest]
testpaths = backend/tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --verbose
    --cov=backend
    --cov-report=html
    --cov-report=term
    --benchmark-autosave
    --benchmark-compare
markers =
    unit: Unit tests
    integration: Integration tests
    performance: Performance tests
    security: Security tests
    slow: Slow running tests
    hipaa: HIPAA compliance tests
```

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install pytest-cov pytest-benchmark locust

      - name: Run unit tests
        run: pytest -m "unit" --cov

      - name: Run integration tests
        run: pytest -m "integration" --cov --cov-append

      - name: Run security tests
        run: pytest -m "security"

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  performance:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Run performance benchmarks
        run: pytest -m "performance" --benchmark-only

      - name: Run load tests
        run: locust --headless --users 50 --spawn-rate 10 --run-time 5m
```

---

## Implementation Priorities

### Priority 1: Critical (Weeks 1-3)
1. ✅ Integration tests for all booking flows (35 tests)
2. ✅ Edge case handling (40 tests)
3. ✅ Voice interruption & VAD (18 tests)
4. ✅ HIPAA compliance tests (20 tests)

**Total: 113 tests**

### Priority 2: High (Weeks 4-5)
1. ✅ SMS/Email threading (25 tests)
2. ✅ Admin API tests (22 tests)
3. ✅ Performance benchmarks (15 tests)

**Total: 62 tests**

### Priority 3: Medium (Weeks 6-8)
1. ✅ Security vulnerability scans (25 tests)
2. ✅ Load testing infrastructure
3. ✅ Penetration testing
4. ✅ Documentation & CI/CD

**Total: 25+ additional security tests**

---

## Success Metrics

### Test Coverage
- **Target:** 150+ automated tests
- **Current:** 37 tests (25% coverage)
- **Target Code Coverage:** 85%+

### Performance Benchmarks
- **Voice session concurrency:** 100+ sessions
- **API response times:** < 200ms (median)
- **Database queries:** < 50ms (median)
- **Zero downtime deployment**

### Security Compliance
- **HIPAA compliance:** 100% checklist completion
- **BAAs signed:** 5/5 vendors
- **Zero critical vulnerabilities**
- **Quarterly penetration tests**

### CI/CD
- **Automated test runs:** Every commit
- **Test execution time:** < 10 minutes
- **Test success rate:** > 98%
- **Coverage reports:** Automated via Codecov

---

## Resource Requirements

### Tools & Services
- **pytest** (test framework)
- **pytest-cov** (coverage reporting)
- **pytest-benchmark** (performance testing)
- **Locust** (load testing)
- **OWASP ZAP** (security scanning)
- **SQLMap** (SQL injection testing)
- **Codecov** (coverage tracking)
- **GitHub Actions** (CI/CD)

### Timeline
- **Total Duration:** 8 weeks
- **Estimated Effort:** 120-160 hours
- **Team Size:** 1-2 engineers

### Cost Estimates
- **CI/CD (GitHub Actions):** Free (OSS) / $4/month (private)
- **Codecov:** Free (OSS) / $10/month (private)
- **Load testing infrastructure:** $50-100/month (cloud VMs)
- **Security scanning tools:** Free (open source)

---

## Next Steps

1. **Week 1:** Set up test infrastructure (pytest.ini, CI/CD, coverage)
2. **Week 1-2:** Implement Phase 1 (Integration tests - 35 tests)
3. **Week 2-3:** Implement Phase 2 (Edge cases - 40 tests)
4. **Week 3-4:** Implement Phase 3 (Voice/VAD - 18 tests)
5. **Week 4-5:** Implement Phase 4 (SMS/Email/Analytics - 25 tests)
6. **Week 5-6:** Implement Phase 5 (Admin API/DB - 32 tests)
7. **Week 6:** Performance testing & benchmarking
8. **Week 7-8:** Security audit & penetration testing

**Total: 150+ tests + Performance infrastructure + Security audit**

---

## Appendix: Test File Structure

```
backend/tests/
├── __init__.py
├── conftest.py                          # Shared fixtures
├── pytest.ini                           # Configuration
│
├── unit/                                # Fast, isolated tests
│   ├── test_time_utils.py
│   ├── test_slot_selection.py
│   └── test_validators.py
│
├── integration/                         # Multi-component tests
│   ├── test_voice_booking_flows.py      [12 tests]
│   ├── test_sms_booking_flows.py        [8 tests]
│   ├── test_email_booking_flows.py      [6 tests]
│   └── test_cross_channel_flows.py      [9 tests]
│
├── edge_cases/                          # Error scenarios
│   ├── test_booking_failures.py         [12 tests]
│   ├── test_duplicate_appointments.py   [8 tests]
│   ├── test_expired_slots.py            [6 tests]
│   ├── test_customer_validation.py      [8 tests]
│   └── test_calendar_failures.py        [6 tests]
│
├── voice/                               # Voice-specific
│   ├── test_vad_detection.py            [10 tests]
│   └── test_interruption_handling.py    [8 tests]
│
├── messaging/                           # SMS/Email
│   ├── test_sms_threading.py            [8 tests]
│   └── test_email_threading.py          [7 tests]
│
├── analytics/                           # AI analytics
│   └── test_satisfaction_scoring.py     [10 tests]
│
├── api/                                 # REST API tests
│   ├── test_admin_metrics.py            [8 tests]
│   ├── test_admin_calls.py              [6 tests]
│   └── test_admin_communications.py     [8 tests]
│
├── database/                            # DB performance
│   └── test_query_performance.py        [10 tests]
│
├── performance/                         # Load & benchmarks
│   ├── locustfile.py
│   ├── test_db_optimization.py
│   ├── test_api_benchmarks.py
│   └── test_websocket_stress.py
│
└── security/                            # Security audit
    ├── test_hipaa_compliance.py         [10 tests]
    ├── test_input_validation.py         [12 tests]
    ├── test_sql_injection.py            [8 tests]
    ├── test_auth_authz.py               [10 tests]
    └── test_pii_handling.py             [10 tests]
```

**Total Structure:** 150+ tests across 10 categories

---

## Contact & Questions

For questions about this plan, contact the development team or create an issue in the repository.

**Last Updated:** November 18, 2025
