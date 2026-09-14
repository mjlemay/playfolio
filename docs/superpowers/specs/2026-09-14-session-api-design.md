# Playfolio Session API — Test Suite Repair and `/api/me`

**Status:** Approved design, ready for implementation plan
**Date:** 2026-09-14
**Parent design:** `~/Developer/immersive/PLAYER_IDENTITY_DESIGN.md` §4.2–4.3 (Playfolio references `player_uid`; whoami middleware)
**Depends on:** playfolio-login iteration (`playfolio-login/docs/superpowers/specs/2026-09-13-playfolio-login-design.md`) — Kratos v26.2.0 running in this repo's compose stack, minting `player_uid` at registration
**Repo:** `playfolio` only, branch `session-api`

---

## 1. Goal

Give Playfolio a notion of "the logged-in player": a request carrying a valid Kratos session can ask the API who it is and see its own data. Establish the invariant that **`players.uid` is the canonical `player_uid`** for every player, whether they arrived via a kiosk or via Kratos.

Before that can be tested, the existing test suite must run again: 94 of its 102 tests currently fail for reasons unrelated to production code.

Out of scope: protecting existing routes behind sessions, CORS for browser-side calls, admin pages, kiosk/QR/sync work, linking an existing kiosk-only player to a new login (noted in §7).

## 2. Decisions

| Decision | Choice |
|---|---|
| Identity key | `players.uid` **is** the Kratos `player_uid`. No mapping column, no migration. |
| Row creation | Lazy: the first session-authenticated API call creates the `players` row if missing. Nothing at registration time. |
| Session check | A per-request helper in route handlers, not Next.js middleware, so identity is available to the handler and the helper is unit-testable. |
| Surface | `GET /api/me`, `GET /api/me/activities`. Existing routes untouched. |
| Test suite | Repair the whole suite first (all 102 green), then add new tests in the same integration style. |

## 3. Part A — test suite repair

### 3.1 Root causes (verified 2026-09-13 against the live suite)

1. **Eager database client.** `src/lib/db.ts` calls `drizzle(process.env.DATABASE_URL!)` at import. `import 'dotenv/config'` loads `.env` (absent), not `.env.local`, so in tests the URL is `undefined` until `src/test/setup.ts`'s `beforeAll` sets it — which runs after every route module has already imported `db`. Drizzle builds a client from `undefined`; every query fails with `Cannot read properties of undefined (reading 'query')` (35 tests).
2. **Helper predates keychains.** `createTestKey(key, keychainId, clubId, overrides)` requires a keychain id, but all 30 call sites still pass `player.uid` from before the February keychain rewrite. `club_keys.keychain_id` FK fails (the `club_keys_keychain_id_keychains_uid_fk` family, and the knock-on `club_players_*` and `keychain_players_*` failures where tests continue after a failed insert).
3. **Colliding fixture ids.** `createTestClub`/`createTestPlayer` default uids to `test-club-${Date.now()}`; two fixtures in one millisecond collide (`clubs_pkey`, `players_pkey`, `already exists`).

### 3.2 Fixes

