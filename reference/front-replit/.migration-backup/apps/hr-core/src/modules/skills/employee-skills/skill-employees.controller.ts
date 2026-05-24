import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { EmployeeSkillQueryDto } from '../dto/employee-skill-query.dto';
import { EmployeeSkillsService, EmployeeSkillWithEmployee, PaginatedResult } from './employee-skills.service';

@Controller('skills/:skillId/employees')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Employee Skills')
export class SkillEmployeesController {
  constructor(private readonly employeeSkillsService: EmployeeSkillsService) {}

  @Get()
  @Roles('HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List employees who hold this skill and at what level' })
  @ApiResponse({ status: 200, description: '{ data: EmployeeSkillWithEmployee[], total, page, limit }. Employee trimmed to id, firstName, lastName, departmentId, teamId.' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN or EXECUTIVE required' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async findByEmployeesForSkill(
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: EmployeeSkillQueryDto,
  ): Promise<PaginatedResult<EmployeeSkillWithEmployee>> {
    return this.employeeSkillsService.findByEmployeesForSkill(skillId, user, query);
  }
}
