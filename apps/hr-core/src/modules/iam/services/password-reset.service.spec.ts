import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { InviteService } from './invite.service';
import { MailService } from './mail.service';
import { PasswordPolicyService } from './password-policy.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

const tx = {
  passwordResetToken: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: { update: jest.fn() },
  session: { updateMany: jest.fn() },
};

const mockPrisma = {
  user: { findUnique: jest.fn() },
  passwordResetToken: { deleteMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
};

const mockArgon2 = { hash: jest.fn().mockResolvedValue('$argon2id$new') };
const mockTokens = { hashToken: jest.fn((raw: string) => `hash:${raw}`) };
const mockInvite = { issue: jest.fn().mockResolvedValue(undefined) };
const mockMail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
const mockAudit = { log: jest.fn() };
const mockPasswordPolicy = {
  validateComplexity: jest.fn(),
  assertNotReused: jest.fn().mockResolvedValue(undefined),
  buildUpdatedHistory: jest.fn().mockReturnValue(['$argon2id$old', '$argon2id$new']),
};
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

const TOKEN = 'a'.repeat(64);
const NEW_PASSWORD = 'NewPassw0rd!';

/** request() is fire-and-forget — let its promise chain settle before asserting. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: Argon2Service, useValue: mockArgon2 },
        { provide: TokenService, useValue: mockTokens },
        { provide: InviteService, useValue: mockInvite },
        { provide: MailService, useValue: mockMail },
        { provide: AuditService, useValue: mockAudit },
        { provide: PasswordPolicyService, useValue: mockPasswordPolicy },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(PasswordResetService);
  });

  describe('request', () => {
    it('does nothing for an unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      service.request('Nobody@Example.com ', {});
      await flush();

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'nobody@example.com' } });
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockInvite.issue).not.toHaveBeenCalled();
    });

    it('does nothing for a disabled account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', status: UserStatus.DISABLED });

      service.request('a@b.c', {});
      await flush();

      expect(mockMail.sendPasswordReset).not.toHaveBeenCalled();
      expect(mockInvite.issue).not.toHaveBeenCalled();
    });

    it('re-sends the invite for an account that was never activated', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'new@b.c',
        status: UserStatus.PENDING_ACTIVATION,
      });

      service.request('new@b.c', {});
      await flush();

      expect(mockInvite.issue).toHaveBeenCalledWith('u1', 'new@b.c');
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('replaces prior tokens and mails a single-use reset link for an active account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', status: UserStatus.ACTIVE });

      service.request('a@b.c', { ipAddress: '1.2.3.4' });
      await flush();

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
      });
      const created = mockPrisma.passwordResetToken.create.mock.calls[0][0] as {
        data: { tokenHash: string; expiresAt: Date };
      };
      expect(created.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const [to, url] = mockMail.sendPasswordReset.mock.calls[0] as [string, string];
      expect(to).toBe('a@b.c');
      const rawToken = new URL(url).searchParams.get('token');
      expect(url).toContain('/reset-password?token=');
      // Only the hash is stored; the raw token only travels in the email.
      expect(created.data.tokenHash).toBe(`hash:${rawToken}`);
      expect(mockAudit.log).toHaveBeenCalledWith('u1', SecurityEventType.PASSWORD_RESET_REQUESTED, {
        ipAddress: '1.2.3.4',
      });
    });

    it('never throws to the caller when processing fails', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));

      expect(() => service.request('a@b.c', {})).not.toThrow();
      await flush();
    });
  });

  describe('reset', () => {
    const activeRecord = {
      userId: 'u1',
      user: { status: UserStatus.ACTIVE, passwordHistory: ['$argon2id$old'] },
    };

    it('rejects an invalid, expired or already-used token', async () => {
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reset({ token: TOKEN, newPassword: NEW_PASSWORD }, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token belonging to a disabled account', async () => {
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      tx.passwordResetToken.findUnique.mockResolvedValue({
        ...activeRecord,
        user: { ...activeRecord.user, status: UserStatus.DISABLED },
      });

      await expect(service.reset({ token: TOKEN, newPassword: NEW_PASSWORD }, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('propagates password reuse so the transaction rolls back', async () => {
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      tx.passwordResetToken.findUnique.mockResolvedValue(activeRecord);
      mockPasswordPolicy.assertNotReused.mockRejectedValueOnce(new BadRequestException('used recently'));

      await expect(service.reset({ token: TOKEN, newPassword: NEW_PASSWORD }, {})).rejects.toThrow(
        'used recently',
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('sets the new password, revokes sessions and invalidates other reset links', async () => {
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      tx.passwordResetToken.findUnique.mockResolvedValue(activeRecord);

      await service.reset({ token: TOKEN, newPassword: NEW_PASSWORD }, {});

      expect(tx.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, {
        where: { tokenHash: `hash:${TOKEN}`, usedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { usedAt: expect.any(Date) },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          passwordHash: '$argon2id$new',
          passwordHistory: ['$argon2id$old', '$argon2id$new'],
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tx.passwordResetToken.updateMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', SecurityEventType.PASSWORD_RESET_COMPLETED, {});
    });

    it('unlocks a locked account', async () => {
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      tx.passwordResetToken.findUnique.mockResolvedValue({
        ...activeRecord,
        user: { ...activeRecord.user, status: UserStatus.LOCKED },
      });

      await service.reset({ token: TOKEN, newPassword: NEW_PASSWORD }, {});

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: UserStatus.ACTIVE }) }),
      );
    });
  });
});
