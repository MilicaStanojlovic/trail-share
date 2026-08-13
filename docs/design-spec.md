# TrailShare — Implementation Spec (from Claude Design project)

Source of truth: `design/TrailShare.dc.html` (design-canvas prototype, projectId `b5b8b913-1ab6-424e-94b6-b0841637a0d1`).
Target stack: **Vue 3** (frontend, `frontend/`) + **NestJS** (backend, `backend/`). Maps: **Leaflet 1.9.4** with OpenStreetMap tiles.

> Note: `design/styles.css` has since been fetched in full and is the authoritative source for every token and utility class — it is copied verbatim into `frontend/src/assets/design-system.css`, which the app loads. Where §4 below reconstructs a token from usage, prefer the real file. (`support.js` is the design-canvas runtime and is not needed by the app.)

---

## 1. Product summary

TrailShare is a community trail app around **Zagreb / Medvednica** (Croatia). Two fixed roles chosen at registration:

- **Guide** — publishes routes (drawn on a map), schedules guided tours on routes, manages rosters, sees a dashboard.
- **Hiker** — browses routes and upcoming tours, books one seat per tour, manages bookings.

Auth is **JWT, 24 h session** (copy on the auth screen: "Protected by JWT — session lasts 24 h."). Role is "fixed after registration" (explicit label in the register form).

The prototype has a nav role-toggle (Hiker/Guide seg control) — that is a **prototyping affordance only**; in the real app the role comes from the authenticated user and the toggle must NOT be built.

---

## 2. Screens / views

The prototype is a single `<x-dc>` component with a `screen` state (`discover | route | draw | tours | tour | mine | dash`) plus an unauthenticated auth screen. Map instances are keyed by `data-mapmode`: `hero`, `view`, `draw`.

### 2.1 Auth screen — route `/auth` (redirect target when unauthenticated)

Full-viewport 2-column grid `grid-template-columns: 1.05fr 1fr`, background `var(--color-bg)`.

**Left column** (padding `48px 56px`, column flex, gap 28, max-width 560px):
- Logo row: 30px circle (`background: var(--color-accent-2)` with `inset -7px -7px 0 var(--color-accent)` box-shadow — a two-tone "moon" mark) + wordmark "TrailShare" in `var(--font-heading)` 21px.
- H1 52px: **"Draw the trail. Bring people along."**
- Sub-copy 16px @ 80% opacity: "Sketch a route on the map, tag how hard it is, and publish. Guides schedule tours on it — hikers book a seat."
- Mode switch: `.seg` with two `.seg-opt` radios — **Log in / Register**.
- Form (max-width 400px, gap 14):
  - Register-only: `.field` "Display name" (`.input`, sample "Ivana Kovač").
  - "Email" `.field` (sample "ivana@trailshare.hr").
  - "Password" `.field` (type password) with hint line below in 11px `var(--color-accent-2-700)`: "✓ 8+ characters, one number" → validation rule: **min 8 chars, at least one digit**.
  - Register-only role picker: label 12px @ 70% "Pick your role — this is fixed after registration", then 2-col grid of two selectable cards (**Guide**: "Publish routes and schedule guided tours." / **Hiker**: "Browse upcoming tours and book a seat."). Selected card style: `border: 1.5px solid var(--color-accent); background: var(--color-accent-100)`; unselected: `border: 1.5px solid var(--color-divider)`. Card: padding 12px 14px, radius 20px.
  - Submit: `.btn.btn-primary.btn-block`, min-height 42px, label **"Log in"** or **"Create account"** depending on mode.
  - Footnote 12px @ 60%: "Protected by JWT — session lasts 24 h."

**Right column**: full-bleed Leaflet map (`hero` mode: no zoom control, no scroll-wheel zoom, center `[45.9, 15.96]` zoom 12) showing the featured route polyline. Floating card bottom-left (radius 28px, `var(--color-bg)`, `--shadow-lg`): eyebrow "FEATURED" (10px uppercase, letter-spacing .1em, `var(--color-accent)`), route name in heading font 17px, and a `.tag.tag-neutral` with meta `"{difficulty} · {distance} km"`. Featured route = first route in the list.

After sign-in: guides land on `/dashboard`, hikers on `/routes`. Toast: "Signed in as a guide" / "Signed in as a hiker".

### 2.2 App shell (all authenticated screens)

