# Playfolio Session API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Playfolio's test suite green again, then add a Kratos-session-aware `GET /api/me` and `GET /api/me/activities` that lazily create the caller's `players` row with `uid` equal to the Kratos `player_uid`.

**Architecture:** Part A fixes test plumbing only: a lazily built Drizzle client, environment set before imports, and test helpers that match the keychain data model. Part B adds `getSessionPlayer(request)` in `src/lib/session.ts`, which forwards the request cookie to Kratos whoami, validates `player_uid`, and upserts the player row plus keychain on first sight; two thin route handlers call it. Existing routes are untouched except for extracting the membership query into a shared helper.

**Tech Stack:** Next.js 15 route handlers, Drizzle ORM 0.44 on node-postgres, Postgres 16 (Docker, `localhost:5433`), vitest 4 integration tests against `playfolio_test`, Ory Kratos v26.2.0 whoami over the compose network.

**Spec:** `docs/superpowers/specs/2026-09-14-session-api-design.md`

**Repo / branch:** `/Users/mertie/Developer/immersive/playfolio`, branch `session-api`. Commit steps are included; the owner has approved plan-driven commits on this branch. Nothing is pushed.

**Prerequisites:** Docker Desktop running with the compose stack up (`docker compose ps` shows `playfolio-db` healthy). Tests hit `postgresql://appuser:apppassword@localhost:5433/playfolio_test`. Run `npm test` before Task 1 and record the baseline (expected: 94 failed / 8 passed of 102).

---

## Reference: facts about the codebase the tasks rely on

- `src/lib/db.ts` currently: `import 'dotenv/config'; const db = drizzle(process.env.DATABASE_URL!, { schema }); export default db;`. `dotenv/config` loads `.env` only (absent); `.env.local` is Next-only.
- `src/test/setup.ts` sets env inside `beforeAll` (too late: route modules import `db` first) and runs `npx drizzle-kit push` against the test DB.
- `src/test/test-helpers.ts` exports `cleanDatabase, seedTestData, createTestClub, createTestPlayer, createClubMembership, createTestKeychain, createTestKey, createTestDevice`. `createTestKey(key, keychainId, clubId, overrides)` is called 30 times as `createTestKey(key, player.uid, club.uid, …)`.
- Schema (`src/lib/schema.ts`): `players(uid pk, meta json, status, created_at, updated_at)`, `keychains(uid, auth_code unique)`, `keychain_players(keychain_id, player_uid unique)`, `club_keys(key pk, keychain_id fk, originating_club_id fk, status, …)`, `activities(uid, player_uid, club_id, device_id, meta json notnull, format, created_at)`, `club_players`, `squad_players`, `clubs`, `squads`.
- `src/lib/keychain.ts` exports `createKeychainForPlayer(playerUid)` → `{ uid, auth_code }` (inserts keychain + keychain_players in a transaction).
- `src/app/api/players/[uid]/route.ts` GET builds `clubMemberships` and `squadMemberships` with two inner-join selects; that code moves to `src/lib/players.ts` in Task 4.
- Test style: `import { describe, it, expect } from 'vitest'`; handlers are called directly with `{ json: async () => body } as any` or real `Request`s; `afterEach` in setup cleans all tables.
- vitest config: `environment: 'node'`, `globals: true`, single thread, `testTimeout: 10000`.

---

## File structure

| Path | Change | Responsibility |
|---|---|---|
| `src/lib/db.ts` | modify | Lazy, cached Drizzle client; default export keeps working |
| `src/test/setup.ts` | modify | Env at top level; migrations in `beforeAll` |
| `vitest.config.ts` | modify | `test.env` pins the same variables |
| `src/test/test-helpers.ts` | modify | Keychain-aware `createTestKey`; random fixture ids; no `require` |
| various `__tests__/*.ts` | modify (triage) | Assertion updates only where the keychain model changed |
| `src/lib/players.ts` | create | `getPlayerMemberships(uid)` shared by `/api/players/[uid]` and `/api/me` |
| `src/app/api/players/[uid]/route.ts` | modify | Use `getPlayerMemberships` |
| `src/lib/session.ts` | create | `getSessionPlayer(request)` |
| `src/lib/__tests__/session.test.ts` | create | Session helper tests |
| `src/app/api/me/route.ts` | create | `GET /api/me` |
| `src/app/api/me/__tests__/route.test.ts` | create | |
| `src/app/api/me/activities/route.ts` | create | `GET /api/me/activities` |
| `src/app/api/me/activities/__tests__/route.test.ts` | create | |
| `docker-compose.yml` | modify | `KRATOS_PUBLIC_URL` on `app` |
| `DOCKER_README.md`, `docs/kiosk-login-flow.md` | modify | Session API docs |

