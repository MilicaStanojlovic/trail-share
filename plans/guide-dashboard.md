# Feature: Guide dashboard & polish

**Branch:** `feature/guide-dashboard`
**Depends on:** all previous slices (foundation-ui-kit, auth, route catalog, route drawing, tours, seat booking) — all merged to develop.

## Goal

A signed-in guide gets a real `/dashboard`: a greeting, four stat tiles (tours scheduled, seats booked, routes published, rating), a "Your scheduled tours" table and a "Routes you published" card list. The guide variant of `/my` ("My tours") shows the Route | Date | Seats | Status | Manage table instead of today's bare empty state. Three new read endpoints back this, and a final polish pass confirms toasts, empty states, `ts-rise`/`ts-pop` animations and `aria-current` nav states across the app.

## Design reference

`design/TrailShare.dc.html`:

- **Dashboard screen** — lines 381–430 (`scDash` block): H2 "Good morning, Ivana"; sub line `dashSub`; 4-col stat grid (`grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 32px`, tiles = padding `18px 20px`, radius 24, surface bg, 11px uppercase label, 30px heading-font value, 12px `var(--color-accent-2-700)` note); then a 2-col grid `1.35fr 1fr`, gap 34: left `.table` (thead **Route | Date | Booked | (blank)**, ghost "Manage" button right-aligned), right a stack (gap 10) of horizontal `.card`s — 58×34 sparkline thumb (radius 10, `var(--color-accent-2-200)` bg, stroke `#c67139` width 3), heading-font 15px name, 11px @60% subline "{distLabel} · {tourLabel}", right-aligned difficulty tag; card padding `12px 14px`, gap 12, cursor pointer, hover `box-shadow: var(--shadow-md)`, click → route detail.
- **Dashboard stats** — lines 726–732: `dashSub = "You have {n} tours on the calendar and {m} published routes."`; tiles = `Tours scheduled` (note "next in 9 days"), `Seats booked` (note "across all tours"), `Routes published` (note "1 awaiting photos"), `Rating` ("4.9", note "from 38 hikers").
- **My tours (guide `/my`)** — lines 354–378 + 681–683: table thead **Route | Date | Seats | Status | (blank)**; row = bold route name, `dateLabel` ("Sat 22 August" via `formatDateLong`), seats cell "{booked} / {cap} booked", status `.tag.tag-accent` **Full** when `seatsLeft === 0` else `.tag.tag-accent-2` **Open**, right-aligned `.btn.btn-ghost` **Manage** → tour detail. Empty state (dashed radius-24 box, "Nothing here yet." + primary "Browse tours") already exists in `MyBookingsView.vue`.
- **Seat tag on the dashboard Booked column** — line 651: for a guide viewing own tours (`mine` is never true) the variant is `tag-accent` when full, `tag-outline` when `seatsLeft <= 3`, else `tag-neutral`; label is always "{booked} / {cap} booked" (line 650, `seatFull`).
- **tourLabel pluralization** — line 636: `"{n} tour(s) scheduled"` or `"no tours yet"` — identical logic already lives in `frontend/src/components/RouteCard.vue:12-16`.

Spec: `docs/design-spec.md` §2.8 (guide variant), §2.9, §6 (Dashboard endpoint), §9 slice 7.

## Decisions made resolving design ambiguity (binding for this feature)

