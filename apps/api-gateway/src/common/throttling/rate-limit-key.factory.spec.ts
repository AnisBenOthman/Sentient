import { RateLimitKeyFactory } from './rate-limit-key.factory';

describe('RateLimitKeyFactory', () => {
  const factory = new RateLimitKeyFactory();

  it('uses authenticated user for auto mode when present', () => {
    const key = factory.create({
      routeKey: 'hr',
      keyMode: 'auto',
      overrideKey: 'default',
      request: {
        headers: {},
        ip: '127.0.0.1',
        correlation: { correlationId: 'c', startedAt: 1, userId: 'user-1' },
      } as never,
    });

    expect(key).toBe('hr:auto:user-1:default');
  });

  it('uses forwarded IP for public buckets', () => {
    const key = factory.create({
      routeKey: 'social',
      keyMode: 'ip',
      overrideKey: 'public',
      request: {
        headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
        ip: '127.0.0.1',
      } as never,
    });

    expect(key).toBe('social:ip:203.0.113.1:public');
  });
});

