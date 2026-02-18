import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { keychains, keychainPlayers, players } from '@/lib/schema';

// GET /api/keychains/lookup?auth_code=WOLF-4821
// Look up a keychain by auth code and return all associated players
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth_code = searchParams.get('auth_code');

    if (!auth_code) {
      return NextResponse.json(
        { success: false, error: 'auth_code query parameter is required' },
        { status: 400 }
      );
    }

    const keychain = await db
      .select()
      .from(keychains)
      .where(eq(keychains.auth_code, auth_code.trim().toUpperCase()))
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
      .where(eq(keychainPlayers.keychain_id, keychain[0].uid));

    return NextResponse.json({
      success: true,
      data: { ...keychain[0], players: members },
    });
  } catch (error) {
    console.error('Error looking up keychain:', error);
    return NextResponse.json({ success: false, error: 'Failed to look up keychain' }, { status: 500 });
  }
}
