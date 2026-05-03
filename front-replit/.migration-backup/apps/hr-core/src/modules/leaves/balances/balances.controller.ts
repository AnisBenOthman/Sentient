import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { LeaveBalanceAdjustment } from '../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';
import { TriggerAccrualDto } from '../dto/trigger-accrual.dto';
import { AccrualService } from '../accrual/accrual.service';
import { BalancesService, LeaveBalanceDto } from './balances.service';

@Controller('leave-balances')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Leave Management')
export class BalancesController {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly accrualService: AccrualService,
  ) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Get leave balances for an employee by year' })
  @ApiResponse({ status: 200, description: 'List of leave balances with remainingDays computed' })
  async findByEmployee(
    @Query('employeeId') employeeId: string,
    @Query('year', ParseIntPipe) year: number,
  ): Promise<LeaveBalanceDto[]> {
    return this.balancesService.findByEmployee(employeeId, year);
  }

  @Post(':id/adjust')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually adjust a leave balance total days (HR Admin)' })
  @ApiResponse({ status: 200, description: 'Updated balance with refreshed remainingDays' })
  @ApiResponse({ status: 404, description: 'Balance not found' })
  async adjust(
    @Param('id', ParseUUIDPipe) balanceId: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveBalanceDto> {
    return this.balancesService.adjust(balanceId, dto, user.sub);
  }

  @Get(':id/adjustments')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Get audit log of total-day adjustments for a balance' })
  @ApiResponse({ status: 200, description: 'Adjustment history ordered by createdAt DESC' })
  @ApiResponse({ status: 404, description: 'Balance not found' })
  async findAdjustments(
    @Param('id', ParseUUIDPipe) balanceId: string,
  ): Promise<LeaveBalanceAdjustment[]> {
    return this.balancesService.findAdjustments(balanceId);
  }

  @Post('accrual/trigger')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Manually trigger monthly accrual for a given month (HR Admin)' })
  @ApiResponse({ status: 202, description: '{ runId, status: "QUEUED" }' })
  @ApiResponse({ status: 409, description: 'AccrualAlreadyRun' })
  async triggerAccrual(
    @Body() dto: TriggerAccrualDto,
  ): Promise<{ runId: string; status: string }> {
    return this.accrualService.triggerManualAccrual(dto.month);
  }
}
