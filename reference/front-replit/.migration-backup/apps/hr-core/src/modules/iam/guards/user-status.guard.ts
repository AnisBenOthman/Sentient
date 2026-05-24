import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload, UserStatus, IS_PUBLIC_KEY } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';

interface CacheEntry {
  status: UserStatus;
  cachedAt: number;
}

interface SessionCacheEntry {
  revoked: boolean;
  cachedAt: number;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_SIZE = 10_000;

@Injectable()
export class UserStatusGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly sessionCache = new Map<string, SessionCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) return true;

    // --- User status check (cached per userId) ---
    const cachedUser = this.cache.get(user.sub);
    if (cachedUser && Date.now() - cachedUser.cachedAt < CACHE_TTL_MS) {
      this.assertStatus(cachedUser.status);
    } else {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { status: true },
      });
      if (!dbUser) throw new UnauthorizedException('User not found');

      const status = dbUser.status as UserStatus;
      this.setWithEviction(this.cache, user.sub, { status, cachedAt: Date.now() });
      this.assertStatus(status);
    }

    // --- Session revocation check (skip for SYSTEM tokens — sub === 'system') ---
    if (user.sessionId && user.sub !== 'system') {
      await this.assertSessionActive(user.sessionId);
    }

    return true;
  }

  /** Evict userId from the user-status cache — call on logout / status change. */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /** Evict sessionId from the session cache — call on explicit revocation. */
  invalidateSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  private async assertSessionActive(sessionId: string): Promise<void> {
    const cached = this.sessionCache.get(sessionId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      if (cached.revoked) throw new UnauthorizedException('Session has been revoked');
      return;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true },
    });
    if (!session) throw new UnauthorizedException('Session not found');

    const revoked = session.revokedAt !== null;
    this.setWithEviction(this.sessionCache, sessionId, { revoked, cachedAt: Date.now() });

    if (revoked) throw new UnauthorizedException('Session has been revoked');
  }

  private setWithEviction<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.size >= CACHE_MAX_SIZE) {
      // Map preserves insertion order — delete the oldest entry
      map.delete(map.keys().next().value!);
    }
    map.set(key, value);
  }

  private assertStatus(status: UserStatus): void {
    switch (status) {
      case UserStatus.ACTIVE:
        return;
      case UserStatus.LOCKED:
        throw new UnauthorizedException('Account is locked');
      case UserStatus.DISABLED:
        throw new ForbiddenException('Account is disabled');
      case UserStatus.PENDING_ACTIVATION:
        throw new UnauthorizedException('Account is not yet activated');
    }
  }
}
