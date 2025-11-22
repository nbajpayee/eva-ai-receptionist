# Authentication Setup Guide

This guide explains how to set up authentication for the Ava Admin Dashboard using Supabase Auth.

## Overview

The authentication system uses:
- **Supabase Auth** for user management and JWT token generation
- **Row Level Security (RLS)** for database-level access control
- **Role-Based Access Control (RBAC)** with three roles: Owner, Staff, and Provider
- **Next.js Middleware** to protect frontend routes
- **FastAPI Dependencies** to protect backend API routes

## Architecture

### Frontend (Next.js)
- **Auth Context** (`admin-dashboard/src/contexts/auth-context.tsx`): Manages authentication state
- **Middleware** (`admin-dashboard/middleware.ts`): Protects routes from unauthenticated access
- **Supabase Clients**:
  - Browser client (`src/lib/supabase/client.ts`)
  - Server client (`src/lib/supabase/server.ts`)
  - Middleware client (`src/lib/supabase/middleware.ts`)

### Backend (FastAPI)
- **Auth Module** (`backend/auth.py`): JWT validation and role-based dependencies
- **Protected Routes**: All `/api/admin/*` routes require authentication

### Database (Supabase PostgreSQL)
- **Profiles Table**: Stores user roles and profile information
- **RLS Policies**: Database-level security for all tables
- **Automatic Profile Creation**: Trigger creates profile when user signs up

## Setup Instructions

### Step 1: Run Database Migration

Execute the SQL schema in Supabase SQL Editor:

```bash
# Copy the contents of backend/scripts/create_auth_schema.sql
# Paste into Supabase SQL Editor and run
```

Or use the Supabase CLI:

```bash
supabase db push --file backend/scripts/create_auth_schema.sql
```

This creates:
- `profiles` table with role management
- RLS policies for all tables
- Triggers for automatic profile creation
- Functions for timestamp management

### Step 2: Configure Environment Variables

#### Admin Dashboard (.env.local)

```bash
# Copy from .env.example
cd admin-dashboard
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

#### Backend (.env in project root)

```bash
# Add to existing .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these values:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Create First Admin User

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Click "Create user"
5. Copy the user's UUID
6. Go to SQL Editor and run:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES (
    'paste-user-uuid-here',
    'admin@yourdomain.com',
    'Admin User',
    'owner'
)
ON CONFLICT (id) DO UPDATE SET role = 'owner';
```

#### Option B: Using Supabase Auth API

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Create user via API (requires service role key)
curl -X POST 'https://your-project.supabase.co/auth/v1/admin/users' \
-H "apikey: YOUR_SERVICE_ROLE_KEY" \
-H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
-H "Content-Type: application/json" \
-d '{
  "email": "admin@yourdomain.com",
  "password": "secure-password-here",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "Admin User",
    "role": "owner"
  }
}'
```

### Step 4: Test Authentication

1. Start the backend:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Start the admin dashboard:
```bash
cd admin-dashboard
npm run dev
```

3. Navigate to http://localhost:3000
4. You should be redirected to `/login`
5. Log in with your admin credentials
6. You should be redirected to the dashboard

### Step 5: Verify RLS Policies

Test that RLS is working:

1. Try accessing data without authentication (should fail)
2. Log in and access data (should succeed)
3. Check that users can only see data according to their role

## Role Permissions

### Owner
- Full access to all features
- Can create, update, and delete all resources
- Can manage other users
- Can view all data

### Staff
- Can view all data
- Can manage customers and appointments
- Can manage conversations and calls
- Cannot delete users or critical data

### Provider
- Can view their own appointments and consultations
- Can update their own profile
- Can record consultation notes
- Cannot access other providers' data

## Protected Routes

### Frontend Routes (Middleware)
All routes except `/login` require authentication:
- `/` (Dashboard)
- `/analytics`
- `/customers`
- `/appointments`
- `/messaging`
- `/voice`
- `/research`
- `/consultation`
- `/providers`
- `/settings`

### Backend Routes (FastAPI Dependencies)

Use authentication dependencies in your route handlers:

```python
from auth import get_current_user, require_owner, require_staff

# Require any authenticated user
@app.get("/api/admin/data")
async def get_data(user: User = Depends(get_current_user)):
    # user is authenticated
    return {"user_id": user.id, "role": user.role}

# Require owner role
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: str, user: User = Depends(require_owner)):
    # Only owners can access
    pass

# Require staff or owner role
@app.get("/api/admin/customers")
async def get_customers(user: User = Depends(require_staff)):
    # Staff and owners can access
    pass

# Optional authentication
from auth import get_current_user_optional

@app.get("/api/public/data")
async def public_data(user: Optional[User] = Depends(get_current_user_optional)):
    # Works with or without auth
    if user:
        return {"authenticated": True, "user_id": user.id}
    return {"authenticated": False}
```

