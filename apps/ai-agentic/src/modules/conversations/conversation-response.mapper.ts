import {
  AgentRunStatus,
  Conversation,
  Message,
} from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto/routing-trace.dto';
import { SourceContext } from '../../common/dto/source-context.dto';

export interface ConversationSummaryResponse {
  id: string;
  title: string;
  status: string;
  lastAgentType: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
}

export interface MessageResponse {
  id: string;
  role: string;
  content: string;
  agentType: string | null;
  status: string;
  sourceContext: SourceContext[];
  createdAt: string;
}

export interface ConversationTurnResponse {
  conversation: ConversationSummaryResponse;
  userMessage: MessageResponse;
  assistantMessage: MessageResponse;
  routing: RoutingTrace;
}

export class ConversationResponseMapper {
  static toSummary(conversation: Conversation): ConversationSummaryResponse {
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      lastAgentType: conversation.lastAgentType,
      lastMessagePreview: conversation.lastMessagePreview,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  static toMessage(message: Message): MessageResponse {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      agentType: message.agentType,
      status: message.status,
      sourceContext: ConversationResponseMapper.parseSourceContext(message.sourceSummary),
      createdAt: message.createdAt.toISOString(),
    };
  }

  static toTurn(
    conversation: Conversation,
    userMessage: Message,
    assistantMessage: Message,
    routing: RoutingTrace,
  ): ConversationTurnResponse {
    return {
      conversation: ConversationResponseMapper.toSummary(conversation),
      userMessage: ConversationResponseMapper.toMessage(userMessage),
      assistantMessage: ConversationResponseMapper.toMessage(assistantMessage),
      routing: {
        status: routing.status ?? AgentRunStatus.SUCCESS,
        nodes: routing.nodes,
      },
    };
  }

  private static parseSourceContext(value: unknown): SourceContext[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry) => ({
        sourceType: typeof entry.sourceType === 'string' ? entry.sourceType : 'UNKNOWN',
        title: typeof entry.title === 'string' ? entry.title : 'Unknown source',
        referenceId: typeof entry.referenceId === 'string' ? entry.referenceId : null,
      }));
  }
}
