import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import db from '@/lib/db';
import { keychains, keychainPlayers, players } from '@/lib/schema';

// GET /api/keychains - List all keychains with their member players
export async function GET() {
  try {
    const allKeychains = await db.select().from(keychains);

    const result = await Promise.all(
      allKeychains.map(async (keychain) => {
        const members = await db
          .select({
            player_uid: keychainPlayers.player_uid,
            joined_at: keychainPlayers.created_at,
            meta: players.meta,
            status: players.status,
          })
          .from(keychainPlayers)
          .leftJoin(players, eq(keychainPlayers.player_uid, players.uid))
          .where(eq(keychainPlayers.keychain_id, keychain.uid));

        return { ...keychain, players: members };
      })
    );

    return NextResponse.json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error('Error fetching keychains:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch keychains' }, { status: 500 });
  }
}

// POST /api/keychains/join (via this route as POST /api/keychains)
// Body: { auth_code, player_uid }
// Moves the player into the keychain identified by auth_code.
// The player is removed from their current keychain first; if that keychain
// becomes empty it is deleted.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.auth_code || !body.player_uid) {
      return NextResponse.json(
        { success: false, error: 'auth_code and player_uid are required' },
        { status: 400 }
      );
    }

    // Look up the target keychain by auth_code
    const targetKeychain = await db
      .select()
      .from(keychains)
      .where(eq(keychains.auth_code, body.auth_code.trim().toUpperCase()))
      .limit(1);

    if (targetKeychain.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No keychain found for this auth code' },
        { status: 404 }
      );
    }

    const target = targetKeychain[0];

    // Check player exists
    const player = await db
      .select()
      .from(players)
      .where(eq(players.uid, body.player_uid))
      .limit(1);

    if (player.length === 0) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    // Find the player's current keychain membership (if any)
    const currentMembership = await db
      .select()
      .from(keychainPlayers)
      .where(eq(keychainPlayers.player_uid, body.player_uid))
      .limit(1);

    await db.transaction(async (tx) => {
      if (currentMembership.length > 0) {
        const oldKeychainId = currentMembership[0].keychain_id;

        // Don't do anything if already in the target keychain
        if (oldKeychainId === target.uid) return;

        // Remove from old keychain
        await tx
          .delete(keychainPlayers)
          .where(eq(keychainPlayers.player_uid, body.player_uid));

        // If the old keychain is now empty, delete it
        const remaining = await tx
          .select()
          .from(keychainPlayers)
          .where(eq(keychainPlayers.keychain_id, oldKeychainId))
          .limit(1);

        if (remaining.length === 0) {
          await tx.delete(keychains).where(eq(keychains.uid, oldKeychainId));
        }
      }

      // Add player to target keychain
      await tx.insert(keychainPlayers).values({
        keychain_id: target.uid,
        player_uid: body.player_uid,
      });
    });

    return NextResponse.json({ success: true, data: { keychain_uid: target.uid, auth_code: target.auth_code } });
  } catch (error) {
    console.error('Error joining keychain:', error);
    return NextResponse.json({ success: false, error: 'Failed to join keychain' }, { status: 500 });
  }
}
