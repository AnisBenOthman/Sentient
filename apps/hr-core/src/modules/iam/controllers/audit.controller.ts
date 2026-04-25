import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { SecurityEventType } from '@sentient/shared';
import { SecurityEvent } from '../../../generated/prisma';
import { UserStatusGuard } from '../guards/user-status.guard';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('security-events')
  @Roles('SYSTEM_ADMIN', 'HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'List security events with optional filters' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'eventType', required: false, enum: SecurityEventType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findEvents(
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
    @Query('eventType') eventType?: SecurityEventType,
    @Query('limit') limit?: string,
  ): Promise<SecurityEvent[]> {
    return this.prisma.securityEvent.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit ?? 100), 500),
    });
  }

  @Get('security-events/user/:userId')
  @Roles('SYSTEM_ADMIN', 'HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'List security events for a specific user' })
  async findForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<SecurityEvent[]> {
    return this.prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
