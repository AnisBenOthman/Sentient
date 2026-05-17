import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, RbacGuard, Roles, SharedJwtGuard } from '@sentient/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserStatusGuard } from '../iam/guards/user-status.guard';
import { CreateThresholdIndicatorDto } from './dto/create-threshold-indicator.dto';
import { UpdateThresholdIndicatorDto } from './dto/update-threshold-indicator.dto';
import { ThresholdIndicatorsService } from './threshold-indicators.service';
import { ThresholdIndicator } from '../../generated/prisma';

@Controller('threshold-indicators')
@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
@ApiTags('Threshold Indicators')
export class ThresholdIndicatorsController {
  constructor(private readonly thresholdIndicatorsService: ThresholdIndicatorsService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List all active threshold indicators' })
  @ApiResponse({ status: 200, description: 'Active threshold indicator configurations' })
  findAll(): Promise<ThresholdIndicator[]> {
    return this.thresholdIndicatorsService.findAll();
  }

  @Post()
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a threshold indicator by metric key' })
  @ApiResponse({ status: 201, description: 'Threshold indicator created or updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN role required' })
  upsert(
    @Body() dto: CreateThresholdIndicatorDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ThresholdIndicator> {
    if (!user.employeeId) throw new ForbiddenException('Employee context required');
    return this.thresholdIndicatorsService.upsert(dto, user.employeeId);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @ApiOperation({ summary: 'Partially update a threshold indicator' })
  @ApiResponse({ status: 200, description: 'Threshold indicator updated' })
  @ApiResponse({ status: 404, description: 'Threshold indicator not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThresholdIndicatorDto,
  ): Promise<ThresholdIndicator> {
    return this.thresholdIndicatorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a threshold indicator' })
  @ApiResponse({ status: 204, description: 'Threshold indicator removed' })
  @ApiResponse({ status: 404, description: 'Threshold indicator not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.thresholdIndicatorsService.remove(id);
  }
}
