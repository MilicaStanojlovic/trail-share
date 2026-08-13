# Feature: Tour scheduling & browsing

**Branch:** `feature/tours`
**Depends on:** `plans/route-drawing.md` (RoutesService.create + guarded `POST /api/routes`), `plans/route-catalog.md` (Route entity, `route-stats.ts`, TrailMap view mode, routes store, route detail screen), `plans/auth-and-roles.md` (JwtAuthGuard, RolesGuard, `@Roles`, `@CurrentUser`, auth store `isGuide`), `plans/foundation-ui-kit.md` (kit components incl. `DateBadge`, `CapacityBar`, `AppDialog`, `DataTable`, `seatTagState`)

## Goal

A guide opens a route's detail page, clicks "Schedule a tour", fills the dialog and publishes; the tour appears in the route's "Upcoming tours" list with the toast "Tour scheduled for {Sat 5 September}". Any signed-in user browses `/tours` — the design's card grid with date badges, seat tags and capacity bars — and opens `/tours/:id` to see the tour's route on a map, the date/time range, notes, a details card and a guide card. Booking stays stubbed: CTAs render per the design but are disabled until slice 6.

## Design reference

`design/TrailShare.dc.html`:

- **Tours list** (lines 273–303, spec §2.6): padding `26px 32px 56px`, H2 **"Upcoming guided tours"**, subline "**{n} tours** you can join, led by verified guides." Grid `repeat(auto-fill, minmax(340px, 1fr))`, gap 18. TourCard = `.card.elev-sm` padding `20px 22px` gap 12, hover `--shadow-md`: header row (gap 10) with the 56px date block (`DateBadge`) + `.card-title` 18px route name and 12px @65% subline "{timeLabel} · {meetingPoint}"; tag row gap 6: difficulty tag, `tag-neutral` "{d} km", seat tag; `CapacityBar`; footer: 24px guide initials circle (`neutral-300` bg — pass the matching `AvatarInitials` size/props) + guide name 12px @75% + right-aligned `.btn.btn-primary` CTA.
- **Tour detail** (lines 305–352, spec §2.7): same `1fr 400px` grid as route detail, `ts-rise`; left map container `margin-left: 32px; border-radius: 28px; overflow: hidden; box-shadow: var(--shadow-md)` with `view`-mode TrailMap and floating `.btn.btn-secondary` "← All tours"; right panel padding `8px 32px 48px` gap 16: tags row, H2 32px route name, heading-font 18px `var(--color-accent-700)` line "{dateLabel} · {timeLabel}", notes paragraph @80% 14px, details card (surface bg, radius 22px, padding `16px 18px`, gap 10; rows `flex space-between` 13px, label @60%: **Meeting point**, **Distance** "{distanceLabel} · ↑ {elevationLabel}", **Pace**, **Seats** "{booked} / {cap} booked") with `CapacityBar` below the rows; guide card (border `1px solid var(--color-divider)`, radius 22px, padding `14px 16px`): 40px `accent-2-300` initials circle, heading-font 15px name, 12px @65% "Guide · {toursLed} tours led · {rating} ★"; hiker-only booking button `.btn.btn-primary.btn-block` `min-height: 46px; font-size: 16px` (disabled this slice).
- **Route detail tour list** (lines ~193–204, spec §2.4): "Upcoming tours" H4 with guide-only `.btn.btn-primary` **"Schedule a tour"**; compact clickable `.card`s padding `14px 16px`: heading-font date ("Sat 22 August"), right-aligned seat tag, subline 12px @70% "{timeLabel} · {meetingPoint} · led by {guide}"; existing dashed `EmptyState` "No tours scheduled on this route yet." when empty.
- **Schedule dialog** (spec §2.10): `AppDialog` title **"Schedule a tour"**, context line "On {route name} · {distanceLabel} · {difficulty}"; 2-col field grid: **Date** (`type=date`), **Start time** (`type=time`), **Capacity** (`type=number`, sample 12), **Pace** (text, sample "Relaxed"); full-width **Meeting point** (sample "Bliznec parking lot") and **Notes for hikers** (textarea, placeholder "Bring 1.5 L of water and layers — the ridge is windy."). Actions: secondary **Cancel** / primary **"Publish tour"**. Success toast: **"Tour scheduled for {Sat 5 September}"**.
- Dates render `en-GB` `{ weekday: 'short', day: 'numeric', month: 'long' }` → "Sat 22 August" (prototype `dateFmt`, line 626); `DateBadge` handles the short-uppercase month itself. Seat states come from the existing `seatTagState` (spec §7).

