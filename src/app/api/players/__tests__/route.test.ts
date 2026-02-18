import { describe, it, expect } from 'vitest';
import { GET, POST } from '../route';
import { GET as GET_PLAYER, PUT, DELETE } from '../[uid]/route';
import { createTestPlayer, createTestClub, createClubMembership } from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { players } from '@/lib/schema';
import { eq } from 'drizzle-orm';

describe('GET /api/players', () => {
  it('should list all players', async () => {
    await createTestPlayer({ meta: { name: 'Player 1' } });
    await createTestPlayer({ meta: { name: 'Player 2' } });
    await createTestPlayer({ meta: { name: 'Player 3' } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(3);
    expect(data.data).toHaveLength(3);
  });

  it('should return empty array when no players exist', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.data).toEqual([]);
  });
});

describe('POST /api/players', () => {
  it('should create a new player', async () => {
    const mockRequest = {
      json: async () => ({
        meta: { name: 'John Doe', age: '25' },
        status: 'present',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.uid).toBeTruthy();
    expect(data.data.meta).toEqual({ name: 'John Doe', age: '25' });
    expect(data.data.status).toBe('present');
    expect(data.data.created_at).toBeTruthy();
  });

  it('should create player with minimal data', async () => {
    const mockRequest = {
      json: async () => ({}),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.meta).toBeNull();
    expect(data.data.status).toBeNull();
  });

  it('should auto-generate UUID for player', async () => {
    const mockRequest = {
      json: async () => ({}),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should create multiple players with unique UIDs', async () => {
    const request1 = { json: async () => ({}) } as any;
    const request2 = { json: async () => ({}) } as any;

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(data1.data.uid).not.toBe(data2.data.uid);
  });
});

describe('GET /api/players/[uid]', () => {
  it('should get player with memberships', async () => {
    const player = await createTestPlayer({ meta: { name: 'Test Player' } });
    const club = await createTestClub();
    await createClubMembership(club.uid, player.uid);

    const mockRequest = {} as any;
    const response = await GET_PLAYER(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.uid).toBe(player.uid);
    expect(data.data.meta).toEqual({ name: 'Test Player' });
    expect(data.data.clubMemberships).toHaveLength(1);
    expect(data.data.clubMemberships[0].club.uid).toBe(club.uid);
    expect(data.data.squadMemberships).toHaveLength(0);
  });

  it('should return 404 for non-existent player', async () => {
    const mockRequest = {} as any;
    const response = await GET_PLAYER(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent-player' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Player not found');
  });

  it('should return player with empty memberships', async () => {
    const player = await createTestPlayer();

    const mockRequest = {} as any;
    const response = await GET_PLAYER(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.clubMemberships).toEqual([]);
    expect(data.data.squadMemberships).toEqual([]);
  });
});

describe('PUT /api/players/[uid]', () => {
  it('should update player data', async () => {
    const player = await createTestPlayer({
      meta: { name: 'Original Name' },
      status: 'present',
    });

    const mockRequest = {
      json: async () => ({
        meta: { name: 'Updated Name', nickname: 'Nick' },
        status: 'absent',
      }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.meta).toEqual({ name: 'Updated Name', nickname: 'Nick' });
    expect(data.data.status).toBe('absent');
    expect(data.data.updated_at).toBeTruthy();
  });

  it('should return 404 when updating non-existent player', async () => {
    const mockRequest = {
      json: async () => ({ meta: { name: 'Test' } }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent-player' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Player not found');
  });

  it('should update partial fields', async () => {
    const player = await createTestPlayer({ meta: { name: 'John' } });

    const mockRequest = {
      json: async () => ({ meta: { name: 'Jane' } }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.meta).toEqual({ name: 'Jane' });
  });
});

describe('DELETE /api/players/[uid]', () => {
  it('should delete a player', async () => {
    const db = getTestDb();
    const player = await createTestPlayer();

    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Player deleted successfully');

    const playerRecords = await db.select().from(players).where(eq(players.uid, player.uid));
    expect(playerRecords).toHaveLength(0);
  });

  it('should delete player and their memberships', async () => {
    const db = getTestDb();
    const player = await createTestPlayer();
    const club = await createTestClub();
    await createClubMembership(club.uid, player.uid);

    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: player.uid }),
    });

    expect(response.status).toBe(200);

    const playerRecords = await db.select().from(players).where(eq(players.uid, player.uid));
    expect(playerRecords).toHaveLength(0);
  });

  it('should return 404 when deleting non-existent player', async () => {
    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent-player' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Player not found');
  });
});
