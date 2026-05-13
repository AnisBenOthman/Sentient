import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '@sentient/shared';

interface SseRequest {
  headers: Record<string, string | undefined>;
  query: { accessToken?: string };
  user?: JwtPayload;
}

@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SseRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authorization token');

    const userSecret = this.config.getOrThrow<string>('JWT_SECRET');
    try {
      request.user = jwt.verify(token, userSecret) as JwtPayload;
      return true;
    } catch {
      const systemSecret = this.config.get<string>('SYSTEM_JWT_SECRET');
      if (!systemSecret) throw new UnauthorizedException('Invalid or expired token');
      try {
        request.user = jwt.verify(token, systemSecret) as JwtPayload;
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }
  }

  private extractToken(request: SseRequest): string | null {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return request.query.accessToken ?? null;
  }
}
