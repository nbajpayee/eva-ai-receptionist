# Deployment Guide

## Overview

- **Marketing Site**: Vercel (already configured)
- **Admin Dashboard**: Vercel
- **Backend API**: Railway

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
   NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend.railway.app
   ```
   (You'll get this URL after deploying the backend)

6. Click "Deploy"

### After Backend Deployment:

Update the environment variable `NEXT_PUBLIC_BACKEND_URL` with your Railway backend URL.

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

7. Add Google Calendar credentials:
   - Upload `credentials.json` as a secret file
   - Upload `token.json` as a secret file (if you have it)

8. Click "Deploy"

9. Once deployed, copy the Railway URL (e.g., `https://your-app.railway.app`)

10. Go back to Vercel and update `NEXT_PUBLIC_BACKEND_URL` in your admin dashboard

---

## 3. Custom Domains (Optional)

### Marketing Site:
- Vercel Dashboard → Settings → Domains
- Add: `eva-ai.com`

### Admin Dashboard:
- Vercel Dashboard → Settings → Domains
- Add: `admin.eva-ai.com` or `dashboard.eva-ai.com`

### Backend:
- Railway Dashboard → Settings → Domains
- Add: `api.eva-ai.com`

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
- `NEXT_PUBLIC_BACKEND_URL` - Railway backend URL

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

- [ ] Deploy backend to Railway
- [ ] Copy Railway URL
- [ ] Deploy admin dashboard to Vercel with `NEXT_PUBLIC_BACKEND_URL`
- [ ] Marketing site already deployed
- [ ] Set up custom domains (optional)
- [ ] Test WebSocket connections (voice calls)
- [ ] Test admin dashboard connection to backend
- [ ] Upload Google Calendar credentials to Railway
- [ ] Set up CORS for production domains
- [ ] Monitor Railway logs for any errors

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
