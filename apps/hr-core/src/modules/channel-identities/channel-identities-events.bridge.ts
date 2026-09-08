import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DomainEvent, EVENT_BUS, IEventBus } from '@sentient/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelIdentitiesService } from './channel-identities.service';

interface EmployeeTerminatedPayload {
  employeeId: string;
}

/**
 * WHY: security.md requires channel access to die with the employee — a
 * terminated employee's Telegram/Slack chat must stop resolving to a real
 * session immediately. This does not revoke WEB sessions; that broader
 * "revoke everything on termination" behavior doesn't exist yet anywhere
 * in EmployeesService and is out of scope for the channel-identities slice.
 */
@Injectable()
export class ChannelIdentitiesEventsBridge implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChannelIdentitiesEventsBridge.name);
  private bootstrapped = false;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
    private readonly channelIdentities: ChannelIdentitiesService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    this.eventBus.subscribe<EmployeeTerminatedPayload>('employee.terminated', (event) =>
      this.onTerminated(event),
    );
  }

  private async onTerminated(event: DomainEvent<EmployeeTerminatedPayload>): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { employeeId: event.payload.employeeId },
        select: { id: true },
      });
      if (!user) return;

      await this.channelIdentities.revokeAllForUser(user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to revoke channel identities for employee ${event.payload.employeeId}: ${message}`,
      );
    }
  }
}
