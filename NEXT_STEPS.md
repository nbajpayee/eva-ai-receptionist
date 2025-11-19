# Next Steps - Production Readiness Roadmap
## Eva AI Receptionist - Post-Test Implementation

**Last Updated:** November 18, 2025
**Priority:** HIGH - Production Deployment Preparation

---

## 🎯 Overview

With 157 tests implemented, the next phase focuses on:
1. ✅ Making tests pass (fix missing implementations)
2. 🔒 Security hardening (HIPAA compliance)
3. 🚀 Production deployment readiness
4. 📊 Monitoring & observability

---

## Priority 1: Critical - Make Tests Pass (Week 1)

### 1.1 Install Dependencies & Verify Tests
**Status:** 🔴 BLOCKED - pytest not installed
**Effort:** 1 hour

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-test.txt
pytest --collect-only  # Verify test discovery
pytest -v              # Run all tests
```

**Expected Issues:**
- Import errors for missing modules
- Mock patches pointing to non-existent functions
- Database schema mismatches

**Action:** Fix all failing tests before proceeding

---

### 1.2 Implement Missing Admin API Endpoints
**Status:** 🔴 CRITICAL - Tests exist but endpoints don't
**Effort:** 8 hours

**Missing Endpoints:**
```python
# backend/api_admin.py (NEW FILE NEEDED)

GET  /api/admin/metrics/overview?period=today
GET  /api/admin/calls?page=1&page_size=10
GET  /api/admin/calls/{id}
GET  /api/admin/communications?page=1&page_size=10
GET  /api/admin/communications/{id}
GET  /api/admin/appointments?page=1&page_size=10
```

**Tests Expecting These:**
- `backend/tests/integration/test_voice_booking_flows.py`
- Performance load tests in `locustfile.py`

**Implementation Plan:**
1. Create `backend/api_admin.py`
2. Implement FastAPI router with endpoints
3. Add pagination helpers
4. Register router in `main.py`
5. Add authentication middleware

---

### 1.3 Add Authentication & Authorization
**Status:** 🔴 CRITICAL - Security tests check for this
**Effort:** 6 hours

**Requirements (from security tests):**
- JWT-based authentication for admin routes
- API key authentication for webhooks
- Role-based access control (RBAC)
- Session timeout (15 minutes)

**Files to Create:**
```
backend/auth/
├── __init__.py
├── jwt_auth.py          # JWT token handling
├── rbac.py              # Role-based access control
└── middleware.py        # Auth middleware
```

**Implementation:**
```python
# backend/auth/jwt_auth.py
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta = None):
    # Implementation

def verify_token(credentials: HTTPAuthorizationCredentials = Security(HTTPBearer())):
    # Implementation
```

**Update main.py:**
```python
from auth.middleware import AuthMiddleware

app.add_middleware(AuthMiddleware)

# Protect admin routes
@app.get("/api/admin/metrics", dependencies=[Depends(verify_token)])
```

---

### 1.4 Fix Import Errors & Dependencies
**Status:** 🟡 LIKELY ISSUES
**Effort:** 2 hours

**Common Issues:**
- `conftest.py` imports that don't exist
- Mock patches for non-existent functions
- Missing database columns/tables

**Action Items:**
1. Run `pytest --collect-only` to find import errors
2. Fix each import one by one
3. Update mocks to match actual function signatures
4. Ensure database schema matches test expectations

---

## Priority 2: Security Hardening (Week 2)

### 2.1 Implement HIPAA Compliance Requirements
**Status:** 🔴 CRITICAL for healthcare
**Effort:** 16 hours
**Cost Impact:** See SECURITY_AUDIT_CHECKLIST.md ($102K-$322K)

#### 2.1.1 Encryption at Rest
```python
# Verify Supabase encryption is enabled
# Add column-level encryption for high-sensitivity fields

from cryptography.fernet import Fernet

class EncryptedColumn:
    """Custom SQLAlchemy type for encrypted columns"""
    # Implementation
```

#### 2.1.2 Audit Logging
```python
# backend/middleware/audit_logger.py

class AuditLogMiddleware:
    """Log all PHI access"""
    async def __call__(self, request: Request, call_next):
        # Log: who, what, when, IP address
        # Store in audit_logs table (7-year retention)
```

#### 2.1.3 Access Control
```python
# Implement Row Level Security (RLS) in Supabase
# SQL policies for customer data isolation

CREATE POLICY customer_isolation ON customers
FOR ALL USING (auth.uid() = customer_id OR has_admin_role());
```

#### 2.1.4 Data Masking
```python
# backend/utils/data_masking.py

def mask_phone(phone: str) -> str:
    """Mask phone: +1555***4567"""
    return f"{phone[:5]}***{phone[-4:]}"

