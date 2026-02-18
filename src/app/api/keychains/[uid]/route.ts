import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { keychains, keychainPlayers, players } from '@/lib/schema';

// GET /api/keychains/[uid] - Get a single keychain with all member players
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    const keychain = await db
      .select()
      .from(keychains)
      .where(eq(keychains.uid, uid))
      .limit(1);

    if (keychain.length === 0) {
      return NextResponse.json({ success: false, error: 'Keychain not found' }, { status: 404 });
    }

    const members = await db
      .select({
        player_uid: keychainPlayers.player_uid,
        joined_at: keychainPlayers.created_at,
        meta: players.meta,
        status: players.status,
        created_at: players.created_at,
      })
      .from(keychainPlayers)
      .leftJoin(players, eq(keychainPlayers.player_uid, players.uid))
      .where(eq(keychainPlayers.keychain_id, uid));

    return NextResponse.json({ success: true, data: { ...keychain[0], players: members } });
  } catch (error) {
    console.error('Error fetching keychain:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch keychain' }, { status: 500 });
  }
}

// DELETE /api/keychains/[uid] - Delete a keychain (cascades to club_keys and keychain_players)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    const deleted = await db.delete(keychains).where(eq(keychains.uid, uid)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ success: false, error: 'Keychain not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting keychain:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete keychain' }, { status: 500 });
  }
}
