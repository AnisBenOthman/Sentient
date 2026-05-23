import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, Roles } from '@sentient/shared';

import { HrCoreCallContext } from '../../common/clients/employee-ref.interface';
import { AnnouncementsService, AnnouncementWithAuthor } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements-query.dto';
import { PinAnnouncementDto } from './dto/pin-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}

@Controller('announcements')
@ApiTags('Announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a new announcement' })
  @ApiResponse({ status: 201, description: 'Announcement created' })
  @ApiResponse({ status: 400, description: 'Validation error or bad audience/target' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnnouncementWithAuthor> {
    const context = this.buildHrCoreContext(req);
    return this.announcementsService.create(user, dto, context.correlationId ?? '', context.jwt);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List announcements visible to the caller' })
  @ApiResponse({ status: 200, description: 'Paginated announcement list' })
  @ApiResponse({ status: 403, description: 'scope=all requires HR_ADMIN' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListAnnouncementsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ items: AnnouncementWithAuthor[]; total: number }> {
    return this.announcementsService.findAll(user, query, this.buildHrCoreContext(req));
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get a single announcement by ID' })
  @ApiResponse({ status: 200, description: 'Announcement found' })
  @ApiResponse({ status: 404, description: 'Announcement not found or not visible' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnnouncementWithAuthor> {
    return this.announcementsService.findOne(user, id, this.buildHrCoreContext(req));
  }

  @Patch(':id')
  @Roles('MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Update an announcement (author or HR_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Announcement updated' })
  @ApiResponse({ status: 400, description: 'Validation error or audience-target inconsistency' })
  @ApiResponse({ status: 403, description: 'Not the announcement author' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnnouncementWithAuthor> {
    return this.announcementsService.update(user, id, dto, this.buildHrCoreContext(req));
  }

  @Delete(':id')
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an announcement (author or HR_ADMIN)' })
  @ApiResponse({ status: 204, description: 'Announcement deleted' })
  @ApiResponse({ status: 403, description: 'Not the announcement author' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.announcementsService.remove(user, id);
  }

  @Patch(':id/pin')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Pin or unpin an announcement (HR_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Pin updated' })
  @ApiResponse({ status: 400, description: 'pinnedUntil is in the past' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  pin(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PinAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AnnouncementWithAuthor> {
    return this.announcementsService.pin(user, id, dto, this.buildHrCoreContext(req));
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
