import {
  Body,
  Controller,
  ForbiddenException,
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
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { LeaveRequest } from '../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../../iam/guards/user-status.guard';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { LeaveQueryDto } from '../dto/leave-query.dto';
import { PatchAgentAssessmentDto } from '../dto/patch-agent-assessment.dto';
import { ReviewLeaveRequestDto } from '../dto/review-leave-request.dto';
import { RequestsService, TeamCalendarEntry } from './requests.service';

function requireEmployeeId(user: JwtPayload): string {
  if (!requireEmployeeId(user)) throw new ForbiddenException('No employee record linked to this account');
  return requireEmployeeId(user);
}

@Controller('leave-requests')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Leave Management')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new leave request' })
  @ApiResponse({ status: 201, description: 'Leave request created (PENDING or APPROVED)' })
  @ApiResponse({ status: 400, description: 'Validation error or business rule violation' })
  @ApiResponse({ status: 409, description: 'Overlapping leave request exists' })
  async create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest> {
    return this.requestsService.create(requireEmployeeId(user), dto);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'List leave requests for the current employee' })
  @ApiResponse({ status: 200, description: 'List of leave requests' })
  async findByEmployee(
    @Query() query: LeaveQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest[]> {
    return this.requestsService.findByEmployee(requireEmployeeId(user), query);
  }

  @Get('team-calendar')
  @Roles('MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'View approved leave calendar for a team/department' })
  @ApiResponse({ status: 200, description: 'Calendar entries without reason (privacy)' })
  async teamCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('departmentId') departmentId: string | undefined,
    @Query('teamId') teamId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<TeamCalendarEntry[]> {
    return this.requestsService.teamCalendar(requireEmployeeId(user), from, to, departmentId, teamId);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @ApiOperation({ summary: 'Get a single leave request by ID' })
  @ApiResponse({ status: 200, description: 'Leave request detail' })
  @ApiResponse({ status: 403, description: 'Not the request owner' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest> {
    return this.requestsService.findOne(id, requireEmployeeId(user));
  }

  @Post(':id/approve')
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending leave request' })
  @ApiResponse({ status: 200, description: 'Leave request approved' })
  @ApiResponse({ status: 409, description: 'RequestAlreadyDecided' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest> {
    return this.requestsService.approve(id, dto, requireEmployeeId(user));
  }

  @Post(':id/reject')
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending leave request' })
  @ApiResponse({ status: 200, description: 'Leave request rejected' })
  @ApiResponse({ status: 400, description: 'reviewNote required' })
  @ApiResponse({ status: 409, description: 'RequestAlreadyDecided' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest> {
    return this.requestsService.reject(id, dto, requireEmployeeId(user));
  }

  @Post(':id/cancel')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending leave request (owner only)' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled' })
  @ApiResponse({ status: 403, description: 'NotOwner' })
  @ApiResponse({ status: 409, description: 'RequestAlreadyDecided' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveRequest> {
    return this.requestsService.cancel(id, requireEmployeeId(user));
  }

  @Patch(':id/agent-assessment')
  @Roles('SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patch agent risk assessment on a leave request (SYSTEM only)' })
  @ApiResponse({ status: 200, description: 'Assessment stored' })
  async patchAgentAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchAgentAssessmentDto,
  ): Promise<LeaveRequest> {
    return this.requestsService.patchAgentAssessment(id, dto);
  }
}
