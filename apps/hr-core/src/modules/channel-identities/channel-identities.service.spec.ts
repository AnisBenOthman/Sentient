import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ChannelType, SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../iam/services/audit.service';
import { TokenService } from '../iam/services/token.service';
import { ChannelIdentitiesService } from './channel-identities.service';

// ---- Mocks ----

const mockTokens = {
  hashToken: jest.fn().mockImplementation((t: string) => `hash:${t}`),
  generateRefreshToken: jest.fn().mockReturnValue({ rawToken: 'raw-refresh', tokenHash: 'refresh-hash' }),
  buildJwtPayload: jest.fn().mockReturnValue({ sub: 'user-1', roles: [], roleAssignments: [], sessionId: 'session-1' }),
  signAccessToken: jest.fn().mockReturnValue({ token: 'access-token', expiresIn: 900 }),
  refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date('2099-01-01')),
};

const mockAudit = {
  log: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockReturnValue(undefined),
};

const mockTx = {
  channelLinkCode: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  channelIdentity: {
    upsert: jest.fn().mockResolvedValue({}),
  },
};

const mockPrisma = {
  channelLinkCode: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({}),
  },
  channelIdentity: {
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  session: {
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: jest.fn().mockImplementation(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

const baseUser = {
  id: 'user-1',
  employeeId: 'emp-1',
  status: UserStatus.ACTIVE,
  employee: { departmentId: 'dept-1', teamId: 'team-1', department: { businessUnitId: null as string | null } },
  userRoles: [] as { scope: unknown; scopeEntityId: string | null; role: { code: string } }[],
};

describe('ChannelIdentitiesService', () => {
  let service: ChannelIdentitiesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelIdentitiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ChannelIdentitiesService);
  });

  // ---- generateLinkCode ----

  describe('generateLinkCode', () => {
    it('deletes prior unconsumed codes before creating a new one', async () => {
      const callOrder: string[] = [];
      mockPrisma.channelLinkCode.deleteMany.mockImplementation(async () => {
        callOrder.push('deleteMany');
        return { count: 1 };
      });
      mockPrisma.channelLinkCode.create.mockImplementation(async () => {
        callOrder.push('create');
        return {};
      });

      await service.generateLinkCode('user-1', ChannelType.TELEGRAM);

      expect(callOrder).toEqual(['deleteMany', 'create']);
      expect(mockPrisma.channelLinkCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: ChannelType.TELEGRAM, consumedAt: null },
      });
    });

    it('returns a 6-digit numeric code and an expiry in the future', async () => {
      const result = await service.generateLinkCode('user-1', ChannelType.TELEGRAM);

      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ---- redeemLinkCode ----

  describe('redeemLinkCode', () => {
    const dto = { channel: ChannelType.TELEGRAM, externalId: 'chat-123', code: '482913' };

    it('throws BadRequestException when the code is invalid or expired', async () => {
      mockTx.channelLinkCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.redeemLinkCode(dto)).rejects.toThrow(BadRequestException);
      expect(mockTx.channelIdentity.upsert).not.toHaveBeenCalled();
    });

    it('upserts the channel identity and logs CHANNEL_LINKED on success', async () => {
      mockTx.channelLinkCode.updateMany.mockResolvedValue({ count: 1 });
      mockTx.channelLinkCode.findUnique.mockResolvedValue({ userId: 'user-1' });

      await service.redeemLinkCode(dto);

      expect(mockTx.channelIdentity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channel_externalId: { channel: ChannelType.TELEGRAM, externalId: 'chat-123' } },
          create: { userId: 'user-1', channel: ChannelType.TELEGRAM, externalId: 'chat-123' },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.CHANNEL_LINKED, {
        metadata: { channel: ChannelType.TELEGRAM },
      });
    });
  });

  // ---- exchange ----

  describe('exchange', () => {
    const dto = { channel: ChannelType.TELEGRAM, externalId: 'chat-123' };

    it('throws NotFoundException when the externalId is not linked', async () => {
      mockPrisma.channelIdentity.findUnique.mockResolvedValue(null);

      await expect(service.exchange(dto)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the linked user no longer exists', async () => {
      mockPrisma.channelIdentity.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.exchange(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when the account is not ACTIVE (e.g. terminated)', async () => {
      mockPrisma.channelIdentity.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ ...baseUser, status: UserStatus.DISABLED });

      await expect(service.exchange(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it('mints a real, channel-tagged session for an active linked user', async () => {
      mockPrisma.channelIdentity.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.exchange(dto);

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', channel: ChannelType.TELEGRAM }) }),
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh');
    });

    it('revokes the prior active session on this channel before creating the new one', async () => {
      // Regression test: sessions_active_channel_uidx is a partial unique index
      // on (userId, channel) WHERE revokedAt IS NULL. Without revoking the
      // prior session first, every exchange after the first 500s on that
      // constraint (a bot re-exchanges each time its cached token expires).
      mockPrisma.channelIdentity.findUnique.mockResolvedValue({ userId: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await service.exchange(dto);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: ChannelType.TELEGRAM, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      const [updateManyOrder] = mockPrisma.session.updateMany.mock.invocationCallOrder;
      const [createOrder] = mockPrisma.session.create.mock.invocationCallOrder;
      expect(updateManyOrder).toBeDefined();
      expect(createOrder).toBeDefined();
      expect(updateManyOrder as number).toBeLessThan(createOrder as number);
    });
  });

  // ---- unlink ----

  describe('unlink', () => {
    it('throws NotFoundException when no identity was linked', async () => {
      mockPrisma.channelIdentity.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unlink('user-1', ChannelType.TELEGRAM)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('revokes channel sessions and logs CHANNEL_UNLINKED on success', async () => {
      mockPrisma.channelIdentity.deleteMany.mockResolvedValue({ count: 1 });

      await service.unlink('user-1', ChannelType.TELEGRAM);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', channel: ChannelType.TELEGRAM, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.CHANNEL_UNLINKED, {
        metadata: { channel: ChannelType.TELEGRAM },
      });
    });
  });

  // ---- revokeAllForUser (called from employee.terminated) ----

  describe('revokeAllForUser', () => {
    it('deletes all channel identities and revokes only SLACK/TELEGRAM sessions', async () => {
      await service.revokeAllForUser('user-1');

      expect(mockPrisma.channelIdentity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          channel: { in: [ChannelType.SLACK, ChannelType.TELEGRAM] },
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
