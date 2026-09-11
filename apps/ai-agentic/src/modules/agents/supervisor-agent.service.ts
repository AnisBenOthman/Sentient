import { Injectable } from '@nestjs/common';
import {
  AiActorContext,
  ConversationTurnContext,
  FinalAnswerResult,
  PendingActionDraft,
} from '../../common/graph';
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
  /**
   * Set when a specialist froze a mutating action awaiting confirmation.
   *
   * WHY it rides here and NOT on FinalAnswerResult: FinalAnswerResult is what gets
   * persisted as the assistant Message. The frozen payload belongs in the
   * AgentActionProposal row, which cannot be written until that message exists
   * (messageId is a non-null unique FK). So the draft travels out of the graph and
   * ConversationsService mints from it after the message insert.
   */
  pendingAction?: PendingActionDraft;
}

@Injectable()
export class SupervisorAgentService {
  constructor(private readonly runner: SupervisorLangGraphRunnerService) {}

  async executeTurn(input: ExecuteConversationTurnInput): Promise<ExecuteConversationTurnResult> {
    return this.runner.execute(input);
  }
}