---

### Task 1: Lazy database client and early test environment

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/test/setup.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Record the baseline**

Run: `npm test 2>&1 | tail -6`
Expected: `Tests  94 failed | 8 passed (102)` (numbers may differ slightly; note them in the report).

- [ ] **Step 2: Replace `src/lib/db.ts` with a lazy client**

```ts
import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let instance: Db | null = null;

/**
 * Build the Drizzle client on first use rather than at import time, so that
 * DATABASE_URL can be set by test setup (or by the runtime) after this module loads.
 */
export function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set; cannot connect to Postgres');
    }
    instance = drizzle(url, { schema });
  }
  return instance;
}

/**
 * Default export kept for the many `import db from '@/lib/db'` call sites.
 * Every property access resolves against the lazily built client.
 */
const db: Db = new Proxy({} as Db, {
  get(_target, prop, _receiver) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export default db;
```

- [ ] **Step 3: Set env at module top level in `src/test/setup.ts`**

Replace the file with:

```ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { closeTestDb, getTestDatabaseUrl } from './test-db';
import { cleanDatabase } from './test-helpers';
import { execSync } from 'child_process';

// Setup files run before each test file's imports, so environment must be set
// here at module top level — not inside beforeAll — for modules that read it at import.
const testDbUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = testDbUrl;
process.env.TEST_DATABASE_URL = testDbUrl;
process.env.PLAYFOLIO_ADMIN_KEY = 'test-admin-key';
process.env.KRATOS_PUBLIC_URL = 'http://kratos.test:4433';

beforeAll(async () => {
  console.log('Running migrations on test database...');
  try {
    execSync('npx drizzle-kit push', {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'inherit',
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
});

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});
```

- [ ] **Step 4: Pin the same variables in `vitest.config.ts`**

Add inside `test: { … }`:

```ts
    env: {
      DATABASE_URL: 'postgresql://appuser:apppassword@localhost:5433/playfolio_test',
      TEST_DATABASE_URL: 'postgresql://appuser:apppassword@localhost:5433/playfolio_test',
      PLAYFOLIO_ADMIN_KEY: 'test-admin-key',
      KRATOS_PUBLIC_URL: 'http://kratos.test:4433',
    },
```

- [ ] **Step 5: Run the suite; the `reading 'query'` failures must be gone**

Run: `npm test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -c "reading 'query'"`
Expected: `0`.
Run: `npm test 2>&1 | tail -6` and record the new failed/passed counts (FK and duplicate-key failures remain until Task 2).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/test/setup.ts vitest.config.ts
git commit -m "Build the Drizzle client lazily; set test env before imports"
```

End every commit message in this plan with a blank line and:
```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019vayis8rJSmFD9YYxN99qC
```

---

### Task 2: Keychain-aware test helpers and unique fixture ids

**Files:**
- Modify: `src/test/test-helpers.ts`

- [ ] **Step 1: Replace `createTestKey`, fix ids, remove `require`**

Edit `src/test/test-helpers.ts`:

Add to the top imports: `import { devices } from '@/lib/schema';` (merge into the existing schema import list) and `import { eq } from 'drizzle-orm';`.

Change the three default ids:
```ts
const uid = overrides.uid || `test-club-${randomUUID()}`;      // createTestClub
const uid = overrides.uid || `test-player-${randomUUID()}`;    // createTestPlayer
const uid = overrides.uid || `device-${randomUUID()}`;         // createTestDevice
```

Replace `createTestKey` with:

```ts
/**
 * Create a club key for a player. Finds the player's keychain (creating one if the
 * player has none) and issues the key against it — the same shape the API produces.
 */
export async function createTestKey(
  key: string,
  playerUid: string,
  clubId: string,
  overrides: Partial<typeof clubKeys.$inferInsert> = {}
) {
  const db = getTestDb();

  const existing = await db
    .select({ keychain_id: keychainPlayers.keychain_id })
    .from(keychainPlayers)
    .where(eq(keychainPlayers.player_uid, playerUid))
    .limit(1);

  const keychainId = existing[0]?.keychain_id ?? (await createTestKeychain(playerUid)).uid;

  const [createdKey] = await db.insert(clubKeys).values({
    key,
    keychain_id: keychainId,
    originating_club_id: clubId,
    status: overrides.status || 'active',
    meta: overrides.meta || null,
    expires_at: overrides.expires_at || null,
  }).returning();

  return createdKey;
}
```

In `createTestDevice`, replace `require('@/lib/schema').devices` with `devices`.

- [ ] **Step 2: Run the suite and record the remainder**

Run: `npm test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "^ (FAIL|×)|Tests " | head -60`
Expected: the FK (`club_keys_keychain_id_keychains_uid_fk`, `keychain_players_*`) and `already exists` failures are gone. Record every remaining failing test name for Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/test/test-helpers.ts
git commit -m "Test helpers: issue keys via the player's keychain; random fixture ids"
```

