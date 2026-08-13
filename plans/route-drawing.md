# Feature: Route drawing & publishing

**Branch:** `feature/route-drawing`
**Depends on:** `plans/route-catalog.md` (Route entity, `route-stats.ts`, RoutesService/Controller, TrailMap, routes store, route detail screen), `plans/auth-and-roles.md` (JwtAuthGuard, `@CurrentUser()`, auth store), `plans/foundation-ui-kit.md` (kit components, toast)

## Goal

Any signed-in user opens `/routes/new`, clicks the map to drop numbered draggable waypoints, watches distance / elevation / duration update live, fills in name, difficulty, activity and description, and publishes. The route is created via `POST /api/routes`, the user lands on its detail page with the toast "Route published — {name}", and it appears at the end of the Discover grid.

## Design reference

`design/TrailShare.dc.html` lines **209–270** (draw screen) and spec §2.5 / §8.3:

- 2-col grid `372px 1fr`, `min-height: calc(100vh - 63px)`, `ts-rise`.
- **Left sidebar** (`padding: 4px 26px 40px 32px`, column flex, gap 16): H3 **"Draw a route"** (margin-bottom 4) + help line 13px opacity .7 "Click the map to drop waypoints. Drag any pin to adjust; the line follows."; 2×2 stat grid (gap 8; tiles padding 12px 14px, radius 18, surface bg, label 10px uppercase ls .08em opacity .55, value heading-font 20px) — **Distance / Elev. gain / Duration / Waypoints**; buttons row gap 8: `.btn.btn-secondary` **"Undo point"** and **"Clear"**, both `disabled` at 0 points; `.field`s: "Route name" `.input` placeholder **"e.g. Sljeme Summit Climb"**; "Difficulty" full-width `.seg` Easy/Moderate/Hard (each opt `flex: 1; justify-content: center`), default **Moderate**; "Activity" `.radio` pair Hiking/Biking (row gap 18, padding-top 2), default **Hiking**; "Description" textarea `.input` `border-radius: 20px; min-height: 76px` placeholder **"What makes this route worth walking?"**; validation banner (12px, `color: var(--color-accent-700)`, `background: var(--color-accent-100)`, padding `10px 14px`, radius 16px) shown only while invalid; `.btn.btn-primary.btn-block` **"Publish route"** (`min-height: 42px; font-size: 15px`), `disabled` while invalid.
- **Right**: relative container `margin-right: 32px; border-radius: 28px; overflow: hidden; box-shadow: var(--shadow-md)`; `draw`-mode map absolute inset 0 with **crosshair cursor**; at 0 points a floating pill hint `left: 50%; top: 24px; translateX(-50%); z-index: 450; padding: 10px 18px; radius 999px; background: var(--color-bg); box-shadow: var(--shadow-md); font-size: 13px`: **"Click anywhere to place your first waypoint"**.
- **Draw-mode map behavior** (spec §8.3, design lines 601–613): same halo + main polylines as view mode but the main polyline gets `dashArray: '1 0'` in draw mode; one numbered draggable `divIcon` marker per point using the existing `.ts-wp` class (20×20, anchor center); map `click` appends a point; marker `drag` replaces point i and the polyline follows; **never** auto-`fitBounds` while drawing.
- Validation is `pts.length >= 2 && name.trim().length >= 3`; the banner shows the **first** failing rule: **"Place at least two waypoints on the map."** then **"Give the route a name of 3 characters or more."** Empty description defaults to **"No description yet."** (spec §2.5).

## Decisions (inherited + new)

Inherited from `plans/route-catalog.md` Decisions — binding, do not revisit:

1. Waypoints are a `jsonb` `[lat, lng][]` column on `Route`, written whole and atomically (catalog #1).
2. Stats formulas are the pure functions in `backend/src/routes/route-stats.ts`; this slice **ports that file to `frontend/src/lib/route-stats.ts`**, byte-for-byte except the one import line (catalog #2). The backend's existing `route-stats.spec.ts` (~20 cases) pins the outputs the port must reproduce — including minutes rounding to 5 and the `m === 60` rollover into the hour.
3. `POST /api/routes` uses **`JwtAuthGuard` only — no `@Roles('GUIDE')`** (catalog #4): the nav shows "＋ Draw a route" for both roles.
4. New routes append at the end of the `createdAt ASC` list, like the prototype (catalog #5).

New decisions for this slice:

5. **Stat tiles**: Distance / Elev. gain / Duration show `—` while `pts.length < 2`; the Waypoints tile always shows the live count (`0`, `1`, …) — it *is* the count, and "—" for it would hide the only feedback for the first click.
6. **Backend mirrors the prototype's trim semantics**: `name` is trimmed via `@Transform` before `@MinLength(3)` (so `"  ab  "` → 400); a missing, empty, or whitespace-only `description` becomes `"No description yet."` in the service.
7. **The frontend port's single permitted deviation**: `import { RouteActivity } from './route.entity'` becomes `import type { Activity } from '@/types/domain'`, and `activity === RouteActivity.BIKING` becomes `activity === 'Biking'` (identical runtime value). Everything else is character-identical.
8. **Frontend unit tests use Vitest**, added as a devDependency with a `test:unit` script — the frontend currently has no test runner, and the pinned-value parity requirement needs one. The spec imports `./route-stats` relatively so no alias config is required.
9. **Draft state is view-local** (refs in `DrawRouteView`): the design only specifies a reset after publish; navigating away discards the draft.
10. **Publish failure** (network/4xx): toast "Could not publish route" and stay on the page with the draft intact. The design defines no error state.
11. **Crosshair cursor** is set in `TrailMap` itself (`map.getContainer().style.cursor = 'crosshair'` in draw mode) — Leaflet's own grab cursor would win over wrapper CSS.

## API contract

One new endpoint. `RouteDto` is unchanged from `plans/route-catalog.md` (`id, name, description, difficulty, activity, author{id,displayName}, waypoints, waypointCount, tourCount, distanceKm, distanceLabel, elevationM, elevationLabel, durationLabel, createdAt`).

- `POST /api/routes` — **auth required** (`Authorization: Bearer <jwt>`, `JwtAuthGuard` only, any role).
  - Request body:

    ```json
    {
      "name": "Sljeme Summit Climb",
      "description": "Steep but shaded.",
      "difficulty": "Hard",
      "activity": "Hiking",
      "waypoints": [[45.9002, 15.9432], [45.9068, 15.9508]]
    }
    ```

    - `name`: string, trimmed server-side, trimmed length ≥ 3, max 120.
    - `description`: optional string, max 2000; missing / empty-after-trim → stored as `"No description yet."`.
    - `difficulty`: exactly `"Easy" | "Moderate" | "Hard"`; `activity`: exactly `"Hiking" | "Biking"`.
    - `waypoints`: array of **≥ 2** `[lat, lng]` pairs; each element must be a 2-number array with `lat ∈ [-90, 90]` and `lng ∈ [-180, 180]`.
    - Any extra body field → 400 (global `forbidNonWhitelisted`).
  - 201 → the full decorated `RouteDto` of the created route: `author` = the current user's `{ id, displayName }` (from the JWT — never from the body), `tourCount: 0`, stats computed by `computeRouteStats`.
  - 400 → validation failure (any rule above); 401 → missing/invalid token.

## Tasks

- [x] **T1 — CreateRouteDto with lat/lng pair validator**
  - Files: `backend/src/routes/dto/create-route.dto.ts` (new)
  - Do: In this file, first build a custom decorator `IsLatLngPair(validationOptions?: ValidationOptions)` using `registerDecorator`: valid iff the value is an array of exactly 2 finite numbers with `value[0]` in [-90, 90] and `value[1]` in [-180, 180]; default message `'each waypoint must be a [lat, lng] pair with lat in [-90, 90] and lng in [-180, 180]'`. Then `export class CreateRouteDto`: `name: string` with `@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(3) @MaxLength(120)`; `description?: string` with `@IsOptional() @IsString() @MaxLength(2000)`; `difficulty: RouteDifficulty` with `@IsEnum(RouteDifficulty)`; `activity: RouteActivity` with `@IsEnum(RouteActivity)`; `waypoints: [number, number][]` with `@IsArray() @ArrayMinSize(2) @IsLatLngPair({ each: true })`. Every field decorated — the global pipe strips undecorated fields. Enums imported from `../route.entity`.
  - Done when: `npm run build` passes in `backend/`; the file exports both `CreateRouteDto` and `IsLatLngPair`.

- [x] **T2 — RoutesService.create**
  - Files: `backend/src/routes/routes.service.ts` (edit)
  - Do: Add `async create(dto: CreateRouteDto, authorId: string): Promise<RouteDto>`: compute `const description = dto.description?.trim() ? dto.description.trim() : 'No description yet.'`; `this.routes.create({ name: dto.name, description, difficulty: dto.difficulty, activity: dto.activity, waypoints: dto.waypoints, authorId })`; `await this.routes.save(...)`; return `this.findById(saved.id)` (reuses the existing author join + `toDto` decoration — do not duplicate `toDto` logic). Touch nothing else in the service.
  - Done when: `npm run build` passes; `create` exists with exactly this signature and returns `Promise<RouteDto>`.

- [x] **T3 — POST handler on RoutesController**
  - Files: `backend/src/routes/routes.controller.ts` (edit)
  - Do: Add above the existing GETs: `@Post() @UseGuards(JwtAuthGuard) create(@Body() dto: CreateRouteDto, @CurrentUser() user: AuthUser): Promise<RouteDto> { return this.routesService.create(dto, user.id); }`. **No** `RolesGuard` / `@Roles` (Decisions #3). Imports: `Post`, `Body`, `UseGuards` from `@nestjs/common`; `JwtAuthGuard` and `CurrentUser` from `../auth/...`; **`import type { AuthUser } from '../auth/auth-user'`** — a value import trips TS1272. Leave the two GET handlers and their public status untouched. Nest's default 201 for POST is the contract's status.
  - Done when: `npm run build` passes; with the dev server running, `POST /api/routes` without a token returns 401, and with a valid token + valid body returns 201 JSON containing `id` and `durationLabel`.

- [x] **T4 — Unit tests: CreateRouteDto validation**
  - Files: `backend/src/routes/dto/create-route.dto.spec.ts` (new)
  - Do: Use `plainToInstance(CreateRouteDto, body)` + `validate()` from class-transformer/class-validator. A `validBody` fixture with 2 waypoints. Cases: (1) validBody → 0 errors; (2) `name: '  ab  '` → error on `name` (trim runs before MinLength); (3) `name: '  abc '` → 0 errors and the instance's `name` is `'abc'`; (4) missing `description` → 0 errors; (5) `difficulty: 'Extreme'` → error; (6) `activity: 'Running'` → error; (7) `waypoints: [[45.9, 15.96]]` → error (ArrayMinSize); (8) `waypoints` containing `[95, 15.96]` → error (lat range); (9) containing `[45.9, 195]` → error (lng range); (10) containing `[45.9, 15.96, 1]` → error (not a pair); (11) containing `[45.9, 'x']` → error (non-number).
  - Done when: `npm test` in `backend/` passes with the new spec green.

- [x] **T5 — Unit tests: RoutesService.create**
  - Files: `backend/src/routes/routes.service.spec.ts` (edit)
  - Do: Extend the existing spec (keep its mocking style). Cases: (1) `create` calls `repo.create`/`save` with `authorId` set from the argument (never from the DTO) and the literal waypoints, then resolves `findById(saved.id)`'s decorated DTO — assert by mocking `save` to resolve `{ id: 'route-1', ... }` and spying on the service's own `findById` (mock it to resolve a fixture DTO) so the test pins the delegation; (2) `description: '   '` → the entity passed to `create`/`save` has `description: 'No description yet.'`; (3) `description: ' Steep but shaded. '` → stored trimmed.
  - Done when: `npm test` in `backend/` passes; existing cases stay green.

- [x] **T6 — E2e spec: POST /api/routes**
  - Files: `backend/test/routes-create.e2e-spec.ts` (new)
  - Do: **Reuse the existing harness** — `createE2eContext()` / `destroyE2eContext()` from `backend/test/postgres-testcontainer.ts` in `beforeAll`/`afterAll`; never start a second container. In `beforeAll`, register two fresh users via `POST /api/auth/register` (one `GUIDE`, one `HIKER`, passwords satisfying the 8+/digit rule) and keep both tokens. A `validBody` fixture with 3 waypoints around `[45.9, 15.96]`. Cases: (1) no Authorization header → 401; (2) guide token + validBody → 201, response has a UUID `id`, echoes name/difficulty/activity/waypoints, `waypointCount: 3`, `tourCount: 0`, `author` equal to `{ id: <guide id>, displayName: <guide displayName> }` with `Object.keys(author).sort()` = `['displayName','id']`, `distanceLabel` matching `/^\d+\.\d km$/`, `elevationM % 10 === 0`, `durationLabel` matching `/^(\d+ h( \d+ min)?|\d+ min)$/`; (3) **hiker token** + validBody → 201 (proves no role guard — Decisions #3); (4) omitted `description` → 201 with `description: 'No description yet.'`; (5) `name: 'ab'` → 400; (6) 1 waypoint → 400; (7) a `[95, 15.96]` waypoint → 400; (8) a `[45.9, 15.96, 1]` waypoint → 400; (9) `difficulty: 'Extreme'` → 400; (10) extra field `authorId` in the body → 400 (forbidNonWhitelisted); (11) after the 201s, `GET /api/routes` (no auth) includes the created routes **after** any earlier ones (createdAt ASC — Decisions #4), and `GET /api/routes/:id` of a created route returns 200 with the same decorated shape.
  - Done when: `npm run test:e2e` in `backend/` passes (Docker running) alongside the existing specs.

- [x] **T7 — Frontend port of route-stats**
  - Files: `frontend/src/lib/route-stats.ts` (new)
  - Do: Copy `backend/src/routes/route-stats.ts` **byte-for-byte** with exactly one deviation (Decisions #7): replace `import { RouteActivity } from './route.entity';` with `import type { Activity } from '@/types/domain'`, change the two `activity: RouteActivity` parameter types to `activity: Activity`, and `activity === RouteActivity.BIKING` to `activity === 'Biking'`. All function bodies, names, comments and the `RouteStats` interface stay identical: `haversineKm`, `pathDistanceKm`, `elevationGainM`, `durationHours`, `formatDuration`, `computeRouteStats`. The backend's `route-stats.spec.ts` pins the outputs this port must reproduce — including minutes rounding to 5 and `m === 60` rolling into the hour.
  - Done when: `npm run type-check` passes in `frontend/`; `diff` of the two files shows changes on only the import line and the `RouteActivity`/`Activity` occurrences.

- [x] **T8 — Vitest + parity tests for the port**
  - Files: `frontend/package.json` (edit, via npm), `frontend/src/lib/route-stats.spec.ts` (new)
  - Do: In `frontend/`, `npm install -D vitest`; add script `"test:unit": "vitest run"`. The spec imports `{ describe, it, expect }` from `'vitest'` explicitly and the functions from `'./route-stats'` (relative — no alias config needed, Decisions #8). Assert the **same pinned values as `backend/src/routes/route-stats.spec.ts`**: `haversineKm([45.9, 15.96], [45.909, 15.96])` → `toBeCloseTo(1.0008, 3)`; `pathDistanceKm` of `[]` and of one point → 0; `elevationGainM(1.0008, 2)` → 70; `formatDuration(0.357)` → `'20 min'`; `formatDuration(2.7)` → `'2 h 40 min'`; `formatDuration(1.99)` → `'2 h'` (the m=60 rollover); `formatDuration(3.0)` → `'3 h'`; `computeRouteStats` on `[[45.9, 15.96], [45.909, 15.96]]` → `durationLabel` `'20 min'` for `'Hiking'` and `'10 min'` for `'Biking'`.
  - Done when: `npm run test:unit` in `frontend/` exits 0 with all cases green; `npm run type-check` and `npm run build` still pass.

- [x] **T9 — TrailMap draw mode**
  - Files: `frontend/src/components/TrailMap.vue` (edit)
  - Do: Extend the existing component (hero/view behavior must not change). Add an optional `modelValue?: [number, number][]` prop + `update:modelValue` emit (the draw screen binds `v-model` — the **view owns the waypoint state**; the map never mutates the received array, it always emits a fresh copy). Make `coords` optional defaulting to `[]`. Painting uses `mode === 'draw' ? modelValue ?? [] : coords`. In draw mode: (a) `map.getContainer().style.cursor = 'crosshair'` (Decisions #11); (b) `map.on('click', e => emit('update:modelValue', [...pts, [e.latlng.lat, e.latlng.lng]]))`; (c) in `paint()`, main polyline gets `dashArray: '1 0'` (halo unchanged), **no** start/end circleMarkers and **no** `fitBounds` ever (spec §8.3); (d) after the polylines, add one `L.marker(p, { draggable: true, icon: L.divIcon({ className: 'ts-wp', html: String(i + 1), iconSize: [20, 20], iconAnchor: [10, 10] }) })` per point (`.ts-wp` already exists in `frontend/src/assets/app.css` — do not restyle), with a `drag` handler that emits a copy where point `i` is replaced by `[latlng.lat, latlng.lng]`. Watch `modelValue` deeply and repaint (markers included) on change; keep the existing unmount cleanup.
  - Done when: `npm run type-check` and `npm run build` pass; in view/hero mode nothing visible changed (solid line, markers, fitBounds intact).

- [x] **T10 — publishRoute action on the routes store**
  - Files: `frontend/src/stores/routes.ts` (edit), `frontend/src/types/domain.ts` (edit)
  - Do: In `domain.ts`, add `export interface CreateRoutePayload { name: string; description?: string; difficulty: Difficulty; activity: Activity; waypoints: [number, number][] }`. In the store, add `async function publishRoute(payload: CreateRoutePayload): Promise<TrailRoute>` → `const route = await api.post<TrailRoute>('/routes', payload)`; push it onto `list` (it belongs at the end — Decisions #4) and return it; let errors propagate to the caller. Export it from the store's return.
  - Done when: `npm run type-check` passes; the store exports `publishRoute` alongside the existing members.

- [x] **T11 — Draw screen: layout, draft state, live stats**
  - Files: `frontend/src/views/DrawRouteView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: Replace the `/routes/new` `PlaceholderView` with `DrawRouteView` (keep route name `'draw'`, keep it a child of `AppLayout`). View-local draft refs (Decisions #9): `pts = ref<[number, number][]>([])`, `name = ref('')`, `difficulty = ref<Difficulty>('Moderate')`, `activity = ref<Activity>('Hiking')`, `description = ref('')`. Build the full layout per the Design reference: `372px 1fr` grid with `ts-rise`; sidebar H3 + help line; 2×2 stat grid using `<StatTile size="sm">` with computed values from `computeRouteStats(pts.value, activity.value)` (import from `@/lib/route-stats`) — Distance/Elev. gain/Duration show `'—'` while `pts.length < 2`, Waypoints always shows `pts.length` (Decisions #5); buttons row with `<AppButton variant="secondary">` "Undo point" (`pts.pop()` via a new-array assignment) and "Clear" (`pts = []`), both `:disabled="pts.length === 0"`; the four form fields (FormField + `.input` name with placeholder "e.g. Sljeme Summit Climb", full-width `SegControl` Easy/Moderate/Hard, `RadioGroup` Hiking/Biking, textarea `.input` with `border-radius: 20px; min-height: 76px` and placeholder "What makes this route worth walking?"). Right side: the rounded relative container with `<TrailMap mode="draw" v-model="pts" />` absolute inset 0, plus the floating hint pill (exact styles from the Design reference) shown only when `pts.length === 0`. Publish button and banner render but may be inert until T12 (button present, `disabled` bound; banner markup with the computed message).
  - Done when: `npm run type-check` and `npm run build` pass; at `/routes/new` clicking the map drops numbered terracotta pins, dragging pin 2 moves the dashed-solid line with it, the map never re-fits itself, Undo/Clear enable after the first click and work, and the Duration tile flips from "—" to a `H h M min` value at the second point — Hiking vs Biking changes it.

- [x] **T12 — Draw screen: validation banner + publish flow**
  - Files: `frontend/src/views/DrawRouteView.vue` (edit)
  - Do: `const error = computed(() => pts.value.length < 2 ? 'Place at least two waypoints on the map.' : name.value.trim().length < 3 ? 'Give the route a name of 3 characters or more.' : null)` — first failing rule only; banner (`v-if="error"`, exact styles from the Design reference) shows it; Publish `<AppButton variant="primary" block :disabled="error !== null">Publish route</AppButton>` (min-height 42, font-size 15). On click: `const route = await routesStore.publishRoute({ name: name.value.trim(), description: description.value.trim() || undefined, difficulty: difficulty.value, activity: activity.value, waypoints: pts.value })` in try/catch; on success `useToastStore().show(\`Route published — ${route.name}\`)`, reset all five draft refs, then `router.push(\`/routes/${route.id}\`)`; on error toast `'Could not publish route'` and keep the draft (Decisions #10). Guard against double-submit with a `publishing` ref disabling the button during the request.
  - Done when: `npm run type-check` and `npm run build` pass; with both servers running and signed in (either role): the banner walks through both messages in order as you fix them, the button enables only when `pts.length >= 2 && name.trim().length >= 3`, publishing lands on `/routes/<new-uuid>` showing the drawn polyline and matching stat tiles with the toast "Route published — {name}", the new route appears last on `/routes`, and revisiting `/routes/new` shows a clean draft.

- [x] **T13 — Verification pass**
  - Files: none (fix-ups only in files from T1–T12)
  - Do: Run `npm run lint`, `npm test`, `npm run test:e2e` in `backend/` (Docker running), and `npm run type-check`, `npm run build`, `npm run test:unit` in `frontend/`. Fix failures introduced by this slice; leave pre-existing issues outside this slice's files alone.
  - Done when: all six commands exit 0.
