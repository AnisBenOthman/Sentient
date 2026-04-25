import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChannelType, SecurityEventType, UserStatus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { AuditService } from './audit.service';
import { Argon2Service } from './argon2.service';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

interface LoginMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly argon2: Argon2Service,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta?: LoginMeta): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (
      user.status === UserStatus.LOCKED &&
      user.lockedUntil &&
      user.lockedUntil > new Date()
    ) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    if (user.status === UserStatus.PENDING_ACTIVATION) {
      throw new UnauthorizedException('Account is not yet activated');
    }

    const passwordValid = await this.argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.users.incrementFailedLogins(user.id);
      this.audit.log(user.id, SecurityEventType.LOGIN_FAILED, meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.resetFailedLogins(user.id);

    const roleAssignments = this.users.buildRoleAssignments(user.userRoles);
    const employee = user.employee;

    const { rawToken: rawRefresh } = this.tokens.generateRefreshToken();

    // Revoke any existing active session on this channel (partial unique index enforces one active session per channel).
    await this.sessions.revokeChannel(user.id, dto.channel);

    // Pre-generate the session ID so we can sign it into the JWT and persist
    // both hashes in a single atomic write — no placeholder / two-phase update.
    const sessionId = randomUUID();

    const jwtPayload = this.tokens.buildJwtPayload({
      userId: user.id,
      employeeId: user.employeeId,
      departmentId: employee?.departmentId ?? null,
      teamId: employee?.teamId ?? null,
      businessUnitId: employee?.department?.businessUnitId ?? null,
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

    this.audit.log(user.id, SecurityEventType.LOGIN_SUCCESS, meta);
    return { accessToken, refreshToken: rawRefresh, expiresIn };
  }

  async refresh(rawRefreshToken: string, meta?: LoginMeta): Promise<LoginResponseDto> {
    const incomingHash = this.tokens.hashToken(rawRefreshToken);

    // Find the active session by refresh token hash.
    // Falls back to grace-window / replay detection if the hash matches a rotated token.
    let session = await this.sessions.findByRefreshHash(incomingHash);

    if (!session) {
      // handleGraceWindow throws on confirmed replay; returns session on grace window hit.
      session = await this.sessions.handleGraceWindow(incomingHash);
      if (!session) throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { userId } = session;
    const channel = session.channel as unknown as ChannelType;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          select: {
            departmentId: true,
            teamId: true,
            department: { select: { businessUnitId: true } },
          },
        },
        userRoles: {
          where: { revokedAt: null },
          include: { role: { select: { code: true } } },
        },
      },
    });

    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    const roleAssignments = this.users.buildRoleAssignments(dbUser.userRoles);
    const { rawToken: newRawRefresh } = this.tokens.generateRefreshToken();

    const jwtPayload = this.tokens.buildJwtPayload({
      userId: dbUser.id,
      employeeId: dbUser.employeeId,
      departmentId: dbUser.employee?.departmentId ?? null,
      teamId: dbUser.employee?.teamId ?? null,
      businessUnitId: dbUser.employee?.department?.businessUnitId ?? null,
      channel,
      sessionId: session.id,
      roleAssignments,
    });

    const { token: newAccessToken, expiresIn } = this.tokens.signAccessToken(jwtPayload);
    await this.sessions.rotate(session, newAccessToken, newRawRefresh);

    this.audit.log(userId, SecurityEventType.TOKEN_REFRESHED, meta);
    return { accessToken: newAccessToken, refreshToken: newRawRefresh, expiresIn };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessions.revokeById(sessionId);
    this.audit.log(userId, SecurityEventType.LOGOUT);
  }
}
