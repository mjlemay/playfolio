import { describe, it, expect } from 'vitest';
import { generateKey, resolvePlayersFromKey, createKeychainForPlayer } from '../keychain';
import {
  createTestClub,
  createTestPlayer,
  createTestKeychain,
  createTestKey,
} from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { clubKeys } from '../schema';
import { eq } from 'drizzle-orm';

describe('keychain integration tests', () => {
  describe('generateKey', () => {
    it('should generate a valid UUID v4', () => {
      const key = generateKey();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(key).toMatch(uuidV4Regex);
    });

    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with correct version', () => {
      const key = generateKey();
      const parts = key.split('-');
      expect(parts[2][0]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0]);
    });
  });

  describe('createKeychainForPlayer', () => {
    it('should create a keychain and return uid + auth_code', async () => {
      const player = await createTestPlayer();
      const keychain = await createKeychainForPlayer(player.uid);

      expect(keychain.uid).toBeTruthy();
      expect(keychain.auth_code).toMatch(/^[A-Z]+-\d{4}$/);
    });
  });

  describe('resolvePlayersFromKey', () => {
    it('should resolve all player_uids for a valid key', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid);

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.player_uids).toContain(player.uid);
      }
    });

    it('should return all players when a keychain has multiple members', async () => {
      const club = await createTestClub();
      const player1 = await createTestPlayer();
      const player2 = await createTestPlayer();
      const keychain = await createTestKeychain(player1.uid);

      // Manually add player2 to the same keychain
      const db = getTestDb();
      await db.insert(require('../schema').keychainPlayers).values({
        keychain_id: keychain.uid,
        player_uid: player2.uid,
      });

      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid);

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.player_uids).toContain(player1.uid);
        expect(result.player_uids).toContain(player2.uid);
      }
    });

    it('should increment usage_count on successful resolution', async () => {
      const db = getTestDb();
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid);

      await resolvePlayersFromKey(key, club.uid);
      await resolvePlayersFromKey(key, club.uid);

      const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
      expect(keyRecord.usage_count).toBe(2);
      expect(keyRecord.last_used_at).toBeTruthy();
    });

    it('should reject key with wrong originating_club_id', async () => {
      const club1 = await createTestClub({ uid: 'club-1' });
      const club2 = await createTestClub({ uid: 'club-2' });
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club1.uid);

      const result = await resolvePlayersFromKey(key, club2.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key not found or invalid originating club');
      }
    });

    it('should reject revoked key', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid, { status: 'revoked' });

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has been revoked');
      }
    });

    it('should reject expired key (by status)', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid, { status: 'expired' });

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has expired');
      }
    });

    it('should auto-expire key if expires_at is in the past', async () => {
      const db = getTestDb();
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid, { expires_at: new Date('2020-01-01') });

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has expired');
      }

      const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
      expect(keyRecord.status).toBe('expired');
    });

    it('should allow key with future expiration', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      const keychain = await createTestKeychain(player.uid);
      const key = generateKey();
      await createTestKey(key, keychain.uid, club.uid, { expires_at: new Date('2030-01-01') });

      const result = await resolvePlayersFromKey(key, club.uid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.player_uids).toContain(player.uid);
      }
    });

    it('should reject non-existent key', async () => {
      const club = await createTestClub();
      const result = await resolvePlayersFromKey('non-existent-key', club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key not found or invalid originating club');
      }
    });
  });
});
