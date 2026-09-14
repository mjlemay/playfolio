import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { MAX_LIMIT } from '../limits';
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
  fetchMock.mockImplementation(async () => whoamiOk());
  await createTestPlayer({ uid: UID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/me/activities', () => {
  it('returns 401 without a session', async () => {
    // Note: passing `undefined` explicitly for `cookie` would still trigger its default
    // value (COOKIE) per JS default-parameter semantics, so use '' (falsy, not undefined)
    // to actually omit the cookie header.
    const res = await GET(req('', ''));
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

  it('includes rows whose created_at equals the bound exactly', async () => {
    await seed();
    // a2 was created at exactly this instant: both bounds are inclusive, so it matches.
    const body = await (
      await GET(req('?start_date=2026-09-02T12:00:00.000Z&end_date=2026-09-02T12:00:00.000Z'))
    ).json();
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a2']);
    expect(body.total).toBe(1);
  });

  it('returns an empty page for an unknown format', async () => {
    await seed();
    const res = await GET(req('?format=nope'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns an empty page when end_date precedes start_date', async () => {
    await seed();
    const res = await GET(req('?start_date=2026-09-03T00:00:00Z&end_date=2026-09-01T00:00:00Z'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('paginates with limit and offset and reports total', async () => {
    await seed();
    const body = await (await GET(req('?limit=2&offset=1'))).json();
    expect(body.data.map((a: { uid: string }) => a.uid)).toEqual(['a2', 'a1']);
    expect(body.count).toBe(2);
    expect(body.total).toBe(3);
  });

  it('caps limit at 500 and rejects bad numbers', async () => {
    expect(MAX_LIMIT).toBe(500);
    expect((await GET(req('?limit=abc'))).status).toBe(400);
    expect((await GET(req('?offset=-1'))).status).toBe(400);
    await seed();
    const res = await GET(req('?limit=9999&offset=0'));
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(3);
  });

  it('rejects a number too large to be a safe integer', async () => {
    const res = await GET(req('?offset=99999999999999999999'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/offset is too large/);
  });

  it('answers with cache-control: no-store', async () => {
    await seed();
    expect((await GET(req())).headers.get('cache-control')).toBe('no-store');
    expect((await GET(req('?limit=abc'))).headers.get('cache-control')).toBe('no-store');
    expect((await GET(req('', ''))).headers.get('cache-control')).toBe('no-store');
  });

  it('rejects an invalid date with 400', async () => {
    const res = await GET(req('?start_date=yesterday'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/start_date/);
  });
});
