import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProficiencyLevel } from '@sentient/shared';
import { EmployeeSkill } from '../../../generated/prisma';
// import { Roles } from '../../../common/decorators/roles.decorator'; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from '../../../common/guards/rbac.guard'; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from '../../../common/guards/shared-jwt.guard'; // TODO: re-enable when IAM module is implemented
import { UpsertEmployeeSkillDto } from '../dto/upsert-employee-skill.dto';
import { EmployeeSkillsService, UpsertResult } from './employee-skills.service';

@Controller('employees/:employeeId/skills')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Employee Skills')
export class EmployeeSkillsController {
  constructor(private readonly employeeSkillsService: EmployeeSkillsService) {}

  @Get()
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: "Get an employee's current active skill portfolio" })
  @ApiResponse({ status: 200, description: 'Array of active EmployeeSkill records with skill relation populated' })
  @ApiResponse({ status: 403, description: 'Forbidden — scope violation' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('minLevel') minLevel?: ProficiencyLevel,
  ): Promise<EmployeeSkill[]> {
    return this.employeeSkillsService.findForEmployee(employeeId, { minLevel });
  }

  @Post()
  // @Roles('MANAGER', 'HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Record or update a proficiency — no-op if level unchanged, appends history on change' })
  @ApiResponse({ status: 200, description: '{ changed: boolean, current: EmployeeSkill, history: SkillHistory | null }' })
  @ApiResponse({ status: 400, description: 'Validation error or inactive skill on first assignment' })
  @ApiResponse({ status: 404, description: 'Employee or skill not found' })
  @ApiResponse({ status: 409, description: 'Employee is terminated or resigned — writes blocked' })
  async upsert(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpsertEmployeeSkillDto,
  ): Promise<UpsertResult> {
    return this.employeeSkillsService.upsert(employeeId, dto);
  }

  @Delete(':skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @Roles('MANAGER', 'HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Soft-delete a skill from the employee portfolio (history preserved)' })
  @ApiResponse({ status: 204, description: 'Skill removed from portfolio' })
  @ApiResponse({ status: 404, description: 'Employee, skill, or active assignment not found' })
  @ApiResponse({ status: 409, description: 'Employee is terminated or resigned — writes blocked' })
  async remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ): Promise<void> {
    return this.employeeSkillsService.remove(employeeId, skillId);
  }
}
