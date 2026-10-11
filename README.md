# Scalable URL Shortener

A full-stack URL shortener with **React + Vite**, **Node.js + Express**, **PostgreSQL**, and **Redis**. Includes Base62 IDs, custom aliases, optional expiration, rate limiting, Redis cache with database fallback, and health checks.

## Project structure
- `backend/` — Express API and PostgreSQL model
- `frontend/` — React user interface
- `docker-compose.yml` — local PostgreSQL and Redis
- `render.yaml` — Render blueprint (API + static frontend)

## Run locally (Node.js 20+ and Docker Desktop)
1. From the project root: `docker compose up -d`
2. In `backend/`, copy `.env.example` to `.env`, run `npm install`, then `npm start`.
3. In `frontend/`, copy `.env.example` to `.env`, run `npm install`, then `npm run dev`.
4. Open `http://localhost:5173`.

Windows PowerShell: use `Copy-Item .env.example .env` and `npm.cmd` instead of `npm` if execution policy blocks npm.ps1.

## API
- `GET /health` — health check
- `POST /api/shorten` — JSON `{ "originalUrl": "https://example.com", "customAlias": "optional", "expiresInDays": 7 }`
- `GET /:shortCode` — 302 redirect, 404 not found, 410 expired

Test: `curl -X POST http://localhost:3000/api/shorten -H "Content-Type: application/json" -d '{"originalUrl":"https://example.com"}'`

## Deploy to Render
1. Push the **contents of this ZIP** to your GitHub repository root.
2. Create a **Render PostgreSQL** database and a **Render Key Value** Redis-compatible instance, preferably in the same region as the API. Render plan availability and pricing can vary.
3. Create an API **Web Service** from this repository with **Root Directory `backend`**, Build Command `npm install`, Start Command `npm start`. Alternatively use the included `render.yaml` Blueprint and supply its prompted secrets.
4. Set API environment variables:
   - `DATABASE_URL` = PostgreSQL **internal database URL** (copy from Render)
   - `REDIS_URL` = Key Value **internal connection URL** (copy from Render)
   - `DB_SSL=false` for an internal Render PostgreSQL connection that does not require SSL; set `true` if your database provider requires SSL
   - `BASE_URL` = your deployed API address, e.g. `https://your-api.onrender.com`
   - `FRONTEND_URL` = your deployed frontend address, e.g. `https://your-ui.onrender.com`
   - `TRUST_PROXY=true`
5. Create a Render **Static Site** with Root Directory `frontend`, Build Command `npm install && npm run build`, Publish Directory `dist`, and build environment variable `VITE_API_URL` set to your API address. Redeploy frontend if this variable changes.
6. Update `FRONTEND_URL` in API to the actual frontend URL and redeploy/restart if necessary.
7. Test API `/health`, then shorten a link in the UI and open the result.

**Important:** This repository has a **new endpoint** `/api/shorten` (not the old `/shorten`). Deploy frontend and backend together. The database schema uses `BIGSERIAL` and can work with an existing `urls` table that has compatible columns, but migration may be needed if your existing table differs.

**Security notes:** `.env` is ignored by Git. Never commit database credentials. Restrict Redis access to internal networking. Rate limiting is per-process memory by default; use a shared Redis-backed rate-limit store when running multiple API instances. For public production use, add abuse/malware screening and observability. The service intentionally redirects to user-submitted destinations.

**Architecture:** Client → API/load balancer → stateless Express instances → Redis (cache) / PostgreSQL (durable mapping). PostgreSQL sequence ensures unique Base62 IDs for one shared primary database; distributed database sharding needs a separate ID-generation strategy.
