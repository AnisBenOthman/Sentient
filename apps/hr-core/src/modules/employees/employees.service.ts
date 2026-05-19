import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ContractType,
  EducationLevel,
  Employee,
  EmploymentStatus,
  MaritalStatus,
  Prisma,
  SalaryChangeReason,
  SalaryHistory,
} from '../../generated/prisma';
import { Decimal } from '../../generated/prisma/runtime/library';
import { IEventBus, EVENT_BUS, JwtPayload, PermissionScope, ProficiencyLevel, SkillDomain, SkillRequirementLevel } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SkillsGapQueryDto } from './dto/skills-gap-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

// ============================================================
// Response shapes
// WHY: Augment the base Prisma Employee type with joined relations
// from the defaultInclude() so call sites get full type safety.
// ============================================================

export type EmployeeProfile = Employee & {
  department: {
    id: string;
    name: string;
    businessUnitId: string;
    businessUnit: { id: string; name: string } | null;
  } | null;
  team: {
    id: string;
    name: string;
    businessUnitId: string;
    businessUnit: { id: string; name: string } | null;
  } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  salaryHistory?: SalaryHistory[];
};

export interface PaginatedEmployees {
  data: EmployeeProfile[];
  total: number;
  page: number;
  limit: number;
}

type GapStatus = 'MET' | 'EXCEEDS' | 'PARTIAL' | 'MISSING';

export interface SkillGapItem {
  skill: { id: string; name: string; domain: SkillDomain | null; category: string | null };
  requirementLevel: SkillRequirementLevel;
  requiredProficiency: ProficiencyLevel;
  acquiredProficiency: ProficiencyLevel | null;
  gapSize: number;
  status: GapStatus;
}

export interface SkillsGapResult {
  employeeId: string;
  positionId: string;
  positionTitle: string;
  summary: {
    totalRequired: number;
    met: number;
    exceeds: number;
    partial: number;
    missing: number;
    byLevel: Record<SkillRequirementLevel, { total: number; met: number; gaps: number }>;
  };
  items: SkillGapItem[];
}

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  [ProficiencyLevel.BEGINNER]: 0,
  [ProficiencyLevel.INTERMEDIATE]: 1,
  [ProficiencyLevel.ADVANCED]: 2,
  [ProficiencyLevel.EXPERT]: 3,
};

