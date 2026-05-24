import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { TokenExpiredError, verify } from 'jsonwebtoken';
import { gatewayConfig } from '../../config/gateway.config';
import type { JwtClaims } from './jwt-claims.interface';
import { PublicRouteMatcher } from './public-route.matcher';
import type { GatewayRequest } from '../correlation/correlation-context';
import { GatewayErrorCode } from '../errors/error-envelope';

@Injectable()
export class GatewayJwtGuard implements CanActivate {
  constructor(
    @Inject(gatewayConfig.KEY)
    private readonly config: ConfigType<typeof gatewayConfig>,
    private readonly publicRouteMatcher: PublicRouteMatcher,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>() as GatewayRequest;
    const path = request.path;

    if (this.publicRouteMatcher.isPublic(request.method, path, this.config.publicRoutes)) {
      return true;
    }

    if (path.startsWith('/api/') && !this.matchesConfiguredUpstream(path)) {
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: GatewayErrorCode.MissingAuthorization,
        message: 'Authorization header is required.',
      });
    }

    try {
      const decoded = verify(token, this.config.jwtSecret);
      if (!this.isJwtClaims(decoded)) {
        throw new UnauthorizedException({
          code: GatewayErrorCode.JwtInvalid,
          message: 'JWT payload is invalid.',
        });
      }

      request.correlation = {
        ...(request.correlation ?? { correlationId: 'unknown', startedAt: Date.now() }),
        userId: decoded.sub,
        roleHints: this.extractRoles(decoded),
      };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          code: GatewayErrorCode.JwtExpired,
          message: 'JWT has expired.',
        });
      }

      throw new UnauthorizedException({
        code: GatewayErrorCode.JwtInvalid,
        message: 'JWT signature or payload is invalid.',
      });
    }
  }

  private isJwtClaims(value: unknown): value is JwtClaims {
    return typeof value === 'object' && value !== null && typeof (value as JwtClaims).sub === 'string';
  }

  private extractRoles(claims: JwtClaims): string[] | undefined {
    if (Array.isArray(claims.roles)) return claims.roles.filter((role): role is string => typeof role === 'string');
    if (typeof claims.role === 'string') return [claims.role];
    return undefined;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header) {
      const match = /^Bearer\s+(.+)$/i.exec(header);
      if (!match?.[1]) {
        throw new UnauthorizedException({
          code: GatewayErrorCode.MalformedAuthorization,
          message: 'Authorization header must use the Bearer scheme.',
        });
      }
      return match[1];
    }

    if (request.path === '/api/hr/notifications/stream') {
      const accessToken = request.query.accessToken;
      if (typeof accessToken === 'string' && accessToken.trim().length > 0) {
        return accessToken;
      }
    }

    return undefined;
  }

  private matchesConfiguredUpstream(path: string): boolean {
    return this.config.routes.some((route) => path === route.inboundPrefix || path.startsWith(`${route.inboundPrefix}/`));
  }
}