Sticky top nav (`.nav`, padding `14px 32px`, `z-index 500`, background `var(--color-bg)`, sticky top 0):
- `.nav-brand`: 24px two-tone circle logo + "TrailShare".
- Links (with `aria-current="page"` on active section): **Routes** (active on discover + route detail), **Tours** (active on tours + tour detail), **My bookings** (hiker) / **My tours** (guide), and guide-only **Dashboard**.
- Right side: primary button **"＋ Draw a route"** (visible for both roles in the design) and a 34px avatar circle with the user's initials (e.g. "IK", `background: var(--color-accent-2-300)`) which signs out on click (title="Sign out"). (The Hiker/Guide seg toggle next to these is prototype-only — do not build.)

All screen bodies animate in with `ts-rise` (fade + 10px rise, .35s ease).

### 2.3 Discover / Published routes — route `/routes` (default for hikers)

Padding `26px 32px 56px`.
- Header row (flex, align-end): H2 **"Published routes"** + subline "**{n} community routes** around Zagreb and the Medvednica hills." Right-aligned controls: `.input` search box placeholder **"Search routes"** (width 210px) and a `.seg` difficulty filter: **All / Easy / Moderate / Hard** (single-select, default All).
- Card grid: `repeat(auto-fill, minmax(320px, 1fr))`, gap 18px. Each **RouteCard** (`.card.elev-sm`, padding 0, overflow hidden, clickable; hover: `--shadow-lg` + `translateY(-2px)`):
  - Top strip 148px, `background: var(--color-accent-2-200)`, containing an SVG **sparkline** of the route shape (polyline stroke `#c67139`, width 1.6, viewBox `0 0 100 44`, non-preserved aspect).
  - Overlaid tags top-left: difficulty tag (`tag-accent-2` for Easy, `tag-neutral` for Moderate, `tag-accent` for Hard) + activity `tag-neutral` (Hiking/Biking).
  - Body (padding `16px 18px 18px`): `.card-title` 19px name; `.card-body` description; meta row 12px @ 65%: `{dist} km`, `↑ {elev} m`, `{duration}`; author row: 22px initials circle (`var(--color-neutral-300)`) + "{author} · {n} tour(s) scheduled" or "no tours yet".

Note: the search input has no binding in the prototype (filter seg does); implement search as client-side or query-param name/description match.

### 2.4 Route detail — route `/routes/:id`

2-column grid `1fr 400px`, min-height `calc(100vh - 63px)` (63px = nav height).
- **Left**: Leaflet map in a rounded container (radius 28px, margin-left 32px, `--shadow-md`), `view` mode: route polyline + start/end markers, `fitBounds(pad 0.25)`. Floating `.btn.btn-secondary` top-left: **"← All routes"** (back to `/routes`).
- **Right panel** (padding `8px 32px 48px`, column, gap 18):
  - Tag row: difficulty tag + activity tag.
  - H2 34px route name; description paragraph @ 80%.
  - 2×2 stat tiles (padding 14px 16px, radius 20px, `var(--color-surface)`; label 11px uppercase @55%, value in heading font 22px): **Distance** ("{d} km"), **Elevation gain** ("{e} m"), **Est. duration** ("2 h 45 min" style), **Waypoints** (count).
  - "Upcoming tours" H4 with guide-only `.btn.btn-primary` **"Schedule a tour"** (opens Schedule dialog).
  - Tour list: compact clickable `.card`s (padding 14px 16px): heading-font date ("Sat 22 August"), right-aligned seat tag, and subline 12px @70% "{time} · {meeting point} · led by {guide}".
  - Empty state: dashed-border box (radius 20px, `1px dashed var(--color-divider)`): "No tours scheduled on this route yet."

### 2.5 Draw a route — route `/routes/new` (or `/draw`)

