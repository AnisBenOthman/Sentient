import { PublicRouteMatcher } from './public-route.matcher';
import type { PublicRouteRule } from '../../config/route-config.types';

describe('PublicRouteMatcher', () => {
  const matcher = new PublicRouteMatcher();
  const rules: PublicRouteRule[] = [
    { method: 'POST', pathPattern: '/api/hr/auth/login', reason: 'login' },
    { method: 'POST', pathPattern: '/api/hr/auth/refresh', reason: 'refresh' },
    { method: 'POST', pathPattern: '/api/hr/auth/forgot-password', reason: 'forgot password' },
    { method: '*', pathPattern: '/health', reason: 'health' },
    { method: 'GET', pathPattern: '/api/docs*', reason: 'docs' },
    { method: '*', pathPattern: '/api/social/exit-surveys/respond*', reason: 'scoped token' },
  ];

  it.each([
    ['POST', '/api/hr/auth/login'],
    ['POST', '/api/hr/auth/refresh'],
    ['POST', '/api/hr/auth/forgot-password'],
    ['GET', '/health'],
    ['GET', '/api/docs'],
    ['GET', '/api/docs-json'],
    ['POST', '/api/social/exit-surveys/respond/abc123'],
  ])('matches public route %s %s', (method, path) => {
    expect(matcher.isPublic(method, path, rules)).toBe(true);
  });

  it('does not broaden method-specific public routes', () => {
    expect(matcher.isPublic('GET', '/api/hr/auth/login', rules)).toBe(false);
  });
});

