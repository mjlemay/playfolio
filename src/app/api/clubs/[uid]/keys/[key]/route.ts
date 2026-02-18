import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db';
import { clubKeys, clubs, keychains, keychainPlayers } from '@/lib/schema';

// GET /api/clubs/[uid]/keys/[key] - Get key details with player info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; key: string }> }
) {
  try {
    const { uid: clubId, key } = await params;

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.uid, clubId))
      .limit(1);

    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Fetch key with its keychain
    const keyRecords = await db
      .select()
      .from(clubKeys)
      .innerJoin(keychains, eq(clubKeys.keychain_id, keychains.uid))
      .where(
        and(eq(clubKeys.key, key), eq(clubKeys.originating_club_id, clubId))
      )
      .limit(1);

    if (keyRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 }
      );
    }

    // Fetch all players in the keychain
    const members = await db
      .select({ player_uid: keychainPlayers.player_uid })
      .from(keychainPlayers)
      .where(eq(keychainPlayers.keychain_id, keyRecords[0].keychains.uid));

    return NextResponse.json({
      success: true,
      data: {
        ...keyRecords[0].club_keys,
        keychain: keyRecords[0].keychains,
        player_uids: members.map((m) => m.player_uid),
      },
    });
  } catch (error) {
    console.error('Error fetching key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch key' },
      { status: 500 }
    );
  }
}

// PATCH /api/clubs/[uid]/keys/[key] - Revoke or update key
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; key: string }> }
) {
  try {
    const { uid: clubId, key } = await params;
    const body = await request.json();

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.uid, clubId))
      .limit(1);

    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Verify key exists and belongs to this club
    const existingKey = await db
      .select()
      .from(clubKeys)
      .where(
        and(eq(clubKeys.key, key), eq(clubKeys.originating_club_id, clubId))
      )
      .limit(1);

    if (existingKey.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};

    if (body.status) {
      updates.status = body.status;
      if (body.status === 'revoked') {
        updates.revoked_at = new Date();
      }
    }

    if (body.meta !== undefined) {
      updates.meta = body.meta;
    }

    if (body.expires_at !== undefined) {
      updates.expires_at = body.expires_at ? new Date(body.expires_at) : null;
    }

    // Update the key
    const updatedKey = await db
      .update(clubKeys)
      .set(updates)
      .where(
        and(eq(clubKeys.key, key), eq(clubKeys.originating_club_id, clubId))
      )
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedKey[0],
    });
  } catch (error) {
    console.error('Error updating key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update key' },
      { status: 500 }
    );
  }
}

// DELETE /api/clubs/[uid]/keys/[key] - Permanently delete key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; key: string }> }
) {
  try {
    const { uid: clubId, key } = await params;

    // Verify club exists
    const club = await db
      .select()
      .from(clubs)
      .where(eq(clubs.uid, clubId))
      .limit(1);

    if (club.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Delete the key (only if it belongs to this club)
    const deletedKey = await db
      .delete(clubKeys)
      .where(
        and(eq(clubKeys.key, key), eq(clubKeys.originating_club_id, clubId))
      )
      .returning();

    if (deletedKey.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete key' },
      { status: 500 }
    );
  }
}
