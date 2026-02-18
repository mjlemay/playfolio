import { sql } from 'drizzle-orm';
import { getTestDb } from './test-db';
import { players, clubs, clubPlayers, clubKeys, keychains, keychainPlayers, activities } from '@/lib/schema';
import { randomUUID } from 'crypto';

/**
 * Clean all tables in the test database
 */
export async function cleanDatabase() {
  const db = getTestDb();

  // Delete in order to respect foreign key constraints
  await db.delete(activities);
  await db.delete(clubKeys);
  await db.delete(keychainPlayers);
  await db.delete(keychains);
  await db.delete(clubPlayers);
  await db.delete(players);
  await db.delete(clubs);
}

/**
 * Seed test data - creates a basic club and player for testing
 */
export async function seedTestData() {
  const db = getTestDb();

  // Create test club
  const [testClub] = await db.insert(clubs).values({
    uid: 'test-club-001',
    displayName: 'Test Club',
    safeName: 'test-club',
    meta: null,
    status: null,
  }).returning();

  // Create test player
  const [testPlayer] = await db.insert(players).values({
    uid: 'test-player-001',
    meta: { name: 'Test Player' },
    status: 'present',
  }).returning();

  // Create club-player membership
  await db.insert(clubPlayers).values({
    club_id: testClub.uid,
    player_uid: testPlayer.uid,
    role: 'member',
    status: 'present',
  });

  return { testClub, testPlayer };
}

/**
 * Create a test club
 */
export async function createTestClub(overrides: Partial<typeof clubs.$inferInsert> = {}) {
  const db = getTestDb();
  const uid = overrides.uid || `test-club-${Date.now()}`;

  const [club] = await db.insert(clubs).values({
    uid,
    displayName: overrides.displayName || 'Test Club',
    safeName: overrides.safeName || 'test-club',
    meta: overrides.meta || null,
    status: overrides.status || null,
  }).returning();

  return club;
}

/**
 * Create a test player
 */
export async function createTestPlayer(overrides: Partial<typeof players.$inferInsert> = {}) {
  const db = getTestDb();
  const uid = overrides.uid || `test-player-${Date.now()}`;

  const [player] = await db.insert(players).values({
    uid,
    meta: overrides.meta || { name: 'Test Player' },
    status: overrides.status || 'present',
  }).returning();

  return player;
}

/**
 * Create a club-player membership
 */
export async function createClubMembership(clubId: string, playerUid: string) {
  const db = getTestDb();

  await db.insert(clubPlayers).values({
    club_id: clubId,
    player_uid: playerUid,
    role: 'member',
    status: 'present',
  });
}

/**
 * Create a keychain for a player and return both
 */
export async function createTestKeychain(playerUid: string) {
  const db = getTestDb();
  const keychainUid = randomUUID();
  const auth_code = `TEST-${Math.floor(Math.random() * 9000) + 1000}`;

  const [keychain] = await db.insert(keychains).values({
    uid: keychainUid,
    auth_code,
  }).returning();

  await db.insert(keychainPlayers).values({
    keychain_id: keychainUid,
    player_uid: playerUid,
  });

  return keychain;
}

/**
 * Create a test key — requires a keychain_id (create with createTestKeychain first)
 */
export async function createTestKey(
  key: string,
  keychainId: string,
  clubId: string,
  overrides: Partial<typeof clubKeys.$inferInsert> = {}
) {
  const db = getTestDb();

  const [createdKey] = await db.insert(clubKeys).values({
    key,
    keychain_id: keychainId,
    originating_club_id: clubId,
    status: overrides.status || 'active',
    meta: overrides.meta || null,
    expires_at: overrides.expires_at || null,
  }).returning();

  return createdKey;
}

/**
 * Create a test device
 */
export async function createTestDevice(clubId: string, overrides: Partial<{ uid: string; name: string }> = {}) {
  const db = getTestDb();
  const uid = overrides.uid || `device-${Date.now()}`;

  const [device] = await db.insert(require('@/lib/schema').devices).values({
    uid,
    name: overrides.name || 'Test Device',
    club_id: clubId,
  }).returning();

  return device;
}
