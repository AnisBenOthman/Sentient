import { BadRequestException } from '@nestjs/common';
import { ChannelType, JwtPayload, PermissionScope } from '@sentient/shared';
import { Decimal } from '../../generated/prisma/runtime/library';
import { PromotionRequestStatus, SalaryChangeReason } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { PromotionRequestsService } from './promotion-requests.service';

const scopedUser: JwtPayload = {
  sub: 'user-1',
  employeeId: 'manager-1',
  roles: ['MANAGER'],
  departmentId: 'dept-1',
  teamId: 'team-1',
  businessUnitId: 'bu-1',
  channel: ChannelType.WEB,
  roleAssignments: [
    { roleCode: 'MANAGER', scope: PermissionScope.TEAM, scopeEntityId: 'team-1' },
  ],
  sessionId: 'session-1',
  iat: 1,
  exp: 2,
};

const hrUser: JwtPayload = {
  ...scopedUser,
  sub: 'hr-user-1',
  employeeId: 'hr-1',
  roles: ['HR_ADMIN'],
  roleAssignments: [
    { roleCode: 'HR_ADMIN', scope: PermissionScope.GLOBAL, scopeEntityId: null },
  ],
};

const globalDepartmentHeadUser: JwtPayload = {
  ...scopedUser,
  roleAssignments: [
    { roleCode: 'MANAGER', scope: PermissionScope.GLOBAL, scopeEntityId: null },
  ],
};

function makeRequest(overrides: Partial<{
  id: string;
  employeeId: string;
  salaryDelta: number;
  status: PromotionRequestStatus;
}> = {}) {
  const salaryDelta = overrides.salaryDelta ?? 15000;
  return {
    id: overrides.id ?? 'request-1',
    employeeId: overrides.employeeId ?? 'emp-1',
    requestedById: 'manager-1',
    currentRole: 'Engineer',
    newRole: 'Senior Engineer',
    currentGrossSalary: new Decimal(100000),
    newGrossSalary: new Decimal(100000 + salaryDelta),
    salaryDelta: new Decimal(salaryDelta),
    salaryDeltaPercentage: new Decimal(15),
    currentTeamBudget: new Decimal(400000),
    newTeamBudget: new Decimal(400000 + salaryDelta),
    budgetImpactPercentage: new Decimal(3.75),
    responsibilities: ['Lead delivery'],
    status: overrides.status ?? PromotionRequestStatus.PENDING,
    submittedAt: new Date('2026-02-01T00:00:00.000Z'),
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    employee: {
      id: overrides.employeeId ?? 'emp-1',
      firstName: 'Ava',
      lastName: 'Stone',
      department: { id: 'dept-1', name: 'Engineering', businessUnitId: 'bu-1' },
      team: { id: 'team-1', name: 'Platform', departmentId: 'dept-1', businessUnitId: 'bu-1' },
    },
    requestedBy: { id: 'manager-1', firstName: 'Morgan', lastName: 'Lee' },
  };
}

