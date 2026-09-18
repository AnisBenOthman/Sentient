import { ChannelType, JwtPayload, PermissionScope } from '@sentient/shared';
import { AnalyticsService } from './analytics.service';
import { ContractType, EmploymentStatus, Gender, MaritalStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  employee: { findMany: jest.fn() },
  salaryHistory: { findMany: jest.fn() },
  leaveRequest: { findMany: jest.fn(), count: jest.fn() },
  employeeSkill: { findMany: jest.fn() },
  skillHistory: { findMany: jest.fn() },
};

const hrUser: JwtPayload = {
  sub: 'user-hr',
  employeeId: 'emp-hr',
  roles: ['HR_ADMIN'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  channel: ChannelType.WEB,
  roleAssignments: [],
  sessionId: 'session-1',
  iat: 0,
  exp: 9999999999,
};

function employeeRow(
  id: string,
  employmentStatus: EmploymentStatus,
  grossSalary: string,
  overrides: Partial<{
    contractType: ContractType;
    dateOfBirth: Date | null;
    hireDate: Date;
    currency: string;
  }> = {},
): Prisma.EmployeeGetPayload<{
  include: {
    department: { select: { id: true; name: true; businessUnitId: true; businessUnit: { select: { currency: true } } } };
    team: { select: { id: true; name: true; businessUnitId: true; businessUnit: { select: { currency: true } } } };
    position: { select: { id: true; title: true } };
  };
}> {
  const currency = overrides.currency ?? 'USD';
  return {
    id,
    employeeCode: id.toUpperCase(),
    firstName: 'Test',
    lastName: id,
    email: `${id}@sentient.dev`,
    phone: null,
    dateOfBirth: overrides.dateOfBirth ?? null,
    hireDate: overrides.hireDate ?? new Date('2024-01-01T00:00:00.000Z'),
    employmentStatus,
    contractType: overrides.contractType ?? ContractType.FULL_TIME,
    grossSalary: new Prisma.Decimal(grossSalary),
    netSalary: null,
    gender: overrides.contractType === ContractType.FIXED_TERM ? Gender.FEMALE : Gender.MALE,
    maritalStatus: null,
    educationLevel: null,
    educationField: null,
    positionId: null,
    departmentId: 'dept-finance',
    teamId: 'team-accounting',
    managerId: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    deletedAt: null,
    department: { id: 'dept-finance', name: 'Finance', businessUnitId: 'bu-hq', businessUnit: { currency } },
    team: { id: 'team-accounting', name: 'Accounting', businessUnitId: 'bu-hq', businessUnit: { currency } },
    position: { id: 'pos-analyst', title: 'Finance Analyst' },
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(mockPrisma as unknown as PrismaService);
    mockPrisma.salaryHistory.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
    mockPrisma.employeeSkill.findMany.mockResolvedValue([]);
    mockPrisma.skillHistory.findMany.mockResolvedValue([]);
    mockPrisma.leaveRequest.count.mockResolvedValue(0);
  });

  it('counts total scoped employees separately from active employees', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      employeeRow('emp-active', EmploymentStatus.ACTIVE, '1000'),
      employeeRow('emp-on-leave', EmploymentStatus.ON_LEAVE, '1100'),
      employeeRow('emp-terminated', EmploymentStatus.TERMINATED, '9000'),
    ]);

    const analytics = await service.getDashboard({ departmentId: 'dept-finance' }, hrUser);

    expect(analytics.employees.total).toBe(3);
    expect(analytics.employees.active).toBe(1);
    expect(analytics.employees.onLeave).toBe(1);
    expect(analytics.employees.terminal).toBe(1);
    expect(analytics.employees.statusBreakdown).toEqual(
      expect.arrayContaining([
        { label: 'Active', value: 1 },
        { label: 'On Leave', value: 1 },
        { label: 'Terminated', value: 1 },
      ]),
    );
  });

  it('excludes terminal employees from current payroll and current detail queries', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      employeeRow('emp-active', EmploymentStatus.ACTIVE, '1000'),
      employeeRow('emp-resigned', EmploymentStatus.RESIGNED, '9000'),
    ]);

    const analytics = await service.getDashboard({ departmentId: 'dept-finance' }, hrUser);

    expect(analytics.payroll.totalCost).toBe(1000);
    expect(analytics.payroll.currency).toBe('USD');
    expect(mockPrisma.salaryHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: expect.objectContaining({
            AND: expect.arrayContaining([
              { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
            ]),
          }),
        }),
      }),
    );
    expect(mockPrisma.employeeSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: expect.objectContaining({
            AND: expect.arrayContaining([
              { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
            ]),
          }),
        }),
      }),
    );
    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: expect.objectContaining({
            AND: expect.arrayContaining([
              { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
            ]),
          }),
        }),
      }),
    );
  });

  it('builds HRBP workforce profile metrics from current employees', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      employeeRow('emp-mid', EmploymentStatus.ACTIVE, '1000', {
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        hireDate: new Date('2020-01-01T00:00:00.000Z'),
      }),
      employeeRow('emp-fixed', EmploymentStatus.PROBATION, '1200', {
        contractType: ContractType.FIXED_TERM,
        dateOfBirth: new Date('2001-01-01T00:00:00.000Z'),
        hireDate: new Date('2025-01-01T00:00:00.000Z'),
      }),
      employeeRow('emp-resigned', EmploymentStatus.RESIGNED, '9000', {
        dateOfBirth: new Date('1970-01-01T00:00:00.000Z'),
        hireDate: new Date('2010-01-01T00:00:00.000Z'),
      }),
    ]);

    const analytics = await service.getDashboard({ departmentId: 'dept-finance' }, hrUser);

    expect(analytics.employees.probation).toBe(1);
    expect(analytics.employees.fullTimeRatio).toBe(50);
    expect(analytics.employees.averageAge).not.toBeNull();
    expect(analytics.employees.averageTenureYears).not.toBeNull();
    expect(analytics.employees.contractMix).toEqual(
      expect.arrayContaining([
        { label: 'Full Time', value: 1 },
        { label: 'Fixed Term', value: 1 },
      ]),
    );
    expect(analytics.employees.ageBands.reduce((sum, item) => sum + item.value, 0)).toBe(2);
    expect(analytics.employees.tenureBands.reduce((sum, item) => sum + item.value, 0)).toBe(2);
    expect(analytics.employees.genderDistribution).toEqual(
      expect.arrayContaining([
        { label: 'Male', value: 2 },
        { label: 'Female', value: 1 },
      ]),
    );
    expect(analytics.employees.educationLevels).toEqual(
      expect.arrayContaining([{ label: 'Unspecified', value: 2 }]),
    );
  });

  /**
   * WHY this is pinned: age must mean the same thing on the dashboard and in
   * hr_analytics.v_employees.age_years, which the assistant answers from. The
   * previous elapsed/365.25 measure produced fractional years, which disagreed
   * with the views and — because AGE_BANDS are integer ranges — also fell
   * between bands, dropping those employees out of the chart entirely.
   */
  describe('age and tenure are whole completed years', () => {
    const NOW = new Date('2026-09-18T12:00:00.000Z');

    beforeEach(() => jest.useFakeTimers().setSystemTime(NOW.getTime()));
    afterEach(() => jest.useRealTimers());

    async function analyticsFor(rows: Array<{ dateOfBirth: Date; hireDate: Date }>) {
      mockPrisma.employee.findMany.mockResolvedValue(
        rows.map((row, index) =>
          employeeRow(`emp-${index}`, EmploymentStatus.ACTIVE, '1000', row),
        ) as never,
      );
      return service.getDashboard({}, hrUser);
    }

    it('counts an employee whose age falls between two integer bands', async () => {
      // Turns 35 in four months: 34.7 fractional years. Under the old measure
      // this matched neither 25-34 (max 34) nor 35-44 (min 35) and vanished.
      const analytics = await analyticsFor([
        { dateOfBirth: new Date('1992-01-01T00:00:00.000Z'), hireDate: new Date('2020-01-01T00:00:00.000Z') },
      ]);

      expect(analytics.employees.ageBands.reduce((sum, band) => sum + band.value, 0)).toBe(1);
      expect(analytics.employees.ageBands).toEqual(
        expect.arrayContaining([{ label: '25-34', value: 1 }]),
      );
    });

    it('counts the anniversary itself, matching age(x::date) in the views', async () => {
      const analytics = await analyticsFor([
        // 45 today, and 5 years of service today.
        { dateOfBirth: new Date('1981-09-18T00:00:00.000Z'), hireDate: new Date('2021-09-18T00:00:00.000Z') },
      ]);

      expect(analytics.employees.averageAge).toBe(45);
      expect(analytics.employees.averageTenureYears).toBe(5);
      expect(analytics.employees.ageBands).toEqual(
        expect.arrayContaining([{ label: '45-54', value: 1 }]),
      );
    });

    it('ignores a stored time component, as the ::date cast does', async () => {
      const analytics = await analyticsFor([
        // Same birthday, 18:30 — the case that read a year young in SQL.
        { dateOfBirth: new Date('1981-09-18T18:30:00.000Z'), hireDate: new Date('2021-09-18T18:30:00.000Z') },
      ]);

      expect(analytics.employees.averageAge).toBe(45);
      expect(analytics.employees.averageTenureYears).toBe(5);
    });

    it('never drops an employee from the tenure distribution', async () => {
      const analytics = await analyticsFor([
        { dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), hireDate: new Date('2026-03-01T00:00:00.000Z') }, // 0 yrs
        { dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), hireDate: new Date('2023-09-18T00:00:00.000Z') }, // 3 yrs
        { dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), hireDate: new Date('2016-09-18T00:00:00.000Z') }, // 10 yrs
        { dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), hireDate: new Date('2010-01-01T00:00:00.000Z') }, // 16 yrs
      ]);

      expect(analytics.employees.tenureBands.reduce((sum, band) => sum + band.value, 0)).toBe(4);
    });
  });

  it('builds attrition slices by marital status and job', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      {
        ...employeeRow('emp-active', EmploymentStatus.ACTIVE, '1000'),
        maritalStatus: MaritalStatus.SINGLE,
      },
      {
        ...employeeRow('emp-resigned', EmploymentStatus.RESIGNED, '1000'),
        maritalStatus: MaritalStatus.MARRIED,
        position: { id: 'pos-controller', title: 'Finance Controller' },
      },
      {
        ...employeeRow('emp-terminated', EmploymentStatus.TERMINATED, '1000'),
        maritalStatus: MaritalStatus.MARRIED,
        position: { id: 'pos-controller', title: 'Finance Controller' },
      },
    ]);

    const analytics = await service.getDashboard({ departmentId: 'dept-finance' }, hrUser);

    expect(analytics.employees.attritionByMaritalStatus).toEqual([{ label: 'Married', value: 2 }]);
    expect(analytics.employees.attritionByJob).toEqual([{ label: 'Finance Controller', value: 2 }]);
  });

  it('applies department manager scope before dashboard filters', async () => {
    const managerUser: JwtPayload = {
      ...hrUser,
      sub: 'user-manager',
      roles: ['MANAGER'],
      roleAssignments: [
        {
          roleCode: 'MANAGER',
          scope: PermissionScope.DEPARTMENT,
          scopeEntityId: 'dept-finance',
        },
      ],
    };
    mockPrisma.employee.findMany.mockResolvedValue([]);

    await service.getDashboard({}, managerUser);

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ departmentId: 'dept-finance' }, { deletedAt: null }],
        },
      }),
    );
  });

  describe('payroll currency resolution', () => {
    it('returns null when scoped employees span more than one business unit currency', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([
        employeeRow('emp-dz', EmploymentStatus.ACTIVE, '1000', { currency: 'DZD' }),
        employeeRow('emp-us', EmploymentStatus.ACTIVE, '1000', { currency: 'USD' }),
      ]);

      const analytics = await service.getDashboard({}, hrUser);

      expect(analytics.payroll.currency).toBeNull();
      expect(analytics.payroll.totalCost).toBe(2000);
    });

    it('resolves the shared currency when all scoped employees share one business unit', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([
        employeeRow('emp-a', EmploymentStatus.ACTIVE, '1000', { currency: 'DZD' }),
        employeeRow('emp-b', EmploymentStatus.ACTIVE, '2000', { currency: 'DZD' }),
      ]);

      const analytics = await service.getDashboard({}, hrUser);

      expect(analytics.payroll.currency).toBe('DZD');
    });
  });

  describe('getEmployeesWithoutLeave', () => {
    function rosterRow(id: string, employmentStatus: EmploymentStatus = EmploymentStatus.ACTIVE) {
      return { id, firstName: 'Test', lastName: id, departmentId: 'dept-finance', employmentStatus };
    }

    it('returns the roster minus employees with an approved leave request in the window', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([rosterRow('emp-a'), rosterRow('emp-b'), rosterRow('emp-c')]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([{ employeeId: 'emp-b' }]);

      const result = await service.getEmployeesWithoutLeave({ departmentId: 'dept-finance' }, hrUser);

      expect(result.entries.map((e) => e.employeeId)).toEqual(['emp-a', 'emp-c']);
      expect(result.totalConsidered).toBe(3);
    });

    it('returns every roster employee when none have an approved leave request', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([rosterRow('emp-a'), rosterRow('emp-b')]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getEmployeesWithoutLeave({}, hrUser);

      expect(result.entries).toHaveLength(2);
      expect(result.totalConsidered).toBe(2);
    });

    it('returns an empty result for an empty roster', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getEmployeesWithoutLeave({}, hrUser);

      expect(result.entries).toEqual([]);
      expect(result.totalConsidered).toBe(0);
    });

    it('applies the current-workforce filter and the same scope to both the roster and leave-request queries', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.getEmployeesWithoutLeave({ departmentId: 'dept-finance' }, hrUser);

      const expectedWhere = expect.objectContaining({
        AND: expect.arrayContaining([
          { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
        ]),
      });
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED', employee: expectedWhere }),
        }),
      );
    });

    it('returns a trailing ~365-day window ending today', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getEmployeesWithoutLeave({}, hrUser);

      const today = new Date().toISOString().slice(0, 10);
      expect(result.windowEnd).toBe(today);
      const spanDays = Math.round(
        (new Date(result.windowEnd).getTime() - new Date(result.windowStart).getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(spanDays).toBe(365);
    });

    it('applies department manager scope to the roster query, matching getDashboard', async () => {
      const managerUser: JwtPayload = {
        ...hrUser,
        sub: 'user-manager',
        roles: ['MANAGER'],
        roleAssignments: [
          { roleCode: 'MANAGER', scope: PermissionScope.DEPARTMENT, scopeEntityId: 'dept-finance' },
        ],
      };
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.getEmployeesWithoutLeave({}, managerUser);

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { AND: [{ departmentId: 'dept-finance' }, { deletedAt: null }] },
              { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
            ],
          },
        }),
      );
    });
  });
});
