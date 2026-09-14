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
    // mockImplementation (not mockResolvedValue) so each GET call gets its own
    // Response instance — a real fetch Response body can only be read once.
    fetchMock.mockImplementation(async () =>
      whoami(200, { email: 'ace@example.com', player_uid: UID, display_name: 'Ace' }),
    );
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

  it('answers with cache-control: no-store', async () => {
    fetchMock.mockImplementation(async () => whoami(200, { email: 'a@b.c', player_uid: UID }));
    const res = await GET(req(COOKIE));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await GET(req())).headers.get('cache-control')).toBe('no-store');
  });

  it('returns the 500 envelope when a database read fails', async () => {
    fetchMock.mockImplementation(async () => whoami(200, { email: 'a@b.c', player_uid: UID }));
    const players = await import('@/lib/players');
    vi.spyOn(players, 'getPlayerMemberships').mockRejectedValueOnce(new Error('boom'));
    const res = await GET(req(COOKIE));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Failed to fetch player' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('omits display_name from identity when the session has none', async () => {
    fetchMock.mockResolvedValue(whoami(200, { email: 'a@b.c', player_uid: UID }));
    const body = await (await GET(req(COOKIE))).json();
    expect(body.data.identity).toEqual({ email: 'a@b.c' });
    expect(body.data.meta).toBeNull();
  });
});
