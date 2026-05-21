import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  EmploymentStatus,
  Prisma,
  ProficiencyLevel,
  SalaryChangeReason,
} from '../../generated/prisma';
import { Decimal } from '../../generated/prisma/runtime/library';
import { JwtPayload, PermissionScope } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardAnalyticsQueryDto } from './dto/dashboard-analytics-query.dto';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface SeriesPoint {
  label: string;
  [series: string]: string | number;
}

export interface DashboardAnalytics {
  employees: {
    total: number;
    active: number;
    onLeave: number;
    probation: number;
    terminal: number;
    newHiresOnProbation: number;
    averageAge: number | null;
    averageTenureYears: number | null;
    fullTimeRatio: number | null;
    attritionRate: number | null;
    headcountOverTime: ChartPoint[];
    newHiresTrend: ChartPoint[];
    newHiresByDepartment: SeriesPoint[];
    statusBreakdown: ChartPoint[];
    contractMix: ChartPoint[];
    ageBands: ChartPoint[];
    tenureBands: ChartPoint[];
    educationLevels: ChartPoint[];
    educationFields: ChartPoint[];
    genderDistribution: ChartPoint[];
    attritionByMaritalStatus: ChartPoint[];
    attritionByJob: ChartPoint[];
  };
  payroll: {
    visible: boolean;
    totalCost: number | null;
    averageSalary: number | null;
    costByDepartment: ChartPoint[];
    costTrendByTeam: SeriesPoint[];
  };
  leave: {
    pendingApprovals: number;
    daysByDepartment: ChartPoint[];
    requestsByTypeOverTime: SeriesPoint[];
  };
  skills: {
    averageScore: number | null;
    skillsTracked: number;
    topSkill: string | null;
    radar: ChartPoint[];
    skillEvolution: ChartPoint[];
  };
  promotions: {
    total: number;
    byQuarter: ChartPoint[];
    byDepartment: ChartPoint[];
    recent: Array<{
      id: string;
      employeeName: string;
      departmentName: string;
      previousGrossSalary: number;
      newGrossSalary: number;
      effectiveDate: Date;
    }>;
  };
  engagement: {
    implemented: false;
    metrics: [];
    trend: [];
    message: string;
  };
}

type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: {
    department: { select: { id: true; name: true; businessUnitId: true } };
    team: { select: { id: true; name: true; businessUnitId: true } };
    position: { select: { id: true; title: true } };
  };
}>;

type SalaryRow = Prisma.SalaryHistoryGetPayload<{
  include: {
    employee: {
      select: {
        firstName: true;
        lastName: true;
        department: { select: { name: true; businessUnitId: true } };
        team: { select: { name: true; businessUnitId: true } };
      };
    };
  };
}>;

type LeaveRow = Prisma.LeaveRequestGetPayload<{
  include: {
    leaveType: { select: { name: true } };
    employee: {
      select: {
        department: { select: { name: true; businessUnitId: true } };
        team: { select: { businessUnitId: true } };
      };
    };
  };
}>;

type SkillRow = Prisma.EmployeeSkillGetPayload<{
  include: { skill: { select: { name: true } } };
}>;

type SkillHistoryRow = Prisma.SkillHistoryGetPayload<{
  include: { skill: { select: { name: true } } };
}>;

