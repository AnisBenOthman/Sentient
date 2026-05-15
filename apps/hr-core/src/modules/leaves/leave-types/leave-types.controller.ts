import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { LeaveType } from '../../../generated/prisma';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';
import { LeaveTypeQueryDto, LeaveTypesService } from './leave-types.service';

@Controller('leave-types')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Leave Management')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'List leave types, optionally filtered by businessUnitId' })
  @ApiResponse({ status: 200, description: 'List of leave types' })
  async findAll(@Query() query: LeaveTypeQueryDto): Promise<LeaveType[]> {
    return this.leaveTypesService.findAll(query);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Get a single leave type by ID' })
  @ApiResponse({ status: 200, description: 'Leave type detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LeaveType> {
    return this.leaveTypesService.findOne(id);
  }

  @Post()
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a leave type for a business unit' })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  @ApiResponse({ status: 409, description: 'DuplicateLeaveTypeName' })
  async create(@Body() dto: CreateLeaveTypeDto): Promise<LeaveType> {
    return this.leaveTypesService.create(dto);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiResponse({ status: 200, description: 'Leave type updated' })
  @ApiResponse({ status: 400, description: 'AccrualFrequencyLocked' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ): Promise<LeaveType> {
    return this.leaveTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a leave type (soft-delete; blocked when pending requests exist)' })
  @ApiResponse({ status: 200, description: 'Leave type deactivated' })
  @ApiResponse({ status: 400, description: 'LeaveTypeHasPendingRequests' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<LeaveType> {
    return this.leaveTypesService.deactivate(id);
  }

  @Post(':id/reactivate')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a previously deactivated leave type' })
  @ApiResponse({ status: 200, description: 'Leave type reactivated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<LeaveType> {
    return this.leaveTypesService.reactivate(id);
  }
}
