import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_BUS } from '@sentient/shared';
import { HalfDay } from '@sentient/shared';
import { LeaveStatus } from '../../../generated/prisma';
import { Decimal } from '../../../generated/prisma/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { RequestsService } from './requests.service';

const mockEventBus = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

function makeBalance(overrides: Partial<{
  id: string; totalDays: number; usedDays: number; pendingDays: number; leaveTypeId: string; employeeId: string; year: number;
}> = {}) {
  return {
    id: overrides.id ?? 'bal-1',
    employeeId: overrides.employeeId ?? 'emp-1',
    leaveTypeId: overrides.leaveTypeId ?? 'lt-1',
    year: overrides.year ?? 2026,
    totalDays: new Decimal(overrides.totalDays ?? 15),
    usedDays: new Decimal(overrides.usedDays ?? 0),
    pendingDays: new Decimal(overrides.pendingDays ?? 0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeEmployee(buId: string | null = 'bu-1') {
  return {
    id: 'emp-1',
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice@test.com',
    employeeCode: 'E001',
    hireDate: new Date(),
    employmentStatus: 'ACTIVE',
    contractType: 'FULL_TIME',
    grossSalary: null, netSalary: null, maritalStatus: null, educationLevel: null,
    educationField: null, phone: null, dateOfBirth: null, positionId: null,
    departmentId: 'd-1', teamId: null, managerId: null, createdAt: new Date(),
    updatedAt: new Date(), deletedAt: null,
    team: null,
    department: buId
      ? { id: 'd-1', name: 'D1', code: 'D1', description: null, headId: null, businessUnitId: buId, isActive: true, createdAt: new Date(), updatedAt: new Date(), businessUnit: { id: buId, name: 'BU', address: 'A', isActive: true, createdAt: new Date(), updatedAt: new Date() } }
      : null,
  };
}

function makeLeaveType(requiresApproval = true, buId = 'bu-1') {
  return { id: 'lt-1', businessUnitId: buId, name: 'Annual', defaultDaysPerYear: new Decimal(24), accrualFrequency: 'MONTHLY', maxCarryoverDays: new Decimal(5), requiresApproval, color: null, createdAt: new Date(), updatedAt: new Date() };
}

describe('RequestsService', () => {
  let service: RequestsService;
  let prisma: jest.Mocked<PrismaService>;
  let holidaysService: jest.Mocked<HolidaysService>;

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    const prismaValue = {
      employee: { findUnique: jest.fn() },
      leaveType: { findUnique: jest.fn() },
      leaveRequest: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      leaveBalance: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: mockTransaction,
    };

    const module = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: PrismaService, useValue: prismaValue },
        { provide: HolidaysService, useValue: { listForBusinessUnit: jest.fn().mockResolvedValue(new Set()) } },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get(RequestsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    holidaysService = module.get(HolidaysService) as jest.Mocked<HolidaysService>;
  });

  function setupTransactionMock(overrides: {
    overlapping?: object | null;
    balance?: ReturnType<typeof makeBalance> | null;
    createdRequest?: object;
  }) {
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txPrisma = {
        leaveRequest: {
          findFirst: jest.fn().mockResolvedValue(overrides.overlapping ?? null),
          create: jest.fn().mockResolvedValue(overrides.createdRequest ?? { id: 'lr-1', status: LeaveStatus.PENDING, employeeId: 'emp-1', leaveTypeId: 'lt-1', startDate: new Date(), endDate: new Date(), totalDays: new Decimal(5), startHalfDay: null, endHalfDay: null, reason: null, reviewedById: null, reviewedAt: null, reviewNote: null, agentRiskAssessment: null, agentSuggestedDates: null, createdAt: new Date(), updatedAt: new Date() }),
        },
        leaveBalance: {
          findUnique: jest.fn().mockResolvedValue(overrides.balance !== undefined ? overrides.balance : makeBalance()),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(txPrisma);
    });
  }

  const baseDto = {
    leaveTypeId: 'lt-1',
    startDate: '2026-07-06', // Monday
    endDate: '2026-07-10',   // Friday
  };

  it('happy path: creates PENDING request and increments pendingDays', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));
    setupTransactionMock({});

    const result = await service.create('emp-1', baseDto);
    expect(result.status).toBe(LeaveStatus.PENDING);
    expect(mockEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'leave.requested' }));
  });

  it('auto-approves when requiresApproval=false', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(false));
    const approvedRequest = { id: 'lr-1', status: LeaveStatus.APPROVED, employeeId: 'emp-1', leaveTypeId: 'lt-1', startDate: new Date(), endDate: new Date(), totalDays: new Decimal(5), startHalfDay: null, endHalfDay: null, reason: null, reviewedById: null, reviewedAt: null, reviewNote: null, agentRiskAssessment: null, agentSuggestedDates: null, createdAt: new Date(), updatedAt: new Date() };
    setupTransactionMock({ createdRequest: approvedRequest });

    const result = await service.create('emp-1', baseDto);
    expect(result.status).toBe(LeaveStatus.APPROVED);
  });

  it('throws InsufficientBalance when remainingDays < totalDays', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));
    setupTransactionMock({ balance: makeBalance({ totalDays: 2, usedDays: 0, pendingDays: 0 }) });

    await expect(service.create('emp-1', baseDto)).rejects.toThrow(BadRequestException);
    await expect(service.create('emp-1', baseDto)).rejects.toThrow('InsufficientBalance');
  });

  it('throws OverlappingRequest when an overlapping PENDING request exists', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));
    setupTransactionMock({ overlapping: { id: 'existing' } });

    await expect(service.create('emp-1', baseDto)).rejects.toThrow(ConflictException);
  });

  it('throws ZeroDayRequest when date range falls on weekend only', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));

    await expect(
      service.create('emp-1', { ...baseDto, startDate: '2026-07-11', endDate: '2026-07-12' }),
    ).rejects.toThrow('ZeroDayRequest');
  });

  it('throws UnresolvedBusinessUnit when employee has no team or department', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee(null));
    await expect(service.create('emp-1', baseDto)).rejects.toThrow('UnresolvedBusinessUnit');
  });

  it('throws LeaveTypeOutOfScope when leave type belongs to a different BU', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee('bu-1'));
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true, 'bu-999'));

    await expect(service.create('emp-1', baseDto)).rejects.toThrow('LeaveTypeOutOfScope');
  });

  it('accepts retroactive start dates (no future-only restriction)', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));
    setupTransactionMock({});

    const result = await service.create('emp-1', { ...baseDto, startDate: '2020-01-06', endDate: '2020-01-09' });
    expect(result).toBeDefined();
  });

  it('correctly counts half-day (Mon half + Fri → 4.5 days)', async () => {
    (prisma.employee.findUnique as jest.Mock).mockResolvedValue(makeEmployee());
    (prisma.leaveType.findUnique as jest.Mock).mockResolvedValue(makeLeaveType(true));

    let capturedTotalDays: unknown;
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txPrisma = {
        leaveRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((args: { data: { totalDays: unknown } }) => {
            capturedTotalDays = args.data.totalDays;
            return { id: 'lr-1', status: LeaveStatus.PENDING, employeeId: 'emp-1', leaveTypeId: 'lt-1', startDate: new Date(), endDate: new Date(), totalDays: args.data.totalDays, startHalfDay: HalfDay.MORNING, endHalfDay: null, reason: null, reviewedById: null, reviewedAt: null, reviewNote: null, agentRiskAssessment: null, agentSuggestedDates: null, createdAt: new Date(), updatedAt: new Date() };
          }),
        },
        leaveBalance: {
          findUnique: jest.fn().mockResolvedValue(makeBalance()),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(txPrisma);
    });

    await service.create('emp-1', { ...baseDto, startHalfDay: HalfDay.MORNING });
    expect((capturedTotalDays as Decimal).toNumber()).toBe(4.5);
  });

  it('throws NotOwner when employee tries to cancel another employee\'s request', async () => {
    (prisma.leaveRequest.findUnique as jest.Mock).mockResolvedValue({ id: 'lr-1', status: LeaveStatus.PENDING, employeeId: 'emp-other' });
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txPrisma = {
        leaveRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'lr-1', status: LeaveStatus.PENDING, employeeId: 'emp-other' }) },
        leaveBalance: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      };
      return fn(txPrisma);
    });
    await expect(service.cancel('lr-1', 'emp-1')).rejects.toThrow(ForbiddenException);
  });
});