describe('PromotionRequestsService', () => {
  let prisma: {
    $transaction: jest.Mock;
    employee: { findFirst: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
    position: { findFirst: jest.Mock };
    salaryHistory: { create: jest.Mock };
    promotionRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let eventBus: { emit: jest.Mock; subscribe: jest.Mock };
  let service: PromotionRequestsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) => callback(prisma)),
      employee: { findFirst: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
      position: { findFirst: jest.fn() },
      salaryHistory: { create: jest.fn() },
      promotionRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    eventBus = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
    service = new PromotionRequestsService(
      prisma as unknown as PrismaService,
      eventBus,
    );
  });

  it('creates a request with server-computed salary and budget impact', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      grossSalary: new Decimal(100000),
      teamId: 'team-1',
      managerId: 'manager-1',
      positionId: 'position-current',
      position: { id: 'position-current', title: 'Engineer', isActive: true },
    });
    prisma.position.findFirst.mockResolvedValue({ id: 'position-new', title: 'Senior Engineer' });
    prisma.employee.aggregate.mockResolvedValue({ _sum: { grossSalary: new Decimal(400000) } });
    prisma.promotionRequest.create.mockResolvedValue(makeRequest());

    const result = await service.create(
      {
        employeeId: 'emp-1',
        newPositionId: 'position-new',
        newGrossSalary: 115000,
        responsibilities: [' Lead delivery ', ''],
      },
      scopedUser,
    );

    expect(prisma.promotionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentRole: 'Engineer',
          newRole: 'Senior Engineer',
          salaryDelta: new Decimal(15000),
          salaryDeltaPercentage: new Decimal(15),
          newTeamBudget: new Decimal(415000),
          budgetImpactPercentage: new Decimal(3.75),
          responsibilities: ['Lead delivery'],
        }),
      }),
    );
    expect(result.salaryDelta).toBe(15000);
    expect(result.budgetImpactPercentage).toBe(3.75);
    expect(prisma.employee.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: 'team-1' }),
        _sum: { grossSalary: true },
      }),
    );
  });

  it('requires at least one responsibility', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      grossSalary: new Decimal(100000),
      teamId: 'team-1',
      managerId: 'manager-1',
      positionId: 'position-current',
      position: { id: 'position-current', title: 'Engineer', isActive: true },
    });
    prisma.position.findFirst.mockResolvedValue({ id: 'position-new', title: 'Senior Engineer' });
    prisma.employee.aggregate.mockResolvedValue({ _sum: { grossSalary: new Decimal(400000) } });

    await expect(
      service.create(
        {
          employeeId: 'emp-1',
          newPositionId: 'position-new',
          newGrossSalary: 115000,
          responsibilities: [' '],
        },
        scopedUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows global manager demo accounts to use department/team leadership scope', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      grossSalary: new Decimal(100000),
      teamId: 'team-2',
      managerId: 'manager-2',
      positionId: 'position-current',
      position: { id: 'position-current', title: 'Engineer', isActive: true },
    });
    prisma.position.findFirst.mockResolvedValue({ id: 'position-new', title: 'Senior Engineer' });
    prisma.employee.aggregate.mockResolvedValue({ _sum: { grossSalary: new Decimal(400000) } });
    prisma.promotionRequest.create.mockResolvedValue(makeRequest());

    await service.create(
      {
        employeeId: 'emp-1',
        newPositionId: 'position-new',
        newGrossSalary: 115000,
        responsibilities: ['Lead delivery'],
      },
      globalDepartmentHeadUser,
    );

    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { department: { is: { headId: 'manager-1' } } },
                { team: { is: { leadId: 'manager-1' } } },
                { teamId: 'team-1' },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('builds dashboard totals from filtered scoped requests', async () => {
    prisma.promotionRequest.findMany.mockResolvedValue([
      makeRequest({ id: 'request-1', salaryDelta: 10000 }),
      makeRequest({ id: 'request-2', salaryDelta: 20000, status: PromotionRequestStatus.APPROVED }),
    ]);

    const result = await service.getDashboard(
      { year: 2026, businessUnitId: 'bu-1', departmentId: 'dept-1', teamId: 'team-1' },
      scopedUser,
    );

    expect(result).toMatchObject({
      totalRequests: 2,
      averageSalaryLift: 15000,
      totalBudgetImpact: 30000,
      pendingRequests: 1,
    });
    expect(prisma.promotionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { submittedAt: 'desc' },
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it('approves a pending request and applies the salary change with history', async () => {
    prisma.position.findFirst.mockResolvedValue({ id: 'position-new' });
    prisma.promotionRequest.findUnique.mockResolvedValue({
      ...makeRequest(),
      employee: {
        grossSalary: new Decimal(100000),
        netSalary: new Decimal(74000),
      },
    });
    prisma.promotionRequest.update.mockResolvedValue(
      makeRequest({ status: PromotionRequestStatus.APPROVED }),
    );

    const result = await service.approve(
      'request-1',
      { reviewNote: 'Validated for expanded scope' },
      hrUser,
    );

    expect(prisma.salaryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          previousGrossSalary: new Decimal(100000),
          newGrossSalary: new Decimal(115000),
          previousNetSalary: new Decimal(74000),
          newNetSalary: new Decimal(85100),
          grossRaisePercentage: new Decimal(15),
          netRaisePercentage: new Decimal(15),
          reason: SalaryChangeReason.PROMOTION,
          changedById: 'hr-user-1',
        }),
      }),
    );
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1' },
        data: {
          positionId: 'position-new',
          grossSalary: new Decimal(115000),
          netSalary: new Decimal(85100),
        },
      }),
    );
    expect(result.status).toBe(PromotionRequestStatus.APPROVED);
  });
});
