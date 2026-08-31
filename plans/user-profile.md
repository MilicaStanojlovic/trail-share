# Feature: Profile page

**Branch:** `feature/user-profile` (cut from `develop`)

## Context

TrailShare knows who you are — `authStore.user` carries `{ id, displayName, email, role }` — but there is nowhere in the app that shows it back to you. Your name appears only as 34px initials in the nav, and clicking those initials signs you out, which is a surprising thing for your own avatar to do. Meanwhile the data that describes you is already computed and served: routes you published (`GET /api/routes/mine`), tours you scheduled (`GET /api/tours/mine`), seats you hold (`GET /api/bookings/mine`), and guide counters (`GET /api/guide/dashboard`).

This feature adds `/profile` — a read-only page every signed-in user has, showing their identity, account details, stat tiles, and their routes and tours as cards. The nav avatar becomes the way in, and sign-out moves onto the page.

**There is no profile screen in the design.** `docs/design-spec.md` never mentions "profile", "account" or "settings", and `design/TrailShare.dc.html`'s screen enum is `discover | route | draw | tours | tour | mine | dash`. So the page is composed entirely from existing design precedent — each borrowing is named in Decisions below. Nothing new is invented.

## Decisions (binding)

1. **Own profile only.** One route, `/profile`, always showing the caller. No `/users/:id`, no public profiles, no author bylines turning into links.
2. **Read-only.** No `bio`, `avatarUrl` or `location` columns, no `PATCH`, **no migration** — the `User` entity is untouched. Everything rendered already exists in the database.
3. **New `GET /api/profile` endpoint rather than extending `GET /api/auth/me`.** `plans/auth-and-roles.md` fixes the auth `user` payload as "never includes `passwordHash` or `createdAt`", and the profile needs `createdAt` for "Member since". A separate endpoint keeps that contract intact.
4. **New `profile/` module, not a controller on `UsersModule`.** `AuthModule` already imports `UsersModule`; adding `AuthModule` to `UsersModule` for `JwtAuthGuard` would be a cycle. `ProfileModule` mirrors `guide/` exactly — imports `TypeOrmModule.forFeature([...])` plus `UsersModule` so the guard's `UsersService` dependency resolves in this module's injector.
5. **Nav avatar navigates to `/profile`; sign-out moves onto the profile page.** This deviates from the design (`TrailShare.dc.html:105` gives the avatar `title="Sign out"`), deliberately: clicking your own face to log out is a bad affordance, and the profile is where every app puts it. Sign-out becomes 2 clicks. `AppNav`'s `sign-out` emit is removed.
6. **`/profile` and `/my` show the same records, on purpose.** `/my` stays the management view (tables, Manage / View tour actions); `/profile` is the portfolio view (`RouteCard` / `TourCard` grids). Neither changes the other.
7. **Role is rendered as plain text, not a tag.** The design has no role chip anywhere; the only role byline it has is the tour-detail guide card's `Guide · …`. A `tag-accent-2` "Guide" pill would be an invention.
8. **`rating` is the same stub as everywhere else** — `{ value: 4.9, count: 38 }`, guides only, `null` for hikers. This is now the third copy of that constant (`tours.service.ts` `GUIDE_RATING_STUB`, `guide.service.ts` `RATING_STUB`); it stays local with a comment naming the other two rather than growing a shared module for a display-only fiction.
9. **`toursLed` counts all tours ever**, matching `TourGuideDto.toursLed` on tour detail, so a guide's profile and their guide card never disagree.
10. **Seeded hikers show `0` tours booked.** `docs/seed-data.json` sets `bookedCount` on tours directly and creates no `Booking` rows (see the `GREATEST(...)` comment in `bookings.service.ts:161-166`). This is correct, not a bug — verify with a booking made by hand.

## API contract

### `GET /api/profile`

Auth: `JwtAuthGuard`, any role. 401 without a valid token. No params, no body.

200 →

```json
{
  "id": "uuid",
  "displayName": "Ivana Kovač",
  "email": "ivana@trailshare.hr",
  "role": "GUIDE",
  "createdAt": "2026-08-13T09:00:00.000Z",
  "stats": {
    "routesPublished": 3,
    "toursLed": 4,
    "seatsHosted": 17,
    "toursBooked": 0,
    "upcomingBookings": 0,
    "rating": { "value": 4.9, "count": 38 }
  }
}
```