## Decisions (binding for this slice)

1. **`date` and `startTime` are separate columns** — Postgres `date` and `time` types, both surfacing as strings in TS. The dialog collects them as two inputs, every screen renders them separately (date badge/label vs time range), and the upcoming filter is a plain `date >= CURRENT_DATE` — a combined timestamp would buy nothing and force timezone handling the design never does. Postgres `time` reads back as `HH:MM:SS`; the DTO normalizes to `HH:MM` (`slice(0, 5)`).
2. **`bookedCount` is a denormalized `int` column on `Tour`** (default 0), seeded from `docs/seed-data.json`'s `booked` values. Slice 6 does **not** replace it with a `COUNT(*)` over bookings — it keeps this column as the transactionally-maintained counter (incremented/decremented inside the capacity-guarded booking transaction, exactly the pattern spec §5 asks for) and adds `Booking` rows for the roster and `isBookedByMe`. This is deliberate: seed tour 1 has 9 booked but the design only has 8 hiker users, so a pure count could never reproduce the design's numbers.
3. **"Upcoming" = `tour.date >= CURRENT_DATE`**, ordered `date ASC, startTime ASC, createdAt ASC`. The same predicate drives `GET /api/tours`, `GET /api/routes/:id/tours` **and** `RouteDto.tourCount`, so a route card's "{n} tours scheduled" always equals the length of the list on its detail page.
4. **End time is computed, not stored**: `endTime = startTime + route duration`, with the duration rounded exactly like `formatDuration` in `backend/src/routes/route-stats.ts` (minutes to the nearest 5, `m === 60` rolls into the hour), wrapping modulo 24 h. Verified: the prototype's hardcoded ranges are **not reproducible from its own formulas** (seed tour 1: computed `08:00 – 10:30` vs the design's literal "08:00 – 12:30"), so per spec §10.4 and the seed file's `designTimeRange` being display fiction, we compute. Pinned values for the 5 seed tours: `08:00 – 10:30`, `07:30 – 08:30`, `09:00 – 10:30`, `08:30 – 09:25`, `09:00 – 11:30`. `timeLabel` = `"{startTime} – {endTime}"` with a spaced en dash.
5. **Guide decoration**: `toursLed` is the real count of **all** tours (past included) by that guide; `rating` is the static stub `4.9` for every guide (spec §10.3 — no backing entity; the prototype's "14 tours led · 31 tours led" literals are also non-derivable).
6. **Tour GETs are public** (like the route GETs). `isBookedByMe` is always `false` this slice; slice 6 adds optional-token awareness. The `roster` field is **omitted entirely** from `TourDto` — slice 6 adds it additively for the owning guide only.
7. **`GET /api/tours/mine` is deferred to slice 7** (spec §9 assigns it there; `/my` stays a placeholder). Note for slice 7: it must be declared **before** `GET /tours/:id` in the controller.
8. **Scheduling a past-dated tour returns 400** ("date must not be in the past", checked in the service against the server's current date). The design is silent; an invisible-on-creation tour would read as a bug.
9. **CTA stubs this slice**: the TourCard footer CTA (label per prototype: "Book a seat" / "Booked" / "Join waitlist") only navigates to the tour detail, like the card itself. The detail booking button renders for hikers only (design's `isHiker` gate), label "Book a seat" / "Tour is full", and is **always disabled**. Guides see no booking button and no roster yet.
10. **Dialog validation is client-side minimal**: "Publish tour" is disabled until date, start time, capacity ≥ 1, meeting point and pace are non-empty; notes optional. Backend 4xx → toast "Could not schedule tour", dialog stays open with values intact.

## Parallel build note

After this contract is fixed, **T1–T9 (backend) and T10–T16 (frontend) are independent halves** and can be built concurrently by two implementors — the frontend codes against the contract below, not against backend files. Within each half the tasks are strictly ordered. T17 is the joint verification pass.

## API contract

`TourDto` (returned by every tour endpoint):

```json
{
  "id": "uuid",
  "route": {
    "id": "uuid",
    "name": "Medvednica Ridge Loop",
    "difficulty": "Moderate",
    "activity": "Hiking",
    "waypoints": [[45.9002, 15.9432], [45.9068, 15.9508]],
    "distanceKm": 10.3,
    "distanceLabel": "10.3 km",
    "elevationM": 570,
    "elevationLabel": "570 m",
    "durationLabel": "2 h 30 min"
  },
  "guide": { "id": "uuid", "displayName": "Ivana Kovač", "toursLed": 3, "rating": 4.9 },
  "date": "2026-08-22",
  "startTime": "08:00",
  "endTime": "10:30",
  "timeLabel": "08:00 – 10:30",
  "capacity": 12,
  "bookedCount": 9,
  "seatsLeft": 3,
  "isFull": false,
  "isBookedByMe": false,
  "meetingPoint": "Bliznec parking lot",
  "pace": "Relaxed, 3.5 km/h",
  "notes": "Layered clothing and 1.5 L of water. We break for 20 minutes at the ridge shelter.",
  "createdAt": "2026-08-13T10:00:00.000Z"
}
```

`seatsLeft = capacity - bookedCount` (may go negative in theory; `isFull = seatsLeft <= 0`). Route stats come from `computeRouteStats(route.waypoints, route.activity)`. No `roster` field (Decisions #6).

- `GET /api/tours` — public. Upcoming tours (Decisions #3), ordered `date ASC, startTime ASC, createdAt ASC` → 200 `TourDto[]`.
- `GET /api/tours/:id` — public. Any tour by UUID (even past — deep links must not 404 the day after) → 200 `TourDto`; 404 unknown id; 400 non-UUID.
- `GET /api/routes/:routeId/tours` — public. Upcoming tours on that route, same ordering → 200 `TourDto[]` (empty array for a route with none); 404 unknown route.
- `POST /api/routes/:routeId/tours` — **guide-only**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('GUIDE')`, in that order. Body:

  ```json
  {
    "date": "2026-09-05",
    "startTime": "08:00",
    "capacity": 12,
    "meetingPoint": "Bliznec parking lot",
    "pace": "Relaxed",
    "notes": "Bring 1.5 L of water and layers — the ridge is windy."
  }
  ```

  - `date`: string matching `^\d{4}-\d{2}-\d{2}$`; not before today (400 from the service, Decisions #8).
  - `startTime`: string matching `^([01]\d|2[0-3]):[0-5]\d$`.
  - `capacity`: integer, 1–99.
  - `meetingPoint`: string, trimmed server-side, trimmed length 2–200.
  - `pace`: string, trimmed, length 2–100.
  - `notes`: optional string, max 2000; missing/blank → stored as `""`.
  - Extra body fields → 400 (`forbidNonWhitelisted`). The guide is the caller (never from the body).
  - 201 → the full `TourDto` (`bookedCount: 0`, `isFull: false`); 400 validation; 401 no/bad token; 403 hiker token; 404 unknown route.

`RouteDto` is unchanged in shape, but **`tourCount` becomes real**: the number of upcoming tours on the route (Decisions #3).

## Tasks

### Backend (T1–T9)

- [x] **T1 — Tour entity + ToursModule registration**
  - Files: `backend/src/tours/tour.entity.ts` (new), `backend/src/tours/tours.module.ts` (new), `backend/src/app.module.ts` (edit)
  - Do: `@Entity('tours') export class Tour`: uuid PK; `@ManyToOne(() => Route, { nullable: false, onDelete: 'CASCADE' }) route: Route` + `@Column() routeId: string`; `@ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' }) guide: User` + `@Column() guideId: string`; `@Column({ type: 'date' }) date: string`; `@Column({ type: 'time' }) startTime: string`; `@Column({ type: 'int' }) capacity: number`; `@Column({ type: 'int', default: 0 }) bookedCount: number` with a comment stating Decisions #2 (denormalized counter, slice 6 maintains it transactionally); `@Column({ length: 200 }) meetingPoint: string`; `@Column({ length: 100 }) pace: string`; `@Column({ type: 'text', default: '' }) notes: string`; `@CreateDateColumn() createdAt: Date`. Follow `route.entity.ts`'s style exactly. `ToursModule`: `TypeOrmModule.forFeature([Tour, Route, User])`, empty controllers/providers for now. Import `ToursModule` in `AppModule`. The entity must be picked up by the existing TypeORM entity discovery (check how `Route` is registered — autoLoadEntities or an explicit list — and match it).
  - Done when: `npm run build` passes in `backend/`; starting the dev server creates the `tours` table (dev `synchronize`).

- [x] **T2 — Seeder: the design's 5 tours**
  - Files: `backend/src/seed/seed.ts` (edit)
  - Do: Extend — do not rewrite — the existing create-only idempotent seeder. Add `id: number` to `SeedRoute`, and a `SeedTour` interface matching the JSON (`id`, `routeId`, `guide`, `date`, `startTime`, `capacity`, `booked`, `meetingPoint`, `pace`, `notes`; ignore `designTimeRange` — Decisions #4). In the route loop, build a `routeByJsonId = new Map<number, Route>()` and populate it **before** the existing-route `continue` (existing routes must land in the map too, or tour seeding breaks on re-run). Then loop `data.tours`: resolve the route via `routeByJsonId` and the guide via the existing `userByDisplayName` (throw on a miss, like routes do); skip if a tour with the same `routeId`, `date` and `startTime` exists; else save with `bookedCount: seedTour.booked`. Return `toursCreated` alongside the existing counts, and update every caller of `seedDatabase` to the widened return type.
  - Done when: `npm run build` passes; running the seeder against a dev DB twice yields 5 tours total (idempotent), with tour bookedCounts 9, 8, 6, 4, 2.

- [x] **T3 — DTOs: CreateTourDto + TourDto interfaces**
  - Files: `backend/src/tours/dto/create-tour.dto.ts` (new), `backend/src/tours/dto/tour-dto.ts` (new)
  - Do: `CreateTourDto` with every field decorated (the global pipe strips undecorated fields): `date` `@IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })`; `startTime` `@IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM' })`; `capacity` `@IsInt() @Min(1) @Max(99)`; `meetingPoint` `@Transform(trim) @IsString() @MinLength(2) @MaxLength(200)`; `pace` `@Transform(trim) @IsString() @MinLength(2) @MaxLength(100)`; `notes?` `@IsOptional() @IsString() @MaxLength(2000)`. Reuse the trim-transform idiom from `create-route.dto.ts`. `tour-dto.ts`: plain interfaces `TourRouteSummaryDto`, `TourGuideDto`, `TourDto` matching the API contract exactly (import `RouteDifficulty`/`RouteActivity` from `../../routes/route.entity`).
  - Done when: `npm run build` passes; the DTO file exports `CreateTourDto`; the interface file exports all three interfaces with exactly the contract's fields.

- [x] **T4 — tour-time helper + unit spec**
  - Files: `backend/src/tours/tour-time.ts` (new), `backend/src/tours/tour-time.spec.ts` (new)
  - Do: Pure functions. `normalizeTime(value: string): string` → first 5 chars (`'08:00:00'` → `'08:00'`, `'08:00'` unchanged). `computeEndTime(startTime: string, durationHrs: number): string` → round the duration exactly like `formatDuration` in `../routes/route-stats` (`h = floor`, `m = round(((hours - h) * 60) / 5) * 5`, `m === 60` rolls over — add a comment pinning parity), add to the start, wrap modulo 24 h, return zero-padded `HH:MM`. `timeLabel(start: string, end: string): string` → `` `${start} – ${end}` `` (spaced en dash U+2013). Spec pins: `computeEndTime('08:00', 2.5)` → `'10:30'`; `('09:00', 1.5)` → `'10:30'`; `('08:30', 0.9166)` → `'09:25'`; `('07:30', 1.99)` → `'09:30'` (rollover: 1.99 h rounds to 2 h); `('23:30', 1)` → `'00:30'` (midnight wrap); `normalizeTime('08:00:00')` → `'08:00'`; `timeLabel('08:00', '10:30')` → `'08:00 – 10:30'`.
  - Done when: `npm test` in `backend/` passes with the new spec green.

- [x] **T5 — ToursService**
  - Files: `backend/src/tours/tours.service.ts` (new), `backend/src/tours/tours.module.ts` (edit)
  - Do: Inject `Repository<Tour>` and `Repository<Route>`. Private `baseQuery()`: `createQueryBuilder('tour').leftJoinAndSelect('tour.route', 'route').leftJoin('tour.guide', 'guide').addSelect(['guide.id', 'guide.displayName'])` — **never `leftJoinAndSelect` the guide**; this mirrors `RoutesService.baseQuery` so the password hash never leaves Postgres (joining the full `route` is fine — no sensitive columns). Private upcoming predicate: `tour.date >= CURRENT_DATE`; ordering `date ASC, startTime ASC, createdAt ASC`. Methods: `findUpcoming(): Promise<TourDto[]>`; `findById(id): Promise<TourDto>` (no upcoming filter; `NotFoundException` when missing); `findForRoute(routeId): Promise<TourDto[]>` (throw `NotFoundException` if the route doesn't exist, else upcoming tours filtered by routeId); `create(routeId: string, dto: CreateTourDto, guideId: string): Promise<TourDto>` — 404 unknown route, `BadRequestException('date must not be in the past')` when `dto.date` < today's local `YYYY-MM-DD` (Decisions #8), `notes: dto.notes?.trim() ?? ''` (blank → `''`), save, return `findById(saved.id)`. Decoration `toDto(tour, toursLed)`: route summary via `computeRouteStats(tour.route.waypoints, tour.route.activity)`; guide `{ id, displayName, toursLed, rating: 4.9 }` (Decisions #5); `startTime: normalizeTime(...)`, `endTime: computeEndTime(startTime, durationHours(...))` — reuse `durationHours` + the unrounded distance/elevation from `route-stats.ts` exactly as `computeRouteStats` does, or recompute via its exported pieces; `timeLabel`; `bookedCount`, `seatsLeft = capacity - bookedCount`, `isFull = seatsLeft <= 0`, `isBookedByMe: false` (Decisions #6); no `roster` key. **toursLed without N+1**: for list methods, one grouped query `SELECT guideId, COUNT(*) FROM tours GROUP BY guideId WHERE guideId IN (...)` over the fetched tours' guide ids (all tours, not just upcoming), then map counts into `toDto`; `findById` does one count query. Register the service in `ToursModule` providers/exports.
  - Done when: `npm run build` passes; the service exposes exactly `findUpcoming`, `findById`, `findForRoute`, `create`.

- [x] **T6 — Controllers: ToursController + RouteToursController**
  - Files: `backend/src/tours/tours.controller.ts` (new), `backend/src/tours/route-tours.controller.ts` (new), `backend/src/tours/tours.module.ts` (edit)
  - Do: `ToursController` = `@Controller('tours')`: `@Get() list()` → `findUpcoming()`; `@Get(':id') detail(@Param('id', ParseUUIDPipe) id)` → `findById(id)`. Add a one-line comment noting slice 7's `GET /tours/mine` must be declared before `:id`. `RouteToursController` = `@Controller('routes/:routeId/tours')`: `@Get() listForRoute(@Param('routeId', ParseUUIDPipe) routeId)` → `findForRoute(routeId)`; `@Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('GUIDE') create(@Param('routeId', ParseUUIDPipe) routeId, @Body() dto: CreateTourDto, @CurrentUser() user: AuthUser)` → `this.toursService.create(routeId, dto, user.id)` — guards in exactly that order; **`import type { AuthUser } from '../auth/auth-user'`** (a value import trips TS1272); `Roles` takes the string literal `'GUIDE'` per `roles.decorator.ts`'s template-literal type. Controllers stay thin — no logic. Register both in `ToursModule.controllers`.
  - Done when: `npm run build` passes; with the dev server running and the seeder applied: `GET /api/tours` → 200 with 5 tours ordered by date; `POST /api/routes/<uuid>/tours` without a token → 401, with a hiker token → 403.

- [x] **T7 — Real RouteDto.tourCount**
  - Files: `backend/src/routes/routes.service.ts` (edit), `backend/src/routes/routes.module.ts` (edit), `backend/src/routes/routes.service.spec.ts` (edit)
  - Do: Add `Tour` to `RoutesModule`'s `TypeOrmModule.forFeature` and inject `Repository<Tour>` into `RoutesService` (repository-only — no service import, so no module cycle). Add a private `upcomingTourCounts(routeIds: string[]): Promise<Map<string, number>>` doing **one** grouped query (`SELECT "routeId", COUNT(*)::int` … `WHERE routeId IN (...) AND date >= CURRENT_DATE GROUP BY "routeId"`) — never a count per route (N+1). `findAll`: fetch counts for all returned ids, pass into `toDto(route, tourCount)`; `findById`: same for the single id; delete the `tourCount: 0` hardcode and its slice-5 comment. Update the existing service spec's providers with a mocked Tour repository so current cases stay green, and add a case: two routes where the grouped query returns `{ routeA: 2 }` → DTOs carry `tourCount` 2 and 0, and the tour repo's query ran once for the whole list.
  - Done when: `npm test` passes (old + new cases); `npm run build` passes; against a seeded dev DB, `GET /api/routes` shows `tourCount` 2 for Medvednica Ridge Loop, 1 for Sljeme/Sava/Samobor, 0 for Jarun and Zelenjak (while the seed dates are in the future).

- [x] **T8 — Unit tests: ToursService**
  - Files: `backend/src/tours/tours.service.spec.ts` (new)
  - Do: Follow `routes.service.spec.ts`'s mocking style (mocked repositories / query builders). Cases: (1) `create` on an unknown route rejects with `NotFoundException` and never saves; (2) `create` with yesterday's date (compute relative to now) rejects with `BadRequestException` and never saves; (3) `create` sets `guideId` from the argument and stores blank/missing `notes` as `''`; (4) `toDto` decoration via a mocked found tour (route with 2+ waypoints, `startTime: '08:00:00'`): `startTime` `'08:00'`, `endTime`/`timeLabel` consistent with `computeEndTime`, `seatsLeft = capacity - bookedCount`, `isFull` true when `bookedCount === capacity`, `isBookedByMe === false`, `guide.rating === 4.9`, and `'roster' in dto === false`; (5) list decoration issues one grouped toursLed query for many tours, not one per tour.
  - Done when: `npm test` in `backend/` passes with all new cases green.

- [x] **T9 — E2e spec: tours endpoints**
  - Files: `backend/test/tours.e2e-spec.ts` (new)
  - Do: Reuse `createE2eContext()` / `destroyE2eContext()` from `backend/test/postgres-testcontainer.ts` in `beforeAll`/`afterAll` — never a second container. Setup: register a guide and a hiker via `POST /api/auth/register` (passwords ≥8 chars + digit); create a route with 3 waypoints via `POST /api/routes` (guide token). Use far-future dates (e.g. year 2030) — no time-bomb assertions. `validBody` per the contract. Cases: (1) `POST /api/routes/:id/tours` with no token → 401; hiker token → 403; (2) guide token + validBody → 201: UUID `id`, echoes date/startTime/capacity/meetingPoint/pace/notes, `bookedCount: 0`, `seatsLeft` = capacity, `isFull: false`, `isBookedByMe: false`, `endTime`/`timeLabel` matching `/^([01]\d|2[0-3]):[0-5]\d$/` and `timeLabel === startTime + ' – ' + endTime`, `guide` exactly `{ id, displayName, toursLed: 1, rating: 4.9 }` (assert `Object.keys(guide).sort()`), `route.name` matching, and **no `roster` key** (`'roster' in body === false`); (3) 400s: `date: '05-09-2030'`, `date` of yesterday, `startTime: '25:00'`, `capacity: 0`, missing `meetingPoint`, extra field `guideId` (forbidNonWhitelisted); (4) unknown route UUID → 404; (5) `GET /api/tours` unauthenticated → 200 containing the created tour; schedule a second tour with an earlier date and assert ordering `date ASC`; (6) `GET /api/tours/:id` → 200 same shape; unknown UUID → 404; non-UUID → 400; (7) `GET /api/routes/:id/tours` → the route's tours; a second route with none → `[]`; (8) `GET /api/routes/:id` and `GET /api/routes` now report `tourCount` equal to the number of scheduled tours; (9) upcoming filter: insert a past-dated tour directly via the Tour repository (`app.get(getRepositoryToken(Tour))` — creation via API correctly refuses past dates) and assert it is absent from `GET /api/tours` and `GET /api/routes/:id/tours` and excluded from `tourCount`, while `GET /api/tours/:id` still returns it (Decisions #3 + contract).
  - Done when: `npm run test:e2e` in `backend/` passes (Docker running) alongside the existing specs.

### Frontend (T10–T16) — buildable in parallel with T1–T9 against the contract

- [x] **T10 — Tour types + date formatting helper**
  - Files: `frontend/src/types/domain.ts` (edit), `frontend/src/lib/dates.ts` (new)
  - Do: In `domain.ts`, mirror the contract exactly: `TourRouteSummary`, `TourGuide`, `Tour`, and `CreateTourPayload { date: string; startTime: string; capacity: number; meetingPoint: string; pace: string; notes?: string }` (reuse `Difficulty`/`Activity`). In `dates.ts`: `export function formatDateLong(iso: string): string` → `new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })` — the prototype's `dateFmt` verbatim ("2026-08-22" → "Sat 22 August").
  - Done when: `npm run type-check` passes; `formatDateLong('2026-08-22')` returns `'Sat 22 August'` (verifiable in the T16/T17 smoke).

- [x] **T11 — Tours store**
  - Files: `frontend/src/stores/tours.ts` (new)
  - Do: Pinia setup store `useToursStore` in the style of `stores/routes.ts`. State: `list = ref<Tour[]>([])`, `current = ref<Tour | null>(null)`, `routeTours = ref<Tour[]>([])`, `loading = ref(false)`. Actions (all via `api` from `../lib/api` — no bare fetch): `fetchTours()` → `GET /tours` into `list`; `fetchTour(id)` → clear `current` first (stale-render guard like `fetchRoute`), `GET /tours/:id`; `fetchRouteTours(routeId)` → `GET /routes/:routeId/tours` into `routeTours`; `scheduleTour(routeId, payload: CreateTourPayload): Promise<Tour>` → `api.post` to `/routes/:routeId/tours`, return the created tour, let errors propagate (the dialog handles them).
  - Done when: `npm run type-check` passes; the store exports exactly these members.

- [x] **T12 — TourCard component**
  - Files: `frontend/src/components/TourCard.vue` (new)
  - Do: Props `{ tour: Tour }`, emits `open`. Render per the Design reference (§2.6 block above): `.card.elev-sm` padding `20px 22px` gap 12, clickable (click + Enter/Space emit `open`, hover shadow like `RouteCard`); header row with `<DateBadge :date="tour.date" />`, title `tour.route.name`, subline `` `${tour.timeLabel} · ${tour.meetingPoint}` ``; tag row: `<Tag :variant="difficultyTagVariant(tour.route.difficulty)">`, `<Tag>{{ tour.route.distanceLabel }}</Tag>`, seat tag from `seatTagState(tour.bookedCount, tour.capacity, tour.isBookedByMe)`; `<CapacityBar :booked="tour.bookedCount" :capacity="tour.capacity" />`; footer: `<AvatarInitials>` at 24px with neutral bg, guide name 12px @75%, and a right-aligned (`margin-left: auto`) primary `AppButton` whose label is `tour.isBookedByMe ? 'Booked' : tour.seatsLeft > 0 ? 'Book a seat' : 'Join waitlist'` and which also just emits `open` (Decisions #9). Design-system classes/tokens only; scoped CSS for layout gaps.
  - Done when: `npm run type-check` and `npm run build` pass.

- [x] **T13 — Tours list view + route**
  - Files: `frontend/src/views/ToursView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: Replace the `/tours` `PlaceholderView` with `ToursView` (keep name `'tours'`, keep it a child of `AppLayout`). Padding `26px 32px 56px`, `ts-rise`; H2 **"Upcoming guided tours"**; subline 14px @70% with the count bolded: `<strong>{{ n }} tours</strong> you can join, led by verified guides.` (`n` = `toursStore.list.length`; singular "1 tour"); grid `repeat(auto-fill, minmax(340px, 1fr))` gap 18 of `<TourCard>`s; `@open` → `router.push('/tours/' + tour.id)`. `onMounted` → `fetchTours()`. When the list is empty after loading, render `<EmptyState message="Nothing here yet." />`.
  - Done when: `npm run type-check` and `npm run build` pass; with both servers running and the DB seeded, `/tours` shows 5 cards ordered by date — first card "AUG 22", Medvednica Ridge Loop, "08:00 – 10:30 · Bliznec parking lot", seat tag "3 seats left" (outline), a 75%-filled sage bar; the full Sljeme tour shows an accent "Full" tag and an accent-colored full bar with CTA "Join waitlist".

- [x] **T14 — Tour detail view + route**
  - Files: `frontend/src/views/TourDetailView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: Add child route `{ path: '/tours/:id', name: 'tour-detail', component: TourDetailView }` under `AppLayout` (sibling of the others, after `/tours`). Model the view on `RouteDetailView.vue`: same load/watch/`idOf` pattern via `toursStore.fetchTour` (catch → toast "Tour not found" + replace `/tours`); same 2-col grid and map container but back button **"← All tours"** → `/tours`, map `<TrailMap mode="view" :coords="tour.route.waypoints" />`. Right panel per the Design reference (§2.7 block above): tags (difficulty via `difficultyTagVariant`, activity neutral); H2 32px `tour.route.name`; date line heading-font 18px `color: var(--color-accent-700)`: `` `${formatDateLong(tour.date)} · ${tour.timeLabel}` ``; notes paragraph; details card with the four label/value rows (**Meeting point** / **Distance** `` `${distanceLabel} · ↑ ${elevationLabel}` `` / **Pace** / **Seats** `` `${bookedCount} / ${capacity} booked` ``) + `<CapacityBar>`; guide card with 40px `AvatarInitials` (accent-2-300 bg), name, and `` `Guide · ${toursLed} tours led · ${rating} ★` ``; then, **only when `!authStore.isGuide`**, the block booking `AppButton` (primary, block, `min-height: 46px; font-size: 16px`), label `tour.isFull ? 'Tour is full' : 'Book a seat'`, **always `disabled`** this slice (Decisions #9) — no roster block for guides yet.
  - Done when: `npm run type-check` and `npm run build` pass; clicking the first seeded tour card lands on `/tours/<uuid>` showing the Medvednica polyline, "Sat 22 August · 08:00 – 10:30" in terracotta, the notes, "9 / 12 booked" with its bar, a guide card ending in "· 4.9 ★", and (as a hiker) a disabled "Book a seat" button; an unknown UUID bounces to `/tours` with a toast.

- [x] **T15 — ScheduleTourDialog component**
  - Files: `frontend/src/components/ScheduleTourDialog.vue` (new)
  - Do: Props `{ open: boolean; route: TrailRoute }`, emits `close` and `scheduled(tour: Tour)`. Wrap the existing `AppDialog` (`:open`, `title="Schedule a tour"`, `@close`). Context line under the title (13px @70%): `` `On ${route.name} · ${route.distanceLabel} · ${route.difficulty}` ``. Local refs reset every time `open` flips true: `date = ''`, `startTime = ''`, `capacity = 12`, `pace = ''`, `meetingPoint = ''`, `notes = ''`. Fields via `FormField` + `.input`: 2-col grid (gap ~10) — **Date** `type="date"`, **Start time** `type="time"`, **Capacity** `type="number" min="1" max="99"`, **Pace** (text, placeholder "Relaxed"); full-width **Meeting point** (placeholder "Bliznec parking lot") and **Notes for hikers** textarea `.input` `border-radius: 20px; min-height: 76px` (placeholder "Bring 1.5 L of water and layers — the ridge is windy."). Actions slot: secondary **Cancel** (emit `close`) and primary **"Publish tour"** `:disabled` until date, startTime, capacity ≥ 1, meetingPoint and pace are non-blank (Decisions #10), plus a `submitting` ref against double-submit. Submit: `toursStore.scheduleTour(route.id, { date, startTime, capacity: Number(capacity), meetingPoint: meetingPoint.trim(), pace: pace.trim(), notes: notes.trim() || undefined })`; on success `toastStore.show(\`Tour scheduled for ${formatDateLong(tour.date)}\`)`, emit `scheduled(tour)`, emit `close`; on error toast "Could not schedule tour" and stay open with values intact.
  - Done when: `npm run type-check` and `npm run build` pass.

- [x] **T16 — Route detail: tour list + schedule button wiring**
  - Files: `frontend/src/views/RouteDetailView.vue` (edit)
  - Do: In `load()`, also `await toursStore.fetchRouteTours(id)` (after the route resolves; a failure here should not bounce the page — catch separately, leave the list empty). In the existing `.route-detail__section-head`, add right of the H4 a guide-only (`authStore.isGuide`) primary `AppButton` **"Schedule a tour"** opening the dialog (`dialogOpen` ref). Replace the bare `EmptyState` with: `v-if="toursStore.routeTours.length"` a column (gap 10) of compact clickable `.card`s padding `14px 16px` — heading-font `formatDateLong(t.date)` with the seat tag from `seatTagState(...)` right-aligned on the same row, subline 12px @70% `` `${t.timeLabel} · ${t.meetingPoint} · led by ${t.guide.displayName}` `` — each navigating to `/tours/${t.id}` (click + keyboard, like `RouteCard`); `v-else` the existing `EmptyState compact` message unchanged. Mount `<ScheduleTourDialog :open="dialogOpen" :route="currentRoute" @close="dialogOpen = false" @scheduled="onScheduled" />` (guard with `v-if="currentRoute"`); `onScheduled` → re-run `fetchRouteTours(currentRoute.id)` so the new tour appears sorted (the toast already fired in the dialog). The route header's `tourCount` (Discover card) will reflect on next catalog fetch — no extra wiring.
  - Done when: `npm run type-check` and `npm run build` pass; as the seeded guide `ivana@trailshare.hr` / `trailshare1` on Medvednica Ridge Loop: two tour rows ("Sat 22 August" and "Sat 19 September") render with seat tags, clicking one opens the tour detail, and scheduling a tour for 2026-09-05 08:00 via the dialog closes it, toasts **"Tour scheduled for Sat 5 September"**, and inserts the row in date order; as a hiker the "Schedule a tour" button is absent; a route with no tours still shows "No tours scheduled on this route yet."

### Joint

- [x] **T17 — Verification pass**
  - Files: none (fix-ups only in files from T1–T16)
  - Do: Run `npm run lint`, `npm test`, `npm run test:e2e` in `backend/` (Docker running), and `npm run type-check`, `npm run build` (and `npm run test:unit` if present from slice 4) in `frontend/`. Fix failures introduced by this slice; leave pre-existing issues outside this slice's files alone. Smoke the flow of T13/T14/T16's Done-when lines once against seeded data.
  - Done when: all commands exit 0.
