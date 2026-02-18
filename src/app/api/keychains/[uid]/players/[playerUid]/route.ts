import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { keychains, keychainPlayers } from '@/lib/schema';
import { createKeychainForPlayer } from '@/lib/keychain';

// DELETE /api/keychains/[uid]/players/[playerUid]
// Removes a player from a keychain (unmerge). The detached player
// automatically receives a fresh keychain so they are never identity-less.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string; playerUid: string }> }
) {
  try {
    const { uid: keychainUid, playerUid } = await params;

    // Verify membership exists
    const membership = await db
      .select()
      .from(keychainPlayers)
      .where(
        and(
          eq(keychainPlayers.keychain_id, keychainUid),
          eq(keychainPlayers.player_uid, playerUid)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player is not a member of this keychain' },
        { status: 404 }
      );
    }

    let newKeychain: { uid: string; auth_code: string } | null = null;

    await db.transaction(async (tx) => {
      // Remove player from keychain
      await tx
        .delete(keychainPlayers)
        .where(
          and(
            eq(keychainPlayers.keychain_id, keychainUid),
            eq(keychainPlayers.player_uid, playerUid)
          )
        );

      // If the keychain is now empty, delete it
      const remaining = await tx
        .select()
        .from(keychainPlayers)
        .where(eq(keychainPlayers.keychain_id, keychainUid))
        .limit(1);

      if (remaining.length === 0) {
        await tx.delete(keychains).where(eq(keychains.uid, keychainUid));
      }
    });

    // Give the detached player a fresh keychain (outside the transaction so
    // the unique auth_code collision check reads committed state)
    newKeychain = await createKeychainForPlayer(playerUid);

    return NextResponse.json({
      success: true,
      data: { player_uid: playerUid, new_keychain: newKeychain },
    });
  } catch (error) {
    console.error('Error unmerging player from keychain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unmerge player from keychain' },
      { status: 500 }
    );
  }
}
