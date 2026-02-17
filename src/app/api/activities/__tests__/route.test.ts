import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import {
  createTestClub,
  createTestPlayer,
  createClubMembership,
  createTestKey,
} from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { activities, clubKeys } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateKey } from '@/lib/keychain';

describe('POST /api/activities (keychain integration)', () => {
  it('should create activity with direct player_uid', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();

    const mockRequest = {
      json: async () => ({
        player_uid: player.uid,
        club_id: club.uid,
        meta: { type: 'training' },
        format: 'session',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.player_uid).toBe(player.uid);
    expect(data.data.club_id).toBe(club.uid);
    expect(data.data.meta).toEqual({ type: 'training' });
    expect(data.data.format).toBe('session');
  });

  it('should create activity using key resolution', async () => {
    const clubA = await createTestClub({ uid: 'club-a' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const player = await createTestPlayer();
    await createClubMembership(clubA.uid, player.uid);

    // Club A creates key for player
    const key = generateKey();
    await createTestKey(key, player.uid, clubA.uid);

    // Club B uses key to create activity
    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: clubA.uid,
        club_id: clubB.uid,
        meta: { type: 'match', tournament: 'Summer Cup' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.player_uid).toBe(player.uid); // Resolved from key
    expect(data.data.club_id).toBe(clubB.uid);
    expect(data.data.meta).toEqual({ type: 'match', tournament: 'Summer Cup' });
    expect(data.data.format).toBe('tournament');
  });

  it('should increment key usage_count when creating activity', async () => {
    const db = getTestDb();
    const clubA = await createTestClub({ uid: 'club-a' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const player = await createTestPlayer();
    await createClubMembership(clubA.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, clubA.uid);

    // Create activity using key
    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: clubA.uid,
        club_id: clubB.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    await POST(mockRequest);

    // Verify usage tracking
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.usage_count).toBe(1);
    expect(keyRecord.last_used_at).toBeTruthy();
  });

  it('should return 400 if key resolution fails', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        key: 'invalid-key',
        originating_club_id: club.uid,
        club_id: club.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Key not found or invalid originating club');
  });

  it('should return 400 if neither player_uid nor key provided', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        club_id: club.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Either player_uid or (key + originating_club_id) required');
  });

  it('should return 400 if key provided without originating_club_id', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        key: 'some-key',
        club_id: club.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Either player_uid or (key + originating_club_id) required');
  });

  it('should reject revoked key when creating activity', async () => {
    const clubA = await createTestClub({ uid: 'club-a' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const player = await createTestPlayer();
    await createClubMembership(clubA.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, clubA.uid, { status: 'revoked' });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: clubA.uid,
        club_id: clubB.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Key has been revoked');
  });

  it('should reject expired key when creating activity', async () => {
    const clubA = await createTestClub({ uid: 'club-a' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const player = await createTestPlayer();
    await createClubMembership(clubA.uid, player.uid);

    const key = generateKey();
    const pastDate = new Date('2020-01-01');
    await createTestKey(key, player.uid, clubA.uid, { expires_at: pastDate });

    const mockRequest = {
      json: async () => ({
        key,
        originating_club_id: clubA.uid,
        club_id: clubB.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Key has expired');
  });

  it('should prefer key resolution when both player_uid and key provided', async () => {
    const clubA = await createTestClub({ uid: 'club-a' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const player1 = await createTestPlayer({ uid: 'player-1' });
    const player2 = await createTestPlayer({ uid: 'player-2' });
    await createClubMembership(clubA.uid, player1.uid);

    const key = generateKey();
    await createTestKey(key, player1.uid, clubA.uid);

    const mockRequest = {
      json: async () => ({
        player_uid: player2.uid, // Should be ignored
        key,
        originating_club_id: clubA.uid,
        club_id: clubB.uid,
        meta: { type: 'match' },
        format: 'tournament',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.player_uid).toBe(player1.uid); // From key, not direct player_uid
  });

  it('should support cross-club tournament workflow', async () => {
    // Real-world scenario: Tournament organizer (Club A) creates keys for players,
    // participating clubs (B, C) use keys to track activities

    const tournamentOrganizer = await createTestClub({ uid: 'tournament-org' });
    const clubB = await createTestClub({ uid: 'club-b' });
    const clubC = await createTestClub({ uid: 'club-c' });

    const player = await createTestPlayer();
    await createClubMembership(tournamentOrganizer.uid, player.uid);

    // Organizer creates key
    const key = generateKey();
    await createTestKey(key, player.uid, tournamentOrganizer.uid, {
      meta: { tournament: 'Summer Cup 2026' },
    });

    // Club B creates activity using key
    const requestB = {
      json: async () => ({
        key,
        originating_club_id: tournamentOrganizer.uid,
        club_id: clubB.uid,
        meta: { match: 'semi-final', opponent: 'Club C' },
        format: 'tournament',
      }),
    } as any;

    const responseB = await POST(requestB);
    const dataB = await responseB.json();

    // Club C creates activity using same key
    const requestC = {
      json: async () => ({
        key,
        originating_club_id: tournamentOrganizer.uid,
        club_id: clubC.uid,
        meta: { match: 'final' },
        format: 'tournament',
      }),
    } as any;

    const responseC = await POST(requestC);
    const dataC = await responseC.json();

    expect(responseB.status).toBe(201);
    expect(responseC.status).toBe(201);
    expect(dataB.data.player_uid).toBe(player.uid);
    expect(dataC.data.player_uid).toBe(player.uid);
    expect(dataB.data.club_id).toBe(clubB.uid);
    expect(dataC.data.club_id).toBe(clubC.uid);

    // Verify key was used twice
    const db = getTestDb();
    const [keyRecord] = await db.select().from(clubKeys).where(eq(clubKeys.key, key));
    expect(keyRecord.usage_count).toBe(2);
  });

  it('should maintain backward compatibility with direct player_uid', async () => {
    // Ensure existing API usage (without keys) still works
    const club = await createTestClub();
    const player = await createTestPlayer();

    const mockRequest = {
      json: async () => ({
        player_uid: player.uid,
        club_id: club.uid,
        meta: {},
        format: 'session',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.player_uid).toBe(player.uid);
  });
});
