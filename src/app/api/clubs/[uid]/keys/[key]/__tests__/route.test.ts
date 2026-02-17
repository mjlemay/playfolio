import { describe, it, expect } from 'vitest';
import { GET, PATCH, DELETE } from '../route';
import {
  createTestClub,
  createTestPlayer,
  createClubMembership,
  createTestKey,
} from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { clubKeys } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateKey } from '@/lib/keychain';

describe('GET /api/clubs/[uid]/keys/[key]', () => {
  it('should get key details with player info', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid, {
      meta: { purpose: 'Tournament' },
    });

    const mockRequest = {} as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.key).toBe(key);
    expect(data.data.player_uid).toBe(player.uid);
    expect(data.data.originating_club_id).toBe(club.uid);
    expect(data.data.player).toBeTruthy();
    expect(data.data.player.uid).toBe(player.uid);
    expect(data.data.meta).toEqual({ purpose: 'Tournament' });
  });

  it('should return 404 if club does not exist', async () => {
    const mockRequest = {} as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent', key: 'some-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });

  it('should return 404 if key does not exist', async () => {
    const club = await createTestClub();

    const mockRequest = {} as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key: 'nonexistent-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Key not found');
  });

  it('should return 404 if key belongs to different club', async () => {
    const club1 = await createTestClub({ uid: 'club-1' });
    const club2 = await createTestClub({ uid: 'club-2' });
    const player = await createTestPlayer();
    await createClubMembership(club1.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club1.uid);

    const mockRequest = {} as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club2.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Key not found');
  });
});

describe('PATCH /api/clubs/[uid]/keys/[key]', () => {
  it('should revoke a key', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const mockRequest = {
      json: async () => ({
        status: 'revoked',
      }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('revoked');
    expect(data.data.revoked_at).toBeTruthy();

    // Verify in database
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.status).toBe('revoked');
    expect(keyRecord.revoked_at).toBeTruthy();
  });

  it('should update key metadata', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid, {
      meta: { original: 'value' },
    });

    const mockRequest = {
      json: async () => ({
        meta: { updated: 'metadata', purpose: 'New purpose' },
      }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.meta).toEqual({ updated: 'metadata', purpose: 'New purpose' });

    // Verify in database
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.meta).toEqual({ updated: 'metadata', purpose: 'New purpose' });
  });

  it('should update expiration date', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const newExpiry = '2027-12-31T23:59:59Z';
    const mockRequest = {
      json: async () => ({
        expires_at: newExpiry,
      }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.expires_at).toBeTruthy();

    // Verify in database
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.expires_at).toBeTruthy();
  });

  it('should allow updating multiple fields at once', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const mockRequest = {
      json: async () => ({
        status: 'revoked',
        meta: { reason: 'tournament ended' },
        expires_at: '2026-12-31T23:59:59Z',
      }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe('revoked');
    expect(data.data.meta).toEqual({ reason: 'tournament ended' });
    expect(data.data.revoked_at).toBeTruthy();
  });

  it('should return 404 if club does not exist', async () => {
    const mockRequest = {
      json: async () => ({ status: 'revoked' }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent', key: 'some-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Club not found');
  });

  it('should return 404 if key does not exist', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({ status: 'revoked' }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key: 'nonexistent-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Key not found');
  });

  it('should not update key from different club', async () => {
    const club1 = await createTestClub({ uid: 'club-1' });
    const club2 = await createTestClub({ uid: 'club-2' });
    const player = await createTestPlayer();
    await createClubMembership(club1.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club1.uid);

    const mockRequest = {
      json: async () => ({ status: 'revoked' }),
    } as any;

    const response = await PATCH(mockRequest, {
      params: Promise.resolve({ uid: club2.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Key not found');
  });
});

describe('DELETE /api/clubs/[uid]/keys/[key]', () => {
  it('should permanently delete a key', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const mockRequest = {} as any;

    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Key deleted successfully');

    // Verify key was deleted from database
    const keyRecords = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecords).toHaveLength(0);
  });

  it('should return 404 if club does not exist', async () => {
    const mockRequest = {} as any;

    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent', key: 'some-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Club not found');
  });

  it('should return 404 if key does not exist', async () => {
    const club = await createTestClub();

    const mockRequest = {} as any;

    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: club.uid, key: 'nonexistent-key' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Key not found');
  });

  it('should not delete key from different club', async () => {
    const db = getTestDb();
    const club1 = await createTestClub({ uid: 'club-1' });
    const club2 = await createTestClub({ uid: 'club-2' });
    const player = await createTestPlayer();
    await createClubMembership(club1.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club1.uid);

    const mockRequest = {} as any;

    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: club2.uid, key }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Key not found');

    // Verify key still exists in database
    const keyRecords = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecords).toHaveLength(1);
  });
});
