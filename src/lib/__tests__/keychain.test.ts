import { describe, it, expect, beforeEach } from 'vitest';
import { generateKey, validateClubPlayerOwnership, resolvePlayerFromKey } from '../keychain';
import {
  createTestClub,
  createTestPlayer,
  createClubMembership,
  createTestKey,
} from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { clubKeys } from '../schema';
import { eq } from 'drizzle-orm';

describe('keychain integration tests', () => {
  describe('generateKey', () => {
    it('should generate a valid UUID v4', () => {
      const key = generateKey();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
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

      // Check that the 3rd segment starts with '4' (UUID v4)
      expect(parts[2][0]).toBe('4');

      // Check that the 4th segment starts with '8', '9', 'a', or 'b' (UUID variant)
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0]);
    });
  });

  describe('validateClubPlayerOwnership', () => {
    it('should return true when club has player as member', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const result = await validateClubPlayerOwnership(club.uid, player.uid);

      expect(result).toBe(true);
    });

    it('should return false when club does not have player as member', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      // No membership created

      const result = await validateClubPlayerOwnership(club.uid, player.uid);

      expect(result).toBe(false);
    });

    it('should return false for non-existent club', async () => {
      const player = await createTestPlayer();

      const result = await validateClubPlayerOwnership('non-existent-club', player.uid);

      expect(result).toBe(false);
    });

    it('should return false for non-existent player', async () => {
      const club = await createTestClub();

      const result = await validateClubPlayerOwnership(club.uid, 'non-existent-player');

      expect(result).toBe(false);
    });
  });

  describe('resolvePlayerFromKey', () => {
    it('should successfully resolve a valid active key', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      await createTestKey(key, player.uid, club.uid);

      const result = await resolvePlayerFromKey(key, club.uid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.player_uid).toBe(player.uid);
      }
    });

    it('should increment usage_count on successful resolution', async () => {
      const db = getTestDb();
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      await createTestKey(key, player.uid, club.uid);

      // Resolve twice
      await resolvePlayerFromKey(key, club.uid);
      await resolvePlayerFromKey(key, club.uid);

      // Check usage count
      const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
      expect(keyRecord.usage_count).toBe(2);
      expect(keyRecord.last_used_at).toBeTruthy();
    });

    it('should reject key with wrong originating_club_id', async () => {
      const club1 = await createTestClub({ uid: 'club-1' });
      const club2 = await createTestClub({ uid: 'club-2' });
      const player = await createTestPlayer();
      await createClubMembership(club1.uid, player.uid);

      const key = generateKey();
      await createTestKey(key, player.uid, club1.uid);

      // Try to resolve with wrong club
      const result = await resolvePlayerFromKey(key, club2.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key not found or invalid originating club');
      }
    });

    it('should reject revoked key', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      await createTestKey(key, player.uid, club.uid, { status: 'revoked' });

      const result = await resolvePlayerFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has been revoked');
      }
    });

    it('should reject expired key (by status)', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      await createTestKey(key, player.uid, club.uid, { status: 'expired' });

      const result = await resolvePlayerFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has expired');
      }
    });

    it('should auto-expire key if expires_at is in the past', async () => {
      const db = getTestDb();
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      const pastDate = new Date('2020-01-01');
      await createTestKey(key, player.uid, club.uid, { expires_at: pastDate });

      const result = await resolvePlayerFromKey(key, club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key has expired');
      }

      // Verify status was updated to expired
      const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
      expect(keyRecord.status).toBe('expired');
    });

    it('should allow key with future expiration', async () => {
      const club = await createTestClub();
      const player = await createTestPlayer();
      await createClubMembership(club.uid, player.uid);

      const key = generateKey();
      const futureDate = new Date('2030-01-01');
      await createTestKey(key, player.uid, club.uid, { expires_at: futureDate });

      const result = await resolvePlayerFromKey(key, club.uid);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.player_uid).toBe(player.uid);
      }
    });

    it('should reject non-existent key', async () => {
      const club = await createTestClub();

      const result = await resolvePlayerFromKey('non-existent-key', club.uid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Key not found or invalid originating club');
      }
    });
  });
});
