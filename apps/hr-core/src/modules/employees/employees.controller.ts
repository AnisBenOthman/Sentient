import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChannelType, JwtPayload } from '@sentient/shared';
import { Employee, SalaryHistory } from '../../generated/prisma';

const DEV_USER: JwtPayload = {
  sub: 'dev-user-id', employeeId: 'dev-emp-id', roles: ['HR_ADMIN'],
  departmentId: 'dev-dept-id', teamId: null, channel: ChannelType.WEB, iat: 0, exp: 9999999999,
};
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// import { Roles } from '../../common/decorators/roles.decorator'; // TODO: re-enable when IAM module is implemented
// import { RbacGuard } from '../../common/guards/rbac.guard'; // TODO: re-enable when IAM module is implemented
// import { SharedJwtGuard } from '../../common/guards/shared-jwt.guard'; // TODO: re-enable when IAM module is implemented
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeesService, EmployeeProfile, PaginatedEmployees } from './employees.service';

@Controller('employees')
// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented
@ApiTags('Employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // ---- US1: Create ----

  @Post()
  // @Roles('HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Create a new employee record' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Referenced position, department, team or manager not found' })
  @ApiResponse({ status: 409, description: 'Email or employee code already in use' })
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.create(dto, (user ?? DEV_USER).sub);
  }

  // ---- US4: List & Search ----

  @Get()
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'List employees with filtering, pagination and search' })
  @ApiResponse({ status: 200, description: 'Paginated employee list (scope-filtered, sensitive fields stripped per role)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query() query: EmployeeQueryDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<PaginatedEmployees> {
    return this.employeesService.findAll(query, user ?? DEV_USER);
  }

  // ---- US2: View Profile ----

  @Get(':id')
  // @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Get a single employee profile' })
  @ApiResponse({ status: 200, description: 'Employee profile (sensitive fields stripped per role)' })
  @ApiResponse({ status: 403, description: 'Forbidden — scope violation' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.findById(id, user ?? DEV_USER);
  }

  // ---- US3: Update ----

  @Patch(':id')
  // @Roles('HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Update employee information (salary change auto-creates history)' })
  @ApiResponse({ status: 200, description: 'Updated employee profile' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. salary changed without reason)' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee or referenced entity not found' })
  @ApiResponse({ status: 409, description: 'Email conflict' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.update(id, dto, (user ?? DEV_USER).sub);
  }

  // ---- US5: Lifecycle Transition ----

  @Patch(':id/status')
  // @Roles('HR_ADMIN') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Transition employment status (TERMINATED/RESIGNED emits domain event)' })
  @ApiResponse({ status: 200, description: 'Employee with updated status' })
  @ApiResponse({ status: 400, description: 'Invalid transition or missing reason' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee already in target status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<Employee> {
    return this.employeesService.updateStatus(id, dto, (user ?? DEV_USER).sub);
  }

  // ---- US6: Salary History ----

  @Get(':id/salary-history')
  // @Roles('HR_ADMIN', 'EXECUTIVE') // TODO: re-enable when IAM module is implemented
  @ApiOperation({ summary: 'Get salary history for an employee (ordered by effectiveDate desc)' })
  @ApiResponse({ status: 200, description: 'Array of salary history entries' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN or EXECUTIVE required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getSalaryHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<SalaryHistory[]> {
    return this.employeesService.getSalaryHistory(id, limit);
  }
}
