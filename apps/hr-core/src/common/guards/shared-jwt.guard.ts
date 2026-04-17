import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@sentient/shared';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SharedJwtGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: JwtPayload;
    }>();

    const token = this.extractToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }

    try {
      // WHY: JWT verification is centralised here so all 3 services share the
      // same validation logic. HR Core issues tokens; Social and AI Agentic
      // validate using the same shared secret — no second user table needed.
      const payload = jwt.verify(token, secret) as JwtPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(authorization: string | undefined): string | null {
    if (!authorization) return null;
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
  }
}