- `createdAt` — ISO string from `User.createdAt`.
- `routesPublished` — `COUNT` of routes with `authorId = caller`.
- `toursLed` — `COUNT` of **all** the caller's tours, past included (decision 9). `0` for hikers.
- `seatsHosted` — `COALESCE(SUM(tour.bookedCount), 0)` over all the caller's tours. `0` for hikers.
- `toursBooked` — `COUNT` of the caller's `bookings` rows, all time.
- `upcomingBookings` — those whose `tour.date >= CURRENT_DATE` (same predicate as every other tour query).
- `rating` — `{ value: 4.9, count: 38 }` when `role === 'GUIDE'`, else `null`.

Every counter is always present regardless of role; only `rating` is nullable. No `passwordHash` anywhere.

## Tasks

Backend T2–T5 first, then frontend T6–T11, then the gate. Implementors run sequentially in one working tree.

- [x] **T1 — Branch and plan file**
  - `git checkout develop && git checkout -b feature/user-profile`; this file is the pipeline's shared state, per `CLAUDE.md`.

- [x] **T2 — Backend: profile DTO + service**
  - Files: `backend/src/profile/dto/profile-dto.ts` (new), `backend/src/profile/profile.service.ts` (new)
  - DTO exports `ProfileRatingDto { value: number; count: number }`, `ProfileStatsDto` (the six keys above), `ProfileDto` (the five top-level keys). `ProfileService` injects `UsersService` (for `createdAt` — `findById` returns the entity, so hand-pick fields, never spread) plus `Repository<Route>`, `Repository<Tour>`, `Repository<Booking>`, and exposes `getProfile(user: AuthUser): Promise<ProfileDto>` built from three aggregate queries in the raw-query-builder style of `guide.service.ts:29-48`:
    1. `routes.count({ where: { authorId: user.id } })`
    2. tours: `SELECT COUNT(*) AS "toursLed", COALESCE(SUM(tour.bookedCount), 0) AS "seatsHosted" WHERE tour.guideId = :id` via `getRawOne`, wrapped in `Number(... ?? 0)` so a guide with no tours gets `0`, not `null`/`NaN`.
    3. bookings: `innerJoin('booking.tour', 'tour')` (never `innerJoinAndSelect`), `SELECT COUNT(*) AS "toursBooked"`, `addSelect('COUNT(*) FILTER (WHERE tour.date >= CURRENT_DATE)', 'upcomingBookings')`, `WHERE booking.hikerId = :id`.
    File-level `const RATING_STUB: ProfileRatingDto = { value: 4.9, count: 38 }` with the decision-8 comment. Throw `NotFoundException` if `findById` returns null (the guard already re-loads the user, so this is defensive).
  - Done when: `cd backend && npm run build` passes.

- [x] **T3 — Backend: controller + module wiring**
  - Files: `backend/src/profile/profile.controller.ts` (new), `backend/src/profile/profile.module.ts` (new), `backend/src/app.module.ts` (edit)
  - `@Controller('profile')` with one `@Get()` guarded by `@UseGuards(JwtAuthGuard)`, taking `@CurrentUser() user: AuthUser`, returning `this.profileService.getProfile(user)`. `ProfileModule` imports `TypeOrmModule.forFeature([Route, Tour, Booking])` and `UsersModule` (decision 4 — copy the explanatory comment from `tours.module.ts:13-15`), declares the controller, provides `ProfileService`. Register `ProfileModule` in `app.module.ts`.
  - Done when: `npm run build` passes, `npm run start:dev` boots with no DI error, and `GET /api/profile` returns all six stat keys for a guide token and 401 with none.

- [x] **T4 — Backend: unit spec**
  - Files: `backend/src/profile/profile.service.spec.ts` (new)
  - Follow the repository/query-builder mock style of `guide.service.spec.ts`. Cases: (a) guide → all counters mapped, `rating` is the stub; (b) hiker → `rating` is `null` and `toursLed`/`seatsHosted` are `0`; (c) `SUM` returning `null` yields `0`, not `NaN`; (d) `passwordHash` never appears on the returned object (`expect(dto).not.toHaveProperty('passwordHash')`); (e) missing user → `NotFoundException`.
  - Done when: `npm test -- profile.service` passes.

- [ ] **T5 — Backend: e2e spec**
  - Files: `backend/test/profile.e2e-spec.ts` (new)
  - Using `createE2eContext` / `destroyE2eContext` from `test/postgres-testcontainer` and the register-then-act pattern of `test/guide-dashboard.e2e-spec.ts`: register a guide and a hiker; the guide publishes 2 routes and schedules 2 future tours; the hiker books one seat. Assert the guide's profile has `routesPublished: 2`, `toursLed: 2`, `seatsHosted: 1`, `toursBooked: 0`, `rating: { value: 4.9, count: 38 }`; the hiker's has `routesPublished: 0`, `toursLed: 0`, `seatsHosted: 0`, `toursBooked: 1`, `upcomingBookings: 1`, `rating: null`; `createdAt` parses as a date; no response body contains `passwordHash`; unauthenticated → 401.
  - Done when: `npm run test:e2e -- profile` passes (Docker required).
  - **Status: written but NOT RUN — Docker is not installed on this machine, so Testcontainers cannot start. Run it before merging anywhere Docker is available.**

