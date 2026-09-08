import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'crypto';
import { ChannelType, PermissionScope, SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginResponseDto } from '../iam/dto/login-response.dto';
import { AuditService } from '../iam/services/audit.service';
import { TokenService } from '../iam/services/token.service';
import { ChannelIdentityResponseDto } from './dto/channel-identity-response.dto';
import { ExchangeChannelIdentityDto } from './dto/exchange-channel-identity.dto';
import { LinkCodeResponseDto } from './dto/link-code-response.dto';
import { RedeemLinkCodeDto } from './dto/redeem-link-code.dto';

@Injectable()
export class ChannelIdentitiesService {
  private readonly linkCodeExpiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.linkCodeExpiryMinutes = config.get<number>('CHANNEL_LINK_CODE_EXPIRY_MINUTES') ?? 10;
  }

  // ============================================================
  // Step 1 — authenticated web session requests a one-time code
  // ============================================================
  async generateLinkCode(userId: string, channel: ChannelType): Promise<LinkCodeResponseDto> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.tokens.hashToken(code);
    const expiresAt = new Date(Date.now() + this.linkCodeExpiryMinutes * 60_000);

    // Only one active code per user+channel at a time — mirrors InviteService.issue().
    await this.prisma.channelLinkCode.deleteMany({ where: { userId, channel, consumedAt: null } });
    await this.prisma.channelLinkCode.create({ data: { userId, channel, codeHash, expiresAt } });

    return { code, expiresAt };
  }

  // ============================================================
  // Step 2 — bot (SYSTEM-authenticated) redeems the code to create the link
  // ============================================================
  async redeemLinkCode(dto: RedeemLinkCodeDto): Promise<void> {
    const codeHash = this.tokens.hashToken(dto.code);

    await this.prisma.$transaction(async (tx) => {
      // Atomic: updateMany marks the code consumed in one SQL UPDATE, so two
      // concurrent redemptions of the same code can't both succeed.
      const { count } = await tx.channelLinkCode.updateMany({
        where: { codeHash, channel: dto.channel, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Invalid or expired link code');
      }

      const record = await tx.channelLinkCode.findUnique({ where: { codeHash } });
      const userId = record!.userId;

      // upsert: re-linking the same externalId (device switch, re-pair after
      // unlink) overwrites cleanly rather than failing on the unique index.
      await tx.channelIdentity.upsert({
        where: { channel_externalId: { channel: dto.channel, externalId: dto.externalId } },
        create: { userId, channel: dto.channel, externalId: dto.externalId },
        update: { userId, linkedAt: new Date() },
      });

      this.audit.log(userId, SecurityEventType.CHANNEL_LINKED, { metadata: { channel: dto.channel } });
    });
  }

  // ============================================================
  // Step 3 — bot exchanges a linked externalId for a real, RBAC-scoped
  // session. Never mints a SYSTEM/GLOBAL token here — this always resolves
  // to the linked employee's own claims (security.md §3: agents are not
  // superusers).
  // ============================================================
  async exchange(dto: ExchangeChannelIdentityDto): Promise<LoginResponseDto> {
    const identity = await this.prisma.channelIdentity.findUnique({
      where: { channel_externalId: { channel: dto.channel, externalId: dto.externalId } },
    });
    if (!identity) {
      throw new NotFoundException('This chat is not linked to a Sentient account yet');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: identity.userId },
      include: {
        employee: {
          select: { departmentId: true, teamId: true, department: { select: { businessUnitId: true } } },
        },
        userRoles: { where: { revokedAt: null }, include: { role: { select: { code: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Linked account no longer exists');
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const roleAssignments = user.userRoles.map((ur) => ({
      roleCode: ur.role.code,
      scope: ur.scope as unknown as PermissionScope,
      scopeEntityId: ur.scopeEntityId,
    }));

    const { rawToken: rawRefresh } = this.tokens.generateRefreshToken();
    const sessionId = randomUUID();

    const jwtPayload = this.tokens.buildJwtPayload({
      userId: user.id,
      employeeId: user.employeeId,
      departmentId: user.employee?.departmentId ?? null,
      teamId: user.employee?.teamId ?? null,
      businessUnitId: user.employee?.department?.businessUnitId ?? null,
      channel: dto.channel,
      sessionId,
      roleAssignments,
    });

    const { token: accessToken, expiresIn } = this.tokens.signAccessToken(jwtPayload);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        channel: dto.channel,
        accessTokenHash: this.tokens.hashToken(accessToken),
        refreshTokenHash: this.tokens.hashToken(rawRefresh),
        expiresAt: this.tokens.refreshTokenExpiresAt(),
      },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn };
  }

  // ============================================================
  // Self-service management (own web JWT)
  // ============================================================
  async listOwn(userId: string): Promise<ChannelIdentityResponseDto[]> {
    const identities = await this.prisma.channelIdentity.findMany({
      where: { userId },
      orderBy: { linkedAt: 'desc' },
    });
    return identities.map((i) => ({
      channel: i.channel as unknown as ChannelType,
      externalId: i.externalId,
      linkedAt: i.linkedAt,
    }));
  }

  async unlink(userId: string, channel: ChannelType): Promise<void> {
    const { count } = await this.prisma.channelIdentity.deleteMany({ where: { userId, channel } });
    if (count === 0) {
      throw new NotFoundException(`No linked ${channel} identity found`);
    }
    await this.prisma.session.updateMany({
      where: { userId, channel, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.audit.log(userId, SecurityEventType.CHANNEL_UNLINKED, { metadata: { channel } });
  }

  /** Called by ChannelIdentitiesEventsBridge on employee.terminated. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.channelIdentity.deleteMany({ where: { userId } });
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        channel: { in: [ChannelType.SLACK, ChannelType.TELEGRAM] },
      },
      data: { revokedAt: new Date() },
    });
  }
}
