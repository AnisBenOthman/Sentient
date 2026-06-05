import { Body, Controller, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@sentient/shared';
import { Request } from 'express';
import { ActorContextFactory } from '../../common/graph';
import { FeedbackDto, FeedbackResponse } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

const AI_USER_ROLES = ['HR_ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE', 'EXECUTIVE', 'SYSTEM_ADMIN'];

@ApiTags('AI Feedback')
@ApiBearerAuth()
@Controller('messages')
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly actorFactory: ActorContextFactory,
  ) {}

  @Put(':messageId/feedback')
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Rate an assistant response' })
  @ApiOkResponse({ description: 'Saved response feedback' })
  upsert(
    @Req() request: Request,
    @Param('messageId') messageId: string,
    @Body() dto: FeedbackDto,
  ): Promise<FeedbackResponse> {
    return this.feedback.upsert(messageId, this.actorFactory.fromRequest(request), dto);
  }
}