const TERMINAL_STATUSES = new Set<string>([
  EmploymentStatus.TERMINATED,
  EmploymentStatus.RESIGNED,
]);

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  // ============================================================
  // US1: Create Employee
  // ============================================================

  async create(dto: CreateEmployeeDto, actorUserId: string): Promise<EmployeeProfile> {
    await this.ensureEmailUnique(null, dto.email);

    const employeeCode = dto.employeeCode ?? (await this.generateEmployeeCode());
    await this.ensureEmployeeCodeUnique(null, employeeCode);

    if (dto.positionId) await this.validatePosition(dto.positionId);
    if (dto.managerId) await this.validateEmployee(dto.managerId, 'managerId');

    // Validate team↔department alignment; auto-derive departmentId from team when omitted.
    const effectiveDepartmentId = await this.resolveTeamDepartmentAlignment(
      dto.teamId ?? null,
      dto.departmentId ?? null,
    );

    const employee = await this.prisma.employee.create({
      data: {
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: new Date(dto.hireDate),
        contractType: dto.contractType as ContractType,
        grossSalary: dto.grossSalary ? new Decimal(dto.grossSalary) : undefined,
        netSalary: dto.netSalary ? new Decimal(dto.netSalary) : undefined,
        maritalStatus: dto.maritalStatus as MaritalStatus | undefined,
        educationLevel: dto.educationLevel as EducationLevel | undefined,
        educationField: dto.educationField,
        positionId: dto.positionId,
        departmentId: effectiveDepartmentId,
        teamId: dto.teamId,
        managerId: dto.managerId,
      },
      include: this.defaultInclude(),
    });

    await this.eventBus.emit({
      id: randomUUID(),
      type: 'employee.created',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        employeeId: employee.id,
        departmentId: employee.departmentId,
        teamId: employee.teamId,
      },
      metadata: { userId: actorUserId, correlationId: randomUUID() },
    });

    return employee as EmployeeProfile;
  }

  // ============================================================
  // US2: View Employee Profile
  // ============================================================

  async findById(id: string, user: JwtPayload): Promise<EmployeeProfile> {
    const scopeFilter = this.buildProfileAccessFilter(user);
    const where: Prisma.EmployeeWhereInput = { AND: [scopeFilter, { id, deletedAt: null }] };
    const canViewSensitive =
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE') ||
      user.employeeId === id;

    const employee = await this.prisma.employee.findFirst({
      where,
      include: {
        ...this.defaultInclude(),
        // WHY: Profile detail can expose salary history to HR/exec users and
        // to the employee viewing their own self-service profile.
        ...(canViewSensitive && {
          salaryHistory: { orderBy: { effectiveDate: 'desc' as const } },
        }),
      },
    });

    if (!employee) {
      // Distinguish 403 (scope) from 404 (not found or deleted):
      const exists = await this.prisma.employee.findUnique({
        where: { id },
        select: { id: true, deletedAt: true },
      });
      if (exists && !exists.deletedAt) {
        throw new ForbiddenException('You do not have permission to view this employee');
      }
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return this.stripSensitiveFields(employee as EmployeeProfile, user.roles, canViewSensitive);
  }

  // ============================================================
  // US3: Update Employee
  // ============================================================

  async update(id: string, dto: UpdateEmployeeDto, actorUserId: string): Promise<EmployeeProfile> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Employee ${id} not found`);

    if (dto.email !== undefined && dto.email !== existing.email) {
      await this.ensureEmailUnique(id, dto.email);
    }
    if (dto.positionId !== undefined && dto.positionId !== existing.positionId) {
      await this.validatePosition(dto.positionId);
    }
    if (dto.managerId !== undefined && dto.managerId !== existing.managerId) {
      await this.validateEmployee(dto.managerId, 'managerId');
    }

    // Determine the team and department that will be in effect after the update.
    const teamChanging = dto.teamId !== undefined && dto.teamId !== existing.teamId;
    const deptChanging = dto.departmentId !== undefined && dto.departmentId !== existing.departmentId;

    if (teamChanging || deptChanging) {
      const effectiveTeamId =
        dto.teamId !== undefined ? (dto.teamId ?? null) : (existing.teamId ?? null);
      const effectiveDeptId =
        dto.departmentId !== undefined ? (dto.departmentId ?? null) : (existing.departmentId ?? null);

      await this.resolveTeamDepartmentAlignment(effectiveTeamId, effectiveDeptId);
    }

    const incomingGross = dto.grossSalary ? new Decimal(dto.grossSalary) : undefined;
    const incomingNet   = dto.netSalary   ? new Decimal(dto.netSalary)   : undefined;
    const prevGross     = existing.grossSalary ?? new Decimal(0);
    const prevNet       = existing.netSalary   ?? new Decimal(0);
    const salaryChanged = incomingGross !== undefined && !incomingGross.equals(prevGross);

    let updated: EmployeeProfile;

    if (salaryChanged && incomingGross !== undefined) {
      // WHY: $transaction ensures salary history is always created when
      // the salary changes — no partial updates under concurrent writes.
      const [, emp] = await this.prisma.$transaction([
        this.prisma.salaryHistory.create({
          data: {
            employeeId: id,
            previousGrossSalary: prevGross,
            newGrossSalary: incomingGross,
            previousNetSalary: prevNet,
            newNetSalary: incomingNet,
            grossRaisePercentage:
              !prevGross.isZero()
                ? incomingGross.minus(prevGross).div(prevGross).times(100).toDecimalPlaces(2)
                : null,
            netRaisePercentage:
              incomingNet && !prevNet.isZero()
                ? incomingNet.minus(prevNet).div(prevNet).times(100).toDecimalPlaces(2)
                : null,
            effectiveDate: new Date(),
            reason: dto.salaryChangeReason as unknown as SalaryChangeReason | undefined,
            reasonComment: dto.salaryChangeComment,
            changedById: actorUserId,
          },
        }),
        this.prisma.employee.update({
          where: { id },
          data: this.buildUpdateData(dto, incomingGross, incomingNet),
          include: this.defaultInclude(),
        }),
      ]);
      updated = emp as unknown as EmployeeProfile;
    } else {
      updated = await this.prisma.employee.update({
        where: { id },
        data: this.buildUpdateData(dto, incomingGross, incomingNet),
        include: this.defaultInclude(),
      }) as unknown as EmployeeProfile;
    }

    await this.eventBus.emit({
      id: randomUUID(),
      type: 'employee.updated',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: { employeeId: id, changedFields: Object.keys(dto) },
      metadata: { userId: actorUserId, correlationId: randomUUID() },
    });

    return updated;
  }

  // ============================================================
  // US4: List & Search Employees
  // ============================================================

  async findAll(query: EmployeeQueryDto, user: JwtPayload): Promise<PaginatedEmployees> {
    const filters: Prisma.EmployeeWhereInput[] = [{ deletedAt: null }];
    const includeCompensation = query.includeCompensation === true;

    if (includeCompensation) {
      filters.push(this.buildCompensationAccessFilter(user));
    }

    if (query.businessUnitId) {
      filters.push({
        OR: [
          { department: { businessUnitId: query.businessUnitId } },
          { team: { businessUnitId: query.businessUnitId } },
        ],
      });
    }
    if (query.departmentId) filters.push({ departmentId: query.departmentId });
    if (query.teamId) filters.push({ teamId: query.teamId });
    const employmentStatus = query.employmentStatus ?? query.status;
    if (employmentStatus) filters.push({ employmentStatus: employmentStatus as EmploymentStatus });
    if (query.contractType) filters.push({ contractType: query.contractType as ContractType });
    if (query.positionId) filters.push({ positionId: query.positionId });
    if (query.search) {
      filters.push({
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.EmployeeWhereInput = { AND: filters };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortField = query.sortBy ?? 'firstName';
    const sortOrder = query.sortOrder ?? 'asc';

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { [sortField]: sortOrder } as Prisma.EmployeeOrderByWithRelationInput,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    const data = (employees as EmployeeProfile[]).map((e) =>
      includeCompensation
        ? this.stripDirectoryFieldsForCompensationScope(e, user.roles)
        : this.stripSensitiveFields(e, user.roles),
    );

    return { data, total, page, limit };
  }

  // ============================================================
  // US5: Lifecycle Status Transitions
  // ============================================================

  async updateStatus(
    id: string,
    dto: UpdateEmployeeStatusDto,
    actorUserId: string,
  ): Promise<Employee> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Employee ${id} not found`);

    if (existing.employmentStatus === dto.status) {
      throw new ConflictException(`Employee is already in status ${dto.status}`);
    }

    // WHY: TERMINATED and RESIGNED are terminal states — no further
    // transitions permitted. Mirrors real-world HR policy.
    if (TERMINAL_STATUSES.has(existing.employmentStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.employmentStatus} — this status is terminal`,
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { employmentStatus: dto.status as EmploymentStatus },
    });

    const isTermination = TERMINAL_STATUSES.has(dto.status);
    await this.eventBus.emit({
      id: randomUUID(),
      type: isTermination ? 'employee.terminated' : 'employee.updated',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        employeeId: id,
        reason: dto.reason,
        effectiveDate: dto.effectiveDate ?? new Date().toISOString(),
      },
      metadata: { userId: actorUserId, correlationId: randomUUID() },
    });

    return updated;
  }

  // ============================================================
  // US6: Salary History
  // ============================================================

  async getSalaryHistory(employeeId: string, limit: number, user: JwtPayload): Promise<SalaryHistory[]> {
    const exists = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, deletedAt: true },
    });
    if (!exists || exists.deletedAt) throw new NotFoundException(`Employee ${employeeId} not found`);

    const isPrivileged =
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE');
    if (!isPrivileged && user.employeeId !== employeeId) {
      throw new ForbiddenException('You do not have permission to view this salary history');
    }

    return this.prisma.salaryHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      take: limit,
    });
  }

  // ============================================================
  // US7: Soft Delete
  // ============================================================

  async remove(id: string, actorUserId: string): Promise<void> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Employee ${id} not found`);

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.eventBus.emit({
      id: randomUUID(),
      type: 'employee.deleted',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: { employeeId: id },
      metadata: { userId: actorUserId, correlationId: randomUUID() },
    });
  }

  // ============================================================
  // Skills gap analysis
  // ============================================================

  async getSkillsGap(employeeId: string, query: SkillsGapQueryDto, user: JwtPayload): Promise<SkillsGapResult> {
    const scopeFilter = this.buildScopeFilter(user);
    const employee = await this.prisma.employee.findFirst({
      where: { AND: [scopeFilter, { id: employeeId, deletedAt: null }] },
      select: { id: true, positionId: true },
    });

    if (!employee) {
      const exists = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, deletedAt: true } });
      if (exists && !exists.deletedAt) throw new ForbiddenException('You do not have permission to view this employee');
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const positionId = query.positionId ?? employee.positionId;
    if (!positionId) {
      throw new BadRequestException('Employee has no assigned position. Provide a positionId query parameter.');
    }

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: {
        id: true,
        title: true,
        requiredSkills: {
          include: { skill: { select: { id: true, name: true, domain: true, category: true } } },
          orderBy: { createdAt: 'asc' as const },
        },
      },
    });
    if (!position) throw new NotFoundException(`Position ${positionId} not found`);

    const employeeSkills = await this.prisma.employeeSkill.findMany({
      where: { employeeId, deletedAt: null },
      select: { skillId: true, proficiency: true },
    });

    const acquiredMap = new Map(employeeSkills.map((es) => [es.skillId, es.proficiency as ProficiencyLevel]));

    const items: SkillGapItem[] = position.requiredSkills.map((ps) => {
      const acquiredProficiency = acquiredMap.get(ps.skillId) ?? null;
      const requiredRank = PROFICIENCY_RANK[ps.minimumProficiency as ProficiencyLevel] ?? 0;
      const acquiredRank = acquiredProficiency !== null ? (PROFICIENCY_RANK[acquiredProficiency] ?? 0) : null;

      let status: GapStatus;
      let gapSize: number;

      if (acquiredRank === null) {
        status = 'MISSING';
        gapSize = requiredRank;
      } else {
        gapSize = requiredRank - acquiredRank;
        if (gapSize > 0) status = 'PARTIAL';
        else if (gapSize === 0) status = 'MET';
        else status = 'EXCEEDS';
      }

      return {
        skill: { ...ps.skill, domain: ps.skill.domain as SkillDomain | null },
        requirementLevel: ps.requirementLevel as SkillRequirementLevel,
        requiredProficiency: ps.minimumProficiency as ProficiencyLevel,
        acquiredProficiency,
        gapSize,
        status,
      };
    });

    const emptyLevelStat = () => ({ total: 0, met: 0, gaps: 0 });
    const byLevel: Record<SkillRequirementLevel, { total: number; met: number; gaps: number }> = {
      [SkillRequirementLevel.MANDATORY]: emptyLevelStat(),
      [SkillRequirementLevel.EXPECTED]: emptyLevelStat(),
      [SkillRequirementLevel.NICE_TO_HAVE]: emptyLevelStat(),
    };

    for (const item of items) {
      const bucket = byLevel[item.requirementLevel];
      if (bucket !== undefined) {
        bucket.total += 1;
        if (item.status === 'MET' || item.status === 'EXCEEDS') bucket.met += 1;
        else bucket.gaps += 1;
      }
    }

    return {
      employeeId,
      positionId,
      positionTitle: position.title,
      summary: {
        totalRequired: items.length,
        met: items.filter((i) => i.status === 'MET').length,
        exceeds: items.filter((i) => i.status === 'EXCEEDS').length,
        partial: items.filter((i) => i.status === 'PARTIAL').length,
        missing: items.filter((i) => i.status === 'MISSING').length,
        byLevel,
      },
      items,
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private buildScopeFilter(user: JwtPayload): Prisma.EmployeeWhereInput {
    const hasGlobalVisibility = user.roleAssignments.some(
      (ra) =>
        ra.scope === PermissionScope.GLOBAL &&
        ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN'].includes(ra.roleCode),
    );
    if (hasGlobalVisibility || user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE')) {
      return {};
    }
    // WHY: BUSINESS_UNIT scope is a per-assignment claim, not a role code.
    // Employee has no direct businessUnitId — filter via department or team.
    const buAssignment = user.roleAssignments.find(
      (ra) => ra.scope === PermissionScope.BUSINESS_UNIT,
    );
    if (buAssignment) {
      const buId = buAssignment.scopeEntityId ?? user.businessUnitId;
      if (buId) {
        return {
          OR: [
            { department: { businessUnitId: buId } },
            { team: { businessUnitId: buId } },
          ],
        };
      }
    }
    const departmentAssignment = user.roleAssignments.find(
      (ra) => ra.scope === PermissionScope.DEPARTMENT,
    );
    const departmentId = departmentAssignment?.scopeEntityId ?? null;
    if (departmentId) {
      return { departmentId };
    }

    if (user.roleAssignments.length === 0 && user.roles.includes('EMPLOYEE') && user.employeeId) {
      return { id: user.employeeId };
    }

    const teamAssignment = user.roleAssignments.find(
      (ra) => ra.scope === PermissionScope.TEAM,
    );
    const teamId = teamAssignment?.scopeEntityId ?? user.teamId;
    if (teamId) {
      return { teamId };
    }
    // OWN scope — an account with no linked employee has no visibility
    if (!user.employeeId) {
      throw new ForbiddenException('No employee profile linked to this account');
    }
    return { id: user.employeeId };
  }

  private buildProfileAccessFilter(user: JwtPayload): Prisma.EmployeeWhereInput {
    const isPrivileged =
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE');
    if (isPrivileged) return {};

    if (user.roles.includes('MANAGER') || user.roles.includes('TEAM_LEAD')) {
      const departmentAssignment = user.roleAssignments.find(
        (assignment) =>
          (assignment.roleCode === 'MANAGER' || assignment.roleCode === 'TEAM_LEAD') &&
          assignment.scope === PermissionScope.DEPARTMENT,
      );
      if (departmentAssignment?.scopeEntityId) return { departmentId: departmentAssignment.scopeEntityId };

      const teamAssignment = user.roleAssignments.find(
        (assignment) =>
          (assignment.roleCode === 'MANAGER' || assignment.roleCode === 'TEAM_LEAD') &&
          assignment.scope === PermissionScope.TEAM,
      );
      if (teamAssignment?.scopeEntityId) return { teamId: teamAssignment.scopeEntityId };

      const managerScopes: Prisma.EmployeeWhereInput[] = [];
      if (user.employeeId) {
        managerScopes.push(
          { department: { is: { headId: user.employeeId } } },
          { team: { is: { leadId: user.employeeId } } },
        );
      }
      if (user.teamId) managerScopes.push({ teamId: user.teamId });
      if (managerScopes.length > 0) return { OR: managerScopes };
    }

    if (user.employeeId) return { id: user.employeeId };
    throw new ForbiddenException('No employee profile linked to this account');
  }

  private buildCompensationAccessFilter(user: JwtPayload): Prisma.EmployeeWhereInput {
    const isPrivileged =
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE');
    if (isPrivileged) return {};
    if (!user.roles.includes('MANAGER') && !user.roles.includes('TEAM_LEAD')) {
      throw new ForbiddenException('Compensation data is limited to HR and manager simulation scopes');
    }
    return this.buildProfileAccessFilter(user);
  }

  private stripDirectoryFieldsForCompensationScope(
    employee: EmployeeProfile,
    roles: string[],
  ): EmployeeProfile {
    const isPrivileged =
      roles.includes('HR_ADMIN') ||
      roles.includes('GLOBAL_HR_ADMIN') ||
      roles.includes('EXECUTIVE');
    return {
      ...employee,
      netSalary: isPrivileged ? employee.netSalary : null,
      dateOfBirth: isPrivileged ? employee.dateOfBirth : null,
      salaryHistory: undefined,
    };
  }

  private stripSensitiveFields(
    employee: EmployeeProfile,
    roles: string[],
    revealSensitive = false,
  ): EmployeeProfile {
    const isPrivileged =
      revealSensitive ||
      roles.includes('HR_ADMIN') ||
      roles.includes('GLOBAL_HR_ADMIN') ||
      roles.includes('EXECUTIVE');
    if (!isPrivileged) {
      return {
        ...employee,
        grossSalary: null,
        netSalary: null,
        dateOfBirth: null,
        salaryHistory: undefined,
      };
    }
    return employee;
  }

  private buildUpdateData(
    dto: UpdateEmployeeDto,
    incomingGross: Decimal | undefined,
    incomingNet: Decimal | undefined,
  ): Prisma.EmployeeUpdateInput {
    return {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.contractType !== undefined && { contractType: dto.contractType as ContractType }),
      ...(incomingGross !== undefined && { grossSalary: incomingGross }),
      ...(incomingNet !== undefined && { netSalary: incomingNet }),
      ...(dto.maritalStatus !== undefined && { maritalStatus: dto.maritalStatus as MaritalStatus }),
      ...(dto.educationLevel !== undefined && { educationLevel: dto.educationLevel as EducationLevel }),
      ...(dto.educationField !== undefined && { educationField: dto.educationField }),
      ...(dto.positionId !== undefined && { positionId: dto.positionId }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.teamId !== undefined && { teamId: dto.teamId }),
      ...(dto.managerId !== undefined && { managerId: dto.managerId }),
    };
  }

  private defaultInclude() {
    return {
      department: {
        select: {
          id: true,
          name: true,
          businessUnitId: true,
          businessUnit: { select: { id: true, name: true } },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          businessUnitId: true,
          businessUnit: { select: { id: true, name: true } },
        },
      },
      position: { select: { id: true, title: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    } as const;
  }

  private async generateEmployeeCode(): Promise<string> {
    // WHY: Sort by employeeCode desc (not createdAt) so manually-assigned
    // out-of-order codes don't cause collisions.
    const last = await this.prisma.employee.findFirst({
      where: { employeeCode: { startsWith: 'EMP-' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });

    let next = 1;
    if (last?.employeeCode) {
      const num = parseInt(last.employeeCode.replace('EMP-', ''), 10);
      if (!isNaN(num)) next = num + 1;
    }

    return `EMP-${String(next).padStart(4, '0')}`;
  }

  private async ensureEmailUnique(excludeId: string | null, email: string): Promise<void> {
    const existing = await this.prisma.employee.findFirst({ where: { email } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Email ${email} is already in use`);
    }
  }

  private async ensureEmployeeCodeUnique(excludeId: string | null, code: string): Promise<void> {
    const existing = await this.prisma.employee.findFirst({
      where: { employeeCode: code },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Employee code ${code} is already in use`);
    }
  }

  private async validatePosition(positionId: string): Promise<void> {
    const pos = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true },
    });
    if (!pos) throw new NotFoundException(`Position ${positionId} not found`);
  }

  /**
   * WHY: An employee's team must always belong to their department.
   * If teamId is provided without departmentId, we auto-derive the department
   * from the team so HR admins don't need to repeat redundant data.
   * If both are provided, they must agree.
   *
   * Returns the resolved departmentId (may differ from input when auto-derived).
   */
  private async resolveTeamDepartmentAlignment(
    teamId: string | null,
    departmentId: string | null,
  ): Promise<string | null> {
    if (!teamId) {
      if (departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: departmentId },
          select: { id: true },
        });
        if (!dept) throw new NotFoundException(`Department ${departmentId} not found`);
      }
      return departmentId;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);

    if (departmentId && departmentId !== team.departmentId) {
      throw new BadRequestException(
        `Team "${team.name}" belongs to department "${team.department.name}" (${team.departmentId}), not the specified department (${departmentId})`,
      );
    }

    return team.departmentId;
  }

  private async validateEmployee(employeeId: string, field: string): Promise<void> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!emp) {
      throw new NotFoundException(
        `Employee referenced by ${field} (${employeeId}) not found`,
      );
    }
  }
}
