---
name: run
description: Start the TrailShare stack locally — the NestJS backend on :8086 and the Vue frontend on :5173 against the local PostgreSQL service. Use when asked to run, start, serve, or open the app, or to check a change in the real app.
---

# Running TrailShare locally

## Ports

| Service | Port | URL |
|---|---|---|
| Backend (NestJS) | 8086 | http://localhost:8086/api |
| Frontend (Vite) | 5173 | http://localhost:5173 |
| PostgreSQL | 5432 | local Windows service `postgresql-x64-16` |

## Database

Postgres runs as a **local Windows service** — there is no Docker container for the dev database.

```powershell
Get-Service postgresql-x64-16     # expect Status: Running
Start-Service postgresql-x64-16   # if it is stopped
```

Connection settings live in `backend/.env` (copy from `backend/.env.example` if it is missing). Docker is only needed for the Testcontainers e2e suite — see the `test` skill.

First-time setup creates the `trailshare` database and writes `backend/.env`. It prompts for the PostgreSQL superuser password, so **the user runs it, not an agent**:

```powershell
powershell -File scripts\setup-db.ps1
```

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
