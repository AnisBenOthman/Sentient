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
  Employee,
  EmploymentStatus,
  Prisma,
  SalaryHistory,
} from '../../generated/prisma';
import { Decimal } from '../../generated/prisma/runtime/library';
import { IEventBus, EVENT_BUS, JwtPayload } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

// ============================================================
// Response shapes
// WHY: Augment the base Prisma Employee type with joined relations
// from the defaultInclude() so call sites get full type safety.
// ============================================================

export type EmployeeProfile = Employee & {
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
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
    if (dto.departmentId) await this.validateDepartment(dto.departmentId);
    if (dto.teamId) await this.validateTeam(dto.teamId);
    if (dto.managerId) await this.validateEmployee(dto.managerId, 'managerId');

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
        currentSalary: dto.currentSalary ? new Decimal(dto.currentSalary) : undefined,
        positionId: dto.positionId,
        departmentId: dto.departmentId,
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
    const scopeFilter = this.buildScopeFilter(user);
    const where: Prisma.EmployeeWhereInput = { AND: [scopeFilter, { id }] };
    const isPrivileged = user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE');

    const employee = await this.prisma.employee.findFirst({
      where,
      include: {
        ...this.defaultInclude(),
        // WHY: Spec requires complete profile for privileged roles,
        // including salary history. Non-privileged roles get it stripped anyway.
        ...(isPrivileged && {
          salaryHistory: { orderBy: { effectiveDate: 'desc' as const } },
        }),
      },
    });

    if (!employee) {
      // Distinguish 403 (scope) from 404 (not found):
      const exists = await this.prisma.employee.findUnique({
        where: { id },
        select: { id: true },
      });
      if (exists) {
        throw new ForbiddenException('You do not have permission to view this employee');
      }
      throw new NotFoundException(`Employee ${id} not found`);
    }

    return this.stripSensitiveFields(employee as EmployeeProfile, user.roles);
  }

  // ============================================================
  // US3: Update Employee
  // ============================================================

  async update(id: string, dto: UpdateEmployeeDto, actorUserId: string): Promise<EmployeeProfile> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Employee ${id} not found`);

    if (dto.email !== undefined && dto.email !== existing.email) {
      await this.ensureEmailUnique(id, dto.email);
    }
    if (dto.positionId !== undefined && dto.positionId !== existing.positionId) {
      await this.validatePosition(dto.positionId);
    }
    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      await this.validateDepartment(dto.departmentId);
    }
    if (dto.teamId !== undefined && dto.teamId !== existing.teamId) {
      await this.validateTeam(dto.teamId);
    }
    if (dto.managerId !== undefined && dto.managerId !== existing.managerId) {
      await this.validateEmployee(dto.managerId, 'managerId');
    }

    const incomingSalary = dto.currentSalary ? new Decimal(dto.currentSalary) : undefined;
    const previousSalary = existing.currentSalary;
    const salaryChanged =
      incomingSalary !== undefined &&
      !incomingSalary.equals(previousSalary ?? new Decimal(0));

    let updated: EmployeeProfile;

    if (salaryChanged && incomingSalary !== undefined) {
      // WHY: $transaction ensures salary history is always created when
      // the salary changes — no partial updates under concurrent writes.
      const [, emp] = await this.prisma.$transaction([
        this.prisma.salaryHistory.create({
          data: {
            employeeId: id,
            previousSalary: previousSalary ?? new Decimal(0),
            newSalary: incomingSalary,
            effectiveDate: new Date(),
            reason: dto.salaryChangeReason,
            changedById: actorUserId,
          },
        }),
        this.prisma.employee.update({
          where: { id },
          data: this.buildUpdateData(dto, incomingSalary),
          include: this.defaultInclude(),
        }),
      ]);
      updated = emp as unknown as EmployeeProfile;
    } else {
      updated = await this.prisma.employee.update({
        where: { id },
        data: this.buildUpdateData(dto, incomingSalary),
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
    const scopeFilter = this.buildScopeFilter(user);

    const filters: Prisma.EmployeeWhereInput[] = [scopeFilter];

    if (query.departmentId) filters.push({ departmentId: query.departmentId });
    if (query.teamId) filters.push({ teamId: query.teamId });
    if (query.employmentStatus) filters.push({ employmentStatus: query.employmentStatus as EmploymentStatus });
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
      this.stripSensitiveFields(e, user.roles),
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
    if (!existing) throw new NotFoundException(`Employee ${id} not found`);

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

  async getSalaryHistory(employeeId: string, limit: number): Promise<SalaryHistory[]> {
    const exists = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Employee ${employeeId} not found`);

    return this.prisma.salaryHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveDate: 'desc' },
      take: limit,
    });
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private buildScopeFilter(user: JwtPayload): Prisma.EmployeeWhereInput {
    if (user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE')) {
      return {};
    }
    if (user.roles.includes('MANAGER') && user.teamId) {
      return { teamId: user.teamId };
    }
    // Default: OWN scope
    return { id: user.employeeId };
  }

  private stripSensitiveFields(employee: EmployeeProfile, roles: string[]): EmployeeProfile {
    const isPrivileged = roles.includes('HR_ADMIN') || roles.includes('EXECUTIVE');
    if (!isPrivileged) {
      return {
        ...employee,
        currentSalary: null,
        dateOfBirth: null,
        salaryHistory: undefined,
      };
    }
    return employee;
  }

  private buildUpdateData(
    dto: UpdateEmployeeDto,
    incomingSalary: Decimal | undefined,
  ): Prisma.EmployeeUpdateInput {
    return {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.contractType !== undefined && { contractType: dto.contractType as ContractType }),
      ...(incomingSalary !== undefined && { currentSalary: incomingSalary }),
      ...(dto.positionId !== undefined && { positionId: dto.positionId }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.teamId !== undefined && { teamId: dto.teamId }),
      ...(dto.managerId !== undefined && { managerId: dto.managerId }),
    };
  }

  private defaultInclude() {
    return {
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
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

  private async validateDepartment(departmentId: string): Promise<void> {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException(`Department ${departmentId} not found`);
  }

  private async validateTeam(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) throw new NotFoundException(`Team ${teamId} not found`);
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
