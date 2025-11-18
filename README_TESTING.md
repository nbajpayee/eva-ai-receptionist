# Testing Guide - Eva AI Receptionist

## Quick Start

### Run All Tests
```bash
cd backend
pytest
```

### Run Specific Test Categories
```bash
# Integration tests only
pytest -m integration

# Security tests only
pytest -m security

# Performance benchmarks
pytest -m performance --benchmark-only

# Skip slow tests
pytest -m "not slow"
```

### Run with Coverage
```bash
pytest --cov --cov-report=html
open coverage_html/index.html
```

## Test Organization

### By Phase
- **Phase 1:** Integration Tests (35 tests)
- **Phase 2:** Edge Cases (40 tests)
- **Phase 3-5:** Security, Analytics, Performance (82 tests)

### By Marker
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.security` - Security tests
- `@pytest.mark.performance` - Benchmarks
- `@pytest.mark.slow` - Slow tests
- `@pytest.mark.hipaa` - HIPAA compliance

### By Directory
```
backend/tests/
├── integration/     # 35 tests - Full flow testing
├── edge_cases/      # 40 tests - Error scenarios
├── security/        # 30 tests - Security vulnerabilities
├── analytics/       # 10 tests - AI scoring
└── performance/     # 10+ tests - Benchmarks
```

## Test Examples

### Run Integration Tests
```bash
pytest tests/integration/test_voice_booking_flows.py -v
```

### Run Security Tests
```bash
pytest tests/security/ -v
```

### Run Performance Benchmarks
```bash
pytest tests/performance/test_api_benchmarks.py --benchmark-only
```

### Load Testing
```bash
locust -f tests/performance/locustfile.py --headless --users 50 --run-time 5m
```

## CI/CD

Tests run automatically on every push via GitHub Actions:
- Linting (flake8, black, isort)
- Unit tests
- Integration tests
- Security tests
- Coverage reporting
- Security scanning (Bandit, Safety)

## Documentation

- **TEST_SUITE_SUMMARY.md** - Complete test inventory
- **TEST_EXPANSION_PLAN.md** - Full implementation roadmap
- **TEST_IMPLEMENTATION_GUIDE.md** - Developer guide with examples

## Coverage Goals

- **Target:** 85%+ code coverage
- **Current:** 157 tests implemented
- **Focus Areas:**
  - All booking flows (voice, SMS, email)
  - Edge cases and error handling
  - Security vulnerabilities
  - HIPAA compliance
  - Performance baselines

## Troubleshooting

### Tests Not Found
```bash
# Ensure you're in the backend directory
cd backend
pytest --collect-only
```

### Import Errors
```bash
# Install test dependencies
pip install -r requirements-test.txt
```

### Database Errors
```bash
# Tests use SQLite by default
export TEST_DATABASE_URL="sqlite:///test.db"
```

For more details, see **TEST_SUITE_SUMMARY.md**.
