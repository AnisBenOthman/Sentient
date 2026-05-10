import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, Roles } from '@sentient/shared';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CreateReviewCycleDto } from '../dto/create-review-cycle.dto';
import { InitiateReviewCycleDto } from '../dto/initiate-review-cycle.dto';
import { InitiateReviewCycleResult, ReviewCycleSummary, ReviewCyclesService } from './review-cycles.service';

function requireEmployeeId(user: JwtPayload): string {
  if (!user.employeeId) throw new ForbiddenException('No employee record linked to this account');
  return user.employeeId;
}

@Controller('performance-review-cycles')
@ApiTags('Performance Review Cycles')
export class ReviewCyclesController {
  constructor(private readonly cyclesService: ReviewCyclesService) {}

  @Post()
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'Create a performance review cycle' })
  @ApiResponse({ status: 201, description: 'Review cycle created' })
  create(@Body() dto: CreateReviewCycleDto, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.cyclesService.create(dto, requireEmployeeId(user));
  }

  @Get()
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List performance review cycles' })
  @ApiResponse({ status: 200, description: 'Review cycles with assignment counts' })
  findAll(): Promise<unknown[]> {
    return this.cyclesService.list();
  }

  @Post(':id/initiate')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a review cycle and assign employee reviews' })
  @ApiResponse({ status: 200, description: 'Assignment result with missing reviewer conflicts' })
  initiate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateReviewCycleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<InitiateReviewCycleResult> {
    return this.cyclesService.initiate(id, dto, requireEmployeeId(user));
  }

  @Get(':id/summary')
  @Roles('MANAGER', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get review cycle summary metrics' })
  @ApiResponse({ status: 200, description: 'Cycle summary' })
  summary(@Param('id', ParseUUIDPipe) id: string): Promise<ReviewCycleSummary> {
    return this.cyclesService.summary(id);
  }

  @Post(':id/close')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a performance review cycle' })
  @ApiResponse({ status: 200, description: 'Cycle closed and completed reviews locked' })
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.cyclesService.close(id, requireEmployeeId(user));
  }
}
