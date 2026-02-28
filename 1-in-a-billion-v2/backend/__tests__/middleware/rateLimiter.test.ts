/**
 * Tests for rate limiter middleware
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Next } from 'hono';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

describe('createRateLimiter', () => {
  const mockNext = jest.fn<Next>();
  const mockHeader = jest.fn();
  const mockJson = jest.fn().mockReturnValue(new Response());

  function createMockContext(ip = '127.0.0.1') {
    return {
      req: {
        header: (name: string) => {
          if (name === 'x-forwarded-for') return ip;
          return undefined;
        },
      },
      json: mockJson,
      header: mockHeader,
      get: jest.fn(),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests within the rate limit', async () => {
    const limiter = createRateLimiter('test-allow', {
      windowMs: 60_000,
      maxRequests: 5,
    });

    const c = createMockContext();
    await limiter(c, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('should block requests exceeding the rate limit', async () => {
    const limiter = createRateLimiter('test-block', {
      windowMs: 60_000,
      maxRequests: 2,
    });

    const c1 = createMockContext('1.2.3.4');
    const c2 = createMockContext('1.2.3.4');
    const c3 = createMockContext('1.2.3.4');

    await limiter(c1, mockNext);
    await limiter(c2, mockNext);

    // Reset mock to check the third call
    mockJson.mockClear();
    mockNext.mockClear();

    await limiter(c3, mockNext);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      429
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should track different IPs separately', async () => {
    const limiter = createRateLimiter('test-ips', {
      windowMs: 60_000,
      maxRequests: 1,
    });

    const c1 = createMockContext('10.0.0.1');
    const c2 = createMockContext('10.0.0.2');

    await limiter(c1, mockNext);
    mockNext.mockClear();

    await limiter(c2, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should set rate limit headers', async () => {
    const limiter = createRateLimiter('test-headers', {
      windowMs: 60_000,
      maxRequests: 10,
    });

    const c = createMockContext('5.5.5.5');
    await limiter(c, mockNext);

    expect(mockHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(mockHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
  });
});
