import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ChannelType, PermissionScope } from '@sentient/shared';
import { TokenService } from './token.service';

const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
const SYSTEM_SECRET = 'test-system-secret-at-least-32-chars!!';

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return JWT_SECRET;
    if (key === 'SYSTEM_JWT_SECRET') return SYSTEM_SECRET;
    throw new Error(`Missing required config: ${key}`);
  }),
  get: jest.fn((key: string) => {
    if (key === 'JWT_EXPIRY') return '15m';
    if (key === 'SYSTEM_JWT_EXPIRY') return '5m';
    if (key === 'REFRESH_TOKEN_EXPIRY_DAYS') return 7;
    return undefined;
  }),
};

const basePayloadParams = {
  userId: 'user-1',
  employeeId: 'emp-1',
  departmentId: 'dept-1',
  teamId: 'team-1',
  businessUnitId: null,
  channel: 'WEB' as ChannelType,
  sessionId: 'session-1',
  roleAssignments: [
    { roleCode: 'EMPLOYEE', scope: PermissionScope.OWN, scopeEntityId: null },
  ],
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  // ---- signAccessToken ----

  describe('signAccessToken', () => {
    it('returns a verifiable token containing all payload fields', () => {
      const payload = service.buildJwtPayload(basePayloadParams);
      const { token, expiresIn } = service.signAccessToken(payload);

      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded['sub']).toBe('user-1');
      expect(decoded['employeeId']).toBe('emp-1');
      expect(decoded['sessionId']).toBe('session-1');
      expect(decoded['roles']).toEqual(['EMPLOYEE']);
      expect(typeof expiresIn).toBe('number');
      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThanOrEqual(15 * 60);
    });

    it('expiresIn matches decoded exp - iat', () => {
      const payload = service.buildJwtPayload(basePayloadParams);
      const { token, expiresIn } = service.signAccessToken(payload);
      const decoded = jwt.decode(token) as { exp: number; iat: number };
      expect(expiresIn).toBe(decoded.exp - decoded.iat);
    });
  });

  // ---- signSystemToken ----

  describe('signSystemToken', () => {
    it('produces a token with sub=system, SYSTEM role, and correct taskType', () => {
      const token = service.signSystemToken('exit_survey_dispatch');
      const decoded = jwt.verify(token, SYSTEM_SECRET) as Record<string, unknown>;
      expect(decoded['sub']).toBe('system');
      expect(decoded['roles']).toEqual(['SYSTEM']);
      expect(decoded['taskType']).toBe('exit_survey_dispatch');
      expect(decoded['scope']).toBe('GLOBAL');
    });

    it('expires within 5 minutes', () => {
      const token = service.signSystemToken('test_task');
      const decoded = jwt.decode(token) as { exp: number; iat: number };
      expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(5 * 60);
    });

    it('is signed with SYSTEM_JWT_SECRET, not JWT_SECRET', () => {
      const token = service.signSystemToken('test');
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
      expect(() => jwt.verify(token, SYSTEM_SECRET)).not.toThrow();
    });
  });

  // ---- generateRefreshToken ----

  describe('generateRefreshToken', () => {
    it('returns a 96-char hex rawToken (48 random bytes)', () => {
      const { rawToken } = service.generateRefreshToken();
      expect(rawToken).toHaveLength(96);
      expect(/^[0-9a-f]+$/.test(rawToken)).toBe(true);
    });

    it('tokenHash matches hashToken(rawToken)', () => {
      const { rawToken, tokenHash } = service.generateRefreshToken();
      expect(tokenHash).toBe(service.hashToken(rawToken));
    });

    it('generates a unique token on each call', () => {
      const a = service.generateRefreshToken();
      const b = service.generateRefreshToken();
      expect(a.rawToken).not.toBe(b.rawToken);
    });
  });

  // ---- hashToken ----

  describe('hashToken', () => {
    it('is deterministic for the same input', () => {
      expect(service.hashToken('hello')).toBe(service.hashToken('hello'));
    });

    it('produces different hashes for different inputs', () => {
      expect(service.hashToken('abc')).not.toBe(service.hashToken('xyz'));
    });

    it('returns a 64-char hex string (SHA-256)', () => {
      const hash = service.hashToken('any-token');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  // ---- timingSafeCompare ----

  describe('timingSafeCompare', () => {
    it('returns true for identical strings', () => {
      expect(service.timingSafeCompare('hello', 'hello')).toBe(true);
    });

    it('returns false for strings differing in content but same length', () => {
      expect(service.timingSafeCompare('aaaa', 'aaab')).toBe(false);
    });

    it('returns false for different-length strings without throwing', () => {
      expect(service.timingSafeCompare('short', 'muchlongerstring')).toBe(false);
    });
  });

  // ---- buildJwtPayload ----

  describe('buildJwtPayload', () => {
    it('maps all params to the correct JWT fields', () => {
      const result = service.buildJwtPayload(basePayloadParams);
      expect(result.sub).toBe('user-1');
      expect(result.employeeId).toBe('emp-1');
      expect(result.departmentId).toBe('dept-1');
      expect(result.teamId).toBe('team-1');
      expect(result.businessUnitId).toBeNull();
      expect(result.channel).toBe('WEB');
      expect(result.sessionId).toBe('session-1');
    });

    it('deduplicates role codes when the same role appears at multiple scopes', () => {
      const result = service.buildJwtPayload({
        ...basePayloadParams,
        roleAssignments: [
          { roleCode: 'MANAGER', scope: PermissionScope.TEAM, scopeEntityId: 'team-1' },
          { roleCode: 'MANAGER', scope: PermissionScope.DEPARTMENT, scopeEntityId: 'dept-1' },
          { roleCode: 'EMPLOYEE', scope: PermissionScope.OWN, scopeEntityId: null },
        ],
      });
      expect(result.roles).toEqual(['MANAGER', 'EMPLOYEE']);
    });

    it('preserves the full roleAssignments array (not deduped)', () => {
      const assignments = [
        { roleCode: 'MANAGER', scope: PermissionScope.TEAM, scopeEntityId: 'team-1' },
        { roleCode: 'MANAGER', scope: PermissionScope.DEPARTMENT, scopeEntityId: 'dept-1' },
      ];
      const result = service.buildJwtPayload({ ...basePayloadParams, roleAssignments: assignments });
      expect(result.roleAssignments).toHaveLength(2);
    });
  });
});
