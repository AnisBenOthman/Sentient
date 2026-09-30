import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { InviteService } from './invite.service';
import { MailService } from './mail.service';
import { PasswordPolicyService } from './password-policy.service';
import { TokenService } from './token.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const INVALID_TOKEN_MESSAGE = 'Invalid or expired reset token';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly expiryMinutes: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly argon2: Argon2Service,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly tokens: TokenService,
    private readonly invite: InviteService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.expiryMinutes = Number(config.get<string>('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES') ?? 60);
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  /**
   * WHY fire-and-forget: the caller always gets the same 204 whether or not the
   * email exists, and the work (DB lookup, hashing, SMTP) runs after the response
   * so its duration can't be used to enumerate registered emails either.
   */
  request(email: string, meta: RequestMeta): void {
    void this.processRequest(email.toLowerCase().trim(), meta).catch((err: unknown) => {
      this.logger.error('Failed to process password reset request', err);
    });
  }

  async reset(dto: ResetPasswordDto, meta: RequestMeta): Promise<void> {
    this.passwordPolicy.validateComplexity(dto.newPassword);
    const tokenHash = this.tokens.hashToken(dto.token);
    const newHash = await this.argon2.hash(dto.newPassword);

    const userId = await this.prisma.$transaction(async (tx) => {
      // Atomic single-use claim: of two concurrent submissions only one matches.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (count === 0) throw new BadRequestException(INVALID_TOKEN_MESSAGE);

      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!record || record.user.status === UserStatus.DISABLED) {
        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
      }

      // Throwing here rolls the transaction back, so the token stays usable
      // and the user can retry with a different password.
      const history = record.user.passwordHistory as string[];
      await this.passwordPolicy.assertNotReused(dto.newPassword, history);

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newHash,
          passwordHistory: this.passwordPolicy.buildUpdatedHistory(newHash, history),
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
          // A reset proves mailbox ownership, which is enough to lift a lockout.
          ...(record.user.status === UserStatus.LOCKED ? { status: UserStatus.ACTIVE } : {}),
        },
      });

      // Anyone holding the old password may hold a live session too.
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Any other outstanding reset links for this account are now stale.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return record.userId;
    });

    this.audit.log(userId, SecurityEventType.PASSWORD_RESET_COMPLETED, meta);
  }

  private async processRequest(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    switch (user.status) {
      case UserStatus.DISABLED:
        return;
      case UserStatus.PENDING_ACTIVATION:
        // A new employee who lost or let their invite expire has no password to
        // reset yet — send them a fresh invite so they can set their first one.
        await this.invite.issue(user.id, user.email);
        return;
      default:
        break;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.tokens.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60_000);

    // Only the most recent link is valid.
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const resetUrl = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    await this.mail.sendPasswordReset(user.email, resetUrl, this.expiryMinutes);
    this.audit.log(user.id, SecurityEventType.PASSWORD_RESET_REQUESTED, meta);
  }
}
