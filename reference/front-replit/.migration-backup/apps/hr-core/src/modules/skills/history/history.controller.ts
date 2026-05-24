import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { HistoryQueryDto } from '../dto/history-query.dto';
import { HistoryService, PaginatedHistory } from './history.service';

@Controller('skills/history')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Skills Catalog')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({
    summary: 'Audit skill-level evolution between two dates',
    description:
      'At least one of employeeId, teamId, departmentId, skillId MUST be provided. ' +
      'EMPLOYEE role may only query their own employeeId.',
  })
  @ApiResponse({ status: 200, description: '{ data: SkillHistory[], total, page, limit }. Includes skill and assessedBy summaries.' })
  @ApiResponse({ status: 400, description: 'No scope filter provided, or fromDate > toDate' })
  @ApiResponse({ status: 403, description: 'Forbidden — scope violation' })
  async query(@Query() dto: HistoryQueryDto): Promise<PaginatedHistory> {
    return this.historyService.query(dto);
  }
}
