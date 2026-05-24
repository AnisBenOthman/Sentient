import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, Roles } from '@sentient/shared';

import { HrCoreCallContext } from '../../common/clients/employee-ref.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { ReactEventDto } from './dto/react-event.dto';
import { EventsService, EventWithEngagement } from './events.service';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}

@Controller('events')
@ApiTags('Events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a social event' })
  @ApiResponse({ status: 201, description: 'Event created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEventDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EventWithEngagement> {
    const context = this.buildHrCoreContext(req);
    return this.eventsService.create(user, dto, context.correlationId ?? '', context.jwt);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List published social events' })
  @ApiResponse({ status: 200, description: 'Paginated event list' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListEventsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ items: EventWithEngagement[]; total: number }> {
    return this.eventsService.findAll(user, query, this.buildHrCoreContext(req));
  }

  @Put(':id/reaction')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Set or clear the caller emoji reaction for an event' })
  @ApiResponse({ status: 200, description: 'Event reaction updated' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  react(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReactEventDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<EventWithEngagement> {
    return this.eventsService.react(user, id, dto, this.buildHrCoreContext(req));
  }

  private buildHrCoreContext(req: AuthenticatedRequest): HrCoreCallContext {
    return {
      jwt: this.extractBearerToken(req.headers['authorization']),
      correlationId: req.correlationId ?? '',
    };
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith('Bearer ')) return '';
    return value.slice(7);
  }
}
