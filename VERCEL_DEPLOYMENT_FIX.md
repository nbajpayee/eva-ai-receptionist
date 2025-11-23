# Vercel Deployment Configuration Fix

**Issue:** The `eva-ai-receptionist` Vercel project is failing to deploy because it's trying to build from the repository root, which doesn't contain a valid Next.js application.

**Current Setup:**
- ✅ `eva-ai-receptionist-q1jo` - Marketing site (building successfully)
- ❌ `eva-ai-receptionist` - Failing (root directory deployment)

## Solution: Configure Root Directory in Vercel

### For the `eva-ai-receptionist` Project:

1. Go to Vercel Dashboard → Your Project (`eva-ai-receptionist`)
2. Navigate to **Settings** → **General**
3. Scroll to **Root Directory**
4. Click **Edit** and set to: `frontend/marketing-site`
5. Click **Save**
6. **Trigger a redeploy** from the Deployments tab

### OR: Delete the Redundant Project

If `eva-ai-receptionist-q1jo` is already deploying the marketing site correctly:

1. Go to Vercel Dashboard → `eva-ai-receptionist` project
2. Navigate to **Settings** → **General**
3. Scroll to bottom → **Delete Project**
4. Keep only `eva-ai-receptionist-q1jo` for the marketing site

## Why This Happens

The repository has a monorepo structure:
```
eva-ai-receptionist/
├── backend/              # Deployed to Railway
├── admin-dashboard/      # Deployed to Vercel
├── frontend/
│   └── marketing-site/   # Deployed to Vercel
└── (root)                # Not a deployable app
```

When Vercel connects to the GitHub repo without a specified root directory, it tries to build from the repository root, which fails because there's no `package.json` or Next.js app at the root level.

## Recommended Configuration

**Project 1: Marketing Site**
- **Name:** `eva-ai-marketing-site` or keep `eva-ai-receptionist-q1jo`
- **Root Directory:** `frontend/marketing-site`
- **Domain:** `getevaai.com`

**Project 2: Admin Dashboard**
- **Name:** `eva-admin-dashboard`
- **Root Directory:** `admin-dashboard`
- **Domain:** `dashboard.getevaai.com`

**Backend:**
- Deployed to Railway (not Vercel)
- Domain: `api.getevaai.com`

## Quick Fix (If You Have CLI Access)

If you have the Vercel CLI installed:

```bash
# Link to the correct project
cd frontend/marketing-site
vercel --prod

# Or set root directory via CLI
vercel --root frontend/marketing-site
```

---

**Status:** The `eva-ai-receptionist-q1jo` project is building correctly. The `eva-ai-receptionist` project failure can be safely ignored if it's redundant, or fixed by configuring the root directory.
