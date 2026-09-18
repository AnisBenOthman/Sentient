import { Controller, MessageEvent, Param, Req, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@sentient/shared';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { ActorContextFactory, AI_USER_ROLES } from '../../common/graph';
import { ConversationStreamRunnerService } from './conversation-stream-runner.service';

/**
 * WHY a separate controller/GET route rather than folding this into
 * ConversationsController: NestJS's `@Sse()` decorator applies a GET route
 * internally, but sending a message is a POST with a body — the POST already
 * resolved routing and handed back a `turnId`; this GET claims and streams it.
 * Auth is the normal `Authorization: Bearer <jwt>` header (the frontend reads
 * this via `fetch`, not the native `EventSource`, so there is no need for the
 * query-string-token fallback the HR Core notifications stream uses).
 */
@ApiTags('AI Conversations')
@Controller('conversations')
export class ConversationStreamController {
  constructor(
    private readonly streamRunner: ConversationStreamRunnerService,
    private readonly actorFactory: ActorContextFactory,
  ) {}

  @Sse(':conversationId/turns/:turnId/stream')
  @Roles(...AI_USER_ROLES)
  @ApiOperation({ summary: 'Stream a stream-eligible turn token-by-token' })
  stream(
    @Req() request: Request,
    @Param('conversationId') conversationId: string,
    @Param('turnId') turnId: string,
  ): Observable<MessageEvent> {
    const actor = this.actorFactory.fromRequest(request);
    return this.streamRunner.run(conversationId, turnId, actor.userId);
  }
}
