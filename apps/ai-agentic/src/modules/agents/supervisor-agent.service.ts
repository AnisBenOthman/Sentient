import { Injectable } from '@nestjs/common';
import { AiActorContext, ConversationTurnContext, FinalAnswerResult } from '../../common/graph';
import { RoutingTrace } from '../../common/dto';
import { SupervisorLangGraphRunnerService } from './supervisor-langgraph-runner.service';

export interface ExecuteConversationTurnInput {
  conversationId: string;
  userMessageId: string;
  userMessage: string;
  actor: AiActorContext;
  conversationContext: ConversationTurnContext;
}

export interface ExecuteConversationTurnResult {
  finalAnswer: FinalAnswerResult;
  routing: RoutingTrace;
}

@Injectable()
export class SupervisorAgentService {
  constructor(private readonly runner: SupervisorLangGraphRunnerService) {}

  async executeTurn(input: ExecuteConversationTurnInput): Promise<ExecuteConversationTurnResult> {
    return this.runner.execute(input);
  }
}
