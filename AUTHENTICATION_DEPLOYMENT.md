# Authentication Deployment Guide

This guide covers deploying the authentication system to production (Vercel + Railway).

## Production Deployment Checklist

### Pre-Deployment

- [ ] Run authentication schema SQL in production Supabase
- [ ] Create admin user account in production
- [ ] Configure environment variables in Vercel
- [ ] Configure environment variables in Railway
- [ ] Test authentication flow in staging
- [ ] Enable email confirmation in Supabase
- [ ] Set up password policies
- [ ] Configure CORS for production domains

## Environment Variables

### Vercel (Admin Dashboard)

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

```bash
# Required for all environments (Production, Preview, Development)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend API URLs (change for production)
NEXT_PUBLIC_API_BASE_URL=https://api.getevaai.com
NEXT_PUBLIC_BACKEND_URL=https://api.getevaai.com
```

**Important:**
- `NEXT_PUBLIC_*` variables are embedded at build time
- Any changes require a new deployment
- Use different values for Preview and Development environments

### Railway (Backend API)

Add these to your Railway service variables:

```bash
# Existing variables...

# Add Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**Security Note:**
- `SUPABASE_SERVICE_ROLE_KEY` has admin privileges
- Keep it secret and never expose to frontend
- Only use in backend/server-side code

## Database Setup (Production Supabase)

### Step 1: Run Authentication Schema

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `backend/scripts/create_auth_schema.sql`
3. Paste and run the SQL
4. Verify tables were created in Table Editor

### Step 2: Enable Row Level Security

Verify RLS is enabled on all tables:

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Should show rowsecurity = true for:
-- - profiles
-- - customers
-- - appointments
-- - call_sessions
-- - conversations
```

### Step 3: Test RLS Policies

```sql
-- Test as authenticated user
SET request.jwt.claim.sub = 'test-user-id';
SELECT * FROM customers;  -- Should work

-- Test without auth
RESET request.jwt.claim.sub;
SELECT * FROM customers;  -- Should return empty or error
```

## Create Production Admin User

### Option 1: Supabase Dashboard (Recommended)

1. Go to Authentication → Users
2. Click "Add user"
3. Enter:
   - Email: your production admin email
   - Password: strong password (20+ characters)
   - Confirm email: Yes (or send confirmation email)
4. Click "Create user"
5. Copy the User ID

6. Go to SQL Editor and run:
```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES (
    'paste-user-id-here',
    'admin@getevaai.com',
    'Admin User',
    'owner'
)
ON CONFLICT (id) DO UPDATE SET role = 'owner';
```

### Option 2: Via API (for automation)

```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/admin/users' \
-H "apikey: YOUR_SERVICE_ROLE_KEY" \
-H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
-H "Content-Type: application/json" \
-d '{
  "email": "admin@getevaai.com",
  "password": "GenerateSecurePasswordHere!2024",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "Admin User",
    "role": "owner"
  }
}'
```

## Supabase Auth Configuration

### Email Settings

1. Go to Authentication → Settings → Email Templates
2. Customize email templates:
   - Confirmation email
   - Magic link
   - Password reset
   - Email change

3. Configure SMTP (optional, for custom email domain):
   - Settings → Authentication → SMTP Settings
   - Or use Supabase's default email service

### Authentication Policies

1. Go to Authentication → Settings
2. Configure:
   - **Email Confirmations**: Enable for production
   - **Email Auth**: Enable
   - **Magic Links**: Enable (optional)
   - **Social Auth**: Configure if needed (Google, etc.)

### Password Policies

```sql
-- Set minimum password length (Supabase dashboard)
-- Authentication → Settings → Password Settings

-- Or via SQL (custom validation):
CREATE OR REPLACE FUNCTION validate_password()
RETURNS TRIGGER AS $$
BEGIN
    IF LENGTH(NEW.encrypted_password) < 12 THEN
        RAISE EXCEPTION 'Password must be at least 12 characters';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_password_strength
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION validate_password();
```

### Rate Limiting

Configure rate limiting in Authentication → Settings:
- **Requests per hour**: 100 (default)
- **SMS per hour**: 10
- **Failed attempts**: 5 before lockout

## CORS Configuration

### Backend (Railway)

Update `backend/main.py` CORS settings:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dashboard.getevaai.com",  # Production
        "https://getevaai.com",            # Marketing site
        "http://localhost:3000",           # Local development
        "http://localhost:3001",           # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Supabase

1. Go to Settings → API
2. Add allowed origins:
   - `https://dashboard.getevaai.com`
   - `https://api.getevaai.com`
   - (Include localhost for development if needed)

## Deployment Steps

### 1. Deploy Backend (Railway)

```bash
# Commit authentication changes
git add backend/auth.py backend/scripts/create_auth_schema.sql
git commit -m "feat: Add authentication system"

# Push to branch (Railway auto-deploys)
git push origin your-branch-name
```

Verify:
1. Check Railway logs for successful deployment
2. Test health endpoint: `https://api.getevaai.com/health`
3. Test auth endpoint with JWT token

### 2. Deploy Admin Dashboard (Vercel)

```bash
# Commit frontend changes
git add admin-dashboard/src/
git commit -m "feat: Add authentication to admin dashboard"

# Push to trigger Vercel deployment
git push origin your-branch-name
```

Verify:
1. Check Vercel deployment logs
2. Navigate to `https://dashboard.getevaai.com`
3. Should redirect to `/login`
4. Test login with admin credentials

### 3. Run Database Migration

```bash
# Connect to production Supabase and run:
# backend/scripts/create_auth_schema.sql

# Or use Supabase CLI:
supabase db push --project-ref your-project-ref
```

### 4. Create Admin User

Follow "Create Production Admin User" section above.