---

### Task 3: Triage the remaining failures to green

**Files:**
- Modify: only files under `src/**/__tests__/` and `src/test/` — production files may NOT change in this task. If a failure can only be fixed by changing production code, STOP and report it (status DONE_WITH_CONCERNS or BLOCKED) with the failing assertion and the production line it implicates.

- [ ] **Step 1: List failures by file**

Run: `npm test 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "^ FAIL " | sort | uniq`

- [ ] **Step 2: For each failing test, classify and fix**

Classification rules (apply in order):

1. **Stale expectation from the keychain rewrite** — e.g. a key detail response now carries `keychain_id`/`keychain` where the test expects `player_uid`; `resolvePlayersFromKey` now returns `player_uids: string[]` and `keychain`, not `player_uid`. Update the assertion to the current, documented response shape (see `docs/kiosk-login-flow.md` §4 and the route's own JSDoc). Read the route before changing the test.
2. **Fixture ordering** — a test creates a key before the club or player exists, or reuses a uid across tests. Fix the fixture.
3. **Timing** — `Date.now()`-derived ids inside a test file itself. Replace with `randomUUID()`.
4. **Anything else** — do not guess. Record the test name, the assertion, the actual value, and the production line involved; leave it failing and report.

Work one test file at a time: fix, run that file (`npx vitest run <file>`), then run the whole suite.

- [ ] **Step 3: Full suite green**

Run: `npm test 2>&1 | tail -6`
Expected: `Tests  102 passed (102)` (or the exact count of tests present; 0 failed). If any remain under rule 4, report them explicitly with evidence.

- [ ] **Step 4: Lint and typecheck**

Run: `npx tsc --noEmit && npm run lint` → both exit 0.

- [ ] **Step 5: Commit per file group**

One commit per test file (or small group with the same cause), each message naming the cause, e.g.:
```bash
git add "src/app/api/clubs/[uid]/keys/[key]/__tests__/route.test.ts"
git commit -m "Key detail tests: expect keychain fields per the keychain model"
```

---

### Task 4: Extract `getPlayerMemberships`

**Files:**
- Create: `src/lib/players.ts`
- Modify: `src/app/api/players/[uid]/route.ts`

- [ ] **Step 1: Create `src/lib/players.ts`**

```ts
import { eq } from 'drizzle-orm';
import db from './db';
import { clubPlayers, squadPlayers, clubs, squads } from './schema';

/** Club and squad memberships for a player, in the shape /api/players/[uid] returns. */
export async function getPlayerMemberships(uid: string) {
  const clubMemberships = await db
    .select({
      club: clubs,
      role: clubPlayers.role,
      joined_date: clubPlayers.joined_date,
      status: clubPlayers.status,
    })
    .from(clubPlayers)
    .innerJoin(clubs, eq(clubs.uid, clubPlayers.club_id))
    .where(eq(clubPlayers.player_uid, uid));

  const squadMemberships = await db
    .select({
      squad: squads,
      position: squadPlayers.position,
      jersey_number: squadPlayers.jersey_number,
      joined_date: squadPlayers.joined_date,
      status: squadPlayers.status,
    })
    .from(squadPlayers)
    .innerJoin(squads, eq(squads.uid, squadPlayers.squad_id))
    .where(eq(squadPlayers.player_uid, uid));

  return { clubMemberships, squadMemberships };
}
```

- [ ] **Step 2: Use it in `src/app/api/players/[uid]/route.ts`**

In `GET`, replace the two membership queries with:

```ts
    const { clubMemberships, squadMemberships } = await getPlayerMemberships(uid);
```
and the response body's `clubMemberships: clubMemberships, squadMemberships: squadMemberships` stays. Add `import { getPlayerMemberships } from '@/lib/players';` and drop now-unused imports (`clubPlayers`, `squadPlayers`, `clubs`, `squads` remain needed by `DELETE`; keep whichever are still referenced — run tsc/lint to confirm).

- [ ] **Step 3: Verify**

Run: `npx vitest run src/app/api/players && npx tsc --noEmit && npm run lint`
Expected: players tests pass; both checks clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/players.ts "src/app/api/players/[uid]/route.ts"
git commit -m "Extract getPlayerMemberships for reuse by /api/me"
```

---

### Task 5: `getSessionPlayer`

**Files:**
- Create: `src/lib/session.ts`
- Test: `src/lib/__tests__/session.test.ts`

- [ ] **Step 1: Failing tests — create `src/lib/__tests__/session.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getSessionPlayer } from '../session';
import { getTestDb } from '@/test/test-db';
import { createTestPlayer } from '@/test/test-helpers';
import { players, keychainPlayers } from '@/lib/schema';

