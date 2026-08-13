# TrailShare — Roadmap

What is built, what is being built, and what is next. The feature list itself comes from
`docs/design-spec.md` §9 "Feature slices (build order)"; this file tracks its status.

**Detail lives in `plans/<slice>.md`** — one checklist file per slice, with the API contract and
the per-task breakdown. This file stays scannable; the plan files carry the specifics.

_Last updated: 2026-08-13._

## At a glance

| # | Slice | Status | Plan file | Tasks | Where it lives |
|---|---|---|---|---|---|
| 1 | Foundation & design system | ✅ **merged** | `plans/foundation-ui-kit.md` | 15 / 15 | `develop` (`b4dbca1`) |
| 2 | Auth & roles | ✅ **merged** | `plans/auth-and-roles.md` | 15 / 15 | `develop` (`cac4b73`) |
| 3 | Route catalog (read) | 🔨 **implementing** | `plans/route-catalog.md` | 3 / 16 | `feature/route-catalog` |
| 4 | Route drawing & publishing | ⬜ not started | — | — | — |
| 5 | Tour scheduling & browsing | ⬜ not started | — | — | — |
| 6 | Seat booking | ⬜ not started | — | — | — |
| 7 | Guide dashboard & polish | ⬜ not started | — | — | — |

Status vocabulary follows the pipeline stages in `CLAUDE.md`, so "in progress" is never ambiguous:

`not started` → `planned` (plan file written) → `implementing` (tasks being ticked off) →
`reviewed` (reviewer findings addressed) → `tested` (suites + Chrome flow pass) → `merged` (in `develop`)

## The slices

### 1. Foundation & design system — ✅ merged

Monorepo wiring, the `styles.css` tokens and utilities ported into the app, Caprasimo/Figtree
loaded, and the 16-component Vue library (`AppButton`, `Tag`, `SegControl`, `RadioGroup`,
`FormField`, `AppDialog`, `AppToast`, `DataTable`, `EmptyState`, `AvatarInitials`, `StatTile`,
`CapacityBar`, `DateBadge`, `RouteSparkline`, `BrandMark`, `AppNav`) plus the app shell and the
`/_kit` showcase. Unblocks everything.

### 2. Auth & roles — ✅ merged

`User` entity, `register` / `login` / `me` endpoints, HS256 JWT with a 24 h expiry, `JwtAuthGuard`,
`@Roles()` + `RolesGuard`; the auth screen (spec §2.1), the Pinia auth store with session restore,
`Authorization` header plumbing in `src/lib/api.ts`, router navigation guards, role-based nav
(My bookings vs My tours, guide-only Dashboard) and the sign-out flow.

Token is stored under `trailshare.token`. Guides land on `/dashboard`, hikers on `/routes`.

### 3. Route catalog (read) — 🔨 implementing

`Route` entity + seed data from `docs/seed-data.json`, the stats/decoration formulas (spec §8.4),
`GET /routes` and `GET /routes/:id`; the Discover screen with search + difficulty filter,
`RouteCard` + `RouteSparkline`, and the Route detail screen. **Leaflet integration lands here** —
`TrailMap` in view mode. The tours section on route detail shows an empty state for now.

Also picks up a slice-2 follow-up: the auth screen's hero map + FEATURED card, which shipped as a
decorative sparkline placeholder because Leaflet did not exist yet.

Done so far: Route entity and module scaffold, the route-stats module, route-stats unit tests.
Remaining: query DTO, service, controller, service unit tests, seeder, e2e spec, and the whole
frontend half.

### 4. Route drawing & publishing — ⬜ not started

`POST /routes`; the Draw screen (spec §2.5) — `TrailMap` in draw mode with click/drag/undo/clear,
live stat tiles, the form and its validation banner, publish → detail page + toast.
Depends on slice 3 for the map, the stats and the detail page.

### 5. Tour scheduling & browsing — ⬜ not started

`Tour` entity + seeds, `GET /tours`, `GET /tours/:id`, `GET /routes/:id/tours`,
`POST /routes/:routeId/tours` (guide-only); the Tours list (`TourCard`, `DateBadge`,
`CapacityBar`), Tour detail, and the "Schedule a tour" dialog on route detail.
Booking CTAs render but stay stubbed until slice 6. Depends on slice 3.

### 6. Seat booking — ⬜ not started

`Booking` entity, `POST /tours/:id/bookings` (capacity-safe transaction), `GET /bookings/mine`,
`DELETE /bookings/:id` (24 h cancellation rule); the Book dialog and CTA states
("You are in" / "Full" / seats-left), the My bookings table + empty state, and the guide roster on
tour detail. Depends on slice 5.

### 7. Guide dashboard & polish — ⬜ not started

`GET /tours/mine`, `GET /routes/mine`, `GET /guide/dashboard`; the Dashboard screen (stat tiles,
scheduled-tours table, published-routes list) and the guide variant of `/my`. Final pass on toasts,
empty states, the `ts-rise` / `ts-pop` animations and `aria-current` nav states.
Depends on 4–6 for real numbers.

## Open decisions

Carried from `docs/design-spec.md` §10 — worth settling before the slice that trips on each one.

| Decision | Recommendation | Bites in |
|---|---|---|
| **Who can draw routes?** Nav shows "＋ Draw a route" to both roles, but the register copy assigns publishing to guides. | Let any authenticated user publish a route; keep tour scheduling guide-only. | Slice 4 |
| **Waitlist** — "Join waitlist" is a label with nothing behind it. | Do not build one. When a tour is full the detail CTA is a disabled "Tour is full". | Slice 6 |
| **Ratings** — the dashboard's "4.9 from 38 hikers" and the guide card's "4.8 ★" have no backing entity. | Seed static values; a `Review` entity is out of scope for this design. | Slice 7 |
| **Tour end time** — the schedule dialog collects a start time only. | Display a range by adding the route's estimated duration. | Slice 5 |

## Working agreement

- Branches: `main` ← `develop` ← `feature/<slice>`. Every slice is cut from `develop` and merged
  back with `--no-ff`. `main` only moves on a deliberate release merge.
- Slices are built with the `new-feature` skill (planner → implementor per task → reviewer →
  tester), as described in `CLAUDE.md`.
- **Update this file when a slice changes stage** — that is the whole point of it. The task counts
  above are a snapshot; the plan file for a slice is always the authoritative count.
