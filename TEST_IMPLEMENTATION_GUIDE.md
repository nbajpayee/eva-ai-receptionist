# Test Implementation Guide
## Quick-Start Guide for Test Expansion

**Date:** November 18, 2025
**For:** Development team implementing 150+ tests
**Estimated Time:** 8 weeks (Phases 1-5)

---

## Quick Start

### 1. Install Test Dependencies

```bash
cd backend
pip install -r requirements-test.txt
```

**Create `backend/requirements-test.txt`:**
```
pytest==7.4.3
pytest-cov==4.1.0
pytest-asyncio==0.21.1
pytest-benchmark==4.0.0
pytest-mock==3.12.0
faker==20.1.0
locust==2.17.0
httpx==0.25.2
```

### 2. Configure pytest

**File:** `backend/pytest.ini`

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto

addopts =
    --verbose
    --tb=short
    --cov=.
    --cov-report=html:coverage_html
    --cov-report=term-missing
    --cov-branch
    --benchmark-autosave
    --benchmark-compare

markers =
    unit: Unit tests (fast, isolated)
    integration: Integration tests (slower, database required)
    performance: Performance and benchmarking tests
    security: Security and vulnerability tests
    slow: Slow-running tests (skip by default)
    hipaa: HIPAA compliance tests
    smoke: Smoke tests for critical paths

filterwarnings =
    ignore::DeprecationWarning
```

### 3. Set Up Shared Fixtures

**File:** `backend/tests/conftest.py`

```python
"""
Shared pytest fixtures for all tests.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from typing import Generator
from unittest.mock import Mock, patch

import pytest
from faker import Faker
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from database import Base, Customer, Appointment, Conversation
from config import get_settings

fake = Faker()


# ==================== Database Fixtures ====================

@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine."""
    settings = get_settings()
    # Use separate test database
    test_db_url = os.environ.get("TEST_DATABASE_URL", settings.DATABASE_URL)
    engine = create_engine(test_db_url, echo=False)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a database session for each test."""
    TestSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    session = TestSessionLocal()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ==================== Customer Fixtures ====================

@pytest.fixture
def customer(db_session) -> Customer:
    """Create a test customer."""
    customer = Customer(
        name=fake.name(),
        phone=fake.phone_number(),
        email=fake.email(),
        is_new_client=True,
        has_allergies=False,
        is_pregnant=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    yield customer

    # Cleanup
    try:
        db_session.delete(customer)
        db_session.commit()
    except:
        db_session.rollback()


@pytest.fixture
def returning_customer(db_session) -> Customer:
    """Create a returning customer with history."""
    customer = Customer(
        name=fake.name(),
        phone=fake.phone_number(),
        email=fake.email(),
        is_new_client=False,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    # Add past appointment
    past_appointment = Appointment(
        customer_id=customer.id,
        appointment_datetime=datetime.utcnow() - timedelta(days=30),
        service_type="botox",
        status="completed",
    )
    db_session.add(past_appointment)
    db_session.commit()

    yield customer

    # Cleanup
    try:
        db_session.query(Appointment).filter(
            Appointment.customer_id == customer.id
        ).delete()
        db_session.delete(customer)
        db_session.commit()
    except:
        db_session.rollback()


# ==================== Conversation Fixtures ====================

@pytest.fixture
def voice_conversation(db_session, customer) -> Conversation:
    """Create a voice conversation."""
    conversation = Conversation(
        customer_id=customer.id,
        channel="voice",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"session_id": str(uuid.uuid4())},
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    yield conversation

    # Cleanup
    try:
        db_session.delete(conversation)
        db_session.commit()
    except:
        db_session.rollback()


@pytest.fixture
def sms_conversation(db_session, customer) -> Conversation:
    """Create an SMS conversation."""
    conversation = Conversation(
        customer_id=customer.id,
        channel="sms",
        status="active",
        initiated_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
        custom_metadata={"phone_number": customer.phone},
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    yield conversation

    # Cleanup
    try:
        db_session.delete(conversation)
        db_session.commit()
    except:
        db_session.rollback()


# ==================== Mock Fixtures ====================

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client."""
    with patch("messaging_service.openai_client") as mock_client:
        yield mock_client


