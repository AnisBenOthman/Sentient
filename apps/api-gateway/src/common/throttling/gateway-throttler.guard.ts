import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import { gatewayConfig } from '../../config/gateway.config';
import type { RateLimitOverride, RateLimitPolicy, RouteConfig } from '../../config/route-config.types';
import type { GatewayRequest } from '../correlation/correlation-context';
import { GatewayErrorCode } from '../errors/error-envelope';
import { PublicRouteMatcher } from '../auth/public-route.matcher';
import { RateLimitKeyFactory } from './rate-limit-key.factory';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class GatewayThrottlerGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    @Inject(gatewayConfig.KEY)
    private readonly config: ConfigType<typeof gatewayConfig>,
    private readonly keyFactory: RateLimitKeyFactory,
    private readonly matcher: PublicRouteMatcher,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>() as GatewayRequest;
    const response = context.switchToHttp().getResponse<Response>();
    const route = this.matchRoute(request.path);
    if (!route) return true;

    const override = route.rateLimitOverrides.find((candidate) => this.matchesOverride(request.method, request.path, candidate));
    const policy = this.mergePolicy(route.rateLimit, override);
    const key = this.keyFactory.create({
      routeKey: route.key,
      keyMode: policy.keyMode,
      overrideKey: override?.key,
      request,
    });

    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count <= policy.limit) return true;

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    response.setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException(
      {
        code: GatewayErrorCode.RateLimitExceeded,
        message: 'Too many requests. Please retry later.',
        details: {
          routeKey: route.key,
          retryAfterSeconds,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private matchRoute(path: string): RouteConfig | undefined {
    return this.config.routes.find((route) => path === route.inboundPrefix || path.startsWith(`${route.inboundPrefix}/`));
  }

  private mergePolicy(defaultPolicy: RateLimitPolicy, override: RateLimitOverride | undefined): RateLimitPolicy {
    return {
      windowMs: override?.windowMs ?? defaultPolicy.windowMs,
      limit: override?.limit ?? defaultPolicy.limit,
      keyMode: override?.keyMode ?? defaultPolicy.keyMode,
    };
  }

  private matchesOverride(method: string, path: string, override: RateLimitOverride): boolean {
    if (override.method !== '*' && override.method !== method.toUpperCase()) return false;
    return this.matcher.matchesPath(path, override.pathPattern);
  }
}
