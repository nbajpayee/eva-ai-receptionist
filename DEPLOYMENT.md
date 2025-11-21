# Deployment Guide

## ✅ Current Production Status (Nov 21, 2025)

**ALL SERVICES DEPLOYED AND LIVE:**
- **Marketing Site**: https://getevaai.com (Vercel)
- **Admin Dashboard**: https://dashboard.getevaai.com (Vercel)
- **Backend API**: https://api.getevaai.com (Railway)

## Overview

This guide documents the deployment process for Eva AI's three production services.

## 1. Deploy Admin Dashboard to Vercel

### Steps:

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository: `nbajpayee/eva-ai-receptionist`
4. Configure the project:
   - **Project Name**: `eva-admin-dashboard`
   - **Root Directory**: `admin-dashboard`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.getevaai.com
   NEXT_PUBLIC_BACKEND_URL=https://api.getevaai.com
   ```
   **IMPORTANT:** Add these to ALL environments (Production, Preview, Development)

   **Note:** `NEXT_PUBLIC_*` variables are embedded at BUILD TIME. You must redeploy after changing them.

6. Click "Deploy"

7. Configure Custom Domain:
   - Go to Settings → Domains
   - Add `dashboard.getevaai.com`
   - Update DNS records as instructed

### ✅ Current Status:
- **Deployed:** https://dashboard.getevaai.com
- **Environment Variables:** Configured for all environments
- **Build Status:** Passing
- **Features Working:** Analytics, Customer Management, Live Status, Call History

---

## 2. Deploy Backend to Railway

### Steps:

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `nbajpayee/eva-ai-receptionist`
5. Configure the service:
   - **Root Directory**: `backend`
   - Railway will auto-detect Python and use the `Procfile`

6. Add Environment Variables (click on your service → Variables):
   ```
   DATABASE_URL=your-supabase-postgres-url
   OPENAI_API_KEY=your-openai-key
   GOOGLE_CALENDAR_ID=your-calendar-id
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
   MED_SPA_NAME=Your Med Spa Name
   MED_SPA_PHONE=+15551234567
   MED_SPA_ADDRESS=123 Main St
   MED_SPA_HOURS=Mon-Fri 9AM-5PM
   AI_ASSISTANT_NAME=Eva
   PORT=8000
   ```

7. Add Google Calendar credentials (Base64-encoded):
   ```bash
   # Encode credentials on your local machine
   cat backend/credentials.json | base64 > credentials_b64.txt
   cat backend/token.json | base64 > token_b64.txt
   ```

   Add to Railway:
   - `GOOGLE_CREDENTIALS_BASE64`: Paste content of `credentials_b64.txt`
   - `GOOGLE_TOKEN_BASE64`: Paste content of `token_b64.txt`

   **How it works:** Railway runs `railway_setup_credentials.sh` on startup which decodes these and creates the JSON files.

8. Click "Deploy"

9. Configure Custom Domain:
   - Go to Settings → Networking
   - Add `api.getevaai.com`
   - Update DNS records as instructed

### ✅ Current Status:
- **Deployed:** https://api.getevaai.com
- **Environment Variables:** All configured
- **Google Calendar:** Credentials working via base64 decoding
- **Database:** Connected to Supabase
- **WebSocket:** Enabled and tested
- **Health Check:** https://api.getevaai.com/health

---

## 3. Custom Domains ✅ CONFIGURED

### Marketing Site:
- ✅ Vercel Dashboard → Settings → Domains
- ✅ Configured: `getevaai.com`
- ✅ Live at: https://getevaai.com

### Admin Dashboard:
- ✅ Vercel Dashboard → Settings → Domains
- ✅ Configured: `dashboard.getevaai.com`
- ✅ Live at: https://dashboard.getevaai.com

### Backend:
- ✅ Railway Dashboard → Settings → Networking
- ✅ Configured: `api.getevaai.com`
- ✅ Live at: https://api.getevaai.com

---

## Environment Variables Reference

### Backend (Railway)

Required:
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for GPT-4 and Realtime API
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `GOOGLE_CALENDAR_ID` - Google Calendar ID for bookings
- `MED_SPA_NAME` - Your business name
- `MED_SPA_PHONE` - Contact phone number
- `MED_SPA_ADDRESS` - Business address
- `MED_SPA_HOURS` - Operating hours
- `AI_ASSISTANT_NAME` - AI assistant name (default: Eva)

### Admin Dashboard (Vercel)

Required:
- `NEXT_PUBLIC_API_BASE_URL` - Railway backend URL (https://api.getevaai.com)
- `NEXT_PUBLIC_BACKEND_URL` - Railway backend URL (https://api.getevaai.com)

**Important:** Both variables are needed. `NEXT_PUBLIC_API_BASE_URL` is used by API proxy routes.

---

## Cost Estimates

### Vercel (Marketing Site + Admin Dashboard)
- **Hobby Plan**: Free for 2 projects
- No credit card required for hobby plan

### Railway (Backend)
- **Free Tier**: $5/month credit
- **Estimated Usage**: $5-10/month (after free credits)
- Includes:
  - 512 MB RAM
  - 1 GB disk
  - Shared CPU

### Supabase (Database)
- **Free Tier**: Up to 500 MB database, 2 GB bandwidth
- **Paid**: $25/month for production workloads

### Total Estimated Monthly Cost:
- Development: **$0** (free tiers)
- Production: **$5-35/month** depending on usage

---

## Deployment Checklist

- [x] Deploy backend to Railway
- [x] Copy Railway URL (https://api.getevaai.com)
- [x] Deploy admin dashboard to Vercel with environment variables
- [x] Deploy marketing site to Vercel
- [x] Set up custom domains (getevaai.com, dashboard.getevaai.com, api.getevaai.com)
- [x] Test WebSocket connections (voice calls) - Working
- [x] Test admin dashboard connection to backend - Working
- [x] Upload Google Calendar credentials to Railway (base64-encoded)
- [x] Set up CORS for production domains (dashboard.getevaai.com)
- [x] Monitor Railway logs - No errors
- [x] Verify all features working (Analytics, Customer Management, Live Status)

**Deployment Complete:** Nov 21, 2025 ✅

---

## Troubleshooting

### Backend not starting on Railway:
- Check environment variables are set correctly
- Check Railway logs: Dashboard → Deployments → View Logs
- Verify `requirements.txt` includes all dependencies

### Admin dashboard can't connect to backend:
- Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
- Check CORS settings in `backend/main.py`
- Ensure backend is running (check Railway URL in browser)

### WebSocket connections failing:
- Railway supports WebSockets by default
- Check that Railway deployment is using `uvicorn` (not `gunicorn`)
- Verify the WebSocket endpoint is accessible: `wss://your-app.railway.app/ws/voice/test`

---

## Local Development

Backend:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Admin Dashboard:
```bash
cd admin-dashboard
npm run dev
```

Marketing Site:
```bash
cd frontend/marketing-site
npm run dev
```