def mask_email(email: str) -> str:
    """Mask email: u***r@example.com"""
    local, domain = email.split("@")
    return f"{local[0]}***{local[-1]}@{domain}"
```

---

### 2.2 Sign Business Associate Agreements (BAAs)
**Status:** 🔴 BLOCKER for HIPAA compliance
**Effort:** Legal/procurement - 2-4 weeks

**Required BAAs:**
1. **OpenAI** - For GPT-4 satisfaction scoring
   - Contact: enterprise@openai.com
   - Requirement: Enterprise plan ($$$)

2. **Supabase** - For database hosting
   - URL: https://supabase.com/docs/guides/platform/hipaa
   - Requirement: Pro plan + HIPAA add-on

3. **Twilio** - For SMS
   - URL: https://www.twilio.com/legal/hipaa
   - Requirement: HIPAA-eligible account

4. **SendGrid** - For email
   - Contact sales for BAA

5. **Google Workspace** - For Calendar API
   - Requirement: Business/Enterprise plan
   - URL: https://support.google.com/a/answer/3407074

**Cost Estimate:** +$500-$2,000/month for HIPAA-compliant plans

---

### 2.3 Input Validation & Sanitization
**Status:** 🟡 PARTIAL - Tests exist, implementation needed
**Effort:** 4 hours

**Implementation:**
```python
# backend/validators.py

from pydantic import BaseModel, validator, EmailStr
import re

