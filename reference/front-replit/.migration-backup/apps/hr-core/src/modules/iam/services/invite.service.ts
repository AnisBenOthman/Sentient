import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClaimInviteDto } from '../dto/claim-invite.dto';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { MailService } from './mail.service';
import { PasswordPolicyService } from './password-policy.service';
import { TokenService } from './token.service';

@Injectable()
export class InviteService {
  private readonly expiryHours: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly argon2: Argon2Service,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.expiryHours = config.get<number>('INVITE_TOKEN_EXPIRY_HOURS') ?? 72;
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async issue(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.tokens.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.expiryHours * 60 * 60 * 1_000);

    // Revoke any unused prior invite tokens so only one is valid at a time.
    await this.prisma.inviteToken.deleteMany({ where: { userId, usedAt: null } });

    await this.prisma.inviteToken.create({ data: { userId, tokenHash, expiresAt } });

    const inviteUrl = `${this.frontendUrl}/auth/claim-invite?token=${rawToken}`;
    await this.mail.sendInvite(email, inviteUrl);
    this.audit.log(userId, SecurityEventType.INVITE_SENT);
  }

  async claim(dto: ClaimInviteDto): Promise<void> {
    const tokenHash = this.tokens.hashToken(dto.token);

    this.passwordPolicy.validateComplexity(dto.newPassword);
    const newHash = await this.argon2.hash(dto.newPassword);

    // Atomic: updateMany on the token marks it used in one SQL UPDATE.
    // Only one concurrent claim will match count === 1; the other gets 0.
    const claimedUserId = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.inviteToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });

      if (count === 0) {
        throw new BadRequestException('Invalid or expired invite token');
      }

      const record = await tx.inviteToken.findUnique({ where: { tokenHash } });
      const userId = record!.userId;

      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          passwordHistory: [newHash],
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      return userId;
    });

    this.audit.log(claimedUserId, SecurityEventType.INVITE_CLAIMED);
  }

  async resend(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (user.status !== UserStatus.PENDING_ACTIVATION) {
      throw new ConflictException('User has already activated their account');
    }

    await this.issue(userId, user.email);
  }
}
