# Feature: Auth & roles

**Branch:** `feature/auth-and-roles`
**Depends on:** `plans/foundation-ui-kit.md` (slice 1 — UI kit, app shell, layout, toast store, router skeleton)

## Goal

A visitor can create a TrailShare account as a Hiker or a Guide, sign in, and stay signed in for 24 hours. The app knows who they are: guides land on `/dashboard`, hikers on `/routes`, the nav shows their name and role-appropriate links, `/dashboard` is guide-only, and signing out returns to `/auth`. Later slices get a working `JwtAuthGuard`, `@CurrentUser()`, and `@Roles('GUIDE')` to protect their endpoints.

## Design reference

- `design/TrailShare.dc.html` **lines 24–86**: the auth screen — full-viewport grid `grid-template-columns: 1.05fr 1fr`, bg `var(--color-bg)`. Left column `padding: 48px 56px; flex column; gap: 28px; max-width: 560px`: 30px `BrandMark` + "TrailShare" wordmark (heading font 21px, gap 10px); H1 52px (`max-width: 9em`, `margin-bottom: 12px`) **"Draw the trail. Bring people along."** in a wrapper with `margin-top: 8px`; sub-copy 16px `max-width: 34em` opacity .8 "Sketch a route on the map, tag how hard it is, and publish. Guides schedule tours on it — hikers book a seat."; a `.seg` (align-self flex-start) with **Log in / Register**; form column gap 14 max-width 400px; submit `.btn.btn-primary.btn-block` `min-height: 42px; font-size: 15px` labelled **"Log in"** / **"Create account"**; footnote 12px opacity .6 **"Protected by JWT — session lasts 24 h."**
- Password hint (line 50): 11px, `margin-top: 5px`, `color: var(--color-accent-2-700)`, text "✓ 8+ characters, one number".
- Role picker (lines 53–66) and card style (lines 687, 695–696): label 12px opacity .7 **"Pick your role — this is fixed after registration"**, then 2-col grid gap 10px of two clickable cards (`padding: 12px 14px; border-radius: 20px; cursor: pointer; flex column; gap: 4px; border: 1.5px solid`) — selected: `var(--color-accent)` border + `background: var(--color-accent-100)`; unselected: `var(--color-divider)` border. Card content: heading-font 16px title ("Guide" / "Hiker") + 12px opacity .75 blurb ("Publish routes and schedule guided tours." / "Browse upcoming tours and book a seat.").
- Right column (lines 74–85): in the design, a full-bleed hero Leaflet map over `background: var(--color-surface)` with a floating FEATURED card. **This slice ships it as a styled placeholder panel** (see T12) because Leaflet arrives in slice 3 — the hero map + real featured-route card are an explicit slice-3 follow-up.
- Sign-in behaviour (lines 692, 697–698): CTA label per mode; on success guide → dashboard / hiker → discover with toast "Signed in as a guide" / "Signed in as a hiker"; sign-out returns to the auth screen.
- Spec §2.2 warning: the prototype's Hiker/Guide nav seg toggle is **prototype-only — do not build it**. Role comes from the authenticated user.

## API contract

All responses JSON. `user` everywhere means `{ "id": "<uuid>", "displayName": "Ivana Kovač", "email": "ivana@trailshare.hr", "role": "GUIDE" }` — **never** includes `passwordHash` or `createdAt`.

- `POST /api/auth/register`
  - Body: `{ "displayName": "Ivana Kovač", "email": "ivana@trailshare.hr", "password": "trailshare1", "role": "HIKER" | "GUIDE" }`
  - Validation: `displayName` non-empty string ≤ 80 chars (trimmed); `email` valid email; `password` **min 8 chars AND at least one digit**; `role` exactly `HIKER` or `GUIDE`. Emails are normalized to lowercase before storing/matching.
  - 201 → `{ "token": "<jwt>", "user": { ... } }`
  - 400 validation failure (class-validator messages); 409 `{ "message": "Email is already registered" }` on duplicate email.