1. **Rating is a stub.** No Review entity exists in the design or this codebase and none is added. `GuideService` returns the constant `{ value: 4.9, count: 38 }` (matching the design's tile and consistent with `GUIDE_RATING_STUB = 4.9` in `tours.service.ts`), with a comment marking it display-only.
2. **"1 awaiting photos" is static.** The Routes-published tile note renders the literal string `1 awaiting photos` in the frontend, marked with a comment as display-only design flavor. It is NOT part of the API contract.
3. **`GET /api/tours/mine` returns upcoming tours only** (`date >= CURRENT_DATE`, same predicate as every other tour list), ordered date ASC. Both consumers (dashboard table, My tours) describe tours "on the calendar" / "filling up"; in the design every "mine" tour is upcoming.
4. **`toursScheduled` counts upcoming tours; `seatsBooked` sums `bookedCount` across ALL the guide's tours** including past ones — the design note says "across all tours".
5. **`nextTourInDays` is `null` when the guide has no upcoming tours.** Tile note then reads `no upcoming tours`. Otherwise: `0` → "next is today", `1` → "next in 1 day", n → "next in {n} days".
6. **`GET /api/routes/mine` requires auth but no role** (per spec §10 decision 1, any authenticated user may publish routes, so any user may list their own), ordered `createdAt` ASC.
7. **Greeting is always "Good morning, {firstName}"** — the design hardcodes "Good morning"; no time-of-day switching. `firstName` = first word of `displayName`, falling back to the whole `displayName` (`noUncheckedIndexedAccess` makes `split(' ')[0]` `string | undefined`).
8. **Dashboard has no invented empty states.** With zero tours the table renders its header row and no body rows; with zero routes the list is empty — exactly like the design. `/my` keeps its existing dashed empty box.
9. `PlaceholderView.vue` is deleted at the end of this slice — the dashboard route is its last consumer.

## API contract

All three endpoints are GET, JWT bearer, no request body or query params.

### `GET /api/routes/mine`

Auth: `JwtAuthGuard` (any role). 401 without a valid token.
200 → `RouteDto[]` — the exact shape `GET /api/routes` already returns, ordered `createdAt` ASC:

```json
[
  {
    "id": "uuid", "name": "Medvednica Ridge Loop", "description": "…",
    "difficulty": "Easy|Moderate|Hard", "activity": "Hiking|Biking",
    "author": { "id": "uuid", "displayName": "Ivana Kovač" },
    "waypoints": [[45.9, 15.96]], "waypointCount": 8, "tourCount": 2,
    "distanceKm": 11.3, "distanceLabel": "11.3 km",
    "elevationM": 620, "elevationLabel": "620 m",
    "durationLabel": "3 h 45 min", "createdAt": "ISO"
  }
]
```

### `GET /api/tours/mine`

Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles('GUIDE')`. 401 unauthenticated, 403 for a hiker.
200 → `TourDto[]` — the exact shape `GET /api/tours` already returns (route summary, guide, date/time fields, seat fields, `isBookedByMe`, no `roster` key — lists never carry it), filtered to `tour.guideId = caller` AND `tour.date >= CURRENT_DATE`, ordered `date` ASC, `startTime` ASC, `createdAt` ASC.

### `GET /api/guide/dashboard`

Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles('GUIDE')`. 401 unauthenticated, 403 for a hiker.
200 →

```json
{
  "toursScheduled": 3,
  "nextTourInDays": 9,
  "seatsBooked": 17,
  "routesPublished": 3,
  "rating": { "value": 4.9, "count": 38 }
}
```

- `toursScheduled` — `number`: COUNT of the caller's tours with `date >= CURRENT_DATE`.
- `nextTourInDays` — `number | null`: whole days from today (server-local calendar day) to the soonest upcoming tour's date; `0` when that tour is today; `null` when `toursScheduled` is 0.
- `seatsBooked` — `number`: SUM of `bookedCount` over ALL the caller's tours (past included); `0` with no tours.
- `routesPublished` — `number`: COUNT of routes with `authorId = caller`.
- `rating` — constant stub `{ value: 4.9, count: 38 }` (decision 1).

## Tasks

Backend tasks first (T1–T8), then frontend (T9–T13), then the gate (T14). Implementors run sequentially in one shared working tree — never start a frontend task before its backend endpoint task is ticked.

- [x] **T1 — Backend: `GET /api/routes/mine`**
  - Files: `backend/src/routes/routes.service.ts` (edit), `backend/src/routes/routes.controller.ts` (edit)
  - Do: In `RoutesService` add `async findMine(authorId: string): Promise<RouteDto[]>` — reuse `baseQuery()` (which already does `leftJoin('route.author','author')` + `addSelect(['author.id','author.displayName'])`; never `leftJoinAndSelect` a User relation), add `.where('route.authorId = :authorId', { authorId })`, `.orderBy('route.createdAt', 'ASC')`, then decorate with `upcomingTourCounts` + `toDto` exactly as `findAll` does. In `RoutesController` add a `@Get('mine')` handler with `@UseGuards(JwtAuthGuard)` and `@CurrentUser() user: AuthUser`, returning `this.routesService.findMine(user.id)`. **It must be declared textually BEFORE the existing `@Get(':id')` handler** so "mine" is never parsed as a UUID (same pattern and comment style as `bookings.controller.ts:22-27`).
  - Done when: `cd backend && npm run build` passes; with the dev stack running, `GET /api/routes/mine` with a seeded guide's token (`ivana@trailshare.hr` / `trailshare1`) returns 200 with only that user's routes, and without a token returns 401.

- [x] **T2 — Backend: unit tests for `RoutesService.findMine`**
  - Files: `backend/src/routes/routes.service.spec.ts` (edit)
  - Do: Following the existing query-builder mock pattern in that file, add cases: (a) `findMine` filters by `authorId` (assert the `where` call args) and orders by `createdAt` ASC; (b) returns decorated `RouteDto`s with `tourCount` from the grouped count query; (c) returns `[]` when the author has no routes.
  - Done when: `cd backend && npm test -- routes.service` passes with the new cases included.

- [x] **T3 — Backend: `GET /api/tours/mine`**
  - Files: `backend/src/tours/tours.service.ts` (edit), `backend/src/tours/tours.controller.ts` (edit)
  - Do: In `ToursService` add `async findMine(guide: AuthUser): Promise<TourDto[]>` — reuse `upcomingQuery()` (it already carries the `date >= CURRENT_DATE` predicate, ordering, and the safe guide join) plus `.andWhere('tour.guideId = :guideId', { guideId: guide.id })`, then `return this.decorateMany(rows, guide)`. In `ToursController` add `@Get('mine')` with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('GUIDE')` (import `Roles`/`RolesGuard` as `route-tours.controller.ts` does), returning `this.toursService.findMine(user)`. **Declare it BEFORE the existing `@Get(':id')` wildcard** — the comment at `tours.controller.ts:27` says exactly this; replace that comment with one explaining the ordering requirement now that the route exists.
  - Done when: `cd backend && npm run build` passes; `GET /api/tours/mine` returns 200 with only the calling guide's upcoming tours for a guide token, 403 for a hiker token (`luka@trailshare.hr`), 401 with no token; `GET /api/tours/<uuid>` still works (ordering not broken).

- [x] **T4 — Backend: unit tests for `ToursService.findMine`**
  - Files: `backend/src/tours/tours.service.spec.ts` (edit)
  - Do: Using the existing `queryBuilderMock` pattern, add cases: (a) `findMine` applies both the upcoming predicate (`tour.date >= CURRENT_DATE` via `where`) and the `guideId` filter (assert the `andWhere` args); (b) result rows are decorated `TourDto`s with no `roster` key (`expect(dto).not.toHaveProperty('roster')`); (c) `[]` when the guide has no upcoming tours.
  - Done when: `cd backend && npm test -- tours.service` passes with the new cases included.

- [x] **T5 — Backend: guide module skeleton (DTO + service + module registration)**
  - Files: `backend/src/guide/dto/guide-dashboard-dto.ts` (new), `backend/src/guide/guide.service.ts` (new), `backend/src/guide/guide.module.ts` (new), `backend/src/app.module.ts` (edit)
  - Do: DTO file exports `interface GuideRatingDto { value: number; count: number }` and `interface GuideDashboardDto { toursScheduled: number; nextTourInDays: number | null; seatsBooked: number; routesPublished: number; rating: GuideRatingDto }`. `GuideService` injects `Repository<Tour>` and `Repository<Route>` and exposes `async getDashboard(guideId: string): Promise<GuideDashboardDto>` built from: (1) upcoming-tour count + soonest date in one query (`SELECT COUNT(*) …, MIN(tour.date) …  WHERE guideId = :guideId AND date >= CURRENT_DATE` via `getRawOne`); (2) `SELECT COALESCE(SUM(tour.bookedCount), 0) … WHERE guideId = :guideId` (no date filter); (3) `routes.count({ where: { authorId: guideId } })`. No User joins anywhere in this service, so no password-hash exposure risk. Also export a pure helper `export function daysUntil(dateIso: string, from = new Date()): number` that diffs `new Date(dateIso + 'T00:00:00')` against local midnight of `from` and returns whole days (mirror the local-day reasoning of `today()` in `tours.service.ts:280-285`); `nextTourInDays = minDate === null ? null : daysUntil(minDate)`. Rating: a file-level constant `RATING_STUB: GuideRatingDto = { value: 4.9, count: 38 }` with a comment stating it is display-only — no rating entity exists, and the value matches `GUIDE_RATING_STUB` in `tours.service.ts`. `GuideModule` imports `TypeOrmModule.forFeature([Tour, Route])` and `UsersModule` (needed so `JwtAuthGuard`'s `UsersService` dependency resolves in this module's injector — see the comment in `tours.module.ts:13-15`), provides `GuideService`. Register `GuideModule` in `app.module.ts` imports.
  - Done when: `cd backend && npm run build` passes and `npm run start:dev` boots without DI errors.

- [x] **T6 — Backend: `GET /api/guide/dashboard` controller**
  - Files: `backend/src/guide/guide.controller.ts` (new), `backend/src/guide/guide.module.ts` (edit)
  - Do: `@Controller('guide')` with a single `@Get('dashboard')` handler guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('GUIDE')`, taking `@CurrentUser() user: AuthUser` and returning `this.guideService.getDashboard(user.id)`. Register the controller in `GuideModule`.
  - Done when: `cd backend && npm run build` passes; `GET /api/guide/dashboard` returns 200 with all five contract keys for a seeded guide token, 403 for a hiker token, 401 with none; `rating` equals `{ "value": 4.9, "count": 38 }`.

- [x] **T7 — Backend: unit tests for `GuideService`**
  - Files: `backend/src/guide/guide.service.spec.ts` (new)
  - Do: Follow the repository/query-builder mock style of `tours.service.spec.ts`. Cases: (a) `getDashboard` maps the three queries into the DTO (counts, sum, rating stub); (b) `nextTourInDays` is `null` when the upcoming-count query reports 0 / MIN is null; (c) `seatsBooked` is `0` (not `NaN`/`null`) when SUM is null; (d) `daysUntil` pure-function cases: same day → 0, tomorrow → 1, +9 days → 9 (pass an explicit `from` date so tests are deterministic).
  - Done when: `cd backend && npm test -- guide.service` passes.

- [x] **T8 — Backend: e2e coverage for all three endpoints**
  - Files: `backend/test/guide-dashboard.e2e-spec.ts` (new)
  - Do: Using `createE2eContext`/`destroyE2eContext` from `test/postgres-testcontainer` (see `test/tours.e2e-spec.ts` for the register-then-act pattern): register one guide and one hiker; guide publishes 2 routes; guide schedules 2 future tours (distinct future dates) on route 1; hiker books a seat on one tour. Assert: `GET /api/routes/mine` as guide → 200 with exactly 2 routes ordered by creation, as hiker → 200 `[]`, unauthenticated → 401; `GET /api/tours/mine` as guide → 200 with 2 tours date-ASC and no `roster` key on any element, as hiker → 403, unauthenticated → 401; `GET /api/guide/dashboard` as guide → 200 with `toursScheduled: 2`, `seatsBooked: 1`, `routesPublished: 2`, `nextTourInDays` equal to the computed day-diff of the earlier tour date, `rating: { value: 4.9, count: 38 }`; as hiker → 403; unauthenticated → 401. Also register a second guide with nothing and assert their dashboard is all zeros with `nextTourInDays: null`.
  - Done when: `cd backend && npm run test:e2e -- guide-dashboard` passes (Docker required for Testcontainers).

- [x] **T9 — Frontend: dashboard type + store**
  - Files: `frontend/src/types/domain.ts` (edit), `frontend/src/stores/dashboard.ts` (new)
  - Do: Add to `domain.ts`: `interface GuideRating { value: number; count: number }` and `interface GuideDashboard { toursScheduled: number; nextTourInDays: number | null; seatsBooked: number; routesPublished: number; rating: GuideRating }` — field-for-field the API contract. New Pinia store `useDashboardStore` (setup style, matching `stores/bookings.ts`): state `data = ref<GuideDashboard | null>(null)`, `loading = ref(false)`; action `fetchDashboard()` calling `api.get<GuideDashboard>('/guide/dashboard')` with `loading` managed in `try/finally`. All HTTP via `src/lib/api.ts`; no fetch elsewhere.
  - Done when: `cd frontend && npm run type-check` passes.

- [x] **T10 — Frontend: `mine` state in routes and tours stores**
  - Files: `frontend/src/stores/routes.ts` (edit), `frontend/src/stores/tours.ts` (edit)
  - Do: In `useRoutesStore` add `mine = ref<TrailRoute[]>([])` and `async fetchMine()` → `api.get<TrailRoute[]>('/routes/mine')`; in `useToursStore` add `mine = ref<Tour[]>([])` and `async fetchMine()` → `api.get<Tour[]>('/tours/mine')`. Both toggle the store's existing `loading` ref in `try/finally` and are exported from the store's return object.
  - Done when: `cd frontend && npm run type-check` passes.

- [x] **T11 — Frontend: DashboardView**
  - Files: `frontend/src/views/DashboardView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: New view per the design block (lines 381–430) reusing `StatTile` (size `lg`), `DataTable`, `Tag`, `RouteSparkline` (`:stroke-width="3"`), `AppButton` (ghost). Structure: wrapper `padding: 26px 32px 56px; animation: ts-rise .35s ease both`; H2 `Good morning, {firstName}` (firstName = `authStore.user?.displayName.split(' ')[0] ?? authStore.user?.displayName ?? ''` — mind `noUncheckedIndexedAccess`); sub line `You have {toursScheduled} tours on the calendar and {routesPublished} published routes.`; stat grid `repeat(4, 1fr)`, gap 14, margin-bottom 32 with the four tiles exactly as decided: (1) "Tours scheduled" / `toursScheduled` / note from `nextTourInDays` (`null` → `no upcoming tours`, `0` → `next is today`, `1` → `next in 1 day`, n → `next in {n} days`); (2) "Seats booked" / `seatsBooked` / `across all tours`; (3) "Routes published" / `routesPublished` / literal `1 awaiting photos` with an HTML/JS comment marking it display-only design flavor; (4) "Rating" / `rating.value.toFixed(1)` / `from {rating.count} hikers`. Below, grid `1.35fr 1fr` gap 34: left — h4 "Your scheduled tours" + `DataTable` over `toursStore.mine` with columns Route (bold) | Date (`formatDateLong`) | Booked (Tag variant `accent` if `isFull`, `outline` if `seatsLeft <= 3`, else `neutral`; label `{bookedCount} / {capacity} booked`) | right-aligned ghost "Manage" → `router.push('/tours/' + id)`; right — h4 "Routes you published" + column (gap 10) of horizontal cards over `routesStore.mine`: `class="card"` with inline `flex-direction: row; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer`, hover `box-shadow: var(--shadow-md)` (scoped CSS), sparkline thumb wrapper 58×34 radius 10 background `var(--color-accent-2-200)`, name (heading font 15px), subline 11px @60% `{distanceLabel} · {tourLabel}` (tourLabel logic copied from `RouteCard.vue:12-16`: 0 → "no tours yet", 1 → "1 tour scheduled", n → "{n} tours scheduled"), right difficulty `Tag` (Easy → `accent-2`, Moderate → `neutral`, Hard → `accent`); card click → `router.push('/routes/' + id)`. `onMounted`: `Promise.all([dashboardStore.fetchDashboard(), toursStore.fetchMine(), routesStore.fetchMine()])` inside try/catch; on failure `toastStore.show('Could not load your dashboard')`. Render the stats section behind `v-if="dashboardStore.data"` so no tile shows undefined mid-load. Empty tables/lists render bare, per decision 8. Router: import `DashboardView` and swap it in for `PlaceholderView` on the `/dashboard` record, keeping `meta: { guideOnly: true }`; leave the `PlaceholderView` import removed only if no other route uses it (none does — but the file itself is deleted in T13, not here).
  - Done when: `cd frontend && npm run type-check && npm run build` pass; signed in as `ivana@trailshare.hr` (password `trailshare1`, seeded), `/dashboard` shows non-zero tiles, her scheduled tours and her 3 routes; signed in as `luka@trailshare.hr` navigating to `/dashboard` still redirects to `/routes`.

- [x] **T12 — Frontend: My tours table (guide variant of `/my`)**
  - Files: `frontend/src/views/MyBookingsView.vue` (edit)
  - Do: Replace the guide branch's bare empty state with the full design table. Keep the existing hiker branch untouched. Guide branch: columns `Route | Date | Seats | Status | (blank, right)`; rows from `toursStore.mine` mapped to `{ id, route: tour.route.name (bold), date: formatDateLong(tour.date), seats: '{bookedCount} / {capacity} booked', … }`; Status cell = `Tag` variant `accent` + label "Full" when `isFull`, else variant `accent-2` + label "Open"; action = ghost `AppButton` "Manage" → `router.push('/tours/' + row.id)`. `onMounted` guide path now calls `toursStore.fetchMine()` in try/catch with toast `'Could not load your tours'` on failure (replace the early `return`). Keep the table header rendering even with zero rows and keep the existing `EmptyState` ("Nothing here yet." / "Browse tours") shown only when not loading and zero rows — same `showEmpty` guard pattern the hiker branch uses. Row typing must extend `Record<string, unknown>` like the existing `BookingRow`.
  - Done when: `cd frontend && npm run type-check && npm run build` pass; as `ivana@trailshare.hr`, `/my` shows her tours with correct Seats strings and Open/Full tags; as a freshly registered guide it shows the dashed empty state; as `luka@trailshare.hr` the hiker bookings table is unchanged.

- [x] **T13 — Frontend: polish sweep**
  - Files: `frontend/src/views/PlaceholderView.vue` (delete), `frontend/src/components/AppNav.vue` (edit only if a check fails), `frontend/src/views/DashboardView.vue` (edit only if a check fails)
  - Do: (1) Delete `PlaceholderView.vue` and confirm nothing imports it (`grep PlaceholderView frontend/src` → only expect zero hits; T11 already removed the router import). (2) Verify the polish checklist and fix only what fails: every routed view's root has `animation: ts-rise .35s ease both` (Discover, Tours, TourDetail, RouteDetail, Draw, My, Dashboard — all but Dashboard already verified present); `AppDialog` uses `ts-pop` (already does); nav `aria-current="page"` lands on Routes for `/routes` + `/routes/:id` but not `/routes/new`, Tours for `/tours` + `/tours/:id`, My tours for `/my`, Dashboard for `/dashboard` (logic already in `AppNav.vue:31-36` — verify against the running app); every data fetch in a view surfaces failure via `toastStore.show(...)` (Dashboard and My tours added in T11/T12; Discover/Tours/detail views already do — verify, and add a toast only where one is genuinely missing); empty states render for zero-data cases on `/my` (both roles) and route-detail tour list. Do not restyle anything that matches the design.
  - Done when: `cd frontend && npm run type-check && npm run build` pass with `PlaceholderView.vue` deleted, and each checklist item above is confirmed (or fixed) with a one-line note per item in the task's completion report.

- [ ] **T14 — Full verification gate**
  - Files: none (runs suites only; fix-forward only for failures introduced by this feature)
  - Do: Run `cd backend && npm run lint && npm test && npm run test:e2e` (Docker running for Testcontainers) and `cd frontend && npm run type-check && npm run build`. Then with the dev stack up (`scripts` per the run skill) and the DB seeded (`cd backend && npm run seed`), smoke-check: guide sign-in lands on `/dashboard` with populated tiles; hiker sign-in cannot reach `/dashboard`; `/my` renders the correct table per role.
  - Done when: all five commands exit 0 and the three smoke checks hold.