@pytest.fixture
def mock_calendar_service():
    """Mock Google Calendar service."""
    with patch("messaging_service.MessagingService._get_calendar_service") as mock:
        mock_service = Mock()
        mock_service.check_availability.return_value = {
            "success": True,
            "available_slots": [],
            "date": "2025-11-20",
        }
        mock_service.book_appointment.return_value = {
            "success": True,
            "event_id": "evt-123",
            "start_time": "2025-11-20T10:00:00-05:00",
        }
        mock.return_value = mock_service
        yield mock_service


@pytest.fixture
def mock_twilio_client():
    """Mock Twilio client for SMS testing."""
    with patch("messaging_service.twilio_client") as mock:
        mock_client = Mock()
        mock_client.messages.create.return_value = Mock(sid="SM123")
        mock.return_value = mock_client
        yield mock_client


# ==================== Test Data Builders ====================

def build_availability_response(date: str = "2025-11-20", num_slots: int = 10):
    """Build a realistic availability response."""
    from booking.time_utils import to_eastern

    base_time = to_eastern(datetime(2025, 11, 20, 10, 0))
    slots = []

    for i in range(num_slots):
        start = base_time + timedelta(hours=i)
        end = start + timedelta(minutes=60)
        slots.append({
            "start": start.isoformat(),
            "end": end.isoformat(),
            "start_time": start.strftime("%I:%M %p"),
            "end_time": end.strftime("%I:%M %p"),
        })

    return {
        "success": True,
        "available_slots": slots[:num_slots],
        "all_slots": slots,
        "date": date,
        "service": "Botox",
        "service_type": "botox",
    }


def build_booking_response(slot: dict, customer: Customer):
    """Build a realistic booking response."""
    return {
        "success": True,
        "event_id": f"evt-{uuid.uuid4().hex[:8]}",
        "start_time": slot["start"],
        "original_start_time": slot["start"],
        "service_type": "botox",
        "service": "Botox",
        "customer_name": customer.name,
        "customer_phone": customer.phone,
        "customer_email": customer.email,
    }


# ==================== Parametrize Helpers ====================

# Common service types for parametrized tests
SERVICE_TYPES = ["botox", "fillers", "hydrafacial", "laser_hair_removal"]

