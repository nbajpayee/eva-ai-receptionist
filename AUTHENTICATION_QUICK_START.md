# Authentication Quick Start Guide

Quick reference for common authentication tasks.

## 🚀 Quick Setup (5 minutes)

### 1. Run Database Schema
```sql
-- In Supabase SQL Editor, paste and run:
-- backend/scripts/create_auth_schema.sql
```

### 2. Set Environment Variables

**Admin Dashboard** (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Backend** (`.env`):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Admin User

**Via Supabase Dashboard:**
1. Authentication → Users → Add user
2. Enter email and password
3. Copy user ID
4. SQL Editor:
```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('USER_ID_HERE', 'admin@example.com', 'Admin', 'owner');
```

### 4. Start Services
```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend
cd admin-dashboard && npm run dev
```

### 5. Test
- Visit http://localhost:3000
- Log in with admin credentials
- Should see dashboard

## 📋 Common Tasks

### Protect a New API Route

```python
from auth import get_current_user, User

@app.get("/api/admin/new-endpoint")
async def new_endpoint(user: User = Depends(get_current_user)):
    return {"message": "Authenticated!", "user_id": user.id}
```

### Require Owner Role

```python
from auth import require_owner

@app.delete("/api/admin/sensitive-action")
async def sensitive_action(user: User = Depends(require_owner)):
    # Only owners can access
    return {"message": "Owner access granted"}
```

### Check User Role in Code

```python
from auth import get_current_user

@app.get("/api/admin/data")
async def get_data(user: User = Depends(get_current_user)):
    if user.has_role("owner", "staff"):
        return {"data": "full access"}
    else:
        return {"data": "limited access"}
```

### Use Auth in Frontend Component

```tsx
'use client'

import { useAuth } from '@/contexts/auth-context'

export function MyComponent() {
  const { user, profile, signOut } = useAuth()

  if (!user) {
    return <div>Please log in</div>
  }

  return (
    <div>
      <p>Welcome, {profile?.full_name}</p>
      <p>Role: {profile?.role}</p>
      <button onClick={signOut}>Logout</button>
    </div>
  )
}
```

### Check Role in Frontend

```tsx
import { useAuth } from '@/contexts/auth-context'

export function AdminOnlyButton() {
  const { hasRole } = useAuth()

  if (!hasRole('owner')) {
    return null  // Hide for non-owners
  }

  return <button>Admin Action</button>
}
```

### Make Authenticated API Call

```tsx
import { createClient } from '@/lib/supabase/client'

async function fetchData() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch('http://localhost:8000/api/admin/data', {
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    }
  })

  return response.json()
}
```

## 🔑 User Management

### Create New User (Owner Only)

**Via Supabase Dashboard:**
1. Authentication → Users → Add user
2. Enter email, password
3. Note: Profile will be auto-created with role 'staff'

**Change User Role:**
```sql
UPDATE profiles SET role = 'owner' WHERE email = 'user@example.com';
```

### Reset User Password

**Via Supabase Dashboard:**
1. Authentication → Users
2. Find user → Click ⋮ → Reset Password
3. User receives email with reset link

**Programmatically:**
```typescript
const supabase = createClient()
await supabase.auth.resetPasswordForEmail('user@example.com')
```

### Delete User

**Via Supabase Dashboard:**
1. Authentication → Users
2. Find user → Click ⋮ → Delete User
3. Profile will be auto-deleted (CASCADE)

## 🐛 Quick Troubleshooting

### "Invalid token" error
```bash
# Check backend logs for details
# Verify SUPABASE_SERVICE_ROLE_KEY is set
# Try logging out and back in
```

### Can't log in
```bash
# Check Supabase → Authentication → Users (user exists?)
# Check profiles table (profile exists?)
# Try password reset
# Check browser console for errors
```

### Unauthorized access
```bash
# Check user role in profiles table
# Verify RLS policies are enabled
# Check backend route has correct auth dependency
# Verify JWT token is being sent in header
```

### Redirect loop
```bash
# Clear Next.js cache: rm -rf .next
# Check middleware.ts protectedRoutes
# Verify /login is not in protectedRoutes
```

## 📚 Role Quick Reference

| Role | Permissions |
|------|------------|
| **owner** | Full access, can manage users, delete data |
| **staff** | View/edit customers, appointments, conversations |
| **provider** | View own appointments, add consultation notes |

## 🔒 Security Checklist

Development:
- [x] Auth system implemented
- [x] RLS policies enabled
- [x] JWT validation working
- [x] Role-based access control
- [ ] Test all three roles

Production:
- [ ] Enable email confirmation
- [ ] Set strong password requirements
- [ ] Enable rate limiting
- [ ] Set up MFA for owners
- [ ] Configure session timeout
- [ ] Monitor failed logins
- [ ] Set up audit logs

## 📖 Full Documentation

- **Setup Guide**: `AUTHENTICATION_SETUP.md`
- **Deployment**: `AUTHENTICATION_DEPLOYMENT.md`
- **Backend Auth**: `backend/auth.py`
- **Frontend Context**: `admin-dashboard/src/contexts/auth-context.tsx`
- **Database Schema**: `backend/scripts/create_auth_schema.sql`

## 🆘 Need Help?

1. Check the error message carefully
2. Look in Supabase Dashboard → Logs
3. Check browser console (F12)
4. Review backend logs
5. Refer to full documentation above
6. Test with Postman to isolate issue

## Example: Full Authentication Flow

```typescript
// 1. User visits dashboard
// → Middleware checks auth
// → Redirects to /login if not authenticated

// 2. User logs in
const { signIn } = useAuth()
await signIn('user@example.com', 'password')

// 3. AuthContext fetches user profile
// → Includes role from profiles table

// 4. User makes API call
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch('/api/admin/data', {
  headers: {
    'Authorization': `Bearer ${session?.access_token}`
  }
})

// 5. Backend validates JWT
// → Extracts user info
// → Checks role permissions
// → Returns data or 403 Forbidden

// 6. User logs out
const { signOut } = useAuth()
await signOut()
// → Clears session
// → Redirects to /login
```

That's it! You're ready to use authentication in your app. 🎉
