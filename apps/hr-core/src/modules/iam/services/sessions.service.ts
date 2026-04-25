import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ChannelType } from '@sentient/shared';
import { Session } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService } from './token.service';

const GRACE_WINDOW_MS = 30_000;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async create(
    userId: string,
    channel: ChannelType,
    accessToken: string,
    refreshToken: string,
  ): Promise<Session> {
    const accessTokenHash = this.tokens.hashToken(accessToken);
    const refreshTokenHash = this.tokens.hashToken(refreshToken);
    const expiresAt = this.tokens.refreshTokenExpiresAt();

    return this.prisma.session.create({
      data: {
        userId,
        channel,
        accessTokenHash,
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  async findByRefreshHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async rotate(
    session: Session,
    newAccessToken: string,
    newRefreshToken: string,
  ): Promise<{ idempotent: boolean; session: Session }> {
    const newRefreshHash = this.tokens.hashToken(newRefreshToken);
    const newAccessHash = this.tokens.hashToken(newAccessToken);
    const updated = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        accessTokenHash: newAccessHash,
        refreshTokenHash: newRefreshHash,
        previousTokenHash: session.refreshTokenHash,
        previousRotatedAt: new Date(),
        expiresAt: this.tokens.refreshTokenExpiresAt(),
      },
    });
    return { idempotent: false, session: updated };
  }

  // Returns the current session (to re-issue tokens from) if within grace window.
  // Revokes and throws if the token was replayed outside the grace window.
  // Returns null if no session matches the previous hash at all.
  async handleGraceWindow(incomingRefreshHash: string): Promise<Session | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        revokedAt: null,
        previousTokenHash: incomingRefreshHash,
      },
    });
    if (!session) return null;

    const age = Date.now() - (session.previousRotatedAt?.getTime() ?? 0);
    if (age <= GRACE_WINDOW_MS) {
      return session;
    }

    // Replay detected outside grace window — revoke entire channel
    await this.revokeChannel(session.userId, session.channel as unknown as ChannelType);
    throw new UnauthorizedException('Session replay detected');
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByIdForUser(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeChannel(userId: string, channel: ChannelType): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, channel, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