- [x] **T6 — Frontend: types + date helper**
  - Files: `frontend/src/types/domain.ts` (edit), `frontend/src/lib/dates.ts` (edit)
  - Add `ProfileRating`, `ProfileStats`, `Profile` interfaces — field-for-field the contract above. Add `export function formatMemberSince(iso: string): string` → `new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })` ("13 August 2026"). No `T00:00:00` append here: unlike `formatDateLong`'s bare `YYYY-MM-DD`, `createdAt` is a full timestamp — note that in a comment.
  - Done when: `cd frontend && npm run type-check` passes.

- [x] **T7 — Frontend: profile store**
  - Files: `frontend/src/stores/profile.ts` (new)
  - Setup-style store matching `stores/dashboard.ts`: `data = ref<Profile | null>(null)`, `loading = ref(false)`, `fetchProfile()` → `api.get<Profile>('/profile')` with `loading` in `try/finally`, and `reset()` (mandatory — every per-user store has one).
  - Done when: `npm run type-check` passes.

- [x] **T8 — Frontend: extract sign-out into a helper**
  - Files: `frontend/src/lib/session.ts` (new), `frontend/src/layouts/AppLayout.vue` (edit)
  - Move `AppLayout.onSignOut`'s body verbatim into `export async function signOut(router: Router): Promise<void>` — `auth.logout()`, then `bookings/dashboard/routes/tours/profile.reset()`, `toast.show('Signed out')`, `router.push('/auth')`. Keep the existing comment explaining why every store must be reset. Add the new profile store to the reset list. `AppLayout` drops `onSignOut` and every store import it only used for that, and stops binding `@sign-out` on `AppNav`.
  - Done when: `npm run type-check && npm run build` pass and `grep -rn "sign-out" frontend/src` returns only `AppNav.vue` (removed in T9).

- [x] **T9 — Frontend: nav avatar links to the profile**
  - Files: `frontend/src/components/AppNav.vue` (edit)
  - Replace the `<button class="sign-out">` wrapper with `<RouterLink to="/profile" class="avatar-link" title="Your profile" aria-label="Your profile" :aria-current="profileCurrent">` around the existing `<AvatarInitials :size="34" bg="accent-2" />`. Add `const profileCurrent = computed(() => (route.path === '/profile' ? 'page' : undefined))` alongside the four existing ones. Delete the now-unused `defineEmits` and rewrite the block comment to explain the new behaviour (decision 5). Rename the `.sign-out` scoped rule to `.avatar-link` and keep its declarations, since `.nav a` styling would otherwise underline/recolour the avatar.
  - Done when: `npm run type-check && npm run build` pass; the nav avatar navigates to `/profile` and is keyboard-reachable; the other four `aria-current` states are unchanged.

- [x] **T10 — Frontend: route**
  - Files: `frontend/src/router/index.ts` (edit)
  - Add `{ path: '/profile', name: 'profile', component: ProfileView }` as a child of the `/` `AppLayout` record. **No `meta`** — the global `beforeEach` is deny-by-default, so auth protection is automatic and `guideOnly` must not be set.
  - Done when: `npm run type-check` passes; `/profile` redirects to `/auth` when signed out.

