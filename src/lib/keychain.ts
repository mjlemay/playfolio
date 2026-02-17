import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import db from './db';
import { clubKeys, clubPlayers } from './schema';

/**
 * Generates a new UUID v4 key for player sharing
 */
export function generateKey(): string {
  return randomUUID();
}

/**
 * Validates that a club owns/has membership relationship with a player
 * @param clubId - The club's UID
 * @param playerUid - The player's UID
 * @returns Promise<boolean> - True if club has player as member
 */
export async function validateClubPlayerOwnership(
  clubId: string,
  playerUid: string
): Promise<boolean> {
  const membership = await db
    .select()
    .from(clubPlayers)
    .where(
      and(
        eq(clubPlayers.club_id, clubId),
        eq(clubPlayers.player_uid, playerUid)
      )
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Resolves a player UID from a key and originating club ID
 * Updates usage tracking (usage_count, last_used_at) on successful resolution
 * @param key - The UUID v4 key
 * @param originatingClubId - The club that created the key
 * @returns Promise with success status, player_uid on success, or error message
 */
export async function resolvePlayerFromKey(
  key: string,
  originatingClubId: string
): Promise<
  | { success: true; player_uid: string }
  | { success: false; error: string }
> {
  // Fetch the key with both key and originating_club_id (two-factor security)
  const keyRecords = await db
    .select()
    .from(clubKeys)
    .where(
      and(
        eq(clubKeys.key, key),
        eq(clubKeys.originating_club_id, originatingClubId)
      )
    )
    .limit(1);

  if (keyRecords.length === 0) {
    return { success: false, error: 'Key not found or invalid originating club' };
  }

  const keyRecord = keyRecords[0];

  // Check if key is revoked
  if (keyRecord.status === 'revoked') {
    return { success: false, error: 'Key has been revoked' };
  }

  // Check if key is expired (either status or expires_at)
  if (keyRecord.status === 'expired') {
    return { success: false, error: 'Key has expired' };
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    // Auto-update status to expired if past expiration date
    await db
      .update(clubKeys)
      .set({ status: 'expired' })
      .where(eq(clubKeys.key, key));

    return { success: false, error: 'Key has expired' };
  }

  // Update usage tracking
  await db
    .update(clubKeys)
    .set({
      usage_count: keyRecord.usage_count + 1,
      last_used_at: new Date(),
    })
    .where(eq(clubKeys.key, key));

  return { success: true, player_uid: keyRecord.player_uid };
}