### 5. Test End-to-End

1. **Login Test**:
   - Visit https://dashboard.getevaai.com
   - Should redirect to /login
   - Log in with admin credentials
   - Should redirect to dashboard

2. **API Authorization Test**:
```bash
# Get token by logging in via browser, then check Network tab

# Test authenticated endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.getevaai.com/api/admin/metrics/overview?period=today
```

3. **Role-Based Access Test**:
   - Log in as owner
   - Try to access all features (should work)
   - Create a staff user
   - Log in as staff
   - Try to delete a customer (should fail)

4. **RLS Test**:
   - Log in and view customers
   - Open browser devtools → Application → Cookies
   - Delete auth cookies
   - Refresh page (should redirect to login)

## Monitoring

### Set Up Alerts

1. **Supabase Monitoring**:
   - Dashboard → Logs → Enable alerts
   - Monitor:
     - Failed login attempts
     - RLS policy violations
     - API rate limits exceeded

2. **Backend Logging** (Railway):
```python
# Add to backend/auth.py
import logging

logger = logging.getLogger(__name__)

# Log authentication events
logger.info(f"User {user_id} logged in successfully")
logger.warning(f"Failed login attempt for {email}")
logger.error(f"Invalid JWT token: {error}")
```

3. **Frontend Error Tracking**:
   - Consider Sentry for Next.js
   - Track authentication errors
   - Monitor failed API calls

### Health Checks

Create authenticated health check endpoint:

```python
# backend/main.py
from auth import get_current_user

@app.get("/api/admin/health")
async def admin_health(user: User = Depends(get_current_user)):
    return {
        "status": "healthy",
        "user_id": user.id,
        "role": user.role,
        "timestamp": datetime.utcnow()
    }
```

## Rollback Plan

If authentication causes issues in production:

### Quick Disable (Emergency)

1. **Frontend**: Remove middleware temporarily
```bash
# In Vercel, add environment variable:
DISABLE_AUTH=true

# Update middleware.ts to check this flag
```

2. **Backend**: Make auth optional
```python
# Change all routes to use optional auth
from auth import get_current_user_optional

@app.get("/api/admin/data")
async def get_data(user: Optional[User] = Depends(get_current_user_optional)):
    # Temporarily allow unauthenticated access
    pass
```

### Full Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Redeploy both services
# (Vercel and Railway will auto-deploy)
```

## Security Hardening

### Production Checklist

- [ ] Enable email confirmation
- [ ] Set up MFA for admin accounts
- [ ] Configure password strength requirements (min 12 chars)
- [ ] Enable rate limiting (max 100 requests/hour)
- [ ] Set up session timeout (1 hour)
- [ ] Monitor failed login attempts (alert after 5)
- [ ] Use HTTPS only (Vercel/Railway handle this)
- [ ] Rotate JWT secrets every 90 days
- [ ] Enable audit logging
- [ ] Set up backup admin account
- [ ] Document emergency access procedures
- [ ] Test password reset flow
- [ ] Test account lockout after failed attempts
- [ ] Verify RLS policies on all tables
- [ ] Test with multiple user roles

### JWT Token Security

```python
# backend/auth.py improvements for production:

from jose import jwt, JWTError
import httpx

async def verify_jwt_signature(token: str) -> dict:
    """
    Verify JWT signature against Supabase public key
    More secure than disabling verification
    """
    # Fetch Supabase JWKS (JSON Web Key Set)
    jwks_url = f"{settings.SUPABASE_URL}/.well-known/jwks.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url)
        jwks = response.json()

    # Verify with public key
    payload = jwt.decode(
        token,
        jwks,
        algorithms=["RS256"],
        options={"verify_signature": True}
    )
    return payload
```

### CSRF Protection

Enable CSRF tokens for state-changing operations:

```python
# backend/main.py
from fastapi_csrf_protect import CsrfProtect

@app.post("/api/admin/delete")
async def delete_item(
    csrf_token: str = Depends(CsrfProtect),
    user: User = Depends(require_owner)
):
    # CSRF protection + authentication
    pass
```

## Troubleshooting Production Issues

### Issue: Users can't log in

1. Check Supabase Dashboard → Logs → Auth Logs
2. Verify environment variables in Vercel
3. Check that email confirmation is properly configured
4. Verify user exists in Authentication → Users
5. Check browser console for errors

### Issue: "Invalid token" in production

1. Verify `SUPABASE_SERVICE_ROLE_KEY` in Railway
2. Check token expiration (default 1 hour)
3. Verify CORS headers in browser Network tab
4. Test with Postman to isolate frontend/backend issue

### Issue: RLS blocking legitimate access

1. Check user's role in profiles table
2. Verify RLS policies were applied correctly
3. Check Supabase logs for RLS errors
4. Test with SQL Editor using `SET request.jwt.claim.sub`

### Issue: Deployment fails

1. Check build logs in Vercel/Railway
2. Verify all dependencies installed
3. Check TypeScript compilation errors
4. Verify environment variables are set

## Post-Deployment Tasks

- [ ] Test login from different browsers/devices
- [ ] Verify email confirmations are sent
- [ ] Test password reset flow
- [ ] Create additional staff/provider accounts
- [ ] Set up monitoring dashboards
- [ ] Document credentials in secure location (1Password, etc.)
- [ ] Train team on authentication system
- [ ] Set up backup admin access
- [ ] Schedule JWT secret rotation
- [ ] Review and test disaster recovery procedures

## Support

For production authentication issues:
1. Check Supabase Dashboard → Logs
2. Check Railway logs: `railway logs`
3. Check Vercel logs in dashboard
4. Review AUTHENTICATION_SETUP.md for debugging steps
5. Contact Supabase support for auth-specific issues
