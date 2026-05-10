import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../iam/guards/user-status.guard';
import { AnalyticsService, DashboardAnalytics } from './analytics.service';
import { DashboardAnalyticsQueryDto } from './dto/dashboard-analytics-query.dto';

@Controller('analytics')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get role- and scope-filtered dashboard chart data' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics payload' })
  async getDashboard(
    @Query() query: DashboardAnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<DashboardAnalytics> {
    return this.analyticsService.getDashboard(query, user);
  }
}