const UID = '552bc612-46fd-412c-9f8d-0c3f6262c961';
const SESSION_COOKIE = 'csrf_token_abc=x; ory_kratos_session=MTY5';

const fetchMock = vi.fn();

function whoamiResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function session(traits: Record<string, unknown>) {
  return { id: 's1', active: true, identity: { id: 'i1', schema_id: 'player', traits } };
}

function req(cookie?: string) {
  return new Request('http://localhost:3777/api/me', { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSessionPlayer', () => {
  it('returns 401 without calling Kratos when there is no cookie', async () => {
    const result = await getSessionPlayer(req());
    expect(result).toEqual({ ok: false, status: 401, error: 'No session' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 401 without calling Kratos when there is no ory_kratos_session cookie', async () => {
    const result = await getSessionPlayer(req('csrf_token_abc=x; other=1'));
    expect(result).toEqual({ ok: false, status: 401, error: 'No session' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the cookie to whoami and returns 401 when Kratos says no session', async () => {
    fetchMock.mockResolvedValue(whoamiResponse(401, { error: { id: 'session_inactive' } }));
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://kratos.test:4433/sessions/whoami',
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: SESSION_COOKIE, accept: 'application/json' }),
        cache: 'no-store',
      }),
    );
  });

  it('returns 503 when Kratos is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toEqual({ ok: false, status: 503, error: 'Identity service unavailable' });
  });

  it('returns 503 when Kratos answers 5xx', async () => {
    fetchMock.mockResolvedValue(whoamiResponse(502, {}));
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('returns 401 and logs when the session has no valid player_uid', async () => {
    fetchMock.mockResolvedValue(whoamiResponse(200, session({ email: 'a@b.c', player_uid: 'nope' })));
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toEqual({ ok: false, status: 401, error: 'Session has no player_uid' });
    expect(console.error).toHaveBeenCalled();
  });

  it('creates the player row and a keychain on first sight', async () => {
    fetchMock.mockResolvedValue(
      whoamiResponse(200, session({ email: 'ace@example.com', player_uid: UID, display_name: 'Ace' })),
    );
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toMatchObject({
      ok: true,
      identity: { player_uid: UID, email: 'ace@example.com', display_name: 'Ace' },
      player: { uid: UID, meta: { name: 'Ace' }, status: 'unknown' },
    });
    const db = getTestDb();
    const rows = await db.select().from(players).where(eq(players.uid, UID));
    expect(rows).toHaveLength(1);
    const kc = await db.select().from(keychainPlayers).where(eq(keychainPlayers.player_uid, UID));
    expect(kc).toHaveLength(1);
  });

  it('creates the row with null meta when there is no display_name', async () => {
    fetchMock.mockResolvedValue(whoamiResponse(200, session({ email: 'a@b.c', player_uid: UID })));
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toMatchObject({ ok: true, player: { uid: UID, meta: null } });
  });

  it('is idempotent: a second call creates nothing new', async () => {
    fetchMock.mockResolvedValue(
      whoamiResponse(200, session({ email: 'a@b.c', player_uid: UID, display_name: 'Ace' })),
    );
    await getSessionPlayer(req(SESSION_COOKIE));
    await getSessionPlayer(req(SESSION_COOKIE));
    const db = getTestDb();
    expect(await db.select().from(players).where(eq(players.uid, UID))).toHaveLength(1);
    expect(await db.select().from(keychainPlayers).where(eq(keychainPlayers.player_uid, UID))).toHaveLength(1);
  });

  it('returns an existing player row untouched', async () => {
    await createTestPlayer({ uid: UID, meta: { name: 'Kiosk Name' }, status: 'present' });
    fetchMock.mockResolvedValue(
      whoamiResponse(200, session({ email: 'a@b.c', player_uid: UID, display_name: 'Web Name' })),
    );
    const result = await getSessionPlayer(req(SESSION_COOKIE));
    expect(result).toMatchObject({ ok: true, player: { uid: UID, meta: { name: 'Kiosk Name' }, status: 'present' } });
    const db = getTestDb();
    expect(await db.select().from(keychainPlayers).where(eq(keychainPlayers.player_uid, UID))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: FAIL — cannot find module `../session`.

- [ ] **Step 3: Implement `src/lib/session.ts`**

```ts
import { eq } from 'drizzle-orm';
import db from './db';
import { players, type Player } from './schema';
import { createKeychainForPlayer } from './keychain';

export interface SessionIdentity {
  player_uid: string;
  email: string;
  display_name?: string;
}

export type SessionResult =
  | { ok: true; identity: SessionIdentity; player: Player }
  | { ok: false; status: 401 | 503; error: string };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HAS_SESSION_COOKIE = /(^|;\s*)ory_kratos_session=/;

function kratosPublicUrl(): string {
  return (process.env.KRATOS_PUBLIC_URL ?? 'http://localhost:4433').replace(/\/+$/, '');
}

const NO_SESSION: SessionResult = { ok: false, status: 401, error: 'No session' };
const UNAVAILABLE: SessionResult = { ok: false, status: 503, error: 'Identity service unavailable' };

interface WhoamiBody {
  identity?: { traits?: { email?: unknown; player_uid?: unknown; display_name?: unknown } };
}

/**
 * Resolve the Kratos session behind a request to a Playfolio player.
 * players.uid IS the Kratos player_uid; the row is created on first sight.
 */
export async function getSessionPlayer(request: Request): Promise<SessionResult> {
  const cookie = request.headers.get('cookie') ?? '';
  if (!HAS_SESSION_COOKIE.test(cookie)) return NO_SESSION;

  let res: Response;
  try {
    res = await fetch(`${kratosPublicUrl()}/sessions/whoami`, {
      headers: { cookie, accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[session] kratos unreachable:', String(e));
    return UNAVAILABLE;
  }
  if (res.status >= 500) {
    console.error(`[session] kratos whoami responded ${res.status}`);
    return UNAVAILABLE;
  }
  if (!res.ok) return NO_SESSION;

  const body = (await res.json().catch(() => null)) as WhoamiBody | null;
  const traits = body?.identity?.traits ?? {};
  const player_uid = typeof traits.player_uid === 'string' ? traits.player_uid : '';
  if (!UUID_V4.test(player_uid)) {
    console.error('[session] session identity has no valid player_uid trait');
    return { ok: false, status: 401, error: 'Session has no player_uid' };
  }

  const identity: SessionIdentity = {
    player_uid,
    email: typeof traits.email === 'string' ? traits.email : '',
    ...(typeof traits.display_name === 'string' && traits.display_name
      ? { display_name: traits.display_name }
      : {}),
  };

  const player = await ensurePlayer(identity);
  return { ok: true, identity, player };
}

/** Find the player row for this identity, creating it (and its keychain) if absent. */
async function ensurePlayer(identity: SessionIdentity): Promise<Player> {
  const existing = await db.select().from(players).where(eq(players.uid, identity.player_uid)).limit(1);
  if (existing.length > 0) return existing[0];

  const inserted = await db
    .insert(players)
    .values({
      uid: identity.player_uid,
      meta: identity.display_name ? { name: identity.display_name } : null,
      status: 'unknown',
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    // We won the race: give the new account a keychain, like every other player.
    await createKeychainForPlayer(identity.player_uid);
    return inserted[0];
  }

  // Someone else inserted concurrently; read theirs.
  const [row] = await db.select().from(players).where(eq(players.uid, identity.player_uid)).limit(1);
  return row;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/session.test.ts`
Expected: 10 passed.

- [ ] **Step 5: Full checks and commit**

Run: `npm test && npx tsc --noEmit && npm run lint` → all green (112 tests).
```bash
git add src/lib/session.ts src/lib/__tests__/session.test.ts
git commit -m "Add getSessionPlayer: Kratos whoami to Playfolio player, created on first sight"
```

---

### Task 6: `GET /api/me`

**Files:**
- Create: `src/app/api/me/route.ts`
- Test: `src/app/api/me/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests — create `src/app/api/me/__tests__/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { createTestClub, createClubMembership } from '@/test/test-helpers';

const UID = '552bc612-46fd-412c-9f8d-0c3f6262c961';
const COOKIE = 'ory_kratos_session=MTY5';
const fetchMock = vi.fn();

function whoami(status: number, traits?: Record<string, unknown>) {
  const body = status === 200 ? { id: 's', active: true, identity: { id: 'i', schema_id: 'player', traits } } : { error: {} };
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function req(cookie?: string) {
  return new Request('http://localhost:3777/api/me', { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/me', () => {
  it('returns 401 without a session', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: 'No session' });
  });

  it('returns 503 when Kratos is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await GET(req(COOKIE));
    expect(res.status).toBe(503);
  });

  it('returns the player with memberships and identity', async () => {
    fetchMock.mockResolvedValue(whoami(200, { email: 'ace@example.com', player_uid: UID, display_name: 'Ace' }));
    // First call creates the player row; then add a membership and call again.
    await GET(req(COOKIE));
    const club = await createTestClub({ displayName: 'Arcade' });
    await createClubMembership(club.uid, UID);

    const res = await GET(req(COOKIE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.uid).toBe(UID);
    expect(body.data.meta).toEqual({ name: 'Ace' });
    expect(body.data.identity).toEqual({ email: 'ace@example.com', display_name: 'Ace' });
    expect(body.data.clubMemberships).toHaveLength(1);
    expect(body.data.clubMemberships[0].club.uid).toBe(club.uid);
    expect(body.data.squadMemberships).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/app/api/me/__tests__/route.test.ts` → cannot find module `../route`.

- [ ] **Step 3: Implement `src/app/api/me/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionPlayer } from '@/lib/session';
import { getPlayerMemberships } from '@/lib/players';

// GET /api/me - The player behind the Kratos session cookie, with memberships.
export async function GET(request: NextRequest | Request) {
  const session = await getSessionPlayer(request);
  if (!session.ok) {
    return NextResponse.json({ success: false, error: session.error }, { status: session.status });
  }

  try {
    const memberships = await getPlayerMemberships(session.player.uid);
    return NextResponse.json({
      success: true,
      data: {
        ...session.player,
        ...memberships,
        identity: {
          email: session.identity.email,
          ...(session.identity.display_name ? { display_name: session.identity.display_name } : {}),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching current player:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch player' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run to verify pass** — 3 passed. Then `npm test && npx tsc --noEmit && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/route.ts src/app/api/me/__tests__/route.test.ts
git commit -m "Add GET /api/me"
```

---

### Task 7: `GET /api/me/activities`

**Files:**
- Create: `src/app/api/me/activities/route.ts`
- Test: `src/app/api/me/activities/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests — create `src/app/api/me/activities/__tests__/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { getTestDb } from '@/test/test-db';
import { createTestClub, createTestPlayer } from '@/test/test-helpers';
import { activities } from '@/lib/schema';

const UID = '552bc612-46fd-412c-9f8d-0c3f6262c961';
const COOKIE = 'ory_kratos_session=MTY5';
const fetchMock = vi.fn();

function whoamiOk() {
  return new Response(
    JSON.stringify({ id: 's', active: true, identity: { id: 'i', schema_id: 'player', traits: { email: 'a@b.c', player_uid: UID } } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function req(query = '', cookie: string | undefined = COOKIE) {
  return new Request(`http://localhost:3777/api/me/activities${query}`, { headers: cookie ? { cookie } : {} });
}

async function seed() {
  const club = await createTestClub();
  const other = await createTestPlayer();
  const db = getTestDb();
  const day = (n: number) => new Date(Date.UTC(2026, 8, n, 12));
  await db.insert(activities).values([
    { uid: 'a1', player_uid: UID, club_id: club.uid, meta: {}, format: 'kiosk_login', created_at: day(1) },
    { uid: 'a2', player_uid: UID, club_id: club.uid, meta: {}, format: 'attendance', created_at: day(2) },
    { uid: 'a3', player_uid: UID, club_id: club.uid, meta: {}, format: 'kiosk_login', created_at: day(3) },
    { uid: 'a4', player_uid: other.uid, club_id: club.uid, meta: {}, format: 'kiosk_login', created_at: day(3) },
  ]);
  return club;
}

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock.mockResolvedValue(whoamiOk());
  await createTestPlayer({ uid: UID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/me/activities', () => {
  it('returns 401 without a session', async () => {
    const res = await GET(req('', undefined));
    expect(res.status).toBe(401);
  });

  it("returns only the caller's activities, newest first", async () => {
    await seed();
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a3', 'a2', 'a1']);
    expect(body.count).toBe(3);
    expect(body.total).toBe(3);
  });

  it('filters by format', async () => {
    await seed();
    const body = await (await GET(req('?format=attendance'))).json();
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a2']);
    expect(body.total).toBe(1);
  });

  it('filters by date range (inclusive)', async () => {
    await seed();
    const body = await (await GET(req('?start_date=2026-09-02T00:00:00Z&end_date=2026-09-02T23:59:59Z'))).json();
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a2']);
  });

  it('paginates with limit and offset and reports total', async () => {
    await seed();
    const body = await (await GET(req('?limit=2&offset=1'))).json();
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a2', 'a1']);
    expect(body.count).toBe(2);
    expect(body.total).toBe(3);
  });

  it('caps limit at 500 and rejects bad numbers', async () => {
    expect((await GET(req('?limit=abc'))).status).toBe(400);
    expect((await GET(req('?offset=-1'))).status).toBe(400);
    const ok = await GET(req('?limit=9999'));
    expect(ok.status).toBe(200);
  });

  it('rejects an invalid date with 400', async () => {
    const res = await GET(req('?start_date=yesterday'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/start_date/);
  });
});
```

- [ ] **Step 2: Run to verify failure** — cannot find module `../route`.

- [ ] **Step 3: Implement `src/app/api/me/activities/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import db from '@/lib/db';
import { activities } from '@/lib/schema';
import { getSessionPlayer } from '@/lib/session';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function bad(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function parseInt0(value: string | null, fallback: number, name: string): number | NextResponse {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return bad(`${name} must be a non-negative integer`);
  return Number(value);
}

function parseDate(value: string | null, name: string): Date | null | NextResponse {
  if (value === null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? bad(`${name} must be an ISO 8601 timestamp`) : d;
}

// GET /api/me/activities - The caller's activities, newest first.
// Query: format, start_date, end_date, limit (default 100, max 500), offset (default 0)
export async function GET(request: NextRequest | Request) {
  const session = await getSessionPlayer(request);
  if (!session.ok) {
    return NextResponse.json({ success: false, error: session.error }, { status: session.status });
  }

  const { searchParams } = new URL(request.url);
  const limitOrErr = parseInt0(searchParams.get('limit'), DEFAULT_LIMIT, 'limit');
  if (limitOrErr instanceof NextResponse) return limitOrErr;
  const offsetOrErr = parseInt0(searchParams.get('offset'), 0, 'offset');
  if (offsetOrErr instanceof NextResponse) return offsetOrErr;
  const startOrErr = parseDate(searchParams.get('start_date'), 'start_date');
  if (startOrErr instanceof NextResponse) return startOrErr;
  const endOrErr = parseDate(searchParams.get('end_date'), 'end_date');
  if (endOrErr instanceof NextResponse) return endOrErr;

  const limit = Math.min(limitOrErr, MAX_LIMIT);
  const format = searchParams.get('format');

  const conditions: SQL[] = [eq(activities.player_uid, session.player.uid)];
  if (format) conditions.push(eq(activities.format, format));
  if (startOrErr) conditions.push(gte(activities.created_at, startOrErr));
  if (endOrErr) conditions.push(lte(activities.created_at, endOrErr));
  const where = and(...conditions);

  try {
    const data = await db
      .select()
      .from(activities)
      .where(where)
      .orderBy(desc(activities.created_at))
      .limit(limit)
      .offset(offsetOrErr);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(activities)
      .where(where);

    return NextResponse.json({ success: true, data, count: data.length, total });
  } catch (error) {
    console.error('Error fetching current player activities:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch activities' }, { status: 500 });
  }
}
```

Note on the `offset=-1` test: `/^\d+$/` rejects the minus sign, producing the 400.

- [ ] **Step 4: Run to verify pass** — 7 passed. Then `npm test && npx tsc --noEmit && npm run lint` (122 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/activities
git commit -m "Add GET /api/me/activities with SQL filters and pagination"
```

---

### Task 8: Compose env, docs, and live check

**Files:**
- Modify: `docker-compose.yml` (`app` service environment)
- Modify: `DOCKER_README.md`
- Modify: `docs/kiosk-login-flow.md`

- [ ] **Step 1: Compose**

In the `app` service `environment:` block add:
```yaml
      KRATOS_PUBLIC_URL: http://kratos:4433
```
Run: `docker compose config --quiet && echo compose ok`.

- [ ] **Step 2: DOCKER_README.md — add after the "Smoke test" subsection of the Kratos section**

```markdown
### Session API

The API can identify the logged-in player from the Kratos session cookie:

| Endpoint | Returns |
|---|---|
| `GET /api/me` | The caller's player row (created on first call, `uid` = Kratos `player_uid`), club and squad memberships, and `identity { email, display_name }` |
| `GET /api/me/activities` | The caller's activities, newest first. Query: `format`, `start_date`, `end_date`, `limit` (≤500), `offset` |

Both return 401 with no session and 503 if Kratos is unreachable. Try it after logging in at http://localhost:3778 (copy the `ory_kratos_session` cookie from dev tools):

```sh
curl -s -b "ory_kratos_session=<value>" http://localhost:3777/api/me | python3 -m json.tool
```
```

- [ ] **Step 3: kiosk-login-flow.md — append to the "Implementation Status" table**

```markdown
| **Login-created players** | ✅ Complete | A player who registers via Kratos gets a `players` row (uid = `player_uid`) and a keychain on their first `GET /api/me`, so they work at kiosks like any other player. |
```

- [ ] **Step 4: Restart the API with the new env and run the live check**

```bash
cd /Users/mertie/Developer/immersive/playfolio
docker compose up -d app
sleep 12
docker compose exec app printenv KRATOS_PUBLIC_URL        # http://kratos:4433
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3777/api/me          # 401
cd /private/tmp/claude-501/-Users-mertie/9d04ff1b-4d66-4e17-9576-b762a0864de2/scratchpad
rm -f jar.txt
FLOW_URL=$(curl -s -c jar.txt -o /dev/null -w '%{redirect_url}' http://localhost:4433/self-service/registration/browser); FLOW_ID=${FLOW_URL##*flow=}
CSRF=$(curl -s -b jar.txt -H 'accept: application/json' "http://localhost:4433/self-service/registration/flows?id=$FLOW_ID" | python3 -c "import json,sys;print([n for n in json.load(sys.stdin)['ui']['nodes'] if n['attributes']['name']=='csrf_token'][0]['attributes']['value'])")
EMAIL="me-$(date +%s)@playfolio.local"
curl -s -b jar.txt -c jar.txt -o /dev/null -w 'register: %{http_code} %{redirect_url}\n' -X POST "http://localhost:4433/self-service/registration?flow=$FLOW_ID" --data-urlencode "csrf_token=$CSRF" --data-urlencode "method=password" --data-urlencode "traits.email=$EMAIL" --data-urlencode "traits.display_name=Me Tester" --data-urlencode "password=correct-horse-battery-staple-42"
PUID=$(curl -s -b jar.txt http://localhost:4433/sessions/whoami | python3 -c "import json,sys;print(json.load(sys.stdin)['identity']['traits']['player_uid'])")
curl -s -b jar.txt http://localhost:3777/api/me | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print('me:', d['uid'], d['meta'], d['identity'])"
echo "player_uid from kratos: $PUID"      # must equal the uid above
curl -s http://localhost:3777/api/players/$PUID | python3 -c "import json,sys;d=json.load(sys.stdin);print('players/<uid>:', d['success'], d['data']['uid'])"
docker compose exec -T postgres psql -U appuser -d playfolio -tc "select count(*) from keychain_players where player_uid='$PUID';"   # 1
curl -s -b jar.txt 'http://localhost:3777/api/me/activities?limit=5' | python3 -c "import json,sys;d=json.load(sys.stdin);print('activities:', d['success'], d['total'])"
```
Expected: env printed; 401; `register: 303 …/profile`; `me:` line shows the same uid as `player_uid from kratos`, `{'name': 'Me Tester'}`, and the identity; `players/<uid>: True <uid>`; keychain count `1`; `activities: True 0`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml DOCKER_README.md docs/kiosk-login-flow.md
git commit -m "Wire KRATOS_PUBLIC_URL into the API; document the session endpoints"
```

---

## Self-review against the spec

- §3.1/3.2 root causes and fixes → Tasks 1–2; §3.2 triage rule (production bugs stop and report) → Task 3; §3.3 acceptance → Task 3 Step 3.
- §4.1 helper contract (cookie short-circuit, 401/503 mapping, uid validation with log, race-safe upsert, keychain only on real insert, `KRATOS_PUBLIC_URL` default) → Task 5, each clause tested.
- §4.2 `/api/me` shape and shared memberships → Tasks 4 and 6. §4.3 activities filters in SQL, cap 500, `total`, 400 on bad params → Task 7. §4.4 compose/docs → Task 8.
- §5 tests: every listed case appears in Tasks 5–7; live check → Task 8 Step 4. §6 error table matches the handlers.
- Names consistent: `getSessionPlayer`, `SessionResult`, `SessionIdentity`, `getPlayerMemberships`, `createTestKey(key, playerUid, clubId, overrides)`, env `KRATOS_PUBLIC_URL`, test host `http://kratos.test:4433`.