## Troubleshooting

### Issue: Users can't log in

**Solution:**
1. Check that Supabase URL and keys are correct in `.env.local`
2. Verify email confirmation is disabled for development:
   - Supabase Dashboard → Authentication → Settings
   - Disable "Enable email confirmations"
3. Check that user exists in Authentication → Users
4. Verify profile exists in profiles table

### Issue: "Invalid token" errors

**Solution:**
1. Check that JWT secret is correctly configured
2. Verify token hasn't expired
3. Check that `SUPABASE_SERVICE_ROLE_KEY` is set in backend `.env`
4. Clear browser cookies and log in again

### Issue: RLS policies blocking access

**Solution:**
1. Verify user's profile has correct role in profiles table
2. Check that RLS policies were applied correctly:
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```
3. Ensure auth.uid() is returning correct user ID:
```sql
SELECT auth.uid();  -- Should return your user ID when authenticated
```

### Issue: Middleware redirect loop

**Solution:**
1. Check that `/login` route is not included in protected routes
2. Verify middleware config in `admin-dashboard/middleware.ts`
3. Clear Next.js cache: `rm -rf admin-dashboard/.next`

### Issue: CORS errors on API calls

**Solution:**
1. Add frontend URL to CORS allowed origins in `backend/main.py`
2. Ensure cookies are being sent with requests
3. Check that Authorization header is included in requests

## Security Best Practices

### Production Checklist

- [ ] Enable email confirmation in Supabase Auth settings
- [ ] Set up password strength requirements
- [ ] Enable rate limiting on auth endpoints
- [ ] Use HTTPS/WSS for all connections
- [ ] Rotate JWT secrets regularly
- [ ] Enable MFA for admin accounts
- [ ] Set up session timeout (currently 1 hour default)
- [ ] Monitor failed login attempts
- [ ] Enable audit logging in Supabase
- [ ] Set up alerts for suspicious activity

### JWT Token Validation

The current implementation uses signature verification disabled because Supabase validates tokens on their end. For additional security, you can:

1. Fetch Supabase's public key:
```python
import httpx

async def get_supabase_public_key():
    url = f"{settings.SUPABASE_URL}/rest/v1/"
    response = await httpx.get(f"{url}/.well-known/jwks.json")
    return response.json()
```

2. Enable signature verification in `backend/auth.py`

### RLS Policy Testing

Test RLS policies with different user roles:

```sql
-- Test as specific user
SET request.jwt.claim.sub = 'user-uuid-here';

-- Try queries that should/shouldn't work
SELECT * FROM customers;  -- Should work for authenticated users
DELETE FROM customers WHERE id = 1;  -- Should fail for non-owners
```

## Adding New Users

### Via Dashboard (Recommended for Production)

Owners can add new users through the Settings page (to be implemented):
1. Navigate to Settings → Users
2. Click "Add User"
3. Enter email, name, and select role
4. User receives invitation email
5. User sets password and logs in

### Programmatically

Create users via API:

```python
from supabase import create_client

supabase = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY  # Use service role key!
)

# Create user
user = supabase.auth.admin.create_user({
    "email": "newuser@example.com",
    "password": "temporary-password",
    "email_confirm": True,
    "user_metadata": {
        "full_name": "New User",
        "role": "staff"
    }
})

print(f"Created user: {user.id}")
```

## Migration from No Auth

If you're migrating from a non-authenticated setup:

1. Run the authentication schema SQL script
2. Create admin user account
3. Update all API routes to require authentication
4. Update frontend components to use AuthContext
5. Test all functionality with authentication enabled
6. Deploy with environment variables configured

## Next Steps

- [ ] Implement user management UI in Settings page
- [ ] Add password reset functionality
- [ ] Set up email templates for invitations
- [ ] Enable MFA for owner accounts
- [ ] Add session management (view active sessions, logout all)
- [ ] Implement audit log for sensitive actions

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check FastAPI logs: `uvicorn main:app --log-level debug`
3. Check Next.js logs in terminal
4. Review browser console for frontend errors
5. Test authentication with Postman/curl to isolate issues
