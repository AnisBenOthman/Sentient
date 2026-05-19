import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainEvent, EVENT_BUS, IEventBus, JwtPayload, PermissionScope } from '@sentient/shared';
import { EmploymentStatus, Prisma, PromotionRequestStatus, SalaryChangeReason } from '../../generated/prisma';
import { Decimal } from '../../generated/prisma/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromotionRequestDto } from './dto/create-promotion-request.dto';
import { PromotionRequestQueryDto } from './dto/promotion-request-query.dto';
import { ReviewPromotionRequestDto } from './dto/review-promotion-request.dto';

type PromotionRequestRow = Prisma.PromotionRequestGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        department: { select: { id: true; name: true; businessUnitId: true } };
        team: { select: { id: true; name: true; departmentId: true; businessUnitId: true } };
      };
    };
    requestedBy: { select: { id: true; firstName: true; lastName: true } };
  };
}>;

export interface PromotionRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  teamId: string | null;
  teamName: string;
  requestedById: string;
  requestedByName: string;
  currentRole: string;
  newRole: string;
  currentGrossSalary: number;
  newGrossSalary: number;
  salaryDelta: number;
  salaryDeltaPercentage: number;
  currentTeamBudget: number;
  newTeamBudget: number;
  budgetImpactPercentage: number;
  responsibilities: string[];
  status: PromotionRequestStatus;
  submittedAt: Date;
}

export interface PromotionRequestsDashboard {
  totalRequests: number;
  averageSalaryLift: number;
  totalBudgetImpact: number;
  pendingRequests: number;
  requests: PromotionRequestDto[];
}