2-column grid `372px 1fr`.
- **Left sidebar** (padding `4px 26px 40px 32px`):
  - H3 **"Draw a route"** + help text: "Click the map to drop waypoints. Drag any pin to adjust; the line follows."
  - Live 2×2 stat tiles (radius 18px, surface bg): **Distance / Elev. gain / Duration / Waypoints** — show "—" until ≥2 points.
  - Buttons row: `.btn.btn-secondary` **"Undo point"** and **"Clear"**, both disabled when 0 points.
  - Form fields: "Route name" `.input` (placeholder "e.g. Sljeme Summit Climb"); "Difficulty" full-width `.seg` Easy/Moderate/Hard (default Moderate); "Activity" `.radio` pair **Hiking / Biking** (default Hiking); "Description" textarea `.input` radius 20px min-height 76px (placeholder "What makes this route worth walking?").
  - Inline validation banner (12px, `color: var(--color-accent-700)`, `background: var(--color-accent-100)`, radius 16px), messages: **"Place at least two waypoints on the map."** then **"Give the route a name of 3 characters or more."**
  - `.btn.btn-primary.btn-block` **"Publish route"**, disabled while invalid. Validation: `pts.length >= 2 && name.trim().length >= 3`. Empty description defaults to "No description yet.".
- **Right**: Leaflet map (`draw` mode, rounded 28px container, margin-right 32px, cursor crosshair). When 0 points, floating pill hint top-center: **"Click anywhere to place your first waypoint"**.
- On publish → navigate to the new route's detail page + toast **"Route published — {name}"**; draft resets.

### 2.6 Tours list — route `/tours`

Padding `26px 32px 56px`. H2 **"Upcoming guided tours"** + subline "**{n} tours** you can join, led by verified guides."
Grid `repeat(auto-fill, minmax(340px, 1fr))`, gap 18. Each **TourCard** (`.card.elev-sm`, padding 20px 22px):
- Header row: 56px-wide **date block** (radius 16px, `var(--color-accent-2-200)`; month abbrev uppercase 10px, day number heading-font 22px) + route name (`.card-title` 18px) and subline "{time} · {meet}".
- Tag row: difficulty tag, distance `tag-neutral` ("{d} km"), seat tag (see §7 seat states).
- **Capacity bar**: 6px track `var(--color-neutral-300)` radius 999px; fill width = booked/cap %, `var(--color-accent-2)` normally, `var(--color-accent)` when full.
- Footer: 24px guide-initials circle + guide name 12px @75% + right-aligned `.btn.btn-primary` CTA: **"Book a seat"** / **"Booked"** (if user booked) / **"Join waitlist"** (if full — in the design this only navigates to the detail page; no real waitlist exists). Card CTA navigates to tour detail.

### 2.7 Tour detail — route `/tours/:id`

