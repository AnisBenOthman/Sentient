import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkillHistory } from '../../../generated/prisma';
// import { Roles } from '../../../common/decorators/roles.decorator'; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from '../../../common/guards/rbac.guard'; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from '../../../common/guards/shared-jwt.guard'; // TODO: re-enable when IAM module is implemented
import { HistoryQueryDto } from '../dto/history-query.dto';
import { HistoryService, PaginatedHistory } from './history.service';

@Controller('skills/history')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Skills Catalog')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
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
