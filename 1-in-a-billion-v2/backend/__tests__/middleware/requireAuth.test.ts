/**
 * Tests for requireAuth middleware
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Next } from 'hono';

// Mock the supabaseClient module
jest.mock('../../src/services/supabaseClient', () => ({
  createSupabaseUserClientFromAccessToken: jest.fn(),
}));

import { createSupabaseUserClientFromAccessToken } from '../../src/services/supabaseClient';

describe('requireAuth middleware', () => {
  const mockJson = jest.fn().mockReturnValue(new Response());
  const mockNext = jest.fn<Next>();
  const mockSet = jest.fn();

  function createMockContext(headers: Record<string, string> = {}) {
    return {
      req: {
        header: (name: string) => headers[name] || headers[name.toLowerCase()] || undefined,
      },
      json: mockJson,
      set: mockSet,
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no Authorization header is present', async () => {
    const { requireAuth } = await import('../../src/middleware/requireAuth');
    const c = createMockContext({});

    await requireAuth(c, mockNext);

    expect(mockJson).toHaveBeenCalledWith(
      { success: false, error: 'Missing authorization token' },
      401
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    const { requireAuth } = await import('../../src/middleware/requireAuth');

    const mockClient = {
      auth: {
        getUser: jest.fn<any>().mockResolvedValue({
          data: { user: null },
          error: new Error('Invalid token'),
        }),
      },
    };
    (createSupabaseUserClientFromAccessToken as jest.Mock).mockReturnValue(mockClient);

    const c = createMockContext({ 'Authorization': 'Bearer invalid-token' });

    await requireAuth(c, mockNext);

    expect(mockJson).toHaveBeenCalledWith(
      { success: false, error: 'Invalid or expired token' },
      401
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set userId and call next when token is valid', async () => {
    const { requireAuth } = await import('../../src/middleware/requireAuth');

    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockClient = {
      auth: {
        getUser: jest.fn<any>().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
    };
    (createSupabaseUserClientFromAccessToken as jest.Mock).mockReturnValue(mockClient);

    const c = createMockContext({ 'Authorization': 'Bearer valid-token' });

    await requireAuth(c, mockNext);

    expect(mockSet).toHaveBeenCalledWith('userId', 'user-123');
    expect(mockNext).toHaveBeenCalled();
  });
});
