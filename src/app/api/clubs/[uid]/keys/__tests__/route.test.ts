import { describe, it, expect } from 'vitest';
import { POST, GET } from '../route';
import {
  createTestClub,
  createTestPlayer,
  createClubMembership,
  createTestKeychain,
  createTestKey,
} from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { clubKeys } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateKey } from '@/lib/keychain';

describe('POST /api/clubs/[uid]/keys', () => {
  it('should create a new key for a club member via their auth_code', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);
    const keychain = await createTestKeychain(player.uid);

    const mockRequest = {
      json: async () => ({
        auth_code: keychain.auth_code,
        meta: { purpose: 'Tournament 2026' },
      }),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.keychain_id).toBe(keychain.uid);
    expect(data.data.originating_club_id).toBe(club.uid);
    expect(data.data.status).toBe('active');
    expect(data.data.meta).toEqual({ purpose: 'Tournament 2026' });
    expect(data.data.key).toBeTruthy();
  });

  it('should create key with optional expiration', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);
    const keychain = await createTestKeychain(player.uid);

    const expiresAt = '2026-09-01T00:00:00Z';

    const mockRequest = {
      json: async () => ({
        auth_code: keychain.auth_code,
        expires_at: expiresAt,
      }),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.expires_at).toBeTruthy();
  });

  it('should return 400 if auth_code is missing', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({}),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('auth_code is required');
  });

  it('should return 404 if club does not exist', async () => {
    const player = await createTestPlayer();
    const keychain = await createTestKeychain(player.uid);

    const mockRequest = {
      json: async () => ({
        auth_code: keychain.auth_code,
      }),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent-club' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });

  // Since the Feb keychain rewrite the club does not check membership: possession
  // of the keychain's auth_code is what authorises issuing a key, so an auth_code
  // nobody owns is a 404 rather than a membership 403.
  it('should return 404 if no keychain matches the auth_code', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        auth_code: 'NOPE-0000',
      }),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Keychain not found for this auth code');
  });

  it('should allow club to create multiple keys for same keychain', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);
    const keychain = await createTestKeychain(player.uid);

    // Create first key
    const request1 = {
      json: async () => ({ auth_code: keychain.auth_code }),
    } as any;

    const response1 = await POST(request1, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data1 = await response1.json();

    // Create second key
    const request2 = {
      json: async () => ({ auth_code: keychain.auth_code }),
    } as any;

    const response2 = await POST(request2, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data2 = await response2.json();

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(data1.data.key).not.toBe(data2.data.key);
  });
});

describe('GET /api/clubs/[uid]/keys', () => {
  it('should list all keys for a club', async () => {
    const club = await createTestClub();
    const player1 = await createTestPlayer();
    const player2 = await createTestPlayer();
    await createClubMembership(club.uid, player1.uid);
    await createClubMembership(club.uid, player2.uid);

    // Create keys
    const key1 = generateKey();
    const key2 = generateKey();
    await createTestKey(key1, player1.uid, club.uid);
    await createTestKey(key2, player2.uid, club.uid);

    const mockRequest = {
      url: `http://localhost/api/clubs/${club.uid}/keys`,
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.data).toHaveLength(2);
  });

  // The rewrite dropped the player_uid filter (club_keys has no player_uid column);
  // status is the only supported filter, and an unknown param is ignored.
  it('should ignore a player_uid filter and list the club\'s keys', async () => {
    const club = await createTestClub();
    const player1 = await createTestPlayer();
    const player2 = await createTestPlayer();
    await createClubMembership(club.uid, player1.uid);
    await createClubMembership(club.uid, player2.uid);

    const key1 = generateKey();
    const key2 = generateKey();
    await createTestKey(key1, player1.uid, club.uid);
    await createTestKey(key2, player2.uid, club.uid);

    const mockRequest = {
      url: `http://localhost/api/clubs/${club.uid}/keys?player_uid=${player1.uid}`,
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.data.map((k: { key: string }) => k.key).sort()).toEqual([key1, key2].sort());
    expect(data.data.every((k: { keychain_id: string }) => Boolean(k.keychain_id))).toBe(true);
  });

  it('should filter keys by status', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key1 = generateKey();
    const key2 = generateKey();
    await createTestKey(key1, player.uid, club.uid, { status: 'active' });
    await createTestKey(key2, player.uid, club.uid, { status: 'revoked' });

    const mockRequest = {
      url: `http://localhost/api/clubs/${club.uid}/keys?status=active`,
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.data[0].status).toBe('active');
  });

  it('should return empty array when no keys exist', async () => {
    const club = await createTestClub();

    const mockRequest = {
      url: `http://localhost/api/clubs/${club.uid}/keys`,
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.data).toEqual([]);
  });

  it('should return 404 if club does not exist', async () => {
    const mockRequest = {
      url: 'http://localhost/api/clubs/nonexistent/keys',
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });

  it('should apply the status filter while ignoring player_uid', async () => {
    const club = await createTestClub();
    const player1 = await createTestPlayer();
    const player2 = await createTestPlayer();
    await createClubMembership(club.uid, player1.uid);
    await createClubMembership(club.uid, player2.uid);

    const key1 = generateKey();
    const key2 = generateKey();
    const key3 = generateKey();
    await createTestKey(key1, player1.uid, club.uid, { status: 'active' });
    await createTestKey(key2, player1.uid, club.uid, { status: 'revoked' });
    await createTestKey(key3, player2.uid, club.uid, { status: 'active' });

    const mockRequest = {
      url: `http://localhost/api/clubs/${club.uid}/keys?player_uid=${player1.uid}&status=active`,
    } as any;

    const response = await GET(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.data.map((k: { key: string }) => k.key).sort()).toEqual([key1, key3].sort());
    expect(data.data.every((k: { status: string }) => k.status === 'active')).toBe(true);
  });
});
