import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../iam/guards/user-status.guard';
import { CreatePromotionRequestDto } from './dto/create-promotion-request.dto';
import { PromotionRequestQueryDto } from './dto/promotion-request-query.dto';
import { ReviewPromotionRequestDto } from './dto/review-promotion-request.dto';
import {
  PromotionRequestDto,
  PromotionRequestsDashboard,
  PromotionRequestsService,
} from './promotion-requests.service';

@Controller('promotion-requests')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Promotion Requests')
export class PromotionRequestsController {
  constructor(private readonly promotionRequestsService: PromotionRequestsService) {}

  @Post()
  @Roles('MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a promotion request' })
  @ApiResponse({ status: 201, description: 'Promotion request created' })
  @ApiResponse({ status: 400, description: 'Validation error or missing responsibility' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Employee not found or out of scope' })
  async create(
    @Body() dto: CreatePromotionRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    return this.promotionRequestsService.create(dto, user);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List scoped promotion requests' })
  @ApiResponse({ status: 200, description: 'Promotion requests visible to the current user' })
  async findAll(
    @Query() query: PromotionRequestQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PromotionRequestDto[]> {
    return this.promotionRequestsService.findAll(query, user);
  }

  @Get('dashboard')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get promotion request dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Promotion request aggregate metrics and detail rows' })
  async dashboard(
    @Query() query: PromotionRequestQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PromotionRequestsDashboard> {
    return this.promotionRequestsService.getDashboard(query, user);
  }

  @Patch(':id/approve')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Approve a pending promotion request' })
  @ApiResponse({ status: 200, description: 'Promotion request approved' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPromotionRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    return this.promotionRequestsService.approve(id, dto, user);
  }

  @Patch(':id/reject')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Reject a pending promotion request' })
  @ApiResponse({ status: 200, description: 'Promotion request rejected' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPromotionRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PromotionRequestDto> {
    return this.promotionRequestsService.reject(id, dto, user);
  }
}
