import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  OkrAnalyticsService,
  OkrCycleSummaryDto,
  EmployeeOkrPortfolioDto,
} from './okr-analytics.service';

@Controller('okr-analytics')
@UseGuards(SharedJwtGuard, RbacGuard)
@ApiTags('OKR Analytics')
export class OkrAnalyticsController {
  constructor(private readonly okrAnalyticsService: OkrAnalyticsService) {}

  @Get('cycle/:cycleId/summary')
  @Roles('MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Per-department cycle progress summary; MANAGER sees own dept only' })
  @ApiResponse({ status: 200 })
  async getCycleSummary(
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OkrCycleSummaryDto> {
    return this.okrAnalyticsService.getCycleSummary(cycleId, user);
  }

  @Get('employee/:employeeId/cycle/:cycleId')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Employee OKR portfolio for a cycle (self, direct reports, or HR_ADMIN)' })
  @ApiResponse({ status: 200 })
  async getEmployeePortfolio(
    @Param('employeeId') employeeId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeOkrPortfolioDto> {
    return this.okrAnalyticsService.getEmployeePortfolio(employeeId, cycleId, user);
  }
}
