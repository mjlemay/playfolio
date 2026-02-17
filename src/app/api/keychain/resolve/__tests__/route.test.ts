import { describe, it, expect } from 'vitest';
import { POST } from '../route';
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

describe('POST /api/keychain/resolve', () => {
  it('should successfully resolve a valid key', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.player_uid).toBe(player.uid);
  });

  it('should increment usage tracking on resolution', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    // Resolve twice
    await POST(mockRequest);
    await POST(mockRequest);

    // Check usage count
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.usage_count).toBe(2);
    expect(keyRecord.last_used_at).toBeTruthy();
  });

  it('should return 400 if key is missing', async () => {
    const mockRequest = {
      json: async () => ({
        originating_club_id: 'some-club',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Both key and originating_club_id are required');
  });

  it('should return 400 if originating_club_id is missing', async () => {
    const mockRequest = {
      json: async () => ({
        key: 'some-key',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Both key and originating_club_id are required');
  });

  it('should return 400 for revoked key', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid, { status: 'revoked' });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Key has been revoked');
  });

  it('should return 400 for expired key', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid, { status: 'expired' });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Key has expired');
  });

  it('should auto-expire key with past expires_at date', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    const pastDate = new Date('2020-01-01');
    await createTestKey(key, player.uid, club.uid, { expires_at: pastDate });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Key has expired');

    // Verify status was updated to expired
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.status).toBe('expired');
  });

  it('should return 400 for invalid key', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        key: 'nonexistent-key',
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Key not found or invalid originating club');
  });

  it('should return 400 for wrong originating_club_id (two-factor security)', async () => {
    const club1 = await createTestClub({ uid: 'club-1' });
    const club2 = await createTestClub({ uid: 'club-2' });
    const player = await createTestPlayer();
    await createClubMembership(club1.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club1.uid);

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club2.uid, // Wrong club
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Key not found or invalid originating club');
  });

  it('should allow key with future expiration', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    const futureDate = new Date('2030-12-31');
    await createTestKey(key, player.uid, club.uid, { expires_at: futureDate });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.player_uid).toBe(player.uid);
  });
});