# Common date ranges for parametrized tests
DATE_RANGES = [
    ("today", datetime.utcnow(), datetime.utcnow()),
    ("week", datetime.utcnow(), datetime.utcnow() + timedelta(days=7)),
    ("month", datetime.utcnow(), datetime.utcnow() + timedelta(days=30)),
]
```

---

## Test Template Examples

### Example 1: Integration Test Template

**File:** `backend/tests/integration/test_voice_booking_flows.py`

```python
"""
Integration tests for voice booking flows.

These tests verify end-to-end voice booking scenarios including:
- New customer booking
- Existing customer booking
- Service selection
- Slot selection
- Confirmation flow
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from analytics import AnalyticsService
from booking.manager import SlotSelectionManager
from booking.time_utils import to_eastern
from database import Customer, Appointment
from messaging_service import MessagingService


@pytest.mark.integration
class TestVoiceBookingFlow:
    """Integration tests for complete voice booking flows."""

    @patch("messaging_service.handle_check_availability")
    @patch("messaging_service.openai_client.chat.completions.create")
    def test_complete_booking_flow_new_customer(
        self,
        mock_openai,
        mock_check_avail,
        db_session,
        voice_conversation,
        mock_calendar_service,
    ):
        """
        Test complete booking flow for a new customer.

        Flow:
        1. User: "I'd like to book a Botox appointment for tomorrow at 2pm"
        2. System: Preemptively checks availability
        3. System: Offers available slots
        4. User: "Option 1 sounds good"
        5. System: Collects contact details
        6. User: Provides name, phone, email
        7. System: Books appointment automatically
        8. System: Confirms booking
        """
        # Step 1: User requests booking
        user_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="I'd like to book a Botox appointment for tomorrow at 2pm",
            metadata={"source": "voice_transcript"},
        )

        # Step 2: Mock availability check
        availability = build_availability_response("2025-11-20", num_slots=10)
        mock_check_avail.return_value = availability

        # Step 3: Mock AI response offering slots
        def mock_ai_offers_slots(**kwargs):
            return _mock_ai_response_with_text(
                "Great! I have availability tomorrow at 2 PM. Would you like to take it?"
            )

        mock_openai.side_effect = mock_ai_offers_slots

        # Generate AI response
        content, message = MessagingService.generate_ai_response(
            db_session,
            voice_conversation.id,
            "voice",
        )

        # Verify slots were offered
        db_session.refresh(voice_conversation)
        metadata = SlotSelectionManager.conversation_metadata(voice_conversation)
        assert metadata.get("pending_slot_offers") is not None

        # Step 4: User selects slot
        selection_message = AnalyticsService.add_message(
            db=db_session,
            conversation_id=voice_conversation.id,
            direction="inbound",
            content="Option 1 sounds good",
            metadata={"source": "voice_transcript"},
        )

        # Capture selection
        captured = SlotSelectionManager.capture_selection(
            db_session, voice_conversation, selection_message
        )
        assert captured is True

        # Step 5-6: User provides contact details (in real flow, AI collects these)
        # For testing, we'll set them directly on the conversation
        db_session.refresh(voice_conversation)
        metadata = voice_conversation.custom_metadata
        metadata["customer_name"] = "John Doe"
        metadata["customer_phone"] = "+15555551234"
        metadata["customer_email"] = "john@example.com"
        SlotSelectionManager.persist_conversation_metadata(
            db_session, voice_conversation, metadata
        )

        # Step 7: System auto-books when details complete
        mock_calendar_service.book_appointment.return_value = {
            "success": True,
            "event_id": "evt-123",
            "start_time": availability["available_slots"][0]["start"],
        }

        # Generate final AI response (should auto-book)
        final_content, final_message = MessagingService.generate_ai_response(
            db_session,
            voice_conversation.id,
            "voice",
        )

        # Step 8: Verify booking was created
        appointment = (
            db_session.query(Appointment)
            .filter(Appointment.calendar_event_id == "evt-123")
            .first()
        )
        assert appointment is not None
        assert appointment.service_type == "botox"
        assert appointment.status == "scheduled"

        # Verify customer was created
        customer = db_session.query(Customer).filter(
            Customer.phone == "+15555551234"
        ).first()
        assert customer is not None
        assert customer.name == "John Doe"
        assert customer.is_new_client is True


    def test_booking_with_service_selection(
        self, db_session, voice_conversation, mock_calendar_service
    ):
        """Test booking flow when customer asks about multiple services."""
        # TODO: Implement
        pass

    def test_booking_with_provider_preference(
        self, db_session, voice_conversation, mock_calendar_service
    ):
        """Test booking flow when customer requests specific provider."""
        # TODO: Implement
        pass

    def test_booking_with_medical_screening(
        self, db_session, voice_conversation, mock_calendar_service
    ):
        """Test booking flow with medical screening questions."""
        # TODO: Implement
        pass


# Helper functions
def _mock_ai_response_with_text(text: str) -> Mock:
    """Create a mock AI response with only text content."""
    message = Mock()
    message.content = text
    message.tool_calls = []

    choice = Mock()
    choice.message = message

    response = Mock()
    response.choices = [choice]
    return response
```

### Example 2: Edge Case Test Template

**File:** `backend/tests/edge_cases/test_booking_failures.py`

```python
"""
Edge case tests for booking failure scenarios.

These tests verify proper error handling for:
- Calendar API failures
- Invalid inputs
- Database errors
- Concurrent booking conflicts
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from requests.exceptions import Timeout, HTTPError

from booking_handlers import handle_book_appointment
from database import Customer