- `POST /api/auth/login`
  - Body: `{ "email": "ivana@trailshare.hr", "password": "trailshare1" }` (both required, email `@IsEmail`, password `@IsString` + `@IsNotEmpty` — do NOT apply the digit/length rule here).
  - **200** (not Nest's default 201 — use `@HttpCode(200)`) → `{ "token": "<jwt>", "user": { ... } }`
  - 401 `{ "message": "Invalid email or password" }` for unknown email **and** for wrong password (same message — don't leak which).
- `GET /api/auth/me`
  - Header `Authorization: Bearer <token>`.
  - 200 → `{ "id", "displayName", "email", "role" }` (fresh from DB); 401 when the header is missing, malformed, expired, or the user no longer exists.

JWT: HS256 via `@nestjs/jwt`, payload `{ "sub": "<user uuid>", "email": "<email>", "role": "HIKER"|"GUIDE" }`, `expiresIn: '24h'`, secret from `JWT_SECRET` env (dev fallback `dev-only-secret`).

**Guard shapes (binding — later slices import these):**

```ts
// backend/src/auth/auth-user.ts
export interface AuthUser { id: string; displayName: string; email: string; role: UserRole }

// Usage later slices rely on:
@UseGuards(JwtAuthGuard)                       // verifies Bearer JWT, loads the user from DB,
                                               // attaches request.user: AuthUser, else 401
@UseGuards(JwtAuthGuard, RolesGuard)           // RolesGuard always runs AFTER JwtAuthGuard
@Roles('GUIDE')                                // 403 when request.user.role not in the list
someHandler(@CurrentUser() user: AuthUser) {}  // param decorator returning request.user
```

Frontend token storage: localStorage key **`trailshare.token`** (constant `TOKEN_STORAGE_KEY` exported from `src/lib/api.ts`; the api layer reads it on every request — localStorage is the single source of truth for the raw token).

## Tasks

- [x] **T1 — Backend dependencies and config**
  - Files: `backend/package.json` (edit, via npm), `backend/.env.example` (edit)
  - Do: In `backend/`, run `npm install @nestjs/jwt bcryptjs` (bcryptjs v3 — pure-JS bcrypt, ships its own types; chosen over native `bcrypt` to avoid node-gyp on Windows). Append to `.env.example` under a new comment `# Auth`: `JWT_SECRET=` with a comment line saying any long random string; the app falls back to `dev-only-secret` outside production.
  - Done when: `npm install` exits 0 and `@nestjs/jwt` + `bcryptjs` appear in `backend/package.json` dependencies; `.env.example` documents `JWT_SECRET`; `npm run build` in `backend/` still passes.

- [x] **T2 — User entity and Users module**
  - Files: `backend/src/users/user.entity.ts` (new), `backend/src/users/users.service.ts` (new), `backend/src/users/users.module.ts` (new), `backend/src/app.module.ts` (edit)
  - Do: `user.entity.ts`: export `enum UserRole { HIKER = 'HIKER', GUIDE = 'GUIDE' }` and `@Entity('users') User` with `@PrimaryGeneratedColumn('uuid') id: string`; `@Column({ length: 80 }) displayName: string`; `@Column({ unique: true }) email: string` (stored lowercase); `@Column() passwordHash: string`; `@Column({ type: 'enum', enum: UserRole }) role: UserRole` (immutable — the service exposes no update path); `@CreateDateColumn() createdAt: Date`. `users.service.ts`: `UsersService` injecting `Repository<User>` with `create(data: { displayName: string; email: string; passwordHash: string; role: UserRole }): Promise<User>` (repository create+save), `findByEmail(email: string): Promise<User | null>` (matches against lowercased input), `findById(id: string): Promise<User | null>`. `users.module.ts`: imports `TypeOrmModule.forFeature([User])`, provides and **exports** `UsersService` (and re-exports `TypeOrmModule` is not needed). Register `UsersModule` in `app.module.ts` imports.
  - Done when: `npm run build` passes in `backend/`; starting the dev server against local Postgres creates the `users` table (synchronize) with a unique index on `email`.

- [x] **T3 — Auth DTOs**
  - Files: `backend/src/auth/dto/register.dto.ts` (new), `backend/src/auth/dto/login.dto.ts` (new)
  - Do: `RegisterDto`: `displayName` — `@IsString() @IsNotEmpty() @MaxLength(80)` with `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)`; `email` — `@IsEmail()` + `@Transform` to `trim().toLowerCase()`; `password` — `@IsString() @MinLength(8, { message: 'Password must be at least 8 characters' }) @Matches(/\d/, { message: 'Password must contain at least one number' })`; `role` — `@IsEnum(UserRole)` (import from `../../users/user.entity`). `LoginDto`: `email` — `@IsEmail()` + same lowercase transform; `password` — `@IsString() @IsNotEmpty()` only (no strength rule on login). Every field decorated — the global pipe strips undecorated fields.
  - Done when: `npm run build` passes; both DTOs export classes with every field carrying at least one class-validator decorator.

- [x] **T4 — AuthService and AuthModule (JWT wiring)**
  - Files: `backend/src/auth/auth.service.ts` (new), `backend/src/auth/auth.module.ts` (new), `backend/src/app.module.ts` (edit)
  - Do: `auth.module.ts`: imports `UsersModule` and `JwtModule.registerAsync({ global: true, inject: [ConfigService], useFactory: (config) => ({ secret: config.get<string>('JWT_SECRET', 'dev-only-secret'), signOptions: { expiresIn: '24h' } }) })`; provides `AuthService`; exports `AuthService`. `auth.service.ts`: `AuthService` injecting `UsersService` and `JwtService`. Public type `AuthPayload = { token: string; user: PublicUser }` with `PublicUser = { id: string; displayName: string; email: string; role: UserRole }`. Methods: `register(dto: RegisterDto)` — `findByEmail`; if found throw `ConflictException('Email is already registered')`; `passwordHash = await bcrypt.hash(dto.password, 10)` (import `{ hash, compare }` from `'bcryptjs'`); create user; return `this.buildAuthPayload(user)`. `login(dto: LoginDto)` — `findByEmail`; if missing OR `!(await compare(dto.password, user.passwordHash))` throw `UnauthorizedException('Invalid email or password')`; return `buildAuthPayload(user)`. Private `buildAuthPayload(user)` — signs `{ sub: user.id, email: user.email, role: user.role }` with `jwtService.signAsync` and returns `{ token, user: toPublicUser(user) }`; `toPublicUser` picks exactly `id, displayName, email, role`. Register `AuthModule` in `app.module.ts`.
  - Done when: `npm run build` passes; `AuthService` exposes `register` and `login` returning `{ token, user }` with no `passwordHash` anywhere in the return type.

- [x] **T5 — JwtAuthGuard and @CurrentUser()**
  - Files: `backend/src/auth/auth-user.ts` (new), `backend/src/auth/jwt-auth.guard.ts` (new), `backend/src/auth/current-user.decorator.ts` (new), `backend/src/auth/auth.module.ts` (edit)
  - Do: `auth-user.ts`: export `interface AuthUser { id: string; displayName: string; email: string; role: UserRole }` and `interface JwtPayload { sub: string; email: string; role: UserRole }`. `jwt-auth.guard.ts`: injectable `JwtAuthGuard implements CanActivate` injecting `JwtService` and `UsersService`: read `request.headers.authorization`; require the `Bearer <token>` shape; `verifyAsync<JwtPayload>(token)` in try/catch; load the user with `usersService.findById(payload.sub)`; any failure (missing header, bad scheme, invalid/expired token, user gone) throws `UnauthorizedException`; on success set `request.user = { id, displayName, email, role }` (an `AuthUser`, fresh from DB so role/name are never stale) and return true. `current-user.decorator.ts`: `createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().user as AuthUser)` exported as `CurrentUser`. Add `JwtAuthGuard` to `AuthModule` providers and exports.
  - Done when: `npm run build` passes; the guard and decorator are exported from their files and the guard is exported by `AuthModule`.

- [x] **T6 — @Roles() decorator and RolesGuard**
  - Files: `backend/src/auth/roles.decorator.ts` (new), `backend/src/auth/roles.guard.ts` (new), `backend/src/auth/auth.module.ts` (edit)
  - Do: `roles.decorator.ts`: `export const ROLES_KEY = 'roles'` and `export const Roles = (...roles: \`${UserRole}\`[]) => SetMetadata(ROLES_KEY, roles)` — so call sites can write `@Roles('GUIDE')` with a string literal. `roles.guard.ts`: injectable `RolesGuard implements CanActivate` injecting `Reflector`: `getAllAndOverride<string[]>(ROLES_KEY, [handler, class])`; if no metadata or empty list → return true; read `request.user` (populated by `JwtAuthGuard`, which must be listed first in `@UseGuards`); if user missing or `!roles.includes(user.role)` throw `ForbiddenException`; else true. Add `RolesGuard` to `AuthModule` providers and exports. Guards stay opt-in per route (no global `APP_GUARD`) — `/api/health` and the auth endpoints remain public by default.
  - Done when: `npm run build` passes; `@Roles('GUIDE')` compiles on a handler and `RolesGuard` is exported by `AuthModule`.

- [x] **T7 — AuthController**
  - Files: `backend/src/auth/auth.controller.ts` (new), `backend/src/auth/auth.module.ts` (edit)
  - Do: `@Controller('auth')` with three thin handlers: `@Post('register') register(@Body() dto: RegisterDto)` → `authService.register(dto)` (default 201); `@Post('login') @HttpCode(200) login(@Body() dto: LoginDto)` → `authService.login(dto)`; `@Get('me') @UseGuards(JwtAuthGuard) me(@CurrentUser() user: AuthUser)` → returns `user` as-is. No logic in the controller. Register the controller in `AuthModule`.
  - Done when: `npm run build` passes; with the dev server running, `POST /api/auth/register` with a valid body returns 201 `{ token, user }` and `GET /api/auth/me` without a token returns 401.

- [x] **T8 — Unit tests: AuthService and RolesGuard**
  - Files: `backend/src/auth/auth.service.spec.ts` (new), `backend/src/auth/roles.guard.spec.ts` (new)
  - Do: `auth.service.spec.ts` — Test module with `AuthService` plus mocked `UsersService` (`jest.fn()` for `create/findByEmail/findById`) and mocked `JwtService` (`signAsync` resolving `'signed-token'`). Cases: (1) `register` hashes the password (stored `passwordHash` ≠ plaintext and `bcrypt.compare(plain, hash)` is true), returns `{ token: 'signed-token', user }` without `passwordHash`, and signs a payload containing `sub`, `email`, `role`; (2) `register` with an existing email throws `ConflictException`; (3) `login` with correct credentials returns token + public user; (4) `login` with wrong password throws `UnauthorizedException`; (5) `login` with unknown email throws `UnauthorizedException`. `roles.guard.spec.ts` — instantiate `RolesGuard` with a mocked `Reflector` and a stub `ExecutionContext` carrying `request.user`: (1) no roles metadata → allows; (2) `['GUIDE']` + user role GUIDE → allows; (3) `['GUIDE']` + user role HIKER → throws `ForbiddenException`; (4) `['GUIDE']` + no `request.user` → throws `ForbiddenException`.
  - Done when: `npm test` in `backend/` passes with all new cases green.

- [x] **T9 — E2e spec: register → login → me + rejections**
  - Files: `backend/test/auth.e2e-spec.ts` (new)
  - Do: **Reuse the existing harness** — `createE2eContext()` / `destroyE2eContext()` from `backend/test/postgres-testcontainer.ts` in `beforeAll`/`afterAll`; do not start a second container. With Supertest against `ctx.app.getHttpServer()`: (1) `POST /api/auth/register` `{ displayName: 'Ivana Kovač', email: 'ivana@trailshare.hr', password: 'trailshare1', role: 'GUIDE' }` → 201 with a non-empty `token` and `user` matching `{ displayName, email, role }`, `user.id` a string, and **no `passwordHash` key** in `user`; (2) registering the same email again (any casing, e.g. `IVANA@trailshare.hr`) → 409; (3) password `short1` → 400; (4) password `longpassword` (no digit) → 400; (5) `role: 'ADMIN'` → 400; (6) an extra unknown body field (e.g. `isAdmin: true`) → 400 (forbidNonWhitelisted); (7) `POST /api/auth/login` with correct credentials → 200 `{ token, user }`; (8) wrong password → 401; (9) unknown email → 401; (10) `GET /api/auth/me` with `Authorization: Bearer <token from login>` → 200 exactly `{ id, displayName, email, role }`; (11) `me` with no header → 401; (12) `me` with `Bearer garbage` → 401.
  - Done when: `npm run test:e2e` in `backend/` passes (Docker running) with the new spec green alongside the existing health spec.

- [x] **T10 — Frontend auth types + Authorization header in the api client**
  - Files: `frontend/src/types/domain.ts` (edit), `frontend/src/lib/api.ts` (edit)
  - Do: In `domain.ts` add `export interface AuthUser { id: string; displayName: string; email: string; role: Role }` and `export interface AuthResponse { token: string; user: AuthUser }`. In `api.ts` add `export const TOKEN_STORAGE_KEY = 'trailshare.token'` and, inside `request()`, build headers so that when `localStorage.getItem(TOKEN_STORAGE_KEY)` is non-null an `Authorization: Bearer ${token}` header is sent on **every** request (merged with the existing conditional `Content-Type`). localStorage is read per-request — no module-level token cache, no import of the Pinia store (keeps `api.ts` dependency-free).
  - Done when: `npm run type-check` passes; with a token in localStorage, any `api.*` call sends the `Authorization` header (verifiable in devtools), and without one no `Authorization` header is sent.

- [x] **T11 — useAuthStore**
  - Files: `frontend/src/stores/auth.ts` (new)
  - Do: Pinia setup store `useAuthStore`: state `user = ref<AuthUser | null>(null)` and `token = ref<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY))`; getters `isAuthenticated = computed(() => user.value !== null)` and `isGuide = computed(() => user.value?.role === 'GUIDE')`. Actions: `login(email, password)` → `api.post<AuthResponse>('/auth/login', { email, password })`, then `applyAuth(res)`; `register(payload: { displayName; email; password; role: Role })` → `api.post<AuthResponse>('/auth/register', payload)`, then `applyAuth(res)`; private `applyAuth` sets `token`/`user` and writes the token to `localStorage[TOKEN_STORAGE_KEY]`; `logout()` clears both refs and removes the localStorage key; `restore()` — session restore on app start: cache and return a single promise (module- or store-level `let restorePromise`) so concurrent/repeat navigations await the same one; inside: if no token → resolve; else `api.get<AuthUser>('/auth/me')` → set `user`; on `ApiError` (expired/invalid token) call `logout()` and resolve (never throw). Errors from `login`/`register` propagate to the caller (the view shows them).
  - Done when: `npm run type-check` passes; the store exports `user`, `token`, `isAuthenticated`, `isGuide`, `login`, `register`, `logout`, `restore`.

- [x] **T12 — AuthView (spec §2.1)**
  - Files: `frontend/src/views/AuthView.vue` (new)
  - Do: Build the auth screen exactly per the Design reference section above, composing slice-1 components: root grid `min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; background: var(--color-bg); color: var(--color-text)`. **Left column** in order: `<BrandMark :size="30" />` + wordmark row; H1 + sub-copy (exact strings from Design reference); `<SegControl>` with options Log in / Register bound to a `mode` ref (`'login' | 'register'`); form (`<form @submit.prevent>`, column gap 14, max-width 400px) using `<FormField>`: register-only "Display name" (`.input`, placeholder "Ivana Kovač"), "Email" (placeholder "ivana@trailshare.hr"), "Password" (`type="password"`, FormField `hint="✓ 8+ characters, one number"`); register-only role picker: 12px opacity-.7 label "Pick your role — this is fixed after registration" + two-card grid per the Design reference styles, bound to a `role` ref defaulting `'HIKER'`, cards toggling selected border/background; when submit fails, an inline error banner (12px, `color: var(--color-accent-700)`, `background: var(--color-accent-100)`, `border-radius: 16px`, padding ~10px 14px — the draw-screen banner style, reused here since the design shows no auth error state) showing the `ApiError` message; `<AppButton type="submit" block>` labelled "Log in" / "Create account" with `min-height: 42px; font-size: 15px`, disabled while a request is in flight; footnote "Protected by JWT — session lasts 24 h." **Right column** (placeholder — hero Leaflet map + FEATURED card arrive in slice 3): `position: relative; overflow: hidden; background: var(--color-surface)`, containing a full-bleed decorative `<RouteSparkline>` (absolute inset 0, opacity ~.45, `strokeWidth` 1.6) fed the Medvednica Ridge Loop coords copied from `design/TrailShare.dc.html` lines 478–480. No floating card yet. **Submit handler**: call `auth.login(...)` or `auth.register(...)` per mode; on success `useToastStore().show(auth.isGuide ? 'Signed in as a guide' : 'Signed in as a hiker')` then `router.push(auth.isGuide ? '/dashboard' : '/routes')`; on `ApiError` set the banner message (401 → "Invalid email or password" comes from the API; validation 400s show the first message).
  - Done when: `npm run type-check` passes; `/auth` renders both modes with the exact copy above, the role cards toggle selection styling, and (with the backend running) registering a guide lands on `/dashboard` with the guide toast while a hiker login lands on `/routes` with the hiker toast.

- [x] **T13 — Router: /auth route and navigation guards**
  - Files: `frontend/src/router/index.ts` (edit)
  - Do: Add a top-level route `{ path: '/auth', name: 'auth', component: AuthView }` **outside** `AppLayout` (like `/_kit`). Mark the dashboard child route with `meta: { guideOnly: true }`. Add one `router.beforeEach(async (to) => { ... })`: (1) `to.name === 'kit'` → allow (the showcase stays public — dev-only page); (2) `const auth = useAuthStore(); await auth.restore()` (safe: cached promise, cheap after first call); (3) not authenticated and `to.name !== 'auth'` → return `{ name: 'auth' }`; (4) authenticated and `to.name === 'auth'` → return `auth.isGuide ? '/dashboard' : '/routes'` (also covers the post-sign-in landing on refresh); (5) `to.meta.guideOnly && !auth.isGuide` → return `'/routes'`; else allow. No redirect-query preservation — post-login destination is role-based per the spec.
  - Done when: `npm run type-check` and `npm run build` pass; logged out, every app path redirects to `/auth`; logged in, visiting `/auth` bounces to the role home; a hiker visiting `/dashboard` lands on `/routes`; a page refresh while logged in stays on the current page (session restored from the stored token).

- [x] **T14 — Wire AppNav to the real user; sign-out flow**
  - Files: `frontend/src/layouts/AppLayout.vue` (edit)
  - Do: In `AppLayout`, read `useAuthStore()` and pass the real values to the existing `AppNav` props: `:role="auth.user?.role ?? 'HIKER'"` and `:userName="auth.user?.displayName ?? ''"` (the layout only renders authenticated thanks to T13, so the fallbacks are dead defensive code). Replace the stub `sign-out` handler: `auth.logout()` then `router.push('/auth')`. Do not modify `AppNav.vue` itself — it already renders "My bookings" for hikers vs "My tours" + "Dashboard" for guides from the `role` prop, and the avatar emits `sign-out` (the prototype's role seg toggle stays unbuilt).
  - Done when: `npm run type-check` passes; after logging in as a guide the nav shows the guide's initials, "My tours" and "Dashboard"; as a hiker it shows "My bookings" and no Dashboard; clicking the avatar signs out and lands on `/auth`, and app paths redirect to `/auth` again.

- [x] **T15 — Verification pass**
  - Files: none (fix-ups only in files from T1–T14)
  - Do: Run `npm run lint`, `npm test`, and `npm run test:e2e` in `backend/` (Docker running), and `npm run type-check` plus `npm run build` in `frontend/`. Fix any failures introduced by this slice; leave pre-existing issues outside this slice's files alone.
  - Done when: all five commands exit 0.
