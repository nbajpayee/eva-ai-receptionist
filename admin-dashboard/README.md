# Eva Admin Dashboard

Monitor voice calls, appointments, customer interactions, research campaigns, and configuration for the Eva AI voice receptionist.

This app is a Next.js 14 (App Router) project that acts as the primary admin interface on top of the FastAPI backend and Supabase Postgres.

## Features (High Level)

- **Analytics** – overview metrics, daily trends, call volume, satisfaction, conversion.
- **Customers** – customer CRUD, history, medical screening flags.
- **Appointments & Calls** – view recent activity and drill into individual conversations.
- **Messaging / Research / Consultation / Providers** – UI for omnichannel conversations, outbound campaigns, and provider analytics.
- **Settings** – fully dynamic med‑spa configuration (business info, hours, services, providers).
- **Authentication** – Supabase email/password login, guarded routes, user avatar + logout.

## Local Development

From the repo root:

```bash
cd admin-dashboard
npm install
npm run dev
```

Next.js will choose a port automatically (typically `3000`, or `3001` if `3000` is in use). Use the URL printed in the terminal, e.g. `http://localhost:3001`.

### Required Environment Variables

Create `admin-dashboard/.env.local` with at least:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- `NEXT_PUBLIC_SUPABASE_*` must match the Supabase project the backend uses.
- `NEXT_PUBLIC_API_BASE_URL` should point at the FastAPI backend (local: `http://localhost:8000`, production: `https://api.getevaai.com`).

## Authentication & Route Protection

- Supabase auth is handled via `@supabase/ssr`:
  - Client: `src/lib/supabase/client.ts` (`createBrowserClient`).
  - Server/API: `src/lib/supabase/server.ts` (`createServerClient`).
- `src/contexts/auth-context.tsx` exposes `user`, `session`, `profile`, `signIn`, and `signOut`.
- `src/lib/supabase/middleware.ts` and `middleware.ts` gate routes on the server:
  - Unauthenticated users visiting `/` or any protected route (e.g. `/analytics`, `/customers`, `/settings`) are redirected to `/login?redirect=/original`.
  - `/login` itself is always accessible and renders only the login module.
- `src/components/layout/app-shell.tsx` applies client-side guards:
  - Shows a minimal "Loading" shell while auth state is being determined.
  - If `user` is missing on any non-`/login` route, it does not render the dashboard and lets the router redirect to `/login`.
  - Once authenticated, it renders the full layout (sidebar, header, and `UserNav` avatar with logout menu).

## API Proxying to FastAPI Backend

- All dashboard data is fetched through internal Next.js API routes under `src/app/api/admin/*`.
- These routes proxy to the FastAPI backend using `NEXT_PUBLIC_API_BASE_URL`:
  - Example: `/api/admin/metrics/overview` → `${NEXT_PUBLIC_API_BASE_URL}/api/admin/metrics/overview`.
- Auth forwarding:
  - `src/app/api/admin/_auth.ts` uses the server Supabase client to read the current session.
  - If a user is present, it injects `Authorization: Bearer <access_token>` into the outbound request.
  - If there is no session, routes return `401 { error: "Not authenticated" }`.
- Backend auth:
  - FastAPI decodes the Supabase JWT and applies role-based checks (see `backend/auth.py`).

## CORS & Internal URLs

- UI pages that fetch directly from internal APIs (e.g. dashboard metrics, messaging, call detail) use **relative** URLs like `/api/admin/...`.
- This keeps requests on the same origin/port as the Next.js app and avoids CORS issues when dev runs on ports other than `3000`.

## Known Limitations

- The Live Status widget on the main dashboard has been temporarily disabled while the corresponding FastAPI `/api/admin/live-status` endpoint is finalized and deployed. The Next.js proxy route still exists but should not be re‑enabled in the UI until the backend endpoint is live.

## Production

- Deployed via Vercel as `https://dashboard.getevaai.com`.
- Uses the same Supabase project and backend API as documented in the root `README.md` and `CLAUDE.md`.
