import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UserStatus } from '@sentient/shared';
import { RoleAssignmentClaim } from '@sentient/shared';
import { PermissionScope } from '@sentient/shared';
import { User } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { Argon2Service } from './argon2.service';
import { AuditService } from './audit.service';
import { PasswordPolicyService } from './password-policy.service';
import { SecurityEventType } from '@sentient/shared';

export interface UserWithRelations {
  id: string;
  email: string;
  passwordHash: string;
  passwordHistory: string[];
  status: UserStatus;
  employeeId: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  employee: {
    departmentId: string | null;
    teamId: string | null;
    department: { businessUnitId: string } | null;
  } | null;
  userRoles: {
    scope: PermissionScope;
    scopeEntityId: string | null;
    role: { code: string };
  }[];
}

@Injectable()
export class UsersService {
  private readonly maxFailedLogins: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly argon2: Argon2Service,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.maxFailedLogins = config.get<number>('MAX_FAILED_LOGINS') ?? 5;
    this.lockoutMinutes = config.get<number>('LOCKOUT_DURATION_MINUTES') ?? 15;
  }

  async findByEmail(email: string): Promise<UserWithRelations | null> {
    const normalized = email.toLowerCase().trim();
    return this.prisma.user.findUnique({
      where: { email: normalized },
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
    }) as Promise<UserWithRelations | null>;
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    // Random unusable sentinel — PENDING_ACTIVATION blocks login before the user
    // claims their invite and sets a real password.
    const tempHash = await this.argon2.hash(randomBytes(32).toString('hex'));

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: tempHash,
        passwordHistory: [],
        status: UserStatus.PENDING_ACTIVATION,
        employeeId: dto.employeeId ?? null,
      },
    });

    this.audit.log(user.id, SecurityEventType.USER_CREATED);
    return user;
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    if (status === UserStatus.DISABLED || status === UserStatus.LOCKED) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (status === UserStatus.DISABLED) {
      this.audit.log(id, SecurityEventType.USER_DISABLED);
    }
    return user;
  }

  async incrementFailedLogins(id: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
    });

    if (user.failedLoginCount >= this.maxFailedLogins) {
      const lockedUntil = new Date(Date.now() + this.lockoutMinutes * 60_000);
      const locked = await this.prisma.user.update({
        where: { id },
        data: { lockedUntil, status: UserStatus.LOCKED },
      });
      this.audit.log(id, SecurityEventType.ACCOUNT_LOCKED);
      return locked;
    }
    return user;
  }

  async resetFailedLogins(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async unlockAccount(id: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginCount: 0, status: UserStatus.ACTIVE },
    });
    this.audit.log(id, SecurityEventType.ACCOUNT_UNLOCKED);
    return user;
  }

  async changePassword(
    id: string,
    newPassword: string,
    currentHistory: string[],
  ): Promise<void> {
    this.passwordPolicy.validateComplexity(newPassword);
    await this.passwordPolicy.assertNotReused(newPassword, currentHistory);
    const newHash = await this.argon2.hash(newPassword);
    const updatedHistory = this.passwordPolicy.buildUpdatedHistory(newHash, currentHistory);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: newHash,
        passwordHistory: updatedHistory,
        mustChangePassword: false,
      },
    });
    this.audit.log(id, SecurityEventType.PASSWORD_CHANGED);
  }

  buildRoleAssignments(
    userRoles: { scope: unknown; scopeEntityId: string | null; role: { code: string } }[],
  ): RoleAssignmentClaim[] {
    return userRoles.map((ur) => ({
      roleCode: ur.role.code,
      scope: ur.scope as PermissionScope,
      scopeEntityId: ur.scopeEntityId,
    }));
  }
}