Same 2-column layout as route detail (`1fr 400px`; map left in rounded container, `view` mode showing the tour's route polyline; back button **"← All tours"**).
Right panel (gap 16):
- Difficulty + activity tags; H2 32px route name.
- Heading-font 18px date line in `var(--color-accent-700)`: "{Sat 22 August} · {08:00 – 12:30}".
- Notes paragraph (guide's notes for hikers).
- **Details card** (surface bg, radius 22px, rows of label/value 13px flex-space-between): **Meeting point**, **Distance** ("{d} km · ↑ {e} m"), **Pace** (e.g. "Relaxed, 3.5 km/h"), **Seats** ("{booked} / {cap} booked") + capacity bar.
- **Guide card** (bordered `1px solid var(--color-divider)`, radius 22px): 40px initials circle (`accent-2-300`), guide name heading-font 15px, subline "Guide · {n} tours led · {rating} ★" (e.g. "14 tours led · 4.9 ★").
- **Hiker view**: big `.btn.btn-primary.btn-block` (min-height 46px, 16px font) — label **"Book a seat"** / **"✓ Seat booked"** (disabled) / **"Tour is full"** (disabled). Opens Book dialog.
- **Guide view** (owner): **Roster** H4 + `.table` rows: participant name | "booked {n} days ago" (@60%) | right-aligned `tag-accent-2` status (**Paid** / **Confirmed**).

### 2.8 My bookings / My tours — route `/my` (label depends on role)

Padding `26px 32px 56px`, max-width 1060px.
- Hiker: H2 **"My bookings"**, sub "Seats you hold on upcoming guided tours." Table columns: **Tour | Date | Guide | Status | (action)** — status `tag-accent-2` "Confirmed", ghost-button action **"View tour"**.
- Guide: H2 **"My tours"**, sub "Tours you scheduled, and how they are filling up." Columns: **Route | Date | Seats | Status | (action)** — seats cell "{booked} / {cap} booked", status tag **"Full"** (`tag-accent`) or **"Open"** (`tag-accent-2`), action **"Manage"** → tour detail.
- Empty state: dashed-border centered box (radius 24px): "Nothing here yet." + `.btn.btn-primary` **"Browse tours"**.

### 2.9 Guide dashboard — route `/dashboard` (guide-only, guarded)

Padding `26px 32px 56px`.
- H2 **"Good morning, {firstName}"** + sub "You have {n} tours on the calendar and {m} published routes."
- **Stat tiles row**: 4-col grid, gap 14 (tile: padding 18px 20px, radius 24px, surface bg; label 11px uppercase, value heading-font 30px, note 12px `var(--color-accent-2-700)`):
  1. "Tours scheduled" — count, note "next in 9 days" (compute: days until next tour).
  2. "Seats booked" — total booked across guide's tours, note "across all tours".
  3. "Routes published" — count, note "1 awaiting photos" (design flavor; can be static or omitted).
  4. "Rating" — "4.9", note "from 38 hikers" (no rating entity in the design — display-only/stub).
- Below, 2-col grid `1.35fr 1fr`, gap 34:
  - **"Your scheduled tours"** `.table`: Route | Date | Booked (seat tag "{b} / {c} booked") | ghost **"Manage"**.
  - **"Routes you published"**: list of compact horizontal `.card`s — 58×34 sparkline thumb (radius 10, `accent-2-200` bg, stroke `#c67139` width 3), name (heading 15px) + "{dist} km · {n} tours scheduled", right difficulty tag. Click → route detail.

### 2.10 Dialogs & toast (overlays, any screen)

- **Schedule a tour** (`.dialog-backdrop` z-900 → `.dialog` width `min(480px, 100%)`, `ts-pop` animation): `.dialog-title` "Schedule a tour", context line "On {route name} · {dist} km · {difficulty}". Fields in 2-col grid: **Date** (date input, sample 2026-09-05), **Start time** (time input, sample 08:00), **Capacity** (number, sample 12), **Pace** (text, sample "Relaxed"). Full-width: **Meeting point** (sample "Bliznec parking lot"), **Notes for hikers** (textarea, placeholder "Bring 1.5 L of water and layers — the ridge is windy."). Actions: `.btn.btn-secondary` **Cancel** / `.btn.btn-primary` **"Publish tour"**. Success toast: "Tour scheduled for {Sat 5 September}".
- **Book one seat?** dialog: `.dialog-body` "{route} on {date} at {time}. Meet at {meet}. You can cancel up to 24 h before." Actions: **"Not now"** / **"Confirm booking"**. Success toast: "Seat booked — see it under My bookings". → implies a **cancel-booking rule: allowed until 24 h before start**.
- **Toast**: fixed bottom-left (left 32, bottom 28, z-950) pill, `background: var(--color-accent-2-800)`, `color: var(--color-neutral-100)`, `--shadow-lg`, 14px, with an 8px `accent-2-300` dot; auto-dismiss ~3.2 s, `ts-rise` in.

---

## 3. Reusable components (Vue)

| Component | Props / variants | Notes |
|---|---|---|
| `AppNav` | user (name→initials, role), active section | Sticky; brand logo (two-tone circle + wordmark), links with `aria-current`, "＋ Draw a route" primary btn, avatar sign-out. |
| `BrandMark` | size (30/24px) | Circle `accent-2` bg + inset `accent` shadow. |
| `RouteCard` | route (decorated) | Grid card for Discover (§2.3). Emits open. |
| `RouteSparkline` | coords, strokeWidth (1.6 card / 3 thumb) | SVG viewBox `0 0 100 44`, normalize lon→x `14 + t*72`, lat→y `36 − t*28`, stroke `#c67139`. |
| `TourCard` | tour (decorated), CTA state | §2.6. |
| `DateBadge` | date | 56px, month abbrev + day. |
| `CapacityBar` | booked, capacity | 6px pill track; fill accent-2, accent when full. |
| `SeatTag` / `DifficultyTag` / `Tag` | variant: `neutral | accent | accent-2 | outline` | See tag semantics §7. |
| `StatTile` | label, value, note?, size (sm 18px-radius / md 20 / lg 24) | Uppercase 10-11px label, heading-font value. |
| `TrailMap` | mode: `hero | view | draw`; coords; editable pts (v-model for draw) | Wraps Leaflet; see §8. |
| `SegControl` | options[], modelValue | `.seg` of `.seg-opt` radios (auth mode, difficulty filter, draft difficulty). |
| `RadioGroup` | options[], modelValue | `.radio` + `.dot` (activity picker). |
| `FormField` | label, hint?, error? | `.field` wrapper: label + `.input`. |
| `AppButton` | variant: `primary | secondary | ghost`; block?; disabled | Pill `.btn`. |
| `AppDialog` | title, body?/slot | Backdrop + `.dialog`, `.dialog-title/.dialog-body/.dialog-actions`, `ts-pop`. |
| `AppToast` | message | Global, single, auto-dismiss 3.2 s. |
| `DataTable` | columns, rows (slots) | `.table` used in Mine, Dashboard, Roster. |
| `EmptyState` | message, cta? | Dashed 1px border box, radius 20–24px. |
| `AvatarInitials` | name, size (22/24/34/40) | Circle, initials from name; bg `neutral-300` or `accent-2-300`. |

---

## 4. Design tokens & utility classes

Load fonts: **Caprasimo** (`--font-heading`) and **Figtree** (`--font-body`) from Google Fonts.

CSS custom properties used by the design (define in a global `styles.css` port):

- `--color-bg` — warm cream page background (Leaflet fallback suggests the palette family of `#f5ead8` / `#ddd3bf`).
- `--color-surface` — slightly darker warm neutral for tiles/panels.
- `--color-text` — dark warm brown/near-black.
- `--color-divider` — hairline border color.
- Accent 1 (**burnt orange**): `--color-accent` (route stroke is `#c67139`; halo/dark shade `#8c491a`), plus steps `--color-accent-100` (pale wash) and `--color-accent-700` (deep, used for text).
- Accent 2 (**olive green** `#56633f` family — used for route end-marker): `--color-accent-2`, steps `-200` (pale strip/thumbnail bg), `-300` (avatar bg), `-700` (success-ish text), `-800` (toast bg).
- Neutrals: `--color-neutral-100` (near-white, toast text), `--color-neutral-300` (track/avatar bg).
- Shadows: `--shadow-sm` (via `.elev-sm`), `--shadow-md`, `--shadow-lg`.
- Known literal colors: sparkline/route stroke `#c67139`, route halo `#8c491a`, end marker `#56633f`, marker ring/cream `#f5ead8` (and `rgba(245,234,216,.7)` on Leaflet attribution), map fallback `#ddd3bf`.

Utility classes (all must be implemented):

- `.btn` — pill (radius 999px); variants `.btn-primary` (accent bg), `.btn-secondary` (surface/outline), `.btn-ghost` (borderless text); `.btn-block` full width; disabled state.
- `.card` — large radius (~24–28px), surface/white bg, column flex with gap; `.card-title` (heading font), `.card-body` (muted body), `.elev-sm` small shadow.
- `.input` — pill text input (radius 999px); textareas override to radius 20px.
- `.field` — label (small) + input stack.
- `.tag` — pill chip; variants `.tag-neutral`, `.tag-accent` (orange), `.tag-accent-2` (green), `.tag-outline`.
- `.nav` / `.nav-brand` — top bar; links with `aria-current="page"` active style.
- `.table` — clean rows for tables (thead th small/uppercase implied, generous row padding).
- `.dialog-backdrop` (fixed, dimmed, centers) / `.dialog` (large radius, padded, column gap) / `.dialog-title` / `.dialog-body` / `.dialog-actions` (right-aligned button row).
- `.seg` (pill segmented control) / `.seg-opt` (radio label; checked = filled).
- `.radio` / `.dot` — custom radio with dot indicator.

Extra CSS in the design head (port verbatim):

```css
.leaflet-tile-pane { filter: saturate(0.55) contrast(0.9) brightness(1.06) sepia(0.1); }
.leaflet-container { background: #ddd3bf; font-family: var(--font-body); }
.leaflet-control-attribution { font-size: 9px; background: rgba(245,234,216,.7) !important; }
@keyframes ts-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes ts-pop { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
.ts-wp { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: #c67139; color: #f5ead8; font: 700 10px/1 "Figtree", sans-serif; box-shadow: 0 0 0 3px rgba(245,234,216,.85); }
```

---

## 5. Data model

### User
| field | type | notes |
|---|---|---|
| id | uuid/int PK | |
| displayName | string | e.g. "Ivana Kovač"; initials derived |
| email | string unique | |
| passwordHash | string | password rule: ≥8 chars, ≥1 digit |
| role | enum `HIKER \| GUIDE` | immutable after registration |
| createdAt | timestamp | |

(Guide stats "14 tours led · 4.9 ★" — toursLed is derivable; rating has no source entity in the design, stub or seed it.)

### Route
| field | type | notes |
|---|---|---|
| id | PK | |
| name | string | min 3 chars |
| description | text | default "No description yet." |
| difficulty | enum `Easy \| Moderate \| Hard` | |
| activity | enum `Hiking \| Biking` | |
| authorId | FK User | |
| waypoints | ordered `[lat, lng][]` | min 2; store as JSON column or a `Waypoint` table `(routeId, seq, lat, lng)` |
| createdAt | timestamp | |

Derived (compute server-side, return in DTO — use the design's exact formulas for visual parity, §8.3): `distanceKm`, `elevationM`, `durationLabel`, `waypointCount`, `tourCount`.

### Tour
| field | type | notes |
|---|---|---|
| id | PK | |
| routeId | FK Route | |
| guideId | FK User (role GUIDE) | |
| date | date | e.g. 2026-08-22 |
| startTime | time | dialog collects start only; design displays a range "08:00 – 12:30" — compute end = start + route duration |
| capacity | int | e.g. 12 |
| meetingPoint | string | e.g. "Bliznec parking lot" |
| pace | string | e.g. "Relaxed, 3.5 km/h" |
| notes | text | shown to hikers |
| createdAt | timestamp | |

Derived: `bookedCount`, `seatsLeft`, `isFull`, per-viewer `isBookedByMe`.

### Booking
| field | type | notes |
|---|---|---|
| id | PK | |
| tourId | FK Tour | unique (tourId, hikerId) — one seat per hiker |
| hikerId | FK User | |
| status | enum `CONFIRMED \| PAID` | roster shows "Paid"/"Confirmed"; default CONFIRMED |
| createdAt | timestamp | roster shows "booked {n} days ago" |

Business rules: cannot book a full tour; cannot double-book; cancel allowed until 24 h before tour start; booking increments seat count atomically (guard capacity in a transaction).

### Seed data (from the prototype — use for fixtures)
Routes: Medvednica Ridge Loop (Moderate/Hiking, Ivana Kovač, 8 pts, closed loop), Sljeme Summit Climb (Hard/Hiking, Marko Babić), Sava Riverside Cruise (Easy/Biking, Ivana), Samobor Hills Traverse (Moderate/Biking, Petra Novak), Jarun Lake Circuit (Easy/Hiking, Ivana), Zelenjak Gorge Trail (Hard/Hiking, Marko). Exact coords are in `design/TrailShare.dc.html` (ROUTES array, lines ~477–496).
Tours: 5 tours (dates 2026-08-22 → 2026-09-19, capacities 8–20, booked 2–9, meets like "Gračanski dolac tram stop", "Jarun bridge, east side", "Samobor main square"; paces "Relaxed, 3.5 km/h" / "Brisk, 4.5 km/h" / "Social, 16 km/h" / "Moderate, 14 km/h") — TOURS array, lines ~498–504. Roster sample names: Luka Horvat, Ana Perić, Tomislav Rukavina, Maja Šimić, Filip Barišić, Nina Vuković, Dario Klarić, Sara Jurić.

---

## 6. API surface (REST, prefix `/api`)

Auth (JWT bearer, 24 h expiry):
- `POST /api/auth/register` — create account. Body `{ displayName, email, password, role: 'HIKER'|'GUIDE' }` → `{ token, user }`. Validates password ≥8 chars + 1 digit.
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`.
- `GET /api/auth/me` — current user `{ id, displayName, email, role }`.

Routes:
- `GET /api/routes?difficulty=Easy|Moderate|Hard&search=` — list published routes with derived stats + tourCount + author `{ id, displayName }`. Drives Discover.
- `GET /api/routes/:id` — full route incl. waypoints + its upcoming tours (or use the tours endpoint below).
- `POST /api/routes` — create/publish. Body `{ name, description?, difficulty, activity, waypoints: [[lat,lng],...] }`. 400 if <2 waypoints or name <3 chars. Auth required (design shows the Draw button for both roles; if restricting, restrict to GUIDE — the register copy implies guides publish).
- `GET /api/routes/mine` — routes authored by current user (guide dashboard "Routes you published").
- `GET /api/routes/:id/tours` — upcoming tours on a route (route detail list).

Tours:
- `GET /api/tours` — upcoming tours, decorated: route name/difficulty/activity/stats, guide `{ displayName, toursLed, rating }`, `bookedCount`, `capacity`, `isBookedByMe`. Drives Tours list.
- `GET /api/tours/:id` — tour detail; include `roster: [{ name, bookedAt, status }]` **only when requester is the owning guide**.
- `POST /api/routes/:routeId/tours` — GUIDE only: `{ date, startTime, capacity, pace, meetingPoint, notes }` → tour. Drives Schedule dialog.
- `GET /api/tours/mine` — GUIDE only: tours the guide scheduled (My tours + dashboard table).

Bookings:
- `POST /api/tours/:id/bookings` — HIKER: book one seat. 409 if full or already booked. → booking + updated seat counts.
- `GET /api/bookings/mine` — HIKER: my bookings with tour/route/guide info (My bookings table).
- `DELETE /api/bookings/:id` — cancel own booking; 403/409 if <24 h before tour start.

Dashboard:
- `GET /api/guide/dashboard` — GUIDE only: `{ toursScheduled, nextTourInDays, seatsBooked, routesPublished, rating: { value, count } }` (rating may be seeded/stubbed: 4.9 from 38 hikers).

All list responses should return decorated DTOs so the frontend renders labels without re-deriving (but the frontend still needs the stats formulas for the live Draw screen).

---

## 7. Interaction details & state semantics

**Seat/tag states** (used on tour cards, route-detail tour rows, tables):
- Booked by me → tag `tag-accent-2`, label **"You are in"**; detail CTA "✓ Seat booked" (disabled); list CTA "Booked".
- Full (`seatsLeft === 0`) → `tag-accent`, **"Full"**; detail CTA "Tour is full" (disabled); list CTA "Join waitlist" (navigates only — no waitlist backend).
- Low (`seatsLeft <= 3`) → `tag-outline`, **"{n} seats left"**.
- Otherwise → `tag-neutral`, **"{n} seats left"**.
- Seats summary string everywhere: **"{booked} / {cap} booked"**. Capacity bar fill % = booked/cap; accent color when full, accent-2 otherwise.

**Difficulty tag mapping**: Easy → `tag-accent-2` (green), Moderate → `tag-neutral`, Hard → `tag-accent` (orange).

**Dates**: display as `en-GB` "Sat 22 August" (`weekday: short, day: numeric, month: long`); date badge month = short uppercase ("AUG").

**Auth flow**: unauthenticated → `/auth`. Login/register seg toggles the form (register adds display name + role cards). On success, store JWT (24 h), redirect guide→`/dashboard`, hiker→`/routes`, toast. Sign-out via avatar → back to `/auth`. Route guards: `/dashboard`, `/tours/mine` guide-only; booking endpoints hiker-only.

**Draw flow**: click map → append waypoint (numbered draggable marker); drag marker → update that point, polyline follows; Undo removes last; Clear empties. Stats recompute live. Publish disabled until valid; error banner shows the first failing rule. After publish → route detail of the new route + toast.

**Dialogs**: Schedule (from route detail, guide) and Book (from tour detail, hiker); Esc/Cancel closes; confirm actions call the API, close, refresh data, toast.

## 8. Map implementation (Leaflet) — copy the prototype's behavior

1. **Setup**: OSM tiles `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, maxZoom 18, attribution "© OpenStreetMap". Default view `[45.9, 15.96]` zoom 12, `preferCanvas: true`. Hero mode: no zoom control, no scroll-wheel zoom. View/draw: zoom control bottom-right. Apply the tile-pane desaturation filter (§4).
2. **Route rendering (view/hero)**: two stacked polylines — halo `#8c491a` weight 7 opacity .25, main `#c67139` weight 4, round joins; start/end `circleMarker`s radius 7, stroke `#f5ead8` weight 3, fill start `#c67139` / end `#56633f`. `fitBounds(bounds.pad(0.25), { animate: false })` on shape change.
3. **Draw mode**: same polylines (solid), plus one numbered draggable `divIcon` (`.ts-wp`, 20×20, anchor center) per waypoint. Map `click` appends a point; marker `drag` replaces point i. No auto-fit while drawing.
4. **Stats formulas** (used for card/detail labels AND the live draw sidebar — keep identical front and back):
   - distance = haversine sum over consecutive points (R = 6371 km).
   - elevation gain (synthetic) = `round((distKm * 46 + numPoints * 12) / 10) * 10` meters.
   - duration hours = `distKm / speed + elev / 620`, speed = 14 (Biking) else 4.1; render as `H h M min` with minutes rounded to 5 (prototype note: its `activityOf()` always returns 'hike' — implement properly using the route's activity).
   - sparkline: normalize points into viewBox `0 0 100 44`: `x = 14 + tLon * 72`, `y = 36 − tLat * 28`.
5. **Lifecycle**: one map per container, destroyed on unmount; call `invalidateSize()` after mount/layout settles (the prototype does this at +60 ms).

---

## 9. Feature slices (build order)

1. **Foundation & design system** — Monorepo wiring: Nest app with `/api` prefix + DB (e.g. SQLite/Postgres via TypeORM or Prisma); Vue app with router + Pinia; port `styles.css` tokens/utilities (§4), load Caprasimo/Figtree, build `AppButton`, `Tag`, `SegControl`, `RadioGroup`, `FormField`, `AppDialog`, `AppToast`, `DataTable`, `EmptyState`, `AvatarInitials`, `StatTile`, app shell `AppNav` with placeholder links. *Unblocks everything.*
2. **Auth & roles** — User entity, register/login/me endpoints, JWT (24 h) + role guards; Auth screen (§2.1, hero map can ship as static-styled map or land in slice 3), route guards, sign-in/out flow, role-based nav (My bookings vs My tours, Dashboard link). *Depends on 1.*
3. **Route catalog (read)** — Route entity + seed data (§5), stats/decoration service (formulas §8.4), `GET /routes`, `GET /routes/:id`; Discover screen with difficulty filter + search, `RouteCard` + `RouteSparkline`; Route detail screen with `TrailMap` view mode (Leaflet integration lands here); tours section shows empty state for now. *Depends on 1–2.*
4. **Route drawing & publishing** — `POST /routes`; Draw screen: TrailMap draw mode (click/drag/undo/clear), live stat tiles, form + validation, publish → detail + toast. *Depends on 3 (map + stats + detail page).*
5. **Tour scheduling & browsing** — Tour entity + seeds, `GET /tours`, `GET /tours/:id`, `GET /routes/:id/tours`, `POST /routes/:routeId/tours` (guide); Tours list (`TourCard`, `DateBadge`, `CapacityBar`, seat tags), Tour detail (details card, guide card), Schedule dialog on route detail, route-detail tour list. Booking CTAs render but disabled/stub. *Depends on 3; dialog lives on route detail.*
6. **Seat booking** — Booking entity, `POST /tours/:id/bookings` (capacity-safe transaction), `GET /bookings/mine`, `DELETE /bookings/:id` (24 h rule); Book dialog + CTA states ("You are in"/"Full"/seats-left), My bookings table + empty state, guide Roster on tour detail. *Depends on 5.*
7. **Guide dashboard & polish** — `GET /tours/mine`, `GET /routes/mine`, `GET /guide/dashboard`; Dashboard screen (stat tiles, scheduled-tours table, published-routes list), My tours table (guide variant of `/my`); final pass on toasts, empty states, `ts-rise`/`ts-pop` animations, aria-current nav states. *Depends on 4–6 for real numbers.*

---

## 10. Open decisions (flagged, with recommendation)

1. **Who can draw routes?** Nav shows "＋ Draw a route" for both roles; register copy assigns publishing to guides. Recommendation: allow any authenticated user to publish routes (matches the visible UI), keep tour scheduling guide-only.
2. **Waitlist**: "Join waitlist" is a label only — do not build a waitlist; when full the detail CTA is a disabled "Tour is full".
3. **Ratings**: dashboard "4.9 from 38 hikers" and guide "4.8 ★" have no backing entity — seed static values or add a Review entity later (out of scope for the design).
4. **Tour end time**: dialog collects start time only; display range by adding the route's estimated duration.
5. ~~**styles.css exact values**~~ — resolved: fetched to `design/styles.css` and loaded by the app from `frontend/src/assets/design-system.css`. Use that file, not §4's reconstruction, whenever they disagree.