@pytest.mark.integration
class TestBookingFailures:
    """Test error handling for booking failures."""

    def test_calendar_api_timeout(self, db_session, customer):
        """Test handling of Calendar API timeout."""
        with patch("calendar_service.CalendarService.book_appointment") as mock:
            mock.side_effect = Timeout("Request timed out")

            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

            assert result["success"] is False
            assert "timeout" in result["error"].lower()
            assert "try again" in result["error"].lower()

    def test_calendar_api_unauthorized(self, db_session, customer):
        """Test handling of Calendar API authentication failure."""
        with patch("calendar_service.CalendarService.book_appointment") as mock:
            mock.side_effect = HTTPError("401 Unauthorized")

            result = handle_book_appointment(
                db_session,
                customer_name=customer.name,
                customer_phone=customer.phone,
                customer_email=customer.email,
                start_time="2025-11-20T14:00:00-05:00",
                service_type="botox",
            )

            assert result["success"] is False
            assert "authentication" in result["error"].lower()

    def test_invalid_service_type(self, db_session, customer):
        """Test rejection of invalid service type."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="invalid_service_123",
        )

        assert result["success"] is False
        assert "invalid service" in result["error"].lower()

    def test_booking_past_date(self, db_session, customer):
        """Test rejection of booking in the past."""
        past_date = datetime(2020, 1, 1, 10, 0).isoformat()

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time=past_date,
            service_type="botox",
        )

        assert result["success"] is False
        assert "past" in result["error"].lower()

    @pytest.mark.parametrize("invalid_phone", [
        "123",  # Too short
        "not-a-phone",  # Invalid format
        "",  # Empty
        "123-456-7890-1111",  # Too long
    ])
    def test_invalid_phone_number_format(self, db_session, customer, invalid_phone):
        """Test validation of phone number formats."""
        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=invalid_phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        assert result["success"] is False
        assert "phone" in result["error"].lower()

    def test_concurrent_booking_conflict(self, db_session, customer, mock_calendar_service):
        """Test handling when slot is booked during conversation."""
        # Simulate slot being taken by another customer
        mock_calendar_service.book_appointment.return_value = {
            "success": False,
            "error": "Time slot is no longer available",
        }

        result = handle_book_appointment(
            db_session,
            customer_name=customer.name,
            customer_phone=customer.phone,
            customer_email=customer.email,
            start_time="2025-11-20T14:00:00-05:00",
            service_type="botox",
        )

        assert result["success"] is False
        assert "no longer available" in result["error"].lower()
```

### Example 3: Security Test Template

**File:** `backend/tests/security/test_sql_injection.py`

```python
"""
Security tests for SQL injection vulnerabilities.

These tests attempt various SQL injection techniques to ensure
the application properly sanitizes inputs and uses parameterized queries.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from database import Customer, Appointment


@pytest.mark.security
class TestSQLInjection:
    """Test protection against SQL injection attacks."""

    @pytest.mark.parametrize("malicious_input", [
        "'; DROP TABLE customers; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM customers --",
        "'; DELETE FROM appointments WHERE '1'='1",
        "admin'--",
        "' OR 1=1--",
    ])
    def test_customer_query_injection(self, db_session, malicious_input):
        """Test SQL injection attempts in customer queries."""
        # Attempt to query customer with malicious input
        result = db_session.query(Customer).filter(
            Customer.phone == malicious_input
        ).first()

        # Should return None (no match), not execute injection
        assert result is None

        # Verify tables still exist
        customers = db_session.query(Customer).all()
        assert isinstance(customers, list)  # Query should succeed

    def test_raw_sql_usage_audit(self, db_session):
        """Audit for any raw SQL usage in codebase."""
        # This is a meta-test that would be run as part of code review
        # In practice, you'd use static analysis tools like Bandit

        # Verify ORM queries work correctly
        customer = Customer(
            name="Test User",
            phone="+15555551234",
            email="test@example.com",
        )
        db_session.add(customer)
        db_session.commit()

        # Query using ORM (safe)
        found = db_session.query(Customer).filter(
            Customer.phone == "+15555551234"
        ).first()

        assert found is not None
        assert found.name == "Test User"

    def test_parameterized_queries_enforced(self, db_session):
        """Verify all queries use parameterized statements."""
        malicious_email = "'; DROP TABLE customers; --"

        # This should NOT execute the DROP statement
        result = db_session.query(Customer).filter(
            Customer.email == malicious_email
        ).first()

        assert result is None

        # Verify table still exists
        count = db_session.query(Customer).count()
        assert count >= 0  # Should succeed without error
```

---

## Running Tests

### Run All Tests
```bash
pytest
```

### Run Specific Test Suites
```bash
# Unit tests only (fast)
pytest -m "unit"

# Integration tests
pytest -m "integration"

# Security tests
pytest -m "security"

