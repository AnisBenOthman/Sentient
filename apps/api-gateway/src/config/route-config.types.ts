export type RouteKey = 'hr' | 'social' | 'ai';
export type RateLimitKeyMode = 'authenticated-user' | 'ip' | 'auto';
export type PublicRouteMethod = '*' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface PublicRouteRule {
  method: PublicRouteMethod;
  pathPattern: string;
  reason: string;
}

export interface RateLimitPolicy {
  windowMs: number;
  limit: number;
  keyMode: RateLimitKeyMode;
}

export interface RateLimitOverride extends Partial<RateLimitPolicy> {
  key: string;
  method: PublicRouteMethod;
  pathPattern: string;
}

export interface RouteConfig {
  key: RouteKey;
  inboundPrefix: string;
  targetBaseUrl: string;
  stripPrefix: boolean;
  timeoutMs: number;
  maxBodyBytes: number;
  publicRoutes: PublicRouteRule[];
  rateLimit: RateLimitPolicy;
  rateLimitOverrides: RateLimitOverride[];
}

export interface GatewayConfig {
  port: number;
  corsOrigins: string[];
  jwtSecret: string;
  defaultJsonBodyLimitBytes: number;
  uploadBodyLimitBytes: number;
  routes: RouteConfig[];
  publicRoutes: PublicRouteRule[];
}

export interface MatchedRoute {
  route: RouteConfig;
  downstreamPath: string;
}

