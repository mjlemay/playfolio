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
    // A Response body can be read once, so each call needs a fresh one.
    fetchMock.mockImplementation(async () =>
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