- `src/lib/db.ts`: build the Drizzle instance lazily on first property access and cache it (a small `Proxy` over a `getDb()` factory so every existing `import db from '@/lib/db'` keeps working). Read `DATABASE_URL` at that moment, not at import. Throw a clear error naming the variable if it is unset. Production behaviour is unchanged: the first request builds the client.
- `src/test/setup.ts`: set `DATABASE_URL`, `TEST_DATABASE_URL`, `PLAYFOLIO_ADMIN_KEY`, and `KRATOS_PUBLIC_URL` at **module top level** (setup files run before the test file's imports). Keep migrations (`drizzle-kit push`) in `beforeAll`. Also pin them in `vitest.config.ts` `test.env` as belt and braces.
- `src/test/test-helpers.ts`: `createTestKey(key, playerUid, clubId, overrides)` — look up the player's keychain via `keychain_players`; if none, create one (reuse `createTestKeychain`); insert the club key with that keychain id. Call sites unchanged. Default fixture uids become `test-club-${randomUUID()}` / `test-player-${randomUUID()}` / `device-${randomUUID()}`; `require('@/lib/schema')` in `createTestDevice` becomes a normal import.
- Triage the remainder after the three fixes; expected to be a small number of assertion updates reflecting the keychain model (e.g. the key detail route returning `keychain_id` where a test expects `player_uid`). Each such change is a test change only; if a failing test reveals a real production bug, stop and report rather than silently "fixing" the test.

### 3.3 Acceptance

`npm test` → 102 passed, 0 failed, against the Docker Postgres on `localhost:5433` (`playfolio_test`). `npm run lint` and `npx tsc --noEmit` clean. No production behaviour change other than the lazy db client.

## 4. Part B — session helper and `/api/me`

### 4.1 `src/lib/session.ts`

```ts
export interface SessionIdentity { player_uid: string; email: string; display_name?: string }
export type SessionResult =
  | { ok: true; identity: SessionIdentity; player: Player }   // Player from schema
  | { ok: false; status: 401 | 503; error: string };

export async function getSessionPlayer(request: Request): Promise<SessionResult>
```

Behaviour:

1. Read the request's `cookie` header. If absent or it contains no `ory_kratos_session=`, return `{ ok: false, status: 401, error: 'No session' }` without calling Kratos.
2. `GET ${KRATOS_PUBLIC_URL}/sessions/whoami` with `cookie` and `accept: application/json`, `cache: 'no-store'`. 401 → `{ ok:false, 401 }`. Fetch throw or 5xx → `{ ok:false, 503, error: 'Identity service unavailable' }` (log one line). Other non-2xx → 401.
3. Read `identity.traits.player_uid`; if missing or not matching the lowercase UUID v4 pattern, return 401 with error `'Session has no player_uid'` and log it (this would mean a Kratos identity created outside the registration webhook without a uid — an operator problem, not a player problem).
4. Ensure the player row: `select` by uid; if absent, in one transaction insert `players { uid: player_uid, meta: display_name ? { name: display_name } : null, status: 'unknown' }` and create a keychain via the existing `createKeychainForPlayer` (so the account works at kiosks like any other). A concurrent first request may race; use `insert … on conflict do nothing` and re-select, and create the keychain only when the insert actually inserted.
5. Return `{ ok: true, identity, player }`.

`KRATOS_PUBLIC_URL` defaults to `http://localhost:4433` when unset; compose sets it to `http://kratos:4433` on the `app` service.

### 4.2 `GET /api/me` — `src/app/api/me/route.ts`

- `getSessionPlayer(request)`; on `ok:false` respond `{ success: false, error }` with its status.
- Otherwise respond `200 { success: true, data: { ...player, clubMemberships, squadMemberships, identity: { email, display_name } } }`, reusing the membership queries from `players/[uid]/route.ts` (extract them into `src/lib/players.ts` as `getPlayerMemberships(uid)` and have both routes call it).

### 4.3 `GET /api/me/activities` — `src/app/api/me/activities/route.ts`

- Session as above.
- Query params: `format`, `start_date`, `end_date`, `limit` (default 100, max 500), `offset` (default 0). Filtering is done in SQL with Drizzle `and(eq(...), gte(...), lte(...))` on `activities.player_uid = player.uid`, ordered by `created_at desc`. Invalid dates → 400.
- Respond `200 { success: true, data, count: data.length, total }` where `total` is a `count(*)` with the same filters.

### 4.4 Config and docs

- `docker-compose.yml` `app` service: add `KRATOS_PUBLIC_URL: http://kratos:4433`. No `depends_on` change: the API only calls Kratos on `/api/me*`.
- `DOCKER_README.md`: a short "Session API" subsection with the two endpoints and a curl using the `ory_kratos_session` cookie.
- `docs/kiosk-login-flow.md`: one line noting that login-created players also get a keychain on first `/api/me` call.

## 5. Testing (Part B)

Integration tests in the repo's style (real test DB, `mockRequest` objects), with `fetch` stubbed via `vi.stubGlobal` to simulate Kratos:

- `src/lib/__tests__/session.test.ts`: no cookie → 401 without fetch; cookie without `ory_kratos_session` → 401 without fetch; Kratos 401 → 401; fetch throws → 503; Kratos 500 → 503; session lacking `player_uid` → 401; first call creates the player row with `meta.name` and a keychain; second call does not create a second row or keychain; existing player row is returned untouched (meta not overwritten).
- `src/app/api/me/__tests__/route.test.ts`: 401 shape; 200 shape with memberships and identity.
- `src/app/api/me/activities/__tests__/route.test.ts`: 401; only the caller's activities; `format` filter; date filters; limit/offset and `total`; bad date → 400; limit capped at 500.

Live check after the stack is up: register through `http://localhost:3778/register`, copy the `ory_kratos_session` cookie, `curl -b "ory_kratos_session=…" http://localhost:3777/api/me` shows the new player with `uid` equal to the Kratos `player_uid`; `GET /api/players/<uid>` shows the same row and a keychain exists in `keychain_players`.

## 6. Errors

| Condition | Response |
|---|---|
| No / invalid session | 401 `{ success:false, error:'No session' }` |
| Kratos unreachable or 5xx | 503 `{ success:false, error:'Identity service unavailable' }` |
| Session without `player_uid` | 401 `{ success:false, error:'Session has no player_uid' }` + server log |
| Bad query params | 400 with a message naming the parameter |
| DB failure | 500 `{ success:false, error:'Failed to …' }` as elsewhere in the API |

## 7. Not decided here

- **Linking a kiosk-only player to a new login.** Today a player who first appears at a kiosk gets a Playfolio uid, and if they later register online they get a *second* uid from Kratos. Merging them is an admin operation (create the Kratos identity via the admin API with `traits.player_uid` = the existing uid, or re-point rows). Belongs with the admin pages.
- **Whether kiosk auto-registration should stop minting uids** in favour of always going through Kratos. Not until kiosks have a Kratos API flow (parent build step 3).
- **Browser-side calls from the login app** (CORS) versus server-side proxying. Server-side is assumed; revisit when the profile page needs live data.