@Injectable()
export class PromotionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(
    dto: CreatePromotionRequestDto,
    user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    const requestedById = this.requireEmployeeId(user);
    if (dto.employeeId === requestedById) {
      throw new BadRequestException('Cannot request a promotion for yourself');
    }
    const employee = await this.prisma.employee.findFirst({
      where: {
        AND: [
          { id: dto.employeeId, deletedAt: null },
          this.buildUserScopeFilter(user),
        ],
      },
      select: {
        id: true,
        grossSalary: true,
        teamId: true,
        managerId: true,
        positionId: true,
        position: { select: { id: true, title: true, isActive: true } },
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    if (!employee.grossSalary || employee.grossSalary.isZero()) {
      throw new BadRequestException('Employee compensation is required before requesting a promotion');
    }
    if (!employee.position) {
      throw new BadRequestException('Employee must have a current position before requesting a promotion');
    }

    const newPosition = await this.prisma.position.findFirst({
      where: { id: dto.newPositionId, isActive: true },
      select: { id: true, title: true },
    });
    if (!newPosition) {
      throw new BadRequestException('Selected promoted position does not exist or is inactive');
    }
    if (newPosition.id === employee.positionId) {
      throw new BadRequestException('Promoted position must be different from the current position');
    }

    const currentGrossSalary = this.roundMoney(this.decimalToNumber(employee.grossSalary));
    const newGrossSalary = this.roundMoney(dto.newGrossSalary);
    if (newGrossSalary <= currentGrossSalary) {
      throw new BadRequestException('Proposed salary must be greater than the current salary');
    }
    const currentTeamBudget = await this.getCurrentTeamBudget(employee.teamId, employee.managerId);
    const salaryDelta = this.roundMoney(newGrossSalary - currentGrossSalary);
    const newTeamBudget = this.roundMoney(currentTeamBudget + salaryDelta);
    const salaryDeltaPercentage =
      currentGrossSalary > 0 ? this.roundPercent((salaryDelta / currentGrossSalary) * 100) : 0;
    const budgetImpactPercentage =
      currentTeamBudget > 0 ? this.roundPercent((salaryDelta / currentTeamBudget) * 100) : 0;

    const responsibilities = (dto.responsibilities ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (responsibilities.length === 0) {
      throw new BadRequestException('At least one responsibility is required');
    }

    const request = await this.prisma.promotionRequest.create({
      data: {
        employeeId: dto.employeeId,
        requestedById,
        currentRole: employee.position.title,
        newRole: newPosition.title,
        currentGrossSalary: new Decimal(currentGrossSalary),
        newGrossSalary: new Decimal(newGrossSalary),
        salaryDelta: new Decimal(salaryDelta),
        salaryDeltaPercentage: new Decimal(salaryDeltaPercentage),
        currentTeamBudget: new Decimal(currentTeamBudget),
        newTeamBudget: new Decimal(newTeamBudget),
        budgetImpactPercentage: new Decimal(budgetImpactPercentage),
        responsibilities,
      },
      include: this.includeRequestRelations(),
    });

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'promotion.requested',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        promotionRequestId: request.id,
        employeeId: request.employeeId,
        requestedById: request.requestedById,
        currentRole: request.currentRole,
        newRole: request.newRole,
        currentGrossSalary,
        newGrossSalary,
        salaryDelta,
        salaryDeltaPercentage,
      },
      metadata: { userId: user.sub, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return this.mapRequest(request);
  }

  async approve(
    id: string,
    dto: ReviewPromotionRequestDto,
    user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    return this.decide(id, dto, user, PromotionRequestStatus.APPROVED);
  }

  async reject(
    id: string,
    dto: ReviewPromotionRequestDto,
    user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    if (!dto.reviewNote || dto.reviewNote.trim().length === 0) {
      throw new BadRequestException('reviewNote is required for rejection');
    }
    return this.decide(id, dto, user, PromotionRequestStatus.REJECTED);
  }

  async findAll(
    query: PromotionRequestQueryDto,
    user: JwtPayload,
  ): Promise<PromotionRequestDto[]> {
    const requests = await this.prisma.promotionRequest.findMany({
      where: this.buildRequestWhere(query, user),
      include: this.includeRequestRelations(),
      orderBy: { submittedAt: 'desc' },
    });
    return requests.map((request) => this.mapRequest(request));
  }

  async getDashboard(
    query: PromotionRequestQueryDto,
    user: JwtPayload,
  ): Promise<PromotionRequestsDashboard> {
    const requests = await this.findAll(query, user);
    const totalRequests = requests.length;
    const totalSalaryLift = requests.reduce((sum, request) => sum + request.salaryDelta, 0);

    return {
      totalRequests,
      averageSalaryLift:
        totalRequests > 0 ? this.roundMoney(totalSalaryLift / totalRequests) : 0,
      totalBudgetImpact: this.roundMoney(totalSalaryLift),
      pendingRequests: requests.filter(
        (request) => request.status === PromotionRequestStatus.PENDING,
      ).length,
      requests,
    };
  }

  private includeRequestRelations(): {
    employee: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        department: { select: { id: true; name: true; businessUnitId: true } };
        team: { select: { id: true; name: true; departmentId: true; businessUnitId: true } };
      };
    };
    requestedBy: { select: { id: true; firstName: true; lastName: true } };
  } {
    return {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { id: true, name: true, businessUnitId: true } },
          team: { select: { id: true, name: true, departmentId: true, businessUnitId: true } },
        },
      },
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  private buildRequestWhere(
    query: PromotionRequestQueryDto,
    user: JwtPayload,
  ): Prisma.PromotionRequestWhereInput {
    const filters: Prisma.PromotionRequestWhereInput[] = [
      { employee: this.buildEmployeeWhere(query, user) },
    ];

    if (query.status) filters.push({ status: query.status });
    if (query.year) {
      filters.push({
        submittedAt: {
          gte: new Date(Date.UTC(query.year, 0, 1)),
          lt: new Date(Date.UTC(query.year + 1, 0, 1)),
        },
      });
    }

    return { AND: filters };
  }

  private buildEmployeeWhere(
    query: PromotionRequestQueryDto,
    user: JwtPayload,
  ): Prisma.EmployeeWhereInput {
    const filters: Prisma.EmployeeWhereInput[] = [
      this.buildUserScopeFilter(user),
      { deletedAt: null },
    ];

    if (query.employeeId) filters.push({ id: query.employeeId });
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

    return { AND: filters };
  }

  private buildUserScopeFilter(user: JwtPayload): Prisma.EmployeeWhereInput {
    const hasGlobalVisibility = user.roleAssignments.some(
      (assignment) =>
        assignment.scope === PermissionScope.GLOBAL &&
        ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN'].includes(
          assignment.roleCode,
        ),
    );
    if (
      hasGlobalVisibility ||
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE') ||
      user.roles.includes('SYSTEM_ADMIN')
    ) {
      return {};
    }

    const departmentAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.DEPARTMENT,
    );
    if (departmentAssignment?.scopeEntityId) {
      return { departmentId: departmentAssignment.scopeEntityId };
    }

    const teamAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.TEAM,
    );
    if (teamAssignment?.scopeEntityId) return { teamId: teamAssignment.scopeEntityId };

    const businessUnitAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.BUSINESS_UNIT,
    );
    const businessUnitId = businessUnitAssignment?.scopeEntityId ?? null;
    if (businessUnitId) {
      return {
        OR: [
          { department: { businessUnitId } },
          { team: { businessUnitId } },
        ],
      };
    }

    if (user.roles.includes('MANAGER') || user.roles.includes('TEAM_LEAD')) {
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

    if (user.teamId) return { teamId: user.teamId };

    if (user.businessUnitId) {
      return {
        OR: [
          { department: { businessUnitId: user.businessUnitId } },
          { team: { businessUnitId: user.businessUnitId } },
        ],
      };
    }

    if (user.employeeId) return { id: user.employeeId };
    throw new ForbiddenException('No employee profile linked to this account');
  }

  private mapRequest(request: PromotionRequestRow): PromotionRequestDto {
    return {
      id: request.id,
      employeeId: request.employeeId,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      departmentId: request.employee.department?.id ?? null,
      departmentName: request.employee.department?.name ?? 'Unassigned',
      teamId: request.employee.team?.id ?? null,
      teamName: request.employee.team?.name ?? 'Unassigned',
      requestedById: request.requestedById,
      requestedByName: `${request.requestedBy.firstName} ${request.requestedBy.lastName}`,
      currentRole: request.currentRole,
      newRole: request.newRole,
      currentGrossSalary: this.decimalToNumber(request.currentGrossSalary),
      newGrossSalary: this.decimalToNumber(request.newGrossSalary),
      salaryDelta: this.decimalToNumber(request.salaryDelta),
      salaryDeltaPercentage: this.decimalToNumber(request.salaryDeltaPercentage),
      currentTeamBudget: this.decimalToNumber(request.currentTeamBudget),
      newTeamBudget: this.decimalToNumber(request.newTeamBudget),
      budgetImpactPercentage: this.decimalToNumber(request.budgetImpactPercentage),
      responsibilities: this.parseResponsibilities(request.responsibilities),
      status: request.status,
      submittedAt: request.submittedAt,
    };
  }

  private parseResponsibilities(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async getCurrentTeamBudget(
    teamId: string | null,
    managerId: string | null,
  ): Promise<number> {
    const scope: Prisma.EmployeeWhereInput =
      teamId
        ? { teamId }
        : managerId
          ? { managerId }
          : {};
    const result = await this.prisma.employee.aggregate({
      where: {
        ...scope,
        deletedAt: null,
        employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] },
      },
      _sum: { grossSalary: true },
    });
    return this.roundMoney(this.decimalToNumber(result._sum.grossSalary ?? 0));
  }

  private requireEmployeeId(user: JwtPayload): string {
    if (!user.employeeId) throw new ForbiddenException('No employee record linked to this account');
    return user.employeeId;
  }

  private async decide(
    id: string,
    dto: ReviewPromotionRequestDto,
    user: JwtPayload,
    status: typeof PromotionRequestStatus.APPROVED | typeof PromotionRequestStatus.REJECTED,
  ): Promise<PromotionRequestDto> {
    if (!user.roles.some((role) => ['HR_ADMIN', 'GLOBAL_HR_ADMIN'].includes(role))) {
      throw new ForbiddenException('HR admin role required');
    }
    const reviewedById = this.requireEmployeeId(user);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.promotionRequest.findUnique({
        where: { id },
        include: {
          employee: { select: { grossSalary: true, netSalary: true } },
        },
      });
      if (!request) throw new NotFoundException(`PromotionRequest ${id} not found`);
      if (request.status !== PromotionRequestStatus.PENDING) {
        throw new ConflictException('RequestAlreadyDecided');
      }

      if (status === PromotionRequestStatus.APPROVED) {
        const promotedPosition = await tx.position.findFirst({
          where: { title: request.newRole, isActive: true },
          select: { id: true },
        });
        if (!promotedPosition) {
          throw new BadRequestException(`Promoted position ${request.newRole} is no longer active`);
        }

        const previousGrossSalary = request.employee.grossSalary ?? request.currentGrossSalary;
        const previousNetSalary = request.employee.netSalary;
        const newNetSalary = previousNetSalary
          ? this.deriveNetSalary(previousGrossSalary, previousNetSalary, request.newGrossSalary)
          : null;

        if (!request.newGrossSalary.equals(previousGrossSalary)) {
          await tx.salaryHistory.create({
            data: {
              employeeId: request.employeeId,
              previousGrossSalary,
              newGrossSalary: request.newGrossSalary,
              previousNetSalary,
              newNetSalary,
              grossRaisePercentage: !previousGrossSalary.isZero()
                ? request.newGrossSalary
                    .minus(previousGrossSalary)
                    .div(previousGrossSalary)
                    .times(100)
                    .toDecimalPlaces(2)
                : null,
              netRaisePercentage:
                previousNetSalary && newNetSalary && !previousNetSalary.isZero()
                  ? newNetSalary
                      .minus(previousNetSalary)
                      .div(previousNetSalary)
                      .times(100)
                      .toDecimalPlaces(2)
                  : null,
              effectiveDate: new Date(),
              reason: SalaryChangeReason.PROMOTION,
              reasonComment: dto.reviewNote?.trim() || `Approved promotion to ${request.newRole}`,
              changedById: user.sub,
            },
          });
        }

        await tx.employee.update({
          where: { id: request.employeeId },
          data: {
            positionId: promotedPosition.id,
            grossSalary: request.newGrossSalary,
            netSalary: newNetSalary,
          },
        });
      }

      return tx.promotionRequest.update({
        where: { id },
        data: {
          status,
          reviewedById,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote?.trim() ?? null,
        },
        include: this.includeRequestRelations(),
      });
    });

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: status === PromotionRequestStatus.APPROVED ? 'promotion.approved' : 'promotion.rejected',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        promotionRequestId: updated.id,
        employeeId: updated.employeeId,
        requestedById: updated.requestedById,
        decidedById: reviewedById,
        decidedAt: updated.reviewedAt?.toISOString(),
        reason: dto.reviewNote?.trim(),
      },
      metadata: { userId: user.sub, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return this.mapRequest(updated);
  }

  private decimalToNumber(value: Decimal | number | string): number {
    return Number(value);
  }

  private deriveNetSalary(
    previousGrossSalary: Decimal,
    previousNetSalary: Decimal,
    newGrossSalary: Decimal,
  ): Decimal {
    if (previousGrossSalary.isZero()) return previousNetSalary;
    return previousNetSalary
      .div(previousGrossSalary)
      .times(newGrossSalary)
      .toDecimalPlaces(2);
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
