import { NextResponse } from 'next/server';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import db from '@/lib/db';
import { activities } from '@/lib/schema';
import { getSessionPlayer } from '@/lib/session';
import { json } from '@/lib/http';
import { DEFAULT_LIMIT, MAX_LIMIT } from './limits';

function bad(message: string) {
  return json({ success: false, error: message }, { status: 400 });
}

function parseInt0(value: string | null, fallback: number, name: string): number | NextResponse {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return bad(`${name} must be a non-negative integer`);
  const n = Number(value);
  // /^\d+$/ happily matches digits beyond 2^53, where Number() silently rounds.
  if (!Number.isSafeInteger(n)) return bad(`${name} is too large`);
  return n;
}

function parseDate(value: string | null, name: string): Date | null | NextResponse {
  if (value === null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? bad(`${name} must be an ISO 8601 timestamp`) : d;
}

// GET /api/me/activities - The caller's activities, newest first.
// Query: format, start_date, end_date, limit (default 100, max 500), offset (default 0)
export async function GET(request: Request) {
  try {
    // Inside the try: getSessionPlayer touches the database (it creates the player
    // row on first sight), so its failures belong in the 500 envelope too.
    const session = await getSessionPlayer(request);
    if (!session.ok) {
      return json({ success: false, error: session.error }, { status: session.status });
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

    return json({ success: true, data, count: data.length, total });
  } catch (error) {
    console.error('Error fetching current player activities:', error);
    return json({ success: false, error: 'Failed to fetch activities' }, { status: 500 });
  }
}
