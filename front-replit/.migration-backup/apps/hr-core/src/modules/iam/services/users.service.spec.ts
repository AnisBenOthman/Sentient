import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { PasswordPolicyService } from './password-policy.service';
import { UsersService } from './users.service';
import { CreateUserDto } from '../dto/create-user.dto';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    updateMany: jest.fn(),
  },
};

const mockArgon2 = {
  hash: jest.fn().mockResolvedValue('$argon2id$v=19$hashed'),
};

const mockAudit = {
  log: jest.fn(),
};

const mockPasswordPolicy = {
  validateComplexity: jest.fn(),
  assertNotReused: jest.fn().mockResolvedValue(undefined),
  buildUpdatedHistory: jest.fn().mockReturnValue(['$argon2id$new']),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'MAX_FAILED_LOGINS') return 5;
    if (key === 'LOCKOUT_DURATION_MINUTES') return 15;
    return undefined;
  }),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: Argon2Service, useValue: mockArgon2 },
        { provide: AuditService, useValue: mockAudit },
        { provide: PasswordPolicyService, useValue: mockPasswordPolicy },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  // ---- findByEmail ----

  describe('findByEmail', () => {
    it('normalizes email to lowercase and trims whitespace before query', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await service.findByEmail('  Admin@SENTIENT.DEV  ');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'admin@sentient.dev' } }),
      );
    });
  });

  // ---- findById ----

  describe('findById', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns the user when found', async () => {
      const user = { id: 'u1', email: 'a@b.com', status: UserStatus.ACTIVE };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const result = await service.findById('u1');
      expect(result.id).toBe('u1');
    });
  });

  // ---- create ----

  describe('create', () => {
    const dto: CreateUserDto = { email: 'New@Test.COM' };

    it('normalizes email and sets status to PENDING_ACTIVATION', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new', email: 'new@test.com' });

      await service.create(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@test.com',
            status: UserStatus.PENDING_ACTIVATION,
          }),
        }),
      );
    });

    it('throws ConflictException when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('emits USER_CREATED audit event with the new user id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u-new' });

      await service.create(dto);
      expect(mockAudit.log).toHaveBeenCalledWith('u-new', SecurityEventType.USER_CREATED);
    });
  });

  // ---- incrementFailedLogins ----

  describe('incrementFailedLogins', () => {
    it('only increments counter when below threshold', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ id: 'u1', failedLoginCount: 2 });

      await service.incrementFailedLogins('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('locks account and emits ACCOUNT_LOCKED when threshold (5) is reached', async () => {
      mockPrisma.user.update
        .mockResolvedValueOnce({ id: 'u1', failedLoginCount: 5 })   // increment call
        .mockResolvedValueOnce({ id: 'u1', status: UserStatus.LOCKED }); // lock call

      await service.incrementFailedLogins('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
      const lockCallData = (mockPrisma.user.update.mock.calls[1] as [{ data: Record<string, unknown> }])[0].data;
      expect(lockCallData).toMatchObject({ status: UserStatus.LOCKED });
      expect(lockCallData['lockedUntil']).toBeInstanceOf(Date);
      expect(mockAudit.log).toHaveBeenCalledWith('u1', SecurityEventType.ACCOUNT_LOCKED);
    });

    it('sets lockedUntil ~15 minutes in the future on lockout', async () => {
      mockPrisma.user.update
        .mockResolvedValueOnce({ id: 'u1', failedLoginCount: 5 })
        .mockResolvedValueOnce({ id: 'u1', status: UserStatus.LOCKED });

      const before = Date.now();
      await service.incrementFailedLogins('u1');
      const after = Date.now();

      const lockCallData = (mockPrisma.user.update.mock.calls[1] as [{ data: Record<string, unknown> }])[0].data;
      const lockedUntil = (lockCallData['lockedUntil'] as Date).getTime();
      expect(lockedUntil).toBeGreaterThanOrEqual(before + 14 * 60_000);
      expect(lockedUntil).toBeLessThanOrEqual(after + 16 * 60_000);
    });
  });

  // ---- resetFailedLogins ----

  describe('resetFailedLogins', () => {
    it('clears failedLoginCount and lockedUntil and sets lastLoginAt', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.resetFailedLogins('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
        }),
      );
      const data = (mockPrisma.user.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
      expect(data['lastLoginAt']).toBeInstanceOf(Date);
    });
  });

  // ---- updateStatus ----

  describe('updateStatus', () => {
    it('revokes all active sessions when status changes to DISABLED', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: UserStatus.DISABLED });
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.updateStatus('u1', UserStatus.DISABLED);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u1', revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith('u1', SecurityEventType.USER_DISABLED);
    });

    it('revokes all active sessions when status changes to LOCKED', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: UserStatus.LOCKED });
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.updateStatus('u1', UserStatus.LOCKED);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u1', revokedAt: null }),
        }),
      );
    });

    it('does NOT revoke sessions when status changes to ACTIVE', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: UserStatus.ACTIVE });

      await service.updateStatus('u1', UserStatus.ACTIVE);

      expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---- unlockAccount ----

  describe('unlockAccount', () => {
    it('clears lockedUntil, resets failedLoginCount, and restores ACTIVE status', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', status: UserStatus.ACTIVE });

      await service.unlockAccount('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            lockedUntil: null,
            failedLoginCount: 0,
            status: UserStatus.ACTIVE,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith('u1', SecurityEventType.ACCOUNT_UNLOCKED);
    });
  });

  // ---- buildRoleAssignments ----

  describe('buildRoleAssignments', () => {
    it('maps userRoles to RoleAssignmentClaim array', () => {
      const userRoles = [
        { scope: 'TEAM', scopeEntityId: 'team-1', role: { code: 'MANAGER' } },
        { scope: 'OWN', scopeEntityId: null, role: { code: 'EMPLOYEE' } },
      ];
      const result = service.buildRoleAssignments(userRoles);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ roleCode: 'MANAGER', scopeEntityId: 'team-1' });
      expect(result[1]).toMatchObject({ roleCode: 'EMPLOYEE', scopeEntityId: null });
    });
  });
});
