import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayload, NotificationCategory, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarkAllReadDto } from './dto/mark-all-read.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import {
  NotificationListResult,
  NotificationsService,
  UpdatedCountResult,
} from './notifications.service';

@Controller('notifications')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('Notifications')
@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationListResult> {
    return this.notificationsService.list(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user' })
  @ApiOkResponse({ schema: { example: { unreadCount: 3 } } })
  async unreadCount(@CurrentUser() user: JwtPayload): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notificationsService.getUnreadCount(user.sub) };
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  async markAllRead(
    @CurrentUser() user: JwtPayload,
    @Body() dto: MarkAllReadDto,
  ): Promise<UpdatedCountResult> {
    return this.notificationsService.markAllRead(user.sub, dto.category);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one current-user notification as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(id, user.sub);
  }

  @Delete('dismiss-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss all current-user notifications (optionally filtered by category)' })
  async dismissAll(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: string,
  ): Promise<UpdatedCountResult> {
    return this.notificationsService.dismissAll(user.sub, category as NotificationCategory | undefined);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dismiss one current-user notification' })
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.notificationsService.dismiss(id, user.sub);
  }
}
