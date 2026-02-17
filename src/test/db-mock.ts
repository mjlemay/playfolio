import { vi } from 'vitest';

// Mock database instance
export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
};

// Helper to reset all mocks
export function resetDbMocks() {
  Object.values(mockDb).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
      if (mock !== mockDb.returning) {
        mock.mockReturnThis();
      }
    }
  });
}

// Mock data factories
export const mockPlayer = {
  uid: '550e8400-e29b-41d4-a716-446655440000',
  meta: { name: 'Test Player' },
  status: 'present' as const,
  created_at: new Date('2024-01-01'),
  updated_at: null,
  pin: 1234,
};

export const mockClub = {
  uid: 'abc123def456',
  displayName: 'Test Club',
  safeName: 'test-club',
  meta: null,
  status: null,
  created_at: new Date('2024-01-01'),
  updated_at: null,
};

export const mockClubPlayer = {
  club_id: 'abc123def456',
  player_uid: '550e8400-e29b-41d4-a716-446655440000',
  joined_date: new Date('2024-01-01'),
  role: 'member',
  status: 'present' as const,
};

export const mockKey = {
  key: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  player_uid: '550e8400-e29b-41d4-a716-446655440000',
  originating_club_id: 'abc123def456',
  status: 'active',
  meta: null,
  expires_at: null,
  created_at: new Date('2024-01-01'),
  revoked_at: null,
  last_used_at: null,
  usage_count: 0,
};
