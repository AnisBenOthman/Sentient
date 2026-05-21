import { ChannelType, JwtPayload, PermissionScope } from '@sentient/shared';
import { AnalyticsService } from './analytics.service';
import { ContractType, EmploymentStatus, Gender, MaritalStatus, Prisma } from '../../generated/prisma';
import { Decimal } from '../../generated/prisma/runtime/library';
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
  }> = {},
): Prisma.EmployeeGetPayload<{
  include: {
    department: { select: { id: true; name: true; businessUnitId: true } };
    team: { select: { id: true; name: true; businessUnitId: true } };
    position: { select: { id: true; title: true } };
  };
}> {
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
    grossSalary: new Decimal(grossSalary),
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
    department: { id: 'dept-finance', name: 'Finance', businessUnitId: 'bu-hq' },
    team: { id: 'team-accounting', name: 'Accounting', businessUnitId: 'bu-hq' },
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
});
