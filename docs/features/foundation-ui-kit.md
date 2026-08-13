# Feature: Foundation & design system

**Branch:** `feature/foundation-ui-kit`
**Depends on:** none

## Goal

Deliver the reusable Vue component library (spec §3) and the authenticated app shell so every later slice composes screens from finished parts. When this is done, a developer can open `/_kit` in Chrome and see every component — buttons, tags, tiles, form controls, dialog, toast, table, empty state, capacity bar, date badge, sparkline, nav — rendered in all variants, pixel-faithful to `design/TrailShare.dc.html`. No user-facing feature ships yet; this unblocks everything.

## Design reference

- `design/styles.css` (already ported verbatim to `frontend/src/assets/design-system.css` — **do not touch that file**) defines every token and utility class: `.btn(-primary|-secondary|-ghost|-icon|-block)`, `.card(-kicker|-title|-body|-meta)`, `.input`, `.field`, `.tag(-neutral|-accent|-accent-2|-outline)`, `.nav`/`.nav-brand`, `.table`, `.dialog(-backdrop|-title|-body|-actions)`, `.seg`/`.seg-opt`, `.radio`/`.dot`, `.elev-sm|md|lg`, `.hr`, `.text-muted`.
- `design/TrailShare.dc.html`:
  - Nav markup: lines 88–107 (padding `14px 32px`, gap 26px, sticky top 0, `z-index 500`, bg `var(--color-bg)`; brand = 24px circle `background: var(--color-accent-2); box-shadow: inset -6px -6px 0 var(--color-accent)` + wordmark; links with `aria-current="page"`; `＋ Draw a route` primary button; 34px avatar circle `var(--color-accent-2-300)`, 12px/700, `title="Sign out"`). The Hiker/Guide seg toggle at lines 100–103 is **prototype-only — do not build it**.
  - Stat tiles: lines 166–183 (padding `14px 16px`, radius 20px, surface bg; label 11px uppercase letter-spacing .08em opacity .55; value heading-font 22px). Dashboard variant: radius 24px, padding `18px 20px`, value 30px, note 12px `var(--color-accent-2-700)`. Draw variant: radius 18px.
  - Tour card date badge + capacity bar: lines 281–293 (56px wide, radius 16px, `accent-2-200` bg, month 10px uppercase ls .08em, day heading-font 22px; bar: 6px track `neutral-300` radius 999px, fill `accent-2` / `accent` when full).
  - Sparkline maths: `spark(c)` at lines 543–549 — `x = 14 + ((lon−x0)/spanX)*72`, `y = 36 − ((lat−y0)/spanY)*28`, span guarded `|| 1`, coords `toFixed(1)`, viewBox `0 0 100 44`, `preserveAspectRatio="none"`.
  - Toast: lines 466–470 (fixed left 32px bottom 28px z-950, pill, `accent-2-800` bg, `neutral-100` text, `--shadow-lg`, 14px, 8px `accent-2-300` dot, `ts-rise .25s`; auto-dismiss 3200 ms — `flash()` at line 665).
  - Dialog: lines 455–462 (`.dialog-backdrop` z-900 in the app screens, `.dialog` with `ts-pop .2s`).
  - Tag semantics: `diffClass` line 623, `seatClass`/`seatLabel` lines 649–651.
  - Empty states: lines 201–203 (dashed box radius 20px) and 372–376 (dashed radius 24px, centered, with CTA button).
- Spec §4 extra CSS to port verbatim (keyframes `ts-rise` / `ts-pop`, `.leaflet-*` overrides, `.ts-wp` waypoint marker class).

**Decision (stated per assignment):** the §4 extras go in a **new sibling file `frontend/src/assets/app.css`**, imported in `main.ts` after `design-system.css`. This keeps `design-system.css` a byte-for-byte port of the design source.

