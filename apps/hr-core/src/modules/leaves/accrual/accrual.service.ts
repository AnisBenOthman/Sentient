import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { Decimal } from '../../../generated/prisma/runtime/library';
import { AccrualFrequency, EmploymentStatus, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveEmployeeBusinessUnitId } from '../util/bu-resolver.util';

@Injectable()
export class AccrualService {
  private readonly logger = new Logger(AccrualService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 1 1 *', { name: 'yearEndCarryover' })
  async runYearEndCarryover(): Promise<void> {
    this.logger.log('Running year-end carryover job');
    const now = new Date();
    const priorYear = now.getUTCFullYear() - 1;
    const nextYear = now.getUTCFullYear();

    const priorBalances = await this.prisma.leaveBalance.findMany({
      where: { year: priorYear },
      include: { leaveType: { select: { maxCarryoverDays: true } } },
    });

    for (const balance of priorBalances) {
      const remaining = balance.totalDays.minus(balance.usedDays).minus(balance.pendingDays);
      const carryDays = Decimal.min(remaining, balance.leaveType.maxCarryoverDays);
      const forfeited = remaining.minus(carryDays);

      const nextBalance = await this.prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: balance.employeeId,
            leaveTypeId: balance.leaveTypeId,
            year: nextYear,
          },
        },
        update: { totalDays: { increment: carryDays } },
        create: {
          employeeId: balance.employeeId,
          leaveTypeId: balance.leaveTypeId,
          year: nextYear,
          totalDays: carryDays,
          usedDays: new Decimal(0),
          pendingDays: new Decimal(0),
        },
      });

      await this.prisma.leaveBalanceAdjustment.create({
        data: {
          balanceId: nextBalance.id,
          adjustedBy: 'SYSTEM',
          previousTotalDays: nextBalance.totalDays.minus(carryDays),
          newTotalDays: nextBalance.totalDays,
          reason: `Year-end carryover ${priorYear}->${nextYear} (forfeited ${forfeited.toFixed(2)})`,
        },
      });
    }

    this.logger.log(`Year-end carryover complete: ${priorBalances.length} balances processed`);
  }

  @Cron('0 0 1 * *', { name: 'monthlyAccrual' })
  async runMonthlyAccrual(runMonthOverride?: string): Promise<{ runId: string }> {
    const now = new Date();
    const runMonth =
      runMonthOverride ??
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const isJanuary = runMonth.endsWith('-01');
    const year = parseInt(runMonth.slice(0, 4), 10);

    this.logger.log(`Starting monthly accrual for ${runMonth}`);

    let accrualRun: { id: string };
    try {
      accrualRun = await this.prisma.leaveAccrualRun.create({
        data: { runMonth, employeesProcessed: 0 },
        select: { id: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        this.logger.log(`Accrual for ${runMonth} already ran — skipping`);
        const existing = await this.prisma.leaveAccrualRun.findUnique({
          where: { runMonth },
          select: { id: true },
        });
        return { runId: existing?.id ?? '' };
      }
      throw e;
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        hireDate: { lte: new Date(`${runMonth}-01T00:00:00.000Z`) },
        deletedAt: null,
      },
      include: {
        team: { include: { businessUnit: true } },
        department: { include: { businessUnit: true } },
      },
    });

    // Collect unique BU IDs and fetch all leave types in one query to avoid N+1
    const buIds = new Set(
      employees.map((e) => resolveEmployeeBusinessUnitId(e)).filter((id): id is string => id !== null),
    );
    const allLeaveTypes = await this.prisma.leaveType.findMany({
      where: { businessUnitId: { in: [...buIds] } },
    });
    const leaveTypesByBu = new Map<string, typeof allLeaveTypes>();
    for (const lt of allLeaveTypes) {
      const list = leaveTypesByBu.get(lt.businessUnitId) ?? [];
      list.push(lt);
      leaveTypesByBu.set(lt.businessUnitId, list);
    }

    let processed = 0;
    for (const employee of employees) {
      const businessUnitId = resolveEmployeeBusinessUnitId(employee);
      if (!businessUnitId) continue;

      const leaveTypes = leaveTypesByBu.get(businessUnitId) ?? [];

      for (const leaveType of leaveTypes) {
        if (
          leaveType.accrualFrequency === AccrualFrequency.YEARLY &&
          !isJanuary
        ) {
          continue;
        }

        const increment =
          leaveType.accrualFrequency === AccrualFrequency.MONTHLY
            ? new Decimal(leaveType.defaultDaysPerYear).dividedBy(12).toDecimalPlaces(2)
            : new Decimal(leaveType.defaultDaysPerYear);

        const balance = await this.prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year,
            },
          },
          update: { totalDays: { increment } },
          create: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year,
            totalDays: increment,
            usedDays: new Decimal(0),
            pendingDays: new Decimal(0),
          },
        });

        const reason =
          leaveType.accrualFrequency === AccrualFrequency.MONTHLY
            ? `Monthly accrual ${runMonth}`
            : `Yearly grant ${year}`;

        await this.prisma.leaveBalanceAdjustment.create({
          data: {
            balanceId: balance.id,
            adjustedBy: 'SYSTEM',
            previousTotalDays: balance.totalDays.minus(increment),
            newTotalDays: balance.totalDays,
            reason,
          },
        });
      }
      processed++;
    }

    await this.prisma.leaveAccrualRun.update({
      where: { id: accrualRun.id },
      data: { employeesProcessed: processed },
    });

    this.logger.log(`Monthly accrual ${runMonth} complete: ${processed} employees processed`);
    return { runId: accrualRun.id };
  }

  async triggerManualAccrual(month: string): Promise<{ runId: string; status: string }> {
    const existing = await this.prisma.leaveAccrualRun.findUnique({
      where: { runMonth: month },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('AccrualAlreadyRun');
    }

    const { runId } = await this.runMonthlyAccrual(month);
    return { runId, status: 'QUEUED' };
  }
}