class BookingRequest(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: EmailStr
    start_time: datetime
    service_type: str

    @validator('customer_phone')
    def validate_phone(cls, v):
        # Strip all non-numeric, normalize to E.164
        cleaned = re.sub(r'\D', '', v)
        if len(cleaned) < 10:
            raise ValueError("Invalid phone number")
        return f"+1{cleaned[-10:]}"  # US normalization

    @validator('service_type')
    def validate_service(cls, v):
        ALLOWED_SERVICES = ['botox', 'fillers', 'hydrafacial', ...]
        if v not in ALLOWED_SERVICES:
            raise ValueError("Invalid service type")
        return v

    @validator('customer_name')
    def sanitize_name(cls, v):
        # Remove potential XSS
        return v.replace('<', '').replace('>', '')
```

---

## Priority 3: Production Deployment (Week 3)

### 3.1 Create Deployment Documentation
**Status:** 🟡 NEEDED
**Effort:** 4 hours

**Files to Create:**
```
docs/
├── DEPLOYMENT.md           # Step-by-step deployment guide
├── ENVIRONMENT_SETUP.md    # Environment variables reference
├── MONITORING.md           # Monitoring & alerting setup
└── TROUBLESHOOTING.md      # Common issues & solutions
```

---

### 3.2 Docker & Docker Compose Setup
**Status:** 🟡 docker-compose.yml exists but incomplete
**Effort:** 6 hours

**Update docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

### 3.3 Database Migrations with Alembic
**Status:** 🔴 NEEDED - Currently using create_all()
**Effort:** 4 hours

```bash
# Setup Alembic
pip install alembic
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

**Update database.py:**
```python
# Remove Base.metadata.create_all()
# Use Alembic migrations instead
```

---

## Priority 4: Monitoring & Observability (Week 4)

### 4.1 Add Prometheus Metrics
**Status:** 🟡 RECOMMENDED
**Effort:** 8 hours

```bash
pip install prometheus-client prometheus-fastapi-instrumentator
```

```python
# backend/main.py
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

# Add Prometheus metrics
Instrumentator().instrument(app).expose(app)

# Custom metrics
from prometheus_client import Counter, Histogram

booking_counter = Counter('bookings_total', 'Total bookings', ['service_type', 'channel'])
api_latency = Histogram('api_request_duration_seconds', 'API request latency')
```

---

### 4.2 Structured Logging
**Status:** 🟡 RECOMMENDED
**Effort:** 4 hours

```python
# backend/logger.py
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()

# Usage
logger.info("booking_created",
    customer_id=123,
    service="botox",
    channel="voice",
    appointment_time="2025-11-20T14:00:00"
)
```

---

### 4.3 Error Tracking (Sentry)
**Status:** 🟡 RECOMMENDED
**Effort:** 2 hours

```bash
pip install sentry-sdk
```

```python
# backend/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,
    environment="production"
)
```

---

## Priority 5: Developer Experience (Week 5)

### 5.1 Pre-commit Hooks
**Status:** 🟡 NICE TO HAVE
**Effort:** 1 hour

```bash
pip install pre-commit
```

**File:** `.pre-commit-config.yaml`
```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        language_version: python3.11

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort

  - repo: https://github.com/pycqa/flake8
    rev: 6.1.0
    hooks:
      - id: flake8

  - repo: local
    hooks:
      - id: pytest-fast
        name: Run fast tests
        entry: pytest -m "not slow"
        language: system
        pass_filenames: false
```

```bash
pre-commit install
```

---

### 5.2 Development Setup Script
**Status:** 🟡 NICE TO HAVE
**Effort:** 2 hours

**File:** `scripts/dev-setup.sh`
```bash
#!/bin/bash
set -e

echo "🚀 Setting up Eva AI Receptionist development environment..."

# Check Python version
python --version | grep "3.11" || {
    echo "❌ Python 3.11 required"
    exit 1
}

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install -r backend/requirements-test.txt

# Set up pre-commit hooks
pre-commit install

# Create .env from template
cp .env.example .env
echo "⚠️  Please update .env with your credentials"

# Initialize database
python backend/scripts/create_supabase_schema.py

# Run tests
pytest backend/tests/ -v

echo "✅ Setup complete! Run: source venv/bin/activate"
```

---

### 5.3 Update Main README
**Status:** 🟡 RECOMMENDED
**Effort:** 2 hours

**Add sections:**
- Testing guide (link to TEST_SUITE_SUMMARY.md)
- Security notice (HIPAA compliance requirements)
- Deployment instructions
- Monitoring & alerting
- Contributing guidelines

---

## Priority 6: Additional Features (Backlog)

### 6.1 Implement Missing Voice Tests
- VAD detection tests (10 tests)
- Interruption handling tests (8 tests)

### 6.2 Implement Missing Messaging Tests
- SMS threading tests (8 tests)
- Email threading tests (7 tests)

### 6.3 Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/admin/metrics")
@limiter.limit("100/minute")
async def get_metrics():
    pass
```

### 6.4 Caching Layer (Redis)
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

@app.on_event("startup")
async def startup():
    redis = aioredis.from_url("redis://localhost")
    FastAPICache.init(RedisBackend(redis), prefix="eva-cache")

@app.get("/api/admin/metrics")
@cache(expire=300)  # 5 minutes
async def get_metrics():
    pass
```

---

## Estimated Timeline & Effort

| Priority | Tasks | Effort | Timeline |
|----------|-------|--------|----------|
| **P1: Critical** | Make tests pass, Admin API, Auth | 17 hours | Week 1 |
| **P2: Security** | HIPAA compliance, BAAs, validation | 20 hours + procurement | Week 2-3 |
| **P3: Deployment** | Docker, docs, migrations | 14 hours | Week 3 |
| **P4: Monitoring** | Prometheus, logging, Sentry | 14 hours | Week 4 |
| **P5: DevEx** | Pre-commit, scripts, README | 5 hours | Week 5 |
| **P6: Backlog** | Additional features | Ongoing | Month 2+ |
| **TOTAL** | | **70 hours** | **5 weeks** |

---

## Budget Estimates

### One-Time Costs
- Security penetration test: $15,000 - $30,000
- HITRUST certification: $50,000 - $150,000
- Development effort (70 hours @ $150/hr): $10,500

### Monthly Recurring
- HIPAA-compliant infrastructure: $500 - $2,000/month
  - Supabase Pro + HIPAA: $250/month
  - OpenAI Enterprise: $500+/month
  - Twilio HIPAA: $100/month
  - SendGrid: $50/month
  - Monitoring (Datadog/NewRelic): $100/month
- Security tools: $100/month

### Annual Costs
- SOC 2 audit: $30,000 - $100,000
- Quarterly penetration tests: $20,000/year
- Compliance consultant: $10,000/year

**Total Year 1:** $150,000 - $350,000

---

## Success Criteria

### Week 1 (Critical)
- [ ] All 157 tests passing
- [ ] Admin API endpoints implemented
- [ ] Authentication working

### Week 3 (Launch Blocker)
- [ ] All 5 BAAs signed
- [ ] Encryption at rest verified
- [ ] Audit logging implemented
- [ ] Docker deployment tested

### Week 5 (Production Ready)
- [ ] Monitoring dashboards live
- [ ] CI/CD pipeline green
- [ ] Documentation complete
- [ ] Load testing successful (100 concurrent users)

### Month 2 (Compliance)
- [ ] Penetration test completed
- [ ] HITRUST certification started
- [ ] SOC 2 audit initiated

---

## Immediate Action Items (Today)

1. ✅ **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   pip install -r requirements-test.txt
   ```

2. ✅ **Run tests and document failures:**
   ```bash
   pytest -v > test_results.txt 2>&1
   ```

3. ✅ **Implement Admin API router:**
   - Create `backend/api_admin.py`
   - Add metrics/calls/communications endpoints
   - Register in main.py

4. ✅ **Add basic authentication:**
   - Create `backend/auth/` module
   - Implement JWT verification
   - Protect admin routes

5. ✅ **Fix failing tests:**
   - Address import errors
   - Update mocks
   - Ensure database schema matches

---

**Ready to start? Let's begin with the most critical items! 🚀**
