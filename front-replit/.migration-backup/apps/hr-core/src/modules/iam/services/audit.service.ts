import { Injectable, Logger } from '@nestjs/common';
import { SecurityEventType } from '@sentient/shared';
import { $Enums } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(
    userId: string,
    eventType: SecurityEventType,
    meta?: { ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> },
  ): void {
    this.prisma.securityEvent
      .create({
        data: {
          userId,
          // WHY: shared SecurityEventType and Prisma's have identical string values;
          // cast bridges the two at the DB write boundary.
          eventType: eventType as unknown as $Enums.SecurityEventType,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          ...(meta?.metadata ? { metadata: meta.metadata as object } : {}),
        },
      })
      .catch((err: unknown) => {
        this.logger.error(`Failed to write security event ${eventType} for user ${userId}`, err);
      });
  }
}