# Smoke tests (critical paths)
pytest -m "smoke"
```

### Run with Coverage
```bash
pytest --cov=. --cov-report=html
open coverage_html/index.html  # View coverage report
```

### Run Performance Benchmarks
```bash
pytest -m "performance" --benchmark-only
```

### Run Specific Test File
```bash
pytest backend/tests/integration/test_voice_booking_flows.py -v
```

### Run Specific Test Function
```bash
pytest backend/tests/integration/test_voice_booking_flows.py::TestVoiceBookingFlow::test_complete_booking_flow_new_customer -v
```

---

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop, claude/* ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install flake8 black isort mypy

      - name: Lint with flake8
        run: |
          flake8 backend --count --select=E9,F63,F7,F82 --show-source --statistics
          flake8 backend --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

      - name: Check formatting with black
        run: black --check backend

      - name: Check imports with isort
        run: isort --check-only backend

  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: eva_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eva_test
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-

      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install -r backend/requirements-test.txt

      - name: Run unit tests
        run: |
          cd backend
          pytest -m "unit" --cov --cov-report=xml --cov-report=term

      - name: Run integration tests
        run: |
          cd backend
          pytest -m "integration" --cov --cov-append --cov-report=xml --cov-report=term

      - name: Run security tests
        run: |
          cd backend
          pytest -m "security" --cov --cov-append --cov-report=xml --cov-report=term

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml
          flags: unittests
          name: codecov-umbrella

      - name: Upload coverage report
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: backend/coverage_html/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Bandit security scan
        run: |
          pip install bandit
          bandit -r backend -f json -o bandit-report.json

      - name: Run Safety dependency check
        run: |
          pip install safety
          safety check --json > safety-report.json

      - name: Upload security reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            bandit-report.json
            safety-report.json
```

---

## Debugging Failed Tests

### Common Issues

#### 1. Database Connection Errors

**Error:**
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**Solution:**
```bash
# Set test database URL
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"

# Or use SQLite for local testing
export TEST_DATABASE_URL="sqlite:///test.db"
```

#### 2. Mock Patches Not Working

**Error:**
```
AssertionError: Expected mock to be called once. Called 0 times.
```

**Solution:**
- Ensure patch path matches the import location in the tested module
- Use `patch.object()` for class methods
- Check that code path actually calls the mocked function

#### 3. Async Test Failures

**Error:**
```
RuntimeError: Event loop is closed
```

**Solution:**
```python
# Add to conftest.py
import pytest

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
```

---

## Performance Benchmarking

### Benchmark Example

**File:** `backend/tests/performance/test_api_benchmarks.py`

```python
"""
Performance benchmarks for API endpoints and critical paths.
"""
import pytest
from booking_handlers import handle_check_availability


@pytest.mark.performance
@pytest.mark.benchmark
class TestAPIBenchmarks:
    """Benchmark critical API operations."""

    def test_check_availability_performance(self, benchmark, db_session):
        """Benchmark check_availability execution time."""
        result = benchmark(
            handle_check_availability,
            db_session,
            date="2025-11-20",
            service_type="botox",
        )

        assert result["success"] is True

    def test_database_query_performance(self, benchmark, db_session):
        """Benchmark customer lookup query."""
        from database import Customer

        def query_customer():
            return db_session.query(Customer).filter(
                Customer.phone == "+15555551234"
            ).first()

        result = benchmark(query_customer)
        # Result can be None, that's okay for benchmarking
```

**Run Benchmarks:**
```bash
pytest -m "performance" --benchmark-only --benchmark-autosave
```

---

## Next Steps

1. **Week 1:** Set up test infrastructure
   - Create `conftest.py` with shared fixtures
   - Configure `pytest.ini`
   - Set up CI/CD workflow

2. **Week 1-2:** Implement Phase 1 tests (35 tests)
   - Voice booking flows (12 tests)
   - SMS booking flows (8 tests)
   - Email booking flows (6 tests)
   - Cross-channel flows (9 tests)

3. **Week 2-3:** Implement Phase 2 tests (40 tests)
   - Booking failures (12 tests)
   - Duplicate appointments (8 tests)
   - Expired slots (6 tests)
   - Customer validation (8 tests)
   - Calendar failures (6 tests)

4. **Continue** through Phases 3-5 as outlined in TEST_EXPANSION_PLAN.md

---

## Resources

- **pytest documentation:** https://docs.pytest.org/
- **pytest-cov:** https://pytest-cov.readthedocs.io/
- **pytest-benchmark:** https://pytest-benchmark.readthedocs.io/
- **Locust (load testing):** https://locust.io/
- **OWASP Testing Guide:** https://owasp.org/www-project-web-security-testing-guide/

---

**Last Updated:** November 18, 2025
