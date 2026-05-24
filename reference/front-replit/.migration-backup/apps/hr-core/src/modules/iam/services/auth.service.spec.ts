import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from './auth.service';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

// ---- Fixture helpers ----

const makeUser = (overrides: Partial<typeof baseUser> = {}) => ({ ...baseUser, ...overrides });

const baseUser = {
  id: 'user-1',
  email: 'alice@sentient.dev',
  passwordHash: '$argon2id$hashed',
  status: UserStatus.ACTIVE,
  employeeId: 'emp-1',
  lockedUntil: null as Date | null,
  employee: {
    departmentId: 'dept-1',
    teamId: 'team-1',
    department: { businessUnitId: null as string | null },
  },
  userRoles: [] as unknown[],
};

const loginDto: LoginDto = {
  email: 'alice@sentient.dev',
  password: 'Correct!pass1',
  channel: 'WEB' as LoginDto['channel'],
};

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  channel: 'WEB',
  refreshTokenHash: 'stored-refresh-hash',
  previousTokenHash: null,
  previousRotatedAt: null,
  revokedAt: null,
  expiresAt: new Date('2099-01-01'),
};

// ---- Mocks ----

const mockUsers = {
  findByEmail: jest.fn(),
  incrementFailedLogins: jest.fn().mockResolvedValue({}),
  resetFailedLogins: jest.fn().mockResolvedValue(undefined),
  buildRoleAssignments: jest.fn().mockReturnValue([]),
};

const mockSessions = {
  revokeChannel: jest.fn().mockResolvedValue(undefined),
  findByRefreshHash: jest.fn(),
  handleGraceWindow: jest.fn(),
  rotate: jest.fn().mockResolvedValue({ idempotent: false, session: mockSession }),
  revokeById: jest.fn().mockResolvedValue(undefined),
};

const mockTokens = {
  generateRefreshToken: jest.fn().mockReturnValue({ rawToken: 'raw-refresh', tokenHash: 'refresh-hash' }),
  buildJwtPayload: jest.fn().mockReturnValue({ sub: 'user-1', roles: [], roleAssignments: [], sessionId: 'session-1' }),
  signAccessToken: jest.fn().mockReturnValue({ token: 'access-token', expiresIn: 900 }),
  hashToken: jest.fn().mockImplementation((t: string) => `hash:${t}`),
  refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date('2099-01-01')),
};

const mockArgon2 = {
  verify: jest.fn(),
};

const mockAudit = {
  log: jest.fn(),
};

const mockPrisma = {
  session: { create: jest.fn().mockResolvedValue({}) },
  user: { findUnique: jest.fn() },
};

// ---- Suite ----

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsers },
        { provide: SessionsService, useValue: mockSessions },
        { provide: TokenService, useValue: mockTokens },
        { provide: Argon2Service, useValue: mockArgon2 },
        { provide: AuditService, useValue: mockAudit },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ---- login ----

  describe('login', () => {
    it('throws UnauthorizedException when user email is not found', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for DISABLED account before password check', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser({ status: UserStatus.DISABLED }));
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for LOCKED account that is still within lockout window', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60_000);
      mockUsers.findByEmail.mockResolvedValue(makeUser({ status: UserStatus.LOCKED, lockedUntil }));
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for PENDING_ACTIVATION account', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser({ status: UserStatus.PENDING_ACTIVATION }));
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    it('calls incrementFailedLogins and emits LOGIN_FAILED when password is wrong', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser());
      mockArgon2.verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      expect(mockUsers.incrementFailedLogins).toHaveBeenCalledWith('user-1');
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.LOGIN_FAILED, undefined);
    });

    it('calls revokeChannel BEFORE session.create on successful login', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser());
      mockArgon2.verify.mockResolvedValue(true);

      const callOrder: string[] = [];
      mockSessions.revokeChannel.mockImplementation(async () => { callOrder.push('revokeChannel'); });
      mockPrisma.session.create.mockImplementation(async () => { callOrder.push('sessionCreate'); return {}; });

      await service.login(loginDto);

      expect(callOrder.indexOf('revokeChannel')).toBeLessThan(callOrder.indexOf('sessionCreate'));
    });

    it('creates session with hashed access and refresh tokens on success', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser());
      mockArgon2.verify.mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessTokenHash: 'hash:access-token',
            refreshTokenHash: 'hash:raw-refresh',
          }),
        }),
      );
    });

    it('returns accessToken, refreshToken, and expiresIn on success', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser());
      mockArgon2.verify.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh');
      expect(result.expiresIn).toBe(900);
    });

    it('emits LOGIN_SUCCESS and resets failed login counter on success', async () => {
      mockUsers.findByEmail.mockResolvedValue(makeUser());
      mockArgon2.verify.mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockUsers.resetFailedLogins).toHaveBeenCalledWith('user-1');
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.LOGIN_SUCCESS, undefined);
    });
  });

  // ---- refresh ----

  describe('refresh', () => {
    it('throws when refresh hash does not match any session and grace window misses', async () => {
      mockSessions.findByRefreshHash.mockResolvedValue(null);
      mockSessions.handleGraceWindow.mockResolvedValue(null);
      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user account is no longer ACTIVE at refresh time', async () => {
      mockSessions.findByRefreshHash.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue({ ...baseUser, status: UserStatus.DISABLED });

      await expect(service.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('issues new tokens and calls rotate on a valid refresh', async () => {
      mockSessions.findByRefreshHash.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        status: UserStatus.ACTIVE,
        userRoles: [],
      });

      const result = await service.refresh('valid-raw-token');

      expect(mockSessions.rotate).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('raw-refresh');
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.TOKEN_REFRESHED, undefined);
    });

    it('uses the grace-window session when primary lookup misses', async () => {
      mockSessions.findByRefreshHash.mockResolvedValue(null);
      mockSessions.handleGraceWindow.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        status: UserStatus.ACTIVE,
        userRoles: [],
      });

      const result = await service.refresh('grace-window-token');

      expect(mockSessions.rotate).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
    });

    it('propagates replay detection error from handleGraceWindow', async () => {
      mockSessions.findByRefreshHash.mockResolvedValue(null);
      mockSessions.handleGraceWindow.mockRejectedValue(
        new UnauthorizedException('Session replay detected'),
      );

      await expect(service.refresh('replayed-token')).rejects.toThrow('Session replay detected');
    });
  });

  // ---- logout ----

  describe('logout', () => {
    it('revokes the session and emits LOGOUT audit event', async () => {
      await service.logout('session-1', 'user-1');

      expect(mockSessions.revokeById).toHaveBeenCalledWith('session-1');
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', SecurityEventType.LOGOUT);
    });
  });
});