- [x] **T11 — Frontend: `ProfileView.vue` + optional `TourCard` CTA**
  - Files: `frontend/src/views/ProfileView.vue` (new), `frontend/src/components/TourCard.vue` (edit)
  - `TourCard`: add an optional `cta?: string` prop; `ctaLabel` returns `props.cta ?? <existing computed>`. Default behaviour is unchanged everywhere else — this exists so a guide's own tour does not offer them "Book a seat".
  - `ProfileView` wrapper: `padding: 26px 32px 56px; max-width: 1060px; animation: ts-rise .35s ease both` (identical to `MyBookingsView.vue:109`). Sections, each borrowing an existing pattern:
    - **Identity header** — flex row, gap 16, margin-bottom 22: `AvatarInitials :size="40" bg="accent-2"` (the design's largest avatar, from the tour-detail guide card), then `<h2 style="margin-bottom: 4px">{{ displayName }}</h2>` + a 14px `opacity: .7` subline, then an `AppButton variant="secondary"` **Sign out** at `margin-left: auto` calling `signOut(router)` from T8. Subline: guides get `Guide · {toursLed} tours led · {rating.value} ★` — byte-identical to `TourDetailView.vue:143`; hikers get `Hiker · {toursBooked} tours booked`.
    - **Details card** — replicate `.tour-detail__details` in scoped CSS (surface bg, radius 22px, padding `16px 18px`, gap 10; rows `flex; justify-content: space-between; font-size: 13px` with the label span at `opacity: .6`). Three rows: **Email** / `email`; **Role** / plain `Guide` or `Hiker` (decision 7); **Member since** / `formatMemberSince(createdAt)`.
    - **Stat tiles** — `StatTile size="lg"`, gap 14, margin-bottom 32, exactly as `DashboardView.vue:110-139`. Guides get `repeat(4, 1fr)`: Routes published · Tours led (note `across all time`) · Seats hosted (note `across all tours`) · Rating `value.toFixed(1)` (note `from {count} hikers`). Hikers get `repeat(3, 1fr)`: Routes published · Tours booked (note `seats you have held`) · Upcoming tours (note `still to come`). Wrap the header subline **and** the tiles in `v-if="profileStore.data"` so nothing renders `undefined` mid-load (the `DashboardView.vue:104` guard).
    - **Routes you published** — `<h4>` + `RouteCard` grid `repeat(auto-fill, minmax(320px, 1fr)); gap: 18px` over `routesStore.mine`, `@open` → `/routes/:id`. Empty → `EmptyState message="Nothing here yet." cta-label="Draw a route"` → `/routes/new`, guarded by `!routesStore.loading` (the `showEmpty` pattern at `MyBookingsView.vue:54`).
    - **Tours** — guides: `<h4>Tours you scheduled</h4>` + `TourCard` grid `repeat(auto-fill, minmax(340px, 1fr)); gap: 18px` over `toursStore.mine` with `cta="Manage"`; empty → `EmptyState message="Nothing here yet." cta-label="Browse routes"` → `/routes`. Hikers: `<h4>Tours you booked</h4>` + the same grid over `bookingsStore.mine.map(b => b.tour)` with the default CTA; empty → `EmptyState message="Nothing here yet." cta-label="Browse tours"` → `/tours` (the exact copy `/my` already uses).
    - `onMounted`: `Promise.all` of `profileStore.fetchProfile()`, `routesStore.fetchMine()`, and role-dependently `toursStore.fetchMine()` (guide) or `bookingsStore.fetchMine()` (hiker) — never `tours/mine` for a hiker, it is `@Roles('GUIDE')` and 403s. Wrap in `try/catch` → `toastStore.show('Could not load your profile')`.
  - Done when: `npm run type-check && npm run build` pass; signed in as `ivana@trailshare.hr` (`<SEED_PASSWORD>`), `/profile` shows her name, email, `GUIDE`, member-since, four populated tiles, her 3 routes and her tours; as `luka@trailshare.hr` it shows the 3-tile hiker layout with no rating.

- [x] **T12 — Verification gate** (e2e excepted, see T5)
  - Run `cd backend && npm run lint && npm test && npm run test:e2e` (Docker up) and `cd frontend && npm run type-check && npm run build`. Then with the stack running and seeded, walk the flow in Chrome per Verification below. Commit, push, merge to `develop` with `--no-ff`.

## Verification

Backend, all five must exit 0:

```bash
cd backend && npm run lint && npm test && npm run test:e2e
cd frontend && npm run type-check && npm run build
```

Then start the stack (`cd backend && npm run start:dev`, `cd frontend && npm run dev`), seed with `cd backend && npm run seed`, and check in the browser:

1. Sign in as `ivana@trailshare.hr` / `<SEED_PASSWORD>` → click the nav avatar → lands on `/profile`, nav avatar shows `aria-current="page"`.
2. Header reads `Ivana Kovač` / `Guide · N tours led · 4.9 ★`; details card shows her email, `Guide`, and a real member-since date; four tiles are populated; her 3 seeded routes render as `RouteCard`s; her tours render as `TourCard`s with a **Manage** CTA that opens the tour.
3. Click **Sign out** → toast "Signed out", redirected to `/auth`. Sign back in as `luka@trailshare.hr` and confirm the profile shows **no** trace of Ivana's routes or tours (the store `reset()` chain from T8).
4. As Luka: 3 tiles, no Rating tile, `Hiker · 0 tours booked`, "Nothing here yet." + **Browse tours** under Tours you booked (decision 10 — seeded hikers have no `Booking` rows). Book a seat from `/tours`, return to `/profile`, and confirm Tours booked and Upcoming tours both read 1 and the tour card appears.
5. Navigate to `/profile` while signed out → redirected to `/auth`.
6. `/my`, `/dashboard`, `/routes` and `/tours` are visually unchanged; `/tours` cards still say "Book a seat".
