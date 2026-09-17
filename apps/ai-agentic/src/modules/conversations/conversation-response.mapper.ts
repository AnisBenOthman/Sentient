import {
  AgentActionProposal,
  AgentRunStatus,
  Conversation,
  Message,
} from '../../generated/prisma';
import {
  ActionOutcomeResponse,
  buildConfirmationPayload,
  ConfirmationPayloadResponse,
} from '../agents/actions/confirmation-card.presenter';
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
  /**
   * Present only while a proposal minted for this message is still awaiting a
   * decision. Its presence is the client's signal to render a confirmation card
   * instead of a plain bubble (spec 017 FR-042). Kept out of sourceSummary —
   * that field means "sources used in the answer", not "pending action".
   */
  confirmationPayload?: ConfirmationPayloadResponse | null;
}

export interface ConversationTurnResponse {
  conversation: ConversationSummaryResponse;
  /**
   * Null for a confirm/cancel turn: a button tap is a control signal, not a
   * message, so nothing is persisted as a USER message (spec 017 T047) — which
   * also keeps it out of the classifier's history window on the next turn.
   */
  userMessage: MessageResponse | null;
  assistantMessage: MessageResponse;
  routing: RoutingTrace;
  /** Present on confirm/cancel turns: the execute/verify result (contracts/action-execution-api.yaml). */
  actionOutcome?: ActionOutcomeResponse;
}

/**
 * WHY a separate response type rather than widening ConversationTurnResponse:
 * `assistantMessage` genuinely does not exist yet on this path — the turn is
 * still resolving on the SSE stream the client is about to open. Keeping it a
 * distinct shape (checked via `streaming` being present) means every existing
 * consumer of ConversationTurnResponse is unaffected.
 */
export interface ConversationTurnStreamingResponse {
  conversation: ConversationSummaryResponse;
  userMessage: MessageResponse | null;
  assistantMessage: null;
  routing: RoutingTrace;
  streaming: {
    turnId: string;
    streamPath: string;
    agentType: string;
  };
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

  static toMessage(message: Message, proposal?: AgentActionProposal | null): MessageResponse {
    const confirmationPayload = proposal ? buildConfirmationPayload(proposal) : null;
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      agentType: message.agentType,
      status: message.status,
      sourceContext: ConversationResponseMapper.parseSourceContext(message.sourceSummary),
      createdAt: message.createdAt.toISOString(),
      ...(confirmationPayload ? { confirmationPayload } : {}),
    };
  }

  static toTurn(
    conversation: Conversation,
    userMessage: Message,
    assistantMessage: Message,
    routing: RoutingTrace,
    proposal?: AgentActionProposal | null,
  ): ConversationTurnResponse {
    return {
      conversation: ConversationResponseMapper.toSummary(conversation),
      userMessage: ConversationResponseMapper.toMessage(userMessage),
      assistantMessage: ConversationResponseMapper.toMessage(assistantMessage, proposal),
      routing: {
        status: routing.status ?? AgentRunStatus.SUCCESS,
        nodes: routing.nodes,
      },
    };
  }

  static toStreamingTurn(
    conversation: Conversation,
    userMessage: Message,
    routingNodes: RoutingTrace['nodes'],
    turnId: string,
    streamPath: string,
    agentType: string,
  ): ConversationTurnStreamingResponse {
    return {
      conversation: ConversationResponseMapper.toSummary(conversation),
      userMessage: ConversationResponseMapper.toMessage(userMessage),
      assistantMessage: null,
      routing: { status: AgentRunStatus.RUNNING, nodes: routingNodes },
      streaming: { turnId, streamPath, agentType },
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
