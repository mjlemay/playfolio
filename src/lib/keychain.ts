import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import db from './db';
import { clubKeys, keychains, keychainPlayers } from './schema';

const WORDS = [
  'RED', 'BLUE', 'GREEN', 'PINK', 'GOLD', 'GREY', 'NAVY', 'TEAL',
  'LIME', 'ROSE', 'AQUA', 'CYAN', 'PLUM', 'JADE', 'CORAL', 'AMBER',
  'IVORY', 'LILAC', 'OLIVE', 'PEACH',
];

/**
 * Generates a new UUID v4 key for device authentication
 */
export function generateKey(): string {
  return randomUUID();
}

/**
 * Generates a human-readable auth code (e.g. "WOLF-4821")
 */
export function generateAuthCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${word}-${num}`;
}

/**
 * Creates a new keychain and adds the given player to it.
 * Used when a player account is first created (auto-create on device contact).
 */
export async function createKeychainForPlayer(playerUid: string): Promise<{
  uid: string;
  auth_code: string;
}> {
  // Generate a unique auth code
  let auth_code: string;
  let attempts = 0;
  do {
    auth_code = generateAuthCode();
    const conflict = await db
      .select()
      .from(keychains)
      .where(eq(keychains.auth_code, auth_code))
      .limit(1);
    if (conflict.length === 0) break;
    attempts++;
  } while (attempts < 20);

  const keychainUid = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(keychains).values({
      uid: keychainUid,
      auth_code: auth_code!,
    });
    await tx.insert(keychainPlayers).values({
      keychain_id: keychainUid,
      player_uid: playerUid,
    });
  });

  return { uid: keychainUid, auth_code: auth_code! };
}

/**
 * Resolves all player UIDs associated with a key and originating club ID.
 * Updates usage tracking (usage_count, last_used_at) on successful resolution.
 */
export async function resolvePlayersFromKey(
  key: string,
  originatingClubId: string
): Promise<
  | { success: true; player_uids: string[]; keychain: { uid: string; auth_code: string } }
  | { success: false; error: string }
> {
  // Fetch the club key joined with its keychain
  const records = await db
    .select({
      key: clubKeys.key,
      status: clubKeys.status,
      expires_at: clubKeys.expires_at,
      usage_count: clubKeys.usage_count,
      keychain_uid: keychains.uid,
      auth_code: keychains.auth_code,
    })
    .from(clubKeys)
    .innerJoin(keychains, eq(clubKeys.keychain_id, keychains.uid))
    .where(
      and(
        eq(clubKeys.key, key),
        eq(clubKeys.originating_club_id, originatingClubId)
      )
    )
    .limit(1);

  if (records.length === 0) {
    return { success: false, error: 'Key not found or invalid originating club' };
  }

  const record = records[0];

  if (record.status === 'revoked') {
    return { success: false, error: 'Key has been revoked' };
  }

  if (record.status === 'expired') {
    return { success: false, error: 'Key has expired' };
  }

  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    await db
      .update(clubKeys)
      .set({ status: 'expired' })
      .where(eq(clubKeys.key, key));
    return { success: false, error: 'Key has expired' };
  }

  // Fetch all players in this keychain
  const members = await db
    .select({ player_uid: keychainPlayers.player_uid })
    .from(keychainPlayers)
    .where(eq(keychainPlayers.keychain_id, record.keychain_uid));

  // Update usage tracking
  await db
    .update(clubKeys)
    .set({
      usage_count: record.usage_count + 1,
      last_used_at: new Date(),
    })
    .where(eq(clubKeys.key, key));

  return {
    success: true,
    player_uids: members.map((m) => m.player_uid),
    keychain: { uid: record.keychain_uid, auth_code: record.auth_code },
  };
}
