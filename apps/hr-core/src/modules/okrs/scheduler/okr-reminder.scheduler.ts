import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';

import { DomainEvent, EVENT_BUS, IEventBus } from '@sentient/shared';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OkrReminderScheduler {
  private readonly logger = new Logger(OkrReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  @Cron('0 9 * * *')
  async handleDailyReminders(): Promise<void> {
    const target = new Date();
    target.setDate(target.getDate() + 14);
    const targetDateStr = target.toISOString().slice(0, 10);

    const cycles = await this.prisma.okrCycle.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: new Date(targetDateStr),
          lt: new Date(new Date(targetDateStr).getTime() + 86_400_000),
        },
      },
      select: { id: true },
    });

    for (const cycle of cycles) {
      await this.processCycle(cycle.id, target);
    }
  }

  private async processCycle(cycleId: string, dueAt: Date): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const krs = await this.prisma.keyResult.findMany({
      where: {
        objective: { cycleId, status: 'ACTIVE' },
        status: { notIn: ['ACHIEVED', 'CANCELLED'] },
      },
      select: {
        id: true,
        assigneeIds: true,
        checkIns: {
          where: { status: 'APPROVED', createdAt: { gte: cutoff } },
          select: { employeeId: true },
          take: 1,
        },
      },
    });

    const staleAssigneeToKrs = new Map<string, string[]>();

    for (const kr of krs) {
      const recentApprovedEmployeeIds = new Set(kr.checkIns.map((ci) => ci.employeeId));
      for (const assigneeId of kr.assigneeIds) {
        if (!recentApprovedEmployeeIds.has(assigneeId)) {
          const list = staleAssigneeToKrs.get(assigneeId) ?? [];
          list.push(kr.id);
          staleAssigneeToKrs.set(assigneeId, list);
        }
      }
    }

    for (const [employeeId, openKeyResultIds] of staleAssigneeToKrs) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { user: { select: { id: true } } },
      });
      const userId = employee?.user?.id;
      if (!userId) continue;

      try {
        await this.eventBus.emit<Record<string, unknown>>({
          id: randomUUID(),
          type: 'okr.checkin_reminder_due',
          source: 'HR_CORE',
          timestamp: new Date(),
          payload: {
            userId,
            employeeId,
            cycleId,
            openKeyResultIds,
            dueAt: dueAt.toISOString(),
          },
          metadata: { userId: 'system', correlationId: randomUUID() },
        } satisfies DomainEvent<Record<string, unknown>>);
      } catch (err) {
        this.logger.error(`Failed to emit reminder for employee ${employeeId}: ${String(err)}`);
      }
    }
  }
}
