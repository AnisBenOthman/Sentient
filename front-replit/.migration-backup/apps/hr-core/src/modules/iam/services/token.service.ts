import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ChannelType, JwtPayload, RoleAssignmentClaim, SystemJwtPayload } from '@sentient/shared';

export interface AccessTokenResult {
  token: string;
  expiresIn: number;
}

export interface RefreshTokenResult {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtExpiry: string;
  private readonly systemSecret: string;
  private readonly systemExpiry: string;
  private readonly refreshExpiryDays: number;

  constructor(private readonly config: ConfigService) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiry = config.get<string>('JWT_EXPIRY') ?? '15m';
    this.systemSecret = config.getOrThrow<string>('SYSTEM_JWT_SECRET');
    this.systemExpiry = config.get<string>('SYSTEM_JWT_EXPIRY') ?? '5m';
    this.refreshExpiryDays = config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS') ?? 7;
  }

  signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): AccessTokenResult {
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry } as jwt.SignOptions);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    const expiresIn = decoded.exp - decoded.iat;
    return { token, expiresIn };
  }

  signSystemToken(taskType: string): string {
    const payload: Omit<SystemJwtPayload, 'iat' | 'exp'> = {
      sub: 'system',
      roles: ['SYSTEM'],
      scope: 'GLOBAL',
      taskType,
    };
    return jwt.sign(payload, this.systemSecret, { expiresIn: this.systemExpiry } as jwt.SignOptions);
  }

  generateRefreshToken(): RefreshTokenResult {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  refreshTokenExpiresAt(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this.refreshExpiryDays);
    return d;
  }

  buildJwtPayload(params: {
    userId: string;
    employeeId: string | null;
    departmentId: string | null;
    teamId: string | null;
    businessUnitId: string | null;
    channel: ChannelType;
    sessionId: string;
    roleAssignments: RoleAssignmentClaim[];
  }): Omit<JwtPayload, 'iat' | 'exp'> {
    return {
      sub: params.userId,
      employeeId: params.employeeId,
      roles: [...new Set(params.roleAssignments.map((r) => r.roleCode))],
      departmentId: params.departmentId,
      teamId: params.teamId,
      businessUnitId: params.businessUnitId,
      channel: params.channel,
      sessionId: params.sessionId,
      roleAssignments: params.roleAssignments,
    };
  }
}