const MONTH_COUNT = 12;
const QUARTER_COUNT = 8;
const TERMINAL_STATUSES = new Set<EmploymentStatus>([
  EmploymentStatus.TERMINATED,
  EmploymentStatus.RESIGNED,
]);
const PROFICIENCY_SCORE: Record<ProficiencyLevel, number> = {
  [ProficiencyLevel.BEGINNER]: 1,
  [ProficiencyLevel.INTERMEDIATE]: 2,
  [ProficiencyLevel.ADVANCED]: 3,
  [ProficiencyLevel.EXPERT]: 4,
};
const AGE_BANDS = [
  { label: '<25', min: 0, max: 24 },
  { label: '25-34', min: 25, max: 34 },
  { label: '35-44', min: 35, max: 44 },
  { label: '45-54', min: 45, max: 54 },
  { label: '55+', min: 55, max: Number.POSITIVE_INFINITY },
];
const TENURE_BANDS = [
  { label: '<1 year', min: 0, max: 0.99 },
  { label: '1-2 years', min: 1, max: 2.99 },
  { label: '3-5 years', min: 3, max: 5.99 },
  { label: '6-10 years', min: 6, max: 10.99 },
  { label: '10+ years', min: 11, max: Number.POSITIVE_INFINITY },
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    query: DashboardAnalyticsQueryDto,
    user: JwtPayload,
  ): Promise<DashboardAnalytics> {
    const employeeWhere = this.buildScopedEmployeeWhere(query, user);
    const currentEmployeeWhere = this.andEmployeeWhere(
      employeeWhere,
      this.buildCurrentWorkforceFilter(),
    );
    const gran = query.granularity ?? 'MONTHLY';
    const dateWindow =
      gran === 'YEARLY'    ? this.buildYearWindow(5) :
      gran === 'QUARTERLY' ? this.buildQuarterWindow(QUARTER_COUNT) :
                             this.buildMonthWindow(MONTH_COUNT);
    const quarterWindow = dateWindow;

    const [
      employees,
      salaries,
      leaves,
      skills,
      skillHistory,
      pendingApprovals,
    ] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeWhere,
        include: {
          department: { select: { id: true, name: true, businessUnitId: true } },
          team: { select: { id: true, name: true, businessUnitId: true } },
          position: { select: { id: true, title: true } },
        },
      }),
      this.prisma.salaryHistory.findMany({
        where: {
          employee: currentEmployeeWhere,
          effectiveDate: { lte: quarterWindow[quarterWindow.length - 1]?.end },
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              department: { select: { name: true, businessUnitId: true } },
              team: { select: { name: true, businessUnitId: true } },
            },
          },
        },
        orderBy: { effectiveDate: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employee: currentEmployeeWhere,
          startDate: { gte: dateWindow[0]?.start },
        },
        include: {
          leaveType: { select: { name: true } },
          employee: {
            select: {
              department: { select: { name: true, businessUnitId: true } },
              team: { select: { businessUnitId: true } },
            },
          },
        },
      }),
      this.prisma.employeeSkill.findMany({
        where: { deletedAt: null, employee: currentEmployeeWhere },
        include: { skill: { select: { name: true } } },
      }),
      this.prisma.skillHistory.findMany({
        where: {
          employee: currentEmployeeWhere,
          effectiveDate: { gte: quarterWindow[0]?.start },
        },
        include: { skill: { select: { name: true } } },
        orderBy: { effectiveDate: 'asc' },
      }),
      this.prisma.leaveRequest.count({
        where: { status: 'PENDING', employee: currentEmployeeWhere },
      }),
    ]);

    return {
      employees: this.buildEmployeeAnalytics(employees, dateWindow),
      payroll: this.buildPayrollAnalytics(employees, salaries, quarterWindow, user),
      leave: this.buildLeaveAnalytics(leaves, dateWindow, pendingApprovals),
      skills: this.buildSkillAnalytics(skills, skillHistory, quarterWindow),
      promotions: this.buildPromotionAnalytics(salaries, quarterWindow),
      engagement: {
        implemented: false,
        metrics: [],
        trend: [],
        message: 'Engagement analytics are waiting for the backend performance/engagement module.',
      },
    };
  }

  private buildEmployeeAnalytics(
    employees: EmployeeRow[],
    months: Array<{ label: string; start: Date; end: Date }>,
  ): DashboardAnalytics['employees'] {
    const currentEmployees = employees.filter(
      (employee) => !TERMINAL_STATUSES.has(employee.employmentStatus),
    );
    const now = new Date();
    const ages = currentEmployees
      .map((employee) => this.yearsBetween(employee.dateOfBirth, now))
      .filter((value): value is number => value !== null);
    const tenures = currentEmployees
      .map((employee) => this.yearsBetween(employee.hireDate, now))
      .filter((value): value is number => value !== null);
    const terminalCount = employees.filter((employee) => TERMINAL_STATUSES.has(employee.employmentStatus)).length;
    const terminalEmployees = employees.filter((employee) => TERMINAL_STATUSES.has(employee.employmentStatus));
    const fullTimeCount = currentEmployees.filter((employee) => employee.contractType === 'FULL_TIME').length;
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate()));

    return {
      total: employees.length,
      active: employees.filter((employee) => employee.employmentStatus === EmploymentStatus.ACTIVE).length,
      onLeave: employees.filter((employee) => employee.employmentStatus === EmploymentStatus.ON_LEAVE).length,
      probation: employees.filter((employee) => employee.employmentStatus === EmploymentStatus.PROBATION).length,
      terminal: terminalCount,
      newHiresOnProbation: currentEmployees.filter((employee) => employee.hireDate >= sixMonthsAgo).length,
      averageAge: this.average(ages),
      averageTenureYears: this.average(tenures),
      fullTimeRatio:
        currentEmployees.length > 0 ? this.round((fullTimeCount / currentEmployees.length) * 100) : null,
      attritionRate:
        employees.length > 0 ? this.round((terminalCount / employees.length) * 100) : null,
      headcountOverTime: months.map((month) => ({
        label: month.label,
        value: employees.filter((employee) => employee.hireDate <= month.end).length,
      })),
      newHiresTrend: months.map((month) => ({
        label: month.label,
        value: employees.filter(
          (employee) => employee.hireDate >= month.start && employee.hireDate <= month.end,
        ).length,
      })),
      newHiresByDepartment: this.buildSeries(
        months,
        employees.filter((employee) => employee.hireDate >= months[0]!.start),
        (employee) => employee.hireDate,
        (employee) => employee.department?.name ?? 'Unassigned',
        () => 1,
      ),
      statusBreakdown: this.sortPoints(
        this.sumBy(employees, (employee) => this.formatEnumLabel(employee.employmentStatus), () => 1),
      ),
      contractMix: this.sortPoints(
        this.sumBy(currentEmployees, (employee) => this.formatEnumLabel(employee.contractType), () => 1),
      ),
      ageBands: this.buildBandDistribution(ages, AGE_BANDS),
      tenureBands: this.buildBandDistribution(tenures, TENURE_BANDS),
      educationLevels: this.sortPoints(
        this.sumBy(currentEmployees, (employee) => this.formatNullableEnumLabel(employee.educationLevel), () => 1),
      ),
      educationFields: this.sortPoints(
        this.sumBy(currentEmployees, (employee) => employee.educationField ?? 'Unspecified', () => 1),
      ).slice(0, 10),
      genderDistribution: this.sortPoints(
        this.sumBy(employees, (employee) => this.formatNullableEnumLabel(employee.gender), () => 1),
      ),
      attritionByMaritalStatus: this.sortPoints(
        this.sumBy(terminalEmployees, (employee) => this.formatNullableEnumLabel(employee.maritalStatus), () => 1),
      ),
      attritionByJob: this.sortPoints(
        this.sumBy(terminalEmployees, (employee) => employee.position?.title ?? 'Unassigned', () => 1),
      ).slice(0, 10),
    };
  }

  private buildPayrollAnalytics(
    employees: EmployeeRow[],
    salaries: SalaryRow[],
    quarters: Array<{ label: string; start: Date; end: Date }>,
    user: JwtPayload,
  ): DashboardAnalytics['payroll'] {
    const visible =
      user.roles.includes('HR_ADMIN') ||
      user.roles.includes('GLOBAL_HR_ADMIN') ||
      user.roles.includes('EXECUTIVE');
    if (!visible) {
      return {
        visible: false,
        totalCost: null,
        averageSalary: null,
        costByDepartment: [],
        costTrendByTeam: [],
      };
    }

    const visibleEmployees = employees.filter(
      (employee) =>
        !TERMINAL_STATUSES.has(employee.employmentStatus) &&
        employee.grossSalary !== null,
    );
    const totalCost = visibleEmployees.reduce(
      (sum, employee) => sum + this.decimalToNumber(employee.grossSalary),
      0,
    );

    return {
      visible: true,
      totalCost,
      averageSalary: visibleEmployees.length > 0 ? Math.round(totalCost / visibleEmployees.length) : null,
      costByDepartment: this.sortPoints(
        this.sumBy(
          visibleEmployees,
          (employee) => employee.department?.name ?? 'Unassigned',
          (employee) => this.decimalToNumber(employee.grossSalary),
        ),
      ),
      costTrendByTeam: this.buildPayrollCostTrend(visibleEmployees, salaries, quarters),
    };
  }

  private buildLeaveAnalytics(
    leaves: LeaveRow[],
    months: Array<{ label: string; start: Date; end: Date }>,
    pendingApprovals: number,
  ): DashboardAnalytics['leave'] {
    return {
      pendingApprovals,
      daysByDepartment: this.sortPoints(
        this.sumBy(
          leaves,
          (leave) => leave.employee.department?.name ?? 'Unassigned',
          (leave) => this.decimalToNumber(leave.totalDays),
        ),
      ),
      requestsByTypeOverTime: this.buildSeries(
        months,
        leaves,
        (leave) => leave.startDate,
        (leave) => leave.leaveType.name,
        () => 1,
      ),
    };
  }

  private buildSkillAnalytics(
    skills: SkillRow[],
    skillHistory: SkillHistoryRow[],
    quarters: Array<{ label: string; start: Date; end: Date }>,
  ): DashboardAnalytics['skills'] {
    const scores = skills.map((skill) => PROFICIENCY_SCORE[skill.proficiency]);
    const bySkill = new Map<string, number[]>();
    for (const skill of skills) {
      const bucket = bySkill.get(skill.skill.name) ?? [];
      bucket.push(PROFICIENCY_SCORE[skill.proficiency]);
      bySkill.set(skill.skill.name, bucket);
    }

    const radar = Array.from(bySkill.entries())
      .map(([label, values]) => ({
        label,
        value: this.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const topSkill = radar[0]?.label ?? null;
    const skillEvolution = quarters.map((quarter) => {
      const rows = skillHistory.filter(
        (entry) =>
          entry.effectiveDate >= quarter.start &&
          entry.effectiveDate <= quarter.end &&
          entry.newLevel !== null,
      );
      const values = rows.map((entry) => PROFICIENCY_SCORE[entry.newLevel!]);
      return {
        label: quarter.label,
        value: values.length > 0 ? this.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
      };
    });

    return {
      averageScore:
        scores.length > 0
          ? this.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : null,
      skillsTracked: bySkill.size,
      topSkill,
      radar,
      skillEvolution,
    };
  }

  private buildPromotionAnalytics(
    salaries: SalaryRow[],
    _quarters: Array<{ label: string; start: Date; end: Date }>,
  ): DashboardAnalytics['promotions'] {
    const promotions = salaries.filter((salary) => salary.reason === SalaryChangeReason.PROMOTION);

    return {
      total: promotions.length,
      byQuarter: this.groupByQuarter(promotions, (salary) => salary.effectiveDate),
      byDepartment: this.sortPoints(
        this.sumBy(
          promotions,
          (salary) => salary.employee.department?.name ?? 'Unassigned',
          () => 1,
        ),
      ),
      recent: promotions
        .slice()
        .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())
        .slice(0, 8)
        .map((salary) => ({
          id: salary.id,
          employeeName: `${salary.employee.firstName} ${salary.employee.lastName}`,
          departmentName: salary.employee.department?.name ?? 'Unassigned',
          previousGrossSalary: this.decimalToNumber(salary.previousGrossSalary),
          newGrossSalary: this.decimalToNumber(salary.newGrossSalary),
          effectiveDate: salary.effectiveDate,
        })),
    };
  }

  private groupByQuarter<T>(rows: T[], dateOf: (row: T) => Date): ChartPoint[] {
    const totals = new Map<string, { sortKey: number; value: number }>();
    for (const row of rows) {
      const date = dateOf(row);
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      const label = `Q${quarter} ${date.getUTCFullYear()}`;
      const sortKey = date.getUTCFullYear() * 10 + quarter;
      const current = totals.get(label) ?? { sortKey, value: 0 };
      totals.set(label, { sortKey, value: current.value + 1 });
    }
    return Array.from(totals.entries())
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .map(([label, item]) => ({ label, value: item.value }));
  }

  private buildPayrollCostTrend(
    employees: EmployeeRow[],
    salaries: SalaryRow[],
    quarters: Array<{ label: string; start: Date; end: Date }>,
  ): SeriesPoint[] {
    const historyByEmployee = new Map<string, SalaryRow[]>();
    for (const salary of salaries) {
      const rows = historyByEmployee.get(salary.employeeId) ?? [];
      rows.push(salary);
      historyByEmployee.set(salary.employeeId, rows);
    }
    for (const rows of historyByEmployee.values()) {
      rows.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    }

    const teamNames = Array.from(
      new Set(employees.map((employee) => employee.team?.name ?? 'Unassigned')),
    ).sort((a, b) => a.localeCompare(b));

    return quarters.map((quarter) => {
      const point: SeriesPoint = { label: quarter.label };
      for (const teamName of teamNames) point[teamName] = 0;
      for (const employee of employees) {
        if (employee.hireDate > quarter.end) continue;
        const teamName = employee.team?.name ?? 'Unassigned';
        point[teamName] =
          Number(point[teamName] ?? 0) +
          this.salaryAt(quarter.end, employee.grossSalary, historyByEmployee.get(employee.id) ?? []);
      }
      for (const teamName of teamNames) {
        point[teamName] = this.round(Number(point[teamName] ?? 0));
      }
      return point;
    });
  }

  private salaryAt(
    date: Date,
    currentGrossSalary: Decimal | number | string | null,
    history: SalaryRow[],
  ): number {
    const latest = history
      .filter((salary) => salary.effectiveDate <= date)
      .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0];
    if (latest) return this.decimalToNumber(latest.newGrossSalary);

    const firstFuture = history.find((salary) => salary.effectiveDate > date);
    if (firstFuture) return this.decimalToNumber(firstFuture.previousGrossSalary);

    return this.decimalToNumber(currentGrossSalary);
  }

  private buildScopedEmployeeWhere(
    query: DashboardAnalyticsQueryDto,
    user: JwtPayload,
  ): Prisma.EmployeeWhereInput {
    const filters: Prisma.EmployeeWhereInput[] = [
      this.buildUserScopeFilter(user),
      { deletedAt: null },
    ];

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
        ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN'].includes(assignment.roleCode),
    );
    if (hasGlobalVisibility || user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE')) {
      return {};
    }

    const departmentAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.DEPARTMENT,
    );
    if (departmentAssignment?.scopeEntityId) return { departmentId: departmentAssignment.scopeEntityId };

    const teamAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.TEAM,
    );
    const teamId = teamAssignment?.scopeEntityId ?? user.teamId;
    if (teamId) return { teamId };

    const businessUnitAssignment = user.roleAssignments.find(
      (assignment) => assignment.scope === PermissionScope.BUSINESS_UNIT,
    );
    const businessUnitId = businessUnitAssignment?.scopeEntityId ?? user.businessUnitId;
    if (businessUnitId) {
      return {
        OR: [
          { department: { businessUnitId } },
          { team: { businessUnitId } },
        ],
      };
    }

    if (user.employeeId) return { id: user.employeeId };
    throw new ForbiddenException('No employee profile linked to this account');
  }

  private buildCurrentWorkforceFilter(): Prisma.EmployeeWhereInput {
    return { employmentStatus: { notIn: Array.from(TERMINAL_STATUSES) } };
  }

  private andEmployeeWhere(
    left: Prisma.EmployeeWhereInput,
    right: Prisma.EmployeeWhereInput,
  ): Prisma.EmployeeWhereInput {
    return { AND: [left, right] };
  }

  private buildYearWindow(count: number): Array<{ label: string; start: Date; end: Date }> {
    const currentYear = new Date().getUTCFullYear();
    return Array.from({ length: count }, (_, index) => {
      const year = currentYear - (count - 1 - index);
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      return { label: `${year}`, start, end };
    });
  }

  private buildMonthWindow(count: number): Array<{ label: string; start: Date; end: Date }> {
    const now = new Date();
    const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return Array.from({ length: count }, (_, index) => {
      const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (count - 1 - index), 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return { label: start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), start, end };
    });
  }

  private buildQuarterWindow(count: number): Array<{ label: string; start: Date; end: Date }> {
    const now = new Date();
    const currentQuarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const current = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStartMonth, 1));
    return Array.from({ length: count }, (_, index) => {
      const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 3 * (count - 1 - index), 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59, 999));
      const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
      return { label: `Q${quarter} ${start.getUTCFullYear()}`, start, end };
    });
  }

  private buildSeries<T>(
    windows: Array<{ label: string; start: Date; end: Date }>,
    rows: T[],
    dateOf: (row: T) => Date,
    seriesOf: (row: T) => string,
    valueOf: (row: T) => number,
  ): SeriesPoint[] {
    const seriesNames = Array.from(new Set(rows.map(seriesOf))).sort((a, b) => a.localeCompare(b));
    return windows.map((window) => {
      const point: SeriesPoint = { label: window.label };
      for (const seriesName of seriesNames) point[seriesName] = 0;
      for (const row of rows) {
        const date = dateOf(row);
        if (date >= window.start && date <= window.end) {
          const seriesName = seriesOf(row);
          point[seriesName] = Number(point[seriesName] ?? 0) + valueOf(row);
        }
      }
      return point;
    });
  }

  private sumBy<T>(
    rows: T[],
    keyOf: (row: T) => string,
    valueOf: (row: T) => number,
  ): ChartPoint[] {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = keyOf(row);
      totals.set(key, (totals.get(key) ?? 0) + valueOf(row));
    }
    return Array.from(totals.entries()).map(([label, value]) => ({
      label,
      value: this.round(value),
    }));
  }

  private sortPoints(points: ChartPoint[]): ChartPoint[] {
    return points.sort((a, b) => b.value - a.value);
  }

  private decimalToNumber(value: Decimal | number | string | null): number {
    if (value === null) return 0;
    if (value instanceof Decimal) return value.toNumber();
    return Number(value);
  }

  private yearsBetween(start: Date | null, end: Date): number | null {
    if (!start) return null;
    const elapsed = end.getTime() - start.getTime();
    if (elapsed < 0) return null;
    return this.round(elapsed / (365.25 * 24 * 60 * 60 * 1000));
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    return this.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private buildBandDistribution(
    values: number[],
    bands: Array<{ label: string; min: number; max: number }>,
  ): ChartPoint[] {
    return bands.map((band) => ({
      label: band.label,
      value: values.filter((value) => value >= band.min && value <= band.max).length,
    }));
  }

  private formatEnumLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatNullableEnumLabel(value: string | null): string {
    return value ? this.formatEnumLabel(value) : 'Unspecified';
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
