import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { JwtPayload } from '@sentient/shared';

import { PrismaService } from '../../../prisma/prisma.service';
import { KeyResultResponseDto } from '../dto/response/key-result-response.dto';
import { ObjectiveResponseDto } from '../dto/response/objective-response.dto';
import { KeyResultsService } from '../key-results/key-results.service';
import { ObjectivesService } from '../objectives/objectives.service';

export interface DepartmentSummary {
  departmentId: string;
  departmentName: string;
  objectiveCount: number;
  krCount: number;
  averageScore: number;
  atRiskCount: number;
}

export interface AtRiskKr {
  keyResultId: string;
  title: string;
  score: number;
  employeeIds: string[];
  objectiveId: string;
}

export interface TopLevelObjectiveSummary {
  id: string;
  title: string;
  level: string;
  childCount: number;
  averageScore: number;
}

export interface OkrCycleSummaryDto {
  cycleId: string;
  cycleName: string;
  type: string;
  departments: DepartmentSummary[];
  atRiskKrs: AtRiskKr[];
  topLevelObjectives: TopLevelObjectiveSummary[];
}

export interface AssignedKrEntry {
  keyResult: KeyResultResponseDto;
  parentObjective: { id: string; title: string; level: string };
  latestApprovedCheckIn: object | null;
}

export interface ObjectiveWithKrs {
  objective: ObjectiveResponseDto;
  keyResults: KeyResultResponseDto[];
  averageScore: number;
}

export interface EmployeeOkrPortfolioDto {
  employeeId: string;
  cycleId: string;
  objectivesOwned: ObjectiveWithKrs[];
  keyResultsAssigned: AssignedKrEntry[];
}

@Injectable()
export class OkrAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectivesService: ObjectivesService,
    private readonly keyResultsService: KeyResultsService,
  ) {}

  async getCycleSummary(cycleId: string, user: JwtPayload): Promise<OkrCycleSummaryDto> {
    const cycle = await this.prisma.okrCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('OKR cycle not found');

    const isManagerOnly = user.roles.includes('MANAGER') && !user.roles.includes('HR_ADMIN') && !user.roles.includes('EXECUTIVE');

    const deptFilter = isManagerOnly ? { departmentId: user.departmentId ?? undefined } : {};

    const objectives = await this.prisma.objective.findMany({
      where: { cycleId, level: 'DEPARTMENT', ...deptFilter },
      include: {
        department: { select: { id: true, name: true } },
        keyResults: true,
      },
    });

    const departments: DepartmentSummary[] = objectives.map((obj) => {
      const krs = obj.keyResults;
      const atRiskCount = krs.filter(
        (kr) => Number(kr.score) < 0.3 && kr.status !== 'ACHIEVED' && kr.status !== 'CANCELLED',
      ).length;
      const avgScore = krs.length > 0
        ? krs.reduce((sum, kr) => sum + Number(kr.score), 0) / krs.length
        : 0;

      return {
        departmentId: obj.departmentId ?? obj.id,
        departmentName: obj.department?.name ?? 'Unknown',
        objectiveCount: 1,
        krCount: krs.length,
        averageScore: Math.round(avgScore * 100) / 100,
        atRiskCount,
      };
    });

    const allKrs = await this.prisma.keyResult.findMany({
      where: {
        objective: {
          cycleId,
          ...(isManagerOnly ? { departmentId: user.departmentId ?? undefined } : {}),
        },
        status: { notIn: ['ACHIEVED', 'CANCELLED'] },
      },
      orderBy: { score: 'asc' },
      take: 20,
    });

    const atRiskKrs: AtRiskKr[] = allKrs
      .filter((kr) => Number(kr.score) < 0.3)
      .map((kr) => ({
        keyResultId: kr.id,
        title: kr.title,
        score: Number(kr.score),
        employeeIds: kr.assigneeIds,
        objectiveId: kr.objectiveId,
      }));

    const topLevelObjectives = await this.prisma.objective.findMany({
      where: { cycleId, level: 'COMPANY' },
      include: {
        _count: { select: { childObjectives: true } },
        keyResults: { select: { score: true } },
      },
    });

    const topLevelDtos: TopLevelObjectiveSummary[] = topLevelObjectives.map((obj) => {
      const krs = obj.keyResults;
      const avgScore = krs.length > 0
        ? krs.reduce((sum, kr) => sum + Number(kr.score), 0) / krs.length
        : 0;
      return {
        id: obj.id,
        title: obj.title,
        level: obj.level,
        childCount: obj._count.childObjectives,
        averageScore: Math.round(avgScore * 100) / 100,
      };
    });

    return {
      cycleId,
      cycleName: cycle.name,
      type: cycle.type,
      departments,
      atRiskKrs,
      topLevelObjectives: topLevelDtos,
    };
  }

  async getEmployeePortfolio(
    employeeId: string,
    cycleId: string,
    user: JwtPayload,
  ): Promise<EmployeeOkrPortfolioDto> {
    const isSelf = user.employeeId === employeeId;
    const isManagerOfDept =
      user.roles.includes('MANAGER') &&
      !user.roles.includes('HR_ADMIN') &&
      !isSelf;
    const isAdmin = user.roles.includes('HR_ADMIN');

    if (!isSelf && !isAdmin) {
      if (isManagerOfDept) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: employeeId },
          select: { departmentId: true },
        });
        if (!employee || employee.departmentId !== user.departmentId) {
          throw new ForbiddenException('Access denied to this employee portfolio');
        }
      } else {
        throw new ForbiddenException('Access denied to this employee portfolio');
      }
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { user: { select: { id: true } } },
    });
    const ownerId = employee?.user?.id ?? null;

    const ownedObjectives = await this.prisma.objective.findMany({
      where: { cycleId, ownerId: ownerId ?? undefined },
      include: { keyResults: true },
    });

    const objectivesOwned: ObjectiveWithKrs[] = ownedObjectives.map((obj) => {
      const krDtos = obj.keyResults.map((kr) => this.keyResultsService.toDto(kr));
      const avgScore = krDtos.length > 0
        ? krDtos.reduce((sum, kr) => sum + Number(kr.score), 0) / krDtos.length
        : 0;
      return {
        objective: this.objectivesService.toDto(obj),
        keyResults: krDtos,
        averageScore: Math.round(avgScore * 100) / 100,
      };
    });

    const assignedKrs = await this.prisma.keyResult.findMany({
      where: {
        assigneeIds: { has: employeeId },
        objective: { cycleId },
      },
      include: {
        objective: { select: { id: true, title: true, level: true } },
        checkIns: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const keyResultsAssigned: AssignedKrEntry[] = assignedKrs.map((kr) => ({
      keyResult: this.keyResultsService.toDto(kr),
      parentObjective: {
        id: kr.objective.id,
        title: kr.objective.title,
        level: kr.objective.level,
      },
      latestApprovedCheckIn: kr.checkIns[0] ?? null,
    }));

    return {
      employeeId,
      cycleId,
      objectivesOwned,
      keyResultsAssigned,
    };
  }
}
