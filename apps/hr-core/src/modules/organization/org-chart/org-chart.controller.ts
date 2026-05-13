import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { OrgChartService } from './org-chart.service';

@Controller('org-chart')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Organization - Org Chart')
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE', 'SYSTEM_ADMIN', 'SYSTEM')
  @ApiOperation({ summary: 'Get full organizational hierarchy' })
  @ApiResponse({ status: 200, description: 'Org chart hierarchy' })
  getOrgChart() {
    return this.orgChartService.getOrgChart();
  }
}
