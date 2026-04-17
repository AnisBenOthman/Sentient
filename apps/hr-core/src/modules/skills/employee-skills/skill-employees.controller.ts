import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import { Roles } from '../../../common/decorators/roles.decorator'; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from '../../../common/guards/rbac.guard'; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from '../../../common/guards/shared-jwt.guard'; // TODO: re-enable when IAM module is implemented
import { EmployeeSkillQueryDto } from '../dto/employee-skill-query.dto';
import { EmployeeSkillsService, EmployeeSkillWithEmployee, PaginatedResult } from './employee-skills.service';

@Controller('skills/:skillId/employees')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Employee Skills')
export class SkillEmployeesController {
  constructor(private readonly employeeSkillsService: EmployeeSkillsService) {}

  @Get()
  // @Roles('HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'List employees who hold this skill and at what level' })
  @ApiResponse({ status: 200, description: '{ data: EmployeeSkillWithEmployee[], total, page, limit }. Employee trimmed to id, firstName, lastName, departmentId, teamId.' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN or EXECUTIVE required' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async findByEmployeesForSkill(
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Query() query: EmployeeSkillQueryDto,
  ): Promise<PaginatedResult<EmployeeSkillWithEmployee>> {
    return this.employeeSkillsService.findByEmployeesForSkill(skillId, query);
  }
}
