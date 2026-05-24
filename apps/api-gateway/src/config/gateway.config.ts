import { registerAs } from '@nestjs/config';
import type {
  GatewayConfig,
  PublicRouteRule,
  RateLimitPolicy,
  RouteConfig,
} from './route-config.types';
import { parseBoolean, parseCsv, parseHttpUrl, parsePositiveInt } from './validation';

const publicRoutes: PublicRouteRule[] = [
  { method: 'GET', pathPattern: '/health', reason: 'gateway health' },
  { method: 'GET', pathPattern: '/api/docs*', reason: 'gateway and aggregate docs' },
  { method: 'POST', pathPattern: '/api/hr/auth/login', reason: 'signin' },
  { method: 'POST', pathPattern: '/api/hr/auth/signin', reason: 'signin alias' },
  { method: 'POST', pathPattern: '/api/hr/auth/refresh', reason: 'refresh token' },
  { method: 'POST', pathPattern: '/api/hr/auth/forgot-password', reason: 'password reset request' },
  { method: 'POST', pathPattern: '/api/hr/auth/invite/claim', reason: 'invite claim by scoped token' },
  { method: '*', pathPattern: '/api/social/exit-surveys/respond*', reason: 'exit survey scoped token' },
  { method: '*', pathPattern: '/api/social/exit-survey-responses*', reason: 'exit survey scoped token' },
];

export const DEFAULT_DEV_JWT_SECRET = 'change-me-in-production-minimum-32-random-characters';

function buildRoute(
  key: RouteConfig['key'],
  inboundPrefix: string,
  targetBaseUrl: string,
  timeoutMs: number,
  maxBodyBytes: number,
  defaultRateLimit: RateLimitPolicy,
): RouteConfig {
  return {
    key,
    inboundPrefix,
    targetBaseUrl,
    stripPrefix: true,
    timeoutMs,
    maxBodyBytes,
    publicRoutes: publicRoutes.filter((route) => route.pathPattern.startsWith(inboundPrefix)),
    rateLimit: defaultRateLimit,
    rateLimitOverrides: [],
  };
}

export const gatewayConfig = registerAs('gateway', (): GatewayConfig => {
  const timeoutMs = parsePositiveInt(
    process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS,
    15_000,
    'API_GATEWAY_UPSTREAM_TIMEOUT_MS',
  );
  const defaultJsonBodyLimitBytes = parsePositiveInt(
    process.env.API_GATEWAY_DEFAULT_JSON_BODY_LIMIT_BYTES,
    10 * 1024 * 1024,
    'API_GATEWAY_DEFAULT_JSON_BODY_LIMIT_BYTES',
  );
  const uploadBodyLimitBytes = parsePositiveInt(
    process.env.API_GATEWAY_UPLOAD_BODY_LIMIT_BYTES,
    50 * 1024 * 1024,
    'API_GATEWAY_UPLOAD_BODY_LIMIT_BYTES',
  );
  const authenticatedRateLimit: RateLimitPolicy = {
    windowMs: parsePositiveInt(
      process.env.API_GATEWAY_AUTH_RATE_LIMIT_WINDOW_MS,
      60_000,
      'API_GATEWAY_AUTH_RATE_LIMIT_WINDOW_MS',
    ),
    limit: parsePositiveInt(
      process.env.API_GATEWAY_AUTH_RATE_LIMIT_MAX,
      120,
      'API_GATEWAY_AUTH_RATE_LIMIT_MAX',
    ),
    keyMode: 'auto',
  };
  const publicRateLimit: RateLimitPolicy = {
    windowMs: parsePositiveInt(
      process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_WINDOW_MS,
      60_000,
      'API_GATEWAY_PUBLIC_RATE_LIMIT_WINDOW_MS',
    ),
    limit: parsePositiveInt(
      process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_MAX,
      30,
      'API_GATEWAY_PUBLIC_RATE_LIMIT_MAX',
    ),
    keyMode: 'ip',
  };

  const hr = buildRoute(
    'hr',
    '/api/hr',
    parseHttpUrl(process.env.HR_CORE_URL, 'http://localhost:3001', 'HR_CORE_URL'),
    timeoutMs,
    defaultJsonBodyLimitBytes,
    authenticatedRateLimit,
  );
  hr.rateLimitOverrides = [
    {
      key: 'signin',
      method: 'POST',
      pathPattern: '/api/hr/auth/login',
      windowMs: publicRateLimit.windowMs,
      limit: Math.min(publicRateLimit.limit, 10),
      keyMode: 'ip',
    },
    {
      key: 'signin-alias',
      method: 'POST',
      pathPattern: '/api/hr/auth/signin',
      windowMs: publicRateLimit.windowMs,
      limit: Math.min(publicRateLimit.limit, 10),
      keyMode: 'ip',
    },
  ];

  const social = buildRoute(
    'social',
    '/api/social',
    parseHttpUrl(process.env.SOCIAL_URL, 'http://localhost:3002', 'SOCIAL_URL'),
    timeoutMs,
    uploadBodyLimitBytes,
    authenticatedRateLimit,
  );
  social.rateLimitOverrides = [
    {
      key: 'document-upload',
      method: '*',
      pathPattern: '/api/social/documents*',
      windowMs: authenticatedRateLimit.windowMs,
      limit: 30,
      keyMode: 'auto',
    },
  ];

  const ai = buildRoute(
    'ai',
    '/api/ai',
    parseHttpUrl(process.env.AI_AGENTIC_URL, 'http://localhost:3003', 'AI_AGENTIC_URL'),
    timeoutMs * 2,
    defaultJsonBodyLimitBytes,
    authenticatedRateLimit,
  );
  ai.rateLimitOverrides = [
    {
      key: 'ai-streaming',
      method: '*',
      pathPattern: '/api/ai/conversations*',
      windowMs: authenticatedRateLimit.windowMs,
      limit: 60,
      keyMode: 'auto',
    },
  ];

  return {
    port: parsePositiveInt(process.env.API_GATEWAY_PORT, 3004, 'API_GATEWAY_PORT'),
    corsOrigins: parseCsv(process.env.API_GATEWAY_CORS_ORIGINS, ['http://localhost:3000']),
    trustProxy: parseBoolean(process.env.API_GATEWAY_TRUST_PROXY, false, 'API_GATEWAY_TRUST_PROXY'),
    jwtSecret: process.env.API_GATEWAY_JWT_SECRET ?? process.env.JWT_SECRET ?? DEFAULT_DEV_JWT_SECRET,
    defaultJsonBodyLimitBytes,
    uploadBodyLimitBytes,
    routes: [hr, social, ai],
    publicRoutes,
  };
});
