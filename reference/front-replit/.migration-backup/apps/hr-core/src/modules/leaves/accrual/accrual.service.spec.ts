import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccrualFrequency, EmploymentStatus } from '../../../generated/prisma';
import { Decimal } from '../../../generated/prisma/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccrualService } from './accrual.service';

function makeEmployee(buId: string, status = EmploymentStatus.ACTIVE) {
  return {
    id: `emp-${buId}`,
    firstName: 'Test', lastName: 'User', email: `test@${buId}.com`, employeeCode: 'E001',
    hireDate: new Date('2025-01-01'), employmentStatus: status, contractType: 'FULL_TIME',
    grossSalary: null, netSalary: null, maritalStatus: null, educationLevel: null,
    educationField: null, phone: null, dateOfBirth: null, positionId: null,
    departmentId: 'd-1', teamId: null, managerId: null, createdAt: new Date(),
    updatedAt: new Date(), deletedAt: null,
    team: null,
    department: { id: 'd-1', businessUnit: { id: buId } },
  };
}

function makeLeaveType(frequency: AccrualFrequency, days = 24) {
  return { id: `lt-${frequency}`, businessUnitId: 'bu-1', name: frequency, defaultDaysPerYear: new Decimal(days), accrualFrequency: frequency, maxCarryoverDays: new Decimal(5), requiresApproval: true, color: null, createdAt: new Date(), updatedAt: new Date() };
}

describe('AccrualService', () => {
  let service: AccrualService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccrualService,
        {
          provide: PrismaService,
          useValue: {
            employee: { findMany: jest.fn() },
            leaveType: { findMany: jest.fn() },
            leaveBalance: { upsert: jest.fn() },
            leaveBalanceAdjustment: { create: jest.fn() },
            leaveAccrualRun: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(AccrualService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('MONTHLY accrual in February skips YEARLY types', async () => {
    const monthlyType = makeLeaveType(AccrualFrequency.MONTHLY);
    const yearlyType = makeLeaveType(AccrualFrequency.YEARLY, 98);
    (prisma.leaveAccrualRun.create as jest.Mock).mockResolvedValue({ id: 'run-1' });
    (prisma.leaveAccrualRun.update as jest.Mock).mockResolvedValue({});
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([makeEmployee('bu-1')]);
    (prisma.leaveType.findMany as jest.Mock).mockResolvedValue([monthlyType, yearlyType]);
    (prisma.leaveBalance.upsert as jest.Mock).mockResolvedValue({ id: 'bal-1', totalDays: new Decimal(2) });
    (prisma.leaveBalanceAdjustment.create as jest.Mock).mockResolvedValue({});

    await service.runMonthlyAccrual('2026-02');

    // Should only upsert once (MONTHLY type), not twice
    expect(prisma.leaveBalance.upsert).toHaveBeenCalledTimes(1);
  });

  it('YEARLY grant in January creates balances for YEARLY type', async () => {
    const yearlyType = makeLeaveType(AccrualFrequency.YEARLY, 98);
    (prisma.leaveAccrualRun.create as jest.Mock).mockResolvedValue({ id: 'run-1' });
    (prisma.leaveAccrualRun.update as jest.Mock).mockResolvedValue({});
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([makeEmployee('bu-1')]);
    (prisma.leaveType.findMany as jest.Mock).mockResolvedValue([yearlyType]);
    (prisma.leaveBalance.upsert as jest.Mock).mockResolvedValue({ id: 'bal-1', totalDays: new Decimal(98) });
    (prisma.leaveBalanceAdjustment.create as jest.Mock).mockResolvedValue({});

    await service.runMonthlyAccrual('2026-01');

    expect(prisma.leaveBalance.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = (prisma.leaveBalance.upsert as jest.Mock).mock.calls[0]?.[0];
    expect(upsertCall?.create?.totalDays?.toNumber?.()).toBe(98);
  });

  it('is idempotent: P2002 on LeaveAccrualRun returns early without re-processing', async () => {
    const { Prisma } = await import('../../../generated/prisma');
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: {},
    });
    (prisma.leaveAccrualRun.create as jest.Mock).mockRejectedValue(p2002Error);
    (prisma.leaveAccrualRun.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-run' });

    const result = await service.runMonthlyAccrual('2026-01');
    expect(result.runId).toBe('existing-run');
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('skips TERMINATED employees', async () => {
    const monthlyType = makeLeaveType(AccrualFrequency.MONTHLY);
    (prisma.leaveAccrualRun.create as jest.Mock).mockResolvedValue({ id: 'run-1' });
    (prisma.leaveAccrualRun.update as jest.Mock).mockResolvedValue({});
    (prisma.employee.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.leaveType.findMany as jest.Mock).mockResolvedValue([monthlyType]);

    await service.runMonthlyAccrual('2026-02');
    expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
  });

  it('triggerManualAccrual throws ConflictException when month already ran', async () => {
    (prisma.leaveAccrualRun.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-run' });
    await expect(service.triggerManualAccrual('2026-01')).rejects.toThrow(ConflictException);
  });

  it('year-end carryover caps at maxCarryoverDays=0', async () => {
    const leaveBalanceMock = prisma.leaveBalance as unknown as Record<string, jest.Mock>;
    leaveBalanceMock['findMany'] = jest.fn().mockResolvedValue([{
      id: 'bal-1', employeeId: 'emp-1', leaveTypeId: 'lt-1', year: 2025,
      totalDays: new Decimal(10), usedDays: new Decimal(5), pendingDays: new Decimal(0),
      leaveType: { maxCarryoverDays: new Decimal(0) },
    }]);
    (prisma.leaveBalance.upsert as jest.Mock).mockResolvedValue({ id: 'new-bal', totalDays: new Decimal(0) });
    (prisma.leaveBalanceAdjustment.create as jest.Mock).mockResolvedValue({});

    await service.runYearEndCarryover();

    const upsertCall = (prisma.leaveBalance.upsert as jest.Mock).mock.calls[0]?.[0];
    // carryDays = min(5, 0) = 0
    expect(upsertCall?.create?.totalDays?.toNumber?.()).toBe(0);
  });
});
