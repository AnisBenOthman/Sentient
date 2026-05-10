import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayload, Roles } from '@sentient/shared';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ReassignReviewerDto } from '../dto/reassign-reviewer.dto';
import { RecordSalaryFollowUpDto } from '../dto/record-salary-follow-up.dto';
import { ReopenReviewDto } from '../dto/reopen-review.dto';
import { ReviewQueryDto } from '../dto/review-query.dto';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { PerformanceReviewList, PerformanceReviewsService } from './performance-reviews.service';

@Controller('performance-reviews')
@ApiTags('Performance Reviews')
export class PerformanceReviewsController {
  constructor(private readonly reviewsService: PerformanceReviewsService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List performance reviews in the current user scope' })
  @ApiResponse({ status: 200, description: 'Paged performance reviews' })
  findAll(@Query() query: ReviewQueryDto, @CurrentUser() user: JwtPayload): Promise<PerformanceReviewList> {
    return this.reviewsService.findAll(query, user);
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get a performance review detail' })
  @ApiResponse({ status: 200, description: 'Performance review detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<unknown> {
    return this.reviewsService.findOne(id, user);
  }

  @Post(':id/self-review')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit employee self-review input' })
  @ApiResponse({ status: 200, description: 'Self-review submitted' })
  submitSelfReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitSelfReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.reviewsService.submitSelfReview(id, dto, user);
  }

  @Post(':id/manager-review')
  @Roles('MANAGER', 'HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit manager review rating and comments' })
  @ApiResponse({ status: 200, description: 'Manager review completed' })
  submitManagerReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitManagerReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.reviewsService.submitManagerReview(id, dto, user);
  }

  @Post(':id/reopen')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a submitted, completed, or closed review' })
  @ApiResponse({ status: 200, description: 'Review reopened' })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.reviewsService.reopenReview(id, dto, user);
  }

  @Post(':id/reassign-reviewer')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign the reviewer on a performance review' })
  @ApiResponse({ status: 200, description: 'Reviewer reassigned' })
  reassignReviewer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignReviewerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.reviewsService.reassignReviewer(id, dto, user);
  }

  @Post(':id/salary-follow-ups')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record salary follow-up for a completed review' })
  @ApiResponse({ status: 201, description: 'Salary follow-up recorded' })
  recordSalaryFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordSalaryFollowUpDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown> {
    return this.reviewsService.recordSalaryFollowUp(id, dto, user);
  }

  @Get(':id/audit')
  @Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')
  @ApiOperation({ summary: 'List performance review audit entries' })
  @ApiResponse({ status: 200, description: 'Audit entries' })
  getAudit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.reviewsService.getAudit(id, user);
  }
}
