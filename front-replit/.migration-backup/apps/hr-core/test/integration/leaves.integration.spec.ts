/**
 * Integration tests for the Leave Management Module.
 *
 * Requires HR_CORE_TEST_DATABASE_URL pointing to a test PostgreSQL database
 * with the hr_core schema already migrated.
 * Run: HR_CORE_TEST_DATABASE_URL=postgresql://... npx jest --testPathPatterns="leaves.integration"
 */

import { Test } from '@nestjs/testing';
import { EVENT_BUS } from '@sentient/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AccrualService } from '../../src/modules/leaves/accrual/accrual.service';
import { BalancesService } from '../../src/modules/leaves/balances/balances.service';
import { HolidaysService } from '../../src/modules/leaves/holidays/holidays.service';
import { RequestsService } from '../../src/modules/leaves/requests/requests.service';
import { LeaveTypesService } from '../../src/modules/leaves/leave-types/leave-types.service';

const TEST_DB_URL = process.env['HR_CORE_TEST_DATABASE_URL'];

// Skip integration tests if no test DB URL provided
const describeIf = TEST_DB_URL ? describe : describe.skip;

describeIf('Leave Module Integration', () => {
  let prisma: PrismaClient;
  let prismaService: PrismaService;
  let requestsService: RequestsService;
  let balancesService: BalancesService;
  let accrualService: AccrualService;
  let leaveTypesService: LeaveTypesService;

  let buId: string;
  let ltAnnualId: string;
  let empId: string;
  let balanceId: string;

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: TEST_DB_URL! });
    prisma = new PrismaClient({ adapter });

    const mockEventBus = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        HolidaysService,
        LeaveTypesService,
        BalancesService,
        AccrualService,
        {
          provide: RequestsService,
          useFactory: (ps: PrismaService, hs: HolidaysService) =>
            new RequestsService(ps, hs, mockEventBus),
          inject: [PrismaService, HolidaysService],
        },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    prismaService = module.get(PrismaService);
    requestsService = module.get(RequestsService);
    balancesService = module.get(BalancesService);
    accrualService = module.get(AccrualService);
    leaveTypesService = module.get(LeaveTypesService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean relevant tables preserving migration history
    await prismaService.$executeRaw`TRUNCATE TABLE hr_core.leave_accrual_runs, hr_core.leave_balance_adjustments, hr_core.leave_balances, hr_core.leave_requests, hr_core.leave_types, hr_core.holidays, hr_core.employees, hr_core.departments, hr_core.teams, hr_core.business_units CASCADE`;

    // Seed: BusinessUnit
    const bu = await prismaService.businessUnit.create({
      data: { name: 'Test BU', address: 'Algiers' },
    });
    buId = bu.id;

    // Seed: Department
    const dept = await prismaService.department.create({
      data: { name: 'Engineering', code: 'ENG', businessUnitId: buId },
    });

    // Seed: Employee
    const emp = await prismaService.employee.create({
      data: {
        employeeCode: 'EMP-001',
        firstName: 'Alice',
        lastName: 'Test',
        email: 'alice@test.dev',
        hireDate: new Date('2020-01-01'),
        departmentId: dept.id,
      },
    });
    empId = emp.id;

    // Seed: LeaveType (MONTHLY, 24/yr, approval required)
    const lt = await prismaService.leaveType.create({
      data: {
        businessUnitId: buId,
        name: 'Annual Leave',
        defaultDaysPerYear: 24,
        accrualFrequency: 'MONTHLY',
        maxCarryoverDays: 5,
        requiresApproval: true,
        color: '#4CAF50',
      },
    });
    ltAnnualId = lt.id;

    // Seed: LeaveBalance with 15 days
    const balance = await prismaService.leaveBalance.create({
      data: {
        employeeId: empId,
        leaveTypeId: ltAnnualId,
        year: 2026,
        totalDays: 15,
        usedDays: 0,
        pendingDays: 0,
      },
    });
    balanceId = balance.id;
  });

  describe('Full submit → approve flow', () => {
    it('submit Mon-Fri creates PENDING request and increments pendingDays', async () => {
      const request = await requestsService.create(empId, {
        leaveTypeId: ltAnnualId,
        startDate: '2026-07-06',
        endDate: '2026-07-10',
      });

      expect(request.status).toBe('PENDING');
      expect(request.totalDays.toNumber()).toBe(5);

      const balance = await prismaService.leaveBalance.findUnique({ where: { id: balanceId } });
      expect(balance!.pendingDays.toNumber()).toBe(5);
    });

    it('approve moves pendingDays to usedDays', async () => {
      const request = await requestsService.create(empId, {
        leaveTypeId: ltAnnualId,
        startDate: '2026-07-06',
        endDate: '2026-07-10',
      });

      await requestsService.approve(request.id, {}, 'reviewer-stub');

      const balance = await prismaService.leaveBalance.findUnique({ where: { id: balanceId } });
      expect(balance!.pendingDays.toNumber()).toBe(0);
      expect(balance!.usedDays.toNumber()).toBe(5);
    });

    it('balance remainingDays computed correctly after submit', async () => {
      await requestsService.create(empId, {
        leaveTypeId: ltAnnualId,
        startDate: '2026-07-06',
        endDate: '2026-07-10',
      });

      const balances = await balancesService.findByEmployee(empId, 2026);
      expect(balances[0]?.remainingDays.toNumber()).toBe(10); // 15 - 5 pending
    });
  });

  describe('Accrual', () => {
    it('trigger accrual increments totalDays for MONTHLY type', async () => {
      // Remove existing balance so accrual creates it fresh
      await prismaService.leaveBalance.delete({ where: { id: balanceId } });

      await accrualService.runMonthlyAccrual('2026-04');

      const balance = await prismaService.leaveBalance.findFirst({
        where: { employeeId: empId, leaveTypeId: ltAnnualId, year: 2026 },
      });
      // 24 / 12 = 2.00
      expect(balance!.totalDays.toNumber()).toBe(2);
    });

    it('re-trigger same month does not duplicate (idempotency)', async () => {
      await prismaService.leaveBalance.delete({ where: { id: balanceId } });

      await accrualService.runMonthlyAccrual('2026-04');
      await accrualService.runMonthlyAccrual('2026-04'); // should no-op

      const balance = await prismaService.leaveBalance.findFirst({
        where: { employeeId: empId, leaveTypeId: ltAnnualId, year: 2026 },
      });
      expect(balance!.totalDays.toNumber()).toBe(2); // still 2, not 4
    });
  });
});
