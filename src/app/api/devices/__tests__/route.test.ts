import { describe, it, expect } from 'vitest';
import { GET, POST } from '../route';
import { GET as GET_DEVICE, PUT, DELETE } from '../[uid]/route';
import { createTestClub, createTestDevice } from '@/test/test-helpers';
import { getTestDb } from '@/test/test-db';
import { devices } from '@/lib/schema';
import { eq } from 'drizzle-orm';

describe('GET /api/devices', () => {
  it('should list all devices', async () => {
    const club = await createTestClub();
    await createTestDevice(club.uid, { name: 'Device 1' });
    await createTestDevice(club.uid, { name: 'Device 2' });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.data).toHaveLength(2);
  });

  it('should return empty array when no devices exist', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(0);
    expect(data.data).toEqual([]);
  });
});

describe('POST /api/devices', () => {
  it('should create a new device', async () => {
    const club = await createTestClub();

    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: async () => JSON.stringify({
        name: 'iPad Pro',
        club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('iPad Pro');
    expect(data.data.club_id).toBe(club.uid);
    expect(data.data.uid).toBeTruthy();
  });

  it('should return 400 when name is missing', async () => {
    const club = await createTestClub();

    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: async () => JSON.stringify({
        club_id: club.uid,
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('name is required');
  });

  it('should return 400 when club_id is missing', async () => {
    const mockRequest = {
      headers: {
        get: (name: string) => (name === 'content-type' ? 'application/json' : null),
      },
      text: async () => JSON.stringify({
        name: 'Test Device',
      }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('club_id is required');
  });
});

describe('GET /api/devices/[uid]', () => {
  it('should get device by uid', async () => {
    const club = await createTestClub();
    const device = await createTestDevice(club.uid, { name: 'Test iPad' });

    const mockRequest = {} as any;
    const response = await GET_DEVICE(mockRequest, {
      params: Promise.resolve({ uid: device.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.uid).toBe(device.uid);
    expect(data.data.name).toBe('Test iPad');
  });

  it('should return 404 for non-existent device', async () => {
    const mockRequest = {} as any;
    const response = await GET_DEVICE(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Device not found');
  });
});

describe('PUT /api/devices/[uid]', () => {
  it('should update device', async () => {
    const club = await createTestClub();
    const device = await createTestDevice(club.uid, { name: 'Old Name' });

    const mockRequest = {
      json: async () => ({
        name: 'New Name',
        club_id: club.uid,
      }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: device.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('New Name');
    expect(data.data.updated_at).toBeTruthy();
  });

  it('should return 404 for non-existent device', async () => {
    const club = await createTestClub();

    const mockRequest = {
      json: async () => ({
        name: 'Test',
        club_id: club.uid,
      }),
    } as any;

    const response = await PUT(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Device not found');
  });
});

describe('DELETE /api/devices/[uid]', () => {
  it('should delete device', async () => {
    const db = getTestDb();
    const club = await createTestClub();
    const device = await createTestDevice(club.uid);

    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: device.uid }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Device deleted successfully');

    // Verify deletion
    const deviceRecords = await db.select().from(devices).where(eq(devices.uid, device.uid));
    expect(deviceRecords).toHaveLength(0);
  });

  it('should return 404 for non-existent device', async () => {
    const mockRequest = {} as any;
    const response = await DELETE(mockRequest, {
      params: Promise.resolve({ uid: 'nonexistent' }),
    });

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Device not found');
  });
});
