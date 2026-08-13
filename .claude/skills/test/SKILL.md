---
name: test
description: Run TrailShare's test suites — backend Jest unit tests, Supertest + Testcontainers e2e tests (needs Docker), lint, and the frontend type-check and build. Use when asked to test, verify, or check that changes did not break anything.
---

# Testing TrailShare

## Backend

```bash
cd backend
npm run lint          # ESLint
npm test              # Jest unit tests
npm run test:cov      # with coverage
npm run test:e2e      # Supertest + Testcontainers — needs Docker
```

### e2e tests need Docker

The e2e suite spins up a **throwaway PostgreSQL container** via Testcontainers, so it never touches the local dev database. That requires the Docker daemon, which is usually stopped on this machine.

```bash
docker info           # fails if the daemon is not running
```

To start it:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Then poll `docker info` until it succeeds — a cold start takes 30–90 seconds. The first run also pulls the `postgres:16-alpine` image, so allow several minutes and expect a long Jest timeout.

If Docker cannot start, report the e2e suite as **not run**. Never report it as passing.

## Frontend

```bash
cd frontend
npm run type-check    # vue-tsc
npm run build         # production build — catches what type-check alone misses
npm run lint
```

## Writing tests

- **Unit tests** (`*.spec.ts` beside the source) mock the repository and test service logic in isolation. Every service method with a branch deserves a case.
- **e2e tests** (`backend/test/*.e2e-spec.ts`) hit real HTTP routes through Supertest against a real Postgres container. Cover the happy path plus validation rejections — a `400` from the global `ValidationPipe` is behavior worth pinning down.
- Testcontainers setup lives in `backend/test/`; reuse the existing container bootstrap rather than starting a second container per suite.

## Full pre-merge check

Everything that must be green before a feature merges to develop:

```bash
cd backend && npm run lint && npm test && npm run test:e2e
cd frontend && npm run type-check && npm run build
```

Then walk the feature in the browser — see the `run` skill — because a passing type-check says nothing about whether the screen matches the design.
