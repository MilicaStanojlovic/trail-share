---
name: run
description: Start the TrailShare stack locally — the NestJS backend on :8086 and the Vue frontend on :5173 against the Supabase-hosted database. Use when asked to run, start, serve, or open the app, or to check a change in the real app.
---

# Running TrailShare locally

## Ports

| Service | Port | URL |
|---|---|---|
| Backend (NestJS) | 8086 | http://localhost:8086/api |
| Frontend (Vite) | 5173 | http://localhost:5173 |
| PostgreSQL | — | hosted on Supabase (session pooler, port 5432) |

## Database

The database is **hosted on Supabase**. There is nothing local to start and no service to check — if the backend boots, it connected.

Credentials live in `backend/.env` as `DATABASE_URL` (the session pooler string) and `DB_SSL=require`. Copy `backend/.env.example` if the file is missing; it explains where to get the string. Docker is needed only for the Testcontainers e2e suite — see the `test` skill.

The schema is applied by the migrations on boot, so there is no setup step: an empty Supabase project becomes a working one on the first `npm run start:dev`.

Two failure modes worth recognising before debugging anything else:

- **Hang or timeout on the first request after days of not using it** — a free-tier project pauses when idle. Retry; it wakes in a few seconds.
- **`DATABASE_URL is not set`** — `backend/.env` is missing or the variable is empty. This error is deliberate; there is no localhost fallback to mask it.

## Start

Run both in the background, backend first:

```bash
cd backend && npm run start:dev     # watch mode, port 8086
cd frontend && npm run dev          # port 5173
```

Confirm the backend is up before touching the frontend:

```bash
curl http://localhost:8086/api/health     # → {"status":"ok"}
```

The frontend proxies `/api` to `http://localhost:8086` through `vite.config.ts`, so the browser only ever talks to port 5173. If API calls 404, the backend is not running or the proxy target drifted.

## Verifying in the browser

Use the Claude in Chrome tools: `tabs_context_mcp` first, then `tabs_create_mcp` for a **new** tab, then navigate to `http://localhost:5173`. Read `read_console_messages` for runtime errors and `read_network_requests` to confirm `/api/*` calls succeed. Never reuse one of the user's existing tabs unless they ask you to.

## Troubleshooting

- **Backend exits at startup with a connection error** — Postgres is stopped, or the `trailshare` database / credentials in `.env` are wrong.
- **Port 8086 already in use** — a previous `start:dev` is still alive: `Get-NetTCPConnection -LocalPort 8086` then stop that process.
- **Frontend blank with console import errors** — dependencies drifted: `cd frontend && npm install`.