Other decisions made here: the showcase route `/_kit` is a standalone route **outside** the app layout (it showcases `AppNav` itself, in both role variants, with prop toggles); placeholder child routes under the layout all render one shared `PlaceholderView`; `RouteSparkline` strokes with `var(--color-accent)` (identical to the design's literal `#c67139`, but token-compliant per CLAUDE.md).

## API contract

none — frontend only.

## Tasks

- [x] **T1 — Global app CSS: keyframes, Leaflet overrides, waypoint marker**
  - Files: `frontend/src/assets/app.css` (new), `frontend/src/main.ts` (edit)
  - Do: Create `app.css` containing exactly the spec §4 block: `@keyframes ts-rise` (from `opacity:0; translateY(10px)` to `opacity:1; transform:none`), `@keyframes ts-pop` (from `opacity:0; scale(.96)`), `.leaflet-tile-pane { filter: saturate(0.55) contrast(0.9) brightness(1.06) sepia(0.1); }`, `.leaflet-container { background: #ddd3bf; font-family: var(--font-body); }`, `.leaflet-control-attribution { font-size: 9px; background: rgba(245,234,216,.7) !important; }`, and `.ts-wp { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: #c67139; color: #f5ead8; font: 700 10px/1 "Figtree", sans-serif; box-shadow: 0 0 0 3px rgba(245,234,216,.85); }`. Import it in `main.ts` on the line after `./assets/design-system.css`. Do not modify `design-system.css`.
  - Done when: `npm run build` passes and the built CSS contains `ts-rise`, `ts-pop`, `.leaflet-tile-pane` and `.ts-wp`.

- [x] **T2 — Shared domain types and tag-variant helpers**
  - Files: `frontend/src/types/domain.ts` (new), `frontend/src/types/ui.ts` (new)
  - Do: In `domain.ts` export `type Difficulty = 'Easy' | 'Moderate' | 'Hard'`, `type Activity = 'Hiking' | 'Biking'`, `type Role = 'HIKER' | 'GUIDE'` (string values exactly as spec §5/§6), plus const arrays `DIFFICULTIES`, `ACTIVITIES` for iteration. In `ui.ts` export `type TagVariant = 'neutral' | 'accent' | 'accent-2' | 'outline'`; `function difficultyTagVariant(d: Difficulty): TagVariant` returning Easy→`'accent-2'`, Hard→`'accent'`, Moderate→`'neutral'`; and `function seatTagState(booked: number, capacity: number, isBookedByMe: boolean): { variant: TagVariant; label: string }` implementing spec §7: booked-by-me → `{ variant: 'accent-2', label: 'You are in' }`; else seatsLeft `=== 0` → `{ variant: 'accent', label: 'Full' }`; else seatsLeft `<= 3` → `{ variant: 'outline', label: '{n} seats left' }`; else `{ variant: 'neutral', label: '{n} seats left' }`.
  - Done when: `npm run type-check` passes; both modules export the named symbols.

- [x] **T3 — AppButton and Tag**
  - Files: `frontend/src/components/AppButton.vue` (new), `frontend/src/components/Tag.vue` (new)
  - Do: `AppButton`: renders `<button class="btn btn-{variant}">`; props `variant?: 'primary' | 'secondary' | 'ghost'` (default `'primary'`), `block?: boolean` (adds `.btn-block`), `type?: 'button' | 'submit'` (default `'button'`); disabled comes through native attrs (do not declare it as a prop; do not set `inheritAttrs: false`); default slot for the label. `Tag`: renders `<span class="tag tag-{variant}">` with prop `variant?: TagVariant` (default `'neutral'`, import from `@/types/ui`) and a default slot. No scoped CSS in either — the design-system classes do all the work.
  - Done when: `npm run type-check` passes; `<AppButton variant="secondary" block disabled>` renders `button.btn.btn-secondary.btn-block[disabled]` and `<Tag variant="accent-2">` renders `span.tag.tag-accent-2`.

- [x] **T4 — BrandMark and AvatarInitials**
  - Files: `frontend/src/components/BrandMark.vue` (new), `frontend/src/components/AvatarInitials.vue` (new)
  - Do: `BrandMark`: a circle div; prop `size?: number` (default 24). Style: `width/height: {size}px; border-radius: 999px; background: var(--color-accent-2); box-shadow: inset -{i}px -{i}px 0 var(--color-accent)` where `i = 6` for size ≤ 24 and `7` otherwise (design uses inset −6 at 24px nav, −7 at 30px auth). `AvatarInitials`: props `name: string`, `size?: number` (default 24), `bg?: 'neutral' | 'accent-2'` (default `'neutral'` → `var(--color-neutral-300)`, `'accent-2'` → `var(--color-accent-2-300)`). Compute initials as `name.split(' ').map(w => w[0]).join('').toUpperCase()` (guard empty string). Render a circle div `display: grid; place-items: center; font-weight: 700` with font-size 9px for size ≤ 24, 12px for size ≤ 34, 13px above.
  - Done when: `npm run type-check` passes; `AvatarInitials` with `name="Ivana Kovač"` shows "IK".

- [x] **T5 — StatTile, DateBadge, CapacityBar**
  - Files: `frontend/src/components/StatTile.vue` (new), `frontend/src/components/DateBadge.vue` (new), `frontend/src/components/CapacityBar.vue` (new)
  - Do: `StatTile`: props `label: string`, `value: string | number`, `note?: string`, `size?: 'sm' | 'md' | 'lg'` (default `'md'`). Tile: `background: var(--color-surface)`; sm → radius 18px / padding 14px 16px / value 22px; md → radius 20px / padding 14px 16px / value 22px; lg → radius 24px / padding 18px 20px / value 30px. Label: 11px uppercase, `letter-spacing: .08em`, opacity .55. Value: `font-family: var(--font-heading)`. Note (when given): 12px, `color: var(--color-accent-2-700)`. `DateBadge`: prop `date: string` (ISO `YYYY-MM-DD`); parse as `new Date(date + 'T00:00:00')`; render a 56px-wide block, `text-align: center; padding: 8px 0; border-radius: 16px; background: var(--color-accent-2-200)`, with month `toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()` at 10px uppercase ls .08em and day `getDate()` in heading font 22px line-height 1. `CapacityBar`: props `booked: number`, `capacity: number`; outer track `height: 6px; border-radius: 999px; background: var(--color-neutral-300); overflow: hidden`; inner fill `height: 100%; border-radius: 999px`, width `min(100, round(booked / capacity * 100))%` (guard capacity 0), background `var(--color-accent)` when `booked >= capacity` else `var(--color-accent-2)`.
  - Done when: `npm run type-check` passes; `DateBadge date="2026-08-22"` renders "AUG" / "22"; `CapacityBar :booked="12" :capacity="12"` fills 100% in accent.

- [x] **T6 — RouteSparkline**
  - Files: `frontend/src/components/RouteSparkline.vue` (new)
  - Do: Props `coords: [number, number][]` (lat, lng pairs), `strokeWidth?: number` (default 1.6). Render `<svg viewBox="0 0 100 44" preserveAspectRatio="none">` with one `<polyline fill="none" stroke-linejoin="round" stroke-linecap="round">`, stroke `var(--color-accent)`, `stroke-width` from the prop. Compute `points` exactly like the design's `spark()` (TrailShare.dc.html lines 543–549): min/max over lats and lngs, spans guarded with `|| 1`, each point mapped to `x = (14 + ((lng − minLng) / spanX) * 72).toFixed(1)`, `y = (36 − ((lat − minLat) / spanY) * 28).toFixed(1)`, joined `"x,y x,y …"`. Empty coords → empty points string. The svg fills its container (`width: 100%; height: 100%; display: block`); background is the parent's concern.
  - Done when: `npm run type-check` passes; for coords `[[0,0],[1,1]]` the points string is `14.0,36.0 86.0,8.0`.

- [x] **T7 — SegControl and RadioGroup**
  - Files: `frontend/src/components/SegControl.vue` (new), `frontend/src/components/RadioGroup.vue` (new)
  - Do: Both take `options: { label: string; value: string }[]` and `modelValue: string`, emit `update:modelValue`, and generate a unique radio `name` per instance (`useId()` or a module counter). `SegControl`: `<div class="seg">` of `<label class="seg-opt" style="white-space: nowrap">` each containing a hidden `<input type="radio">` (checked when value matches) + the label text — the checked/hover styling comes from `.seg-opt:has(input:checked)` in the design system, so no extra CSS. Support an optional `block?: boolean` prop that sets `display: flex` and lets options grow (`flex: 1; justify-content: center`) for the full-width Draw-screen difficulty seg. `RadioGroup`: a row (`display: flex; gap: 18px`) of `<label class="radio"><input type="radio"><span class="dot"></span>{label}</label>`.
  - Done when: `npm run type-check` passes; clicking an option emits `update:modelValue` with that option's value and the filled/checked style follows the model.

- [x] **T8 — FormField**
  - Files: `frontend/src/components/FormField.vue` (new)
  - Do: Props `label: string`, `hint?: string`, `error?: string`. Render `<div class="field">` with `<label>{label}</label>`, a default slot for the control (callers place their own `.input`, `SegControl`, textarea, etc.), then when `hint` is set a line at 11px `color: var(--color-accent-2-700)` (the "✓ 8+ characters, one number" style), and when `error` is set a line at 12px `color: var(--color-accent-700)`. Associate label→control via an `id` passed through the slot scope or leave association to the caller (document the choice in a comment).
  - Done when: `npm run type-check` passes; label, slotted input, hint and error all render with the specified styles.

- [x] **T9 — AppDialog**
  - Files: `frontend/src/components/AppDialog.vue` (new)
  - Do: Props `open: boolean`, `title: string`; emits `close`. When `open`, render via `<Teleport to="body">`: `<div class="dialog-backdrop" style="z-index: 900">` containing `<div class="dialog" style="animation: ts-pop .2s ease both">` with `.dialog-title` from the prop, a default slot (callers supply `.dialog-body` content and form fields), and a named slot `actions` rendered inside `<div class="dialog-actions">`. Clicking the backdrop itself (not the dialog) emits `close`; a window `keydown` listener for Escape (added while open, removed on close/unmount) emits `close`. No custom sizing — `.dialog` from the design system already handles width/radius/shadow.
  - Done when: `npm run type-check` passes; dialog appears centered over a dimmed backdrop, Esc and backdrop-click emit `close`, content and actions slots render.

- [ ] **T10 — Toast store and AppToast**
  - Files: `frontend/src/stores/toast.ts` (new), `frontend/src/components/AppToast.vue` (new), `frontend/src/App.vue` (edit)
  - Do: Pinia store `useToastStore` (setup style): state `message: string | null`; action `show(msg: string)` that sets the message, clears any pending timeout, and auto-clears after 3200 ms (design `flash()`, line 665); action `dismiss()`. `AppToast` reads the store and, when a message exists, renders the design's toast pill (line 467): `position: fixed; left: 32px; bottom: 28px; z-index: 950; display: flex; align-items: center; gap: 10px; padding: 13px 22px; border-radius: 999px; background: var(--color-accent-2-800); color: var(--color-neutral-100); box-shadow: var(--shadow-lg); animation: ts-rise .25s ease both; font-size: 14px` with a leading `8px` circle `var(--color-accent-2-300)`. Mount `<AppToast />` once in `App.vue` after `<RouterView />`.
  - Done when: `npm run type-check` passes; calling `useToastStore().show('Hello')` from any component displays the pill bottom-left and it disappears after ~3.2 s; a second `show` resets the timer.

- [x] **T11 — DataTable and EmptyState**
  - Files: `frontend/src/components/DataTable.vue` (new), `frontend/src/components/EmptyState.vue` (new)
  - Do: `DataTable`: generic over row type; props `columns: { key: string; label: string; align?: 'left' | 'right' }[]`, `rows: T[]`. Renders `<table class="table">` with a `thead` from `columns` and one `tbody` row per item; each cell renders `row[key]` by default but exposes a named scoped slot `cell-{key}` (slot props `{ row }`) so callers can put tags/buttons in cells; `align: 'right'` sets `text-align: right` on th+td. `EmptyState`: props `message: string`, `ctaLabel?: string`; emits `cta`. Dashed box: `border: 1px dashed var(--color-divider); border-radius: 24px; padding: 26px; text-align: center` with the message at 14px opacity .7 and, when `ctaLabel` is set, an `AppButton` (primary) emitting `cta` on click. (Route detail's inline variant uses radius 20px, left-aligned, no CTA — add a `compact?: boolean` prop that switches to `padding: 18px; border-radius: 20px; text-align: left; font-size: 13px`.)
  - Done when: `npm run type-check` passes; a table with a custom `cell-status` slot renders a Tag inside that column; both EmptyState variants render.

- [ ] **T12 — AppNav shell**
  - Files: `frontend/src/components/AppNav.vue` (new)
  - Do: Follow TrailShare.dc.html lines 88–107 exactly, minus the role seg toggle. Props: `role?: Role` (default `'HIKER'`, from `@/types/domain`), `userName?: string` (default `'Ivana Kovač'`); emits `sign-out`. Root: `<nav class="nav" style="padding: 14px 32px; gap: 26px; position: sticky; top: 0; z-index: 500; background: var(--color-bg)">`. Brand: `.nav-brand` flex row gap 9px with `<BrandMark :size="24" />` + text "TrailShare". Links as `<RouterLink>`: **Routes** → `/routes`, **Tours** → `/tours`, **My bookings** (hiker) / **My tours** (guide) → `/my`, and **Dashboard** → `/dashboard` only when `role === 'GUIDE'`. Bind `aria-current="page"` manually from the current route: Routes is active when `route.path` starts with `/routes` (but not `/routes/new`), Tours when it starts with `/tours`, My/Dashboard on exact match — do not rely on RouterLink's automatic exact-match attribute. Right side (`margin-left: auto`, flex gap 14px): `<AppButton>` "＋ Draw a route" navigating to `/routes/new` (`router.push`), then `<AvatarInitials :name="userName" :size="34" bg="accent-2" />` wrapped in a clickable element with `title="Sign out"` and `cursor: pointer` that emits `sign-out`.
  - Done when: `npm run type-check` passes; nav sticks on scroll; guide role shows Dashboard + "My tours", hiker shows "My bookings" without Dashboard; the link matching the current placeholder route gets the accent color via `aria-current`.

- [ ] **T13 — App layout and placeholder routing**
  - Files: `frontend/src/layouts/AppLayout.vue` (new), `frontend/src/views/PlaceholderView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: `AppLayout`: renders `<AppNav />` (pass defaults for now; auth wires real props next slice; forward `sign-out` as a no-op or console stub) then `<RouterView />` in a plain wrapper — screens own their padding per the design. `PlaceholderView`: a minimal centered page (`padding: 26px 32px`) showing the current route path in `h2` heading font and a `text-muted` line "Coming in a later slice." Router: restructure to one parent route `path: '/'`, `component: AppLayout`, with children: `''` → redirect `/routes`; `/routes`, `/tours`, `/my`, `/dashboard`, `/routes/new` all → `PlaceholderView` (named `routes`, `tours`, `my`, `dashboard`, `draw`). Delete the old `home` route and remove `HomeView.vue` if nothing references it (also delete the file).
  - Done when: `npm run build` passes; visiting `/` redirects to `/routes`; every nav link and the Draw button land on a placeholder page under the sticky nav with the correct link highlighted.

- [ ] **T14 — Component showcase at `/_kit`**
  - Files: `frontend/src/views/KitView.vue` (new), `frontend/src/router/index.ts` (edit)
  - Do: Add a top-level route `path: '/_kit'`, name `kit`, component `KitView`, **outside** `AppLayout` and not linked from `AppNav`. `KitView` renders every component in every variant, grouped under `h3` section headings, on a `var(--color-bg)` page with `padding: 26px 32px 56px`: AppButton (primary/secondary/ghost × normal/disabled, plus block); Tag (all four variants + the three difficulty tags via `difficultyTagVariant` and the four seat states via `seatTagState` — e.g. (3,12,true), (12,12,false), (10,12,false), (5,12,false)); BrandMark at 24 and 30; AvatarInitials at 22/24/34/40 in both backgrounds; StatTile sm/md/lg with and without note (use design values: "Distance / 9.9 km", "Rating / 4.9 / from 38 hikers"); DateBadge for `2026-08-22`; CapacityBar at 2/12, 9/12, 12/12; RouteSparkline at strokeWidth 1.6 inside a 148px-tall `var(--color-accent-2-200)` strip and at strokeWidth 3 in a 58×34 thumb (radius 10px) — use the Medvednica Ridge Loop coords from TrailShare.dc.html lines ~478–480; SegControl (All/Easy/Moderate/Hard, working v-model, plus a block variant); RadioGroup (Hiking/Biking); FormField with input, with hint, with error; a button opening AppDialog (title "Schedule a tour", body text, Cancel/Confirm actions wired to close); a button firing `useToastStore().show('Seat booked — see it under My bookings')`; DataTable with columns Tour/Date/Guide/Status/action and 2–3 sample rows using `cell-` slots for a status Tag and a ghost "View tour" AppButton; EmptyState in both default (with CTA "Browse tours") and compact variants; and both AppNav role variants rendered inline (non-sticky wrapper, `sign-out` wired to a toast).
  - Done when: `npm run build` passes; `/_kit` renders every listed component/variant with no console errors; interactive pieces (seg, radio, dialog, toast) work.

- [ ] **T15 — Verification pass: lint, type-check, build**
  - Files: none (fix-ups only, in files from T1–T14 as needed)
  - Do: Run `npm run lint`, `npm run type-check`, and `npm run build` in `frontend/`. Fix any errors or warnings introduced by this feature (unused imports, prop typing, oxlint/eslint findings). Do not fix pre-existing issues outside this slice's files. (The frontend has no unit-test runner in this slice; visual verification of `/_kit` against the design is the tester agent's job.)
  - Done when: all three commands exit 0.
