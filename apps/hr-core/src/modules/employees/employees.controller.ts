import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { Employee, SalaryHistory } from '../../generated/prisma';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../iam/guards/user-status.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { EmployeesService, EmployeeProfile, PaginatedEmployees } from './employees.service';

@Controller('employees')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Create a new employee record' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Referenced position, department, team or manager not found' })
  @ApiResponse({ status: 409, description: 'Email or employee code already in use' })
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.create(dto, user.sub);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List employees with filtering, pagination and search' })
  @ApiResponse({ status: 200, description: 'Paginated employee list (scope-filtered, sensitive fields stripped per role)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(
    @Query() query: EmployeeQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedEmployees> {
    return this.employeesService.findAll(query, user);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get a single employee profile' })
  @ApiResponse({ status: 200, description: 'Employee profile (sensitive fields stripped per role)' })
  @ApiResponse({ status: 403, description: 'Forbidden — scope violation' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.findById(id, user);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update employee information (salary change auto-creates history)' })
  @ApiResponse({ status: 200, description: 'Updated employee profile' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. salary changed without reason)' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee or referenced entity not found' })
  @ApiResponse({ status: 409, description: 'Email conflict' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeProfile> {
    return this.employeesService.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Transition employment status (TERMINATED/RESIGNED emits domain event)' })
  @ApiResponse({ status: 200, description: 'Employee with updated status' })
  @ApiResponse({ status: 400, description: 'Invalid transition or missing reason' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee already in target status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Employee> {
    return this.employeesService.updateStatus(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Soft-delete an employee record (sets deletedAt, record is retained for audit)' })
  @ApiResponse({ status: 204, description: 'Employee deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Employee not found or already deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.employeesService.remove(id, user.sub);
  }

  @Get(':id/salary-history')
  @Roles('HR_ADMIN', 'EXECUTIVE')
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
