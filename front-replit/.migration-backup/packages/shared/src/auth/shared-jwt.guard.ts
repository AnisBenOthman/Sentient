import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from './jwt-payload.interface';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class SharedJwtGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: JwtPayload }>();
    const token = this.extractToken(request.headers);
    if (!token) throw new UnauthorizedException('Missing authorization token');

    // Try user JWT first; fall back to SYSTEM JWT so agents can call HR Core
    // with a short-lived SYSTEM token signed by a separate secret.
    const userSecret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = jwt.verify(token, userSecret) as JwtPayload;
      request.user = payload;
      return true;
    } catch {
      // Only attempt SYSTEM secret when the env var is configured
      const systemSecret = this.config.get<string>('SYSTEM_JWT_SECRET');
      if (!systemSecret) throw new UnauthorizedException('Invalid or expired token');

      try {
        const payload = jwt.verify(token, systemSecret) as JwtPayload;
        request.user = payload;
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }
  }

  private extractToken(headers: Record<string, string>): string | null {
    const auth = headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
