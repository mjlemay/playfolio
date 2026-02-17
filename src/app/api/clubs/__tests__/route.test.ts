import { describe, it, expect } from 'vitest';
import { GET, POST } from '../route';
import { GET as GET_CLUB, PUT, DELETE } from '../[uid]/route';
import { createTestClub, createTestPlayer, createClubMembership } from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { clubs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

describe('GET /api/clubs', () => {
  it('should list all clubs without members', async () => {
    await createTestClub({ displayName: 'Club 1', safeName: 'club-1' });
    await createTestClub({ displayName: 'Club 2', safeName: 'club-2' });
    await createTestClub({ displayName: 'Club 3', safeName: 'club-3' });

    const mockRequest = {
      url: 'http://localhost/api/clubs',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(3);
    expect(data.data).toHaveLength(3);
    expect(data.data[0].members).toBeUndefined();
  });

  it('should list clubs with members when includeMembers=true', async () => {
    const club = await createTestClub({ displayName: 'Test Club' });
    const player1 = await createTestPlayer();
    const player2 = await createTestPlayer();
    await createClubMembership(club.uid, player1.uid);
    await createClubMembership(club.uid, player2.uid);

    const mockRequest = {
      url: 'http://localhost/api/clubs?includeMembers=true',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(1);
    expect(data.data[0].members).toHaveLength(2);
    expect(data.data[0].members[0].player).toBeTruthy();
  });

  it('should return empty array when no clubs exist', async () => {
    const mockRequest = {
      url: 'http://localhost/api/clubs',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.data).toEqual([]);
  });
});

describe('POST /api/clubs', () => {
  it('should create a new club with admin key', async () => {
    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'x-admin-key' ? 'test-admin-key' : null),
      },
      json: async () => ({
        displayName: 'New Club',
        safeName: 'new-club',
        meta: { location: 'Test City' },
        status: 'present',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.uid).toBeTruthy();
    expect(data.data.displayName).toBe('New Club');
    expect(data.data.safeName).toBe('new-club');
    expect(data.data.meta).toEqual({ location: 'Test City' });
    expect(data.data.status).toBe('present');
  });

  it('should return 401 when admin key is missing', async () => {
    const mockRequest = {
      headers: {
        get: () => null,
      },
      json: async () => ({
        displayName: 'New Club',
        safeName: 'new-club',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('x-admin-key header is required');
  });

  it('should return 403 when admin key is invalid', async () => {
    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'x-admin-key' ? 'wrong-key' : null),
      },
      json: async () => ({
        displayName: 'New Club',
        safeName: 'new-club',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid admin key');
  });

  it('should create club with auto-generated ID', async () => {
    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'x-admin-key' ? 'test-admin-key' : null),
      },
      json: async () => ({
        displayName: 'Test Club',
        safeName: 'test-club',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.uid).toBeTruthy();
    expect(data.data.uid).toHaveLength(12);
  });
});

describe('GET /api/clubs/[uid]', () => {
  it('should get club with members', async () => {
    const club = await createTestClub({ displayName: 'Test Club' });
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const mockRequest = {} as any;
    const response = await GET_CLUB(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.uid).toBe(club.uid);
    expect(data.data.displayName).toBe('Test Club');
    expect(data.data.members).toHaveLength(1);
    expect(data.data.members[0].player.uid).toBe(player.uid);
  });

  it('should return 404 for non-existent club', async () => {
    const mockRequest = {} as any;
    const response = await GET_CLUB(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent-club' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });

  it('should return club with empty members array', async () => {
    const club = await createTestClub();

    const mockRequest = {} as any;
    const response = await GET_CLUB(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.members).toEqual([]);
  });
});

describe('PUT /api/clubs/[uid]', () => {
  it('should update club data', async () => {
    const club = await createTestClub({
      displayName: 'Original Name',
      safeName: 'original',
    });

    const mockRequest = {
      json: async () => ({
        displayName: 'Updated Name',
        safeName: 'updated',
        meta: { city: 'New City' },
        status: 'active',
      }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.displayName).toBe('Updated Name');
    expect(data.data.safeName).toBe('updated');
    expect(data.data.meta).toEqual({ city: 'New City' });
    expect(data.data.updated_at).toBeTruthy();
  });

  it('should return 404 when updating non-existent club', async () => {
    const mockRequest = {
      json: async () => ({
        displayName: 'Test',
        safeName: 'test',
      }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });
});

describe('DELETE /api/clubs/[uid]', () => {
  it('should delete a club', async () => {
    const db = getTestDb();
    const club = await createTestClub();

    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Club deleted successfully');

    // Verify deletion
    const clubRecords = await db.select().from(clubs).where(eq(clubs.uid, club.uid));
    expect(clubRecords).toHaveLength(0);
  });

  it('should delete club and their memberships', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: club.uid }),
    });

    expect(response.status).toBe(200);

    // Verify club deleted
    const db = getTestDb();
    const clubRecords = await db.select().from(clubs).where(eq(clubs.uid, club.uid));
    expect(clubRecords).toHaveLength(0);
  });

  it('should return 404 when deleting non-existent club', async () => {
    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Club not found');
  });
});
