import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgentActionProposal,
  AgentNodeType,
  AgentRunStatus,
  AgentType,
  Conversation,
  ConversationStatus,
  Message,
  MessageRole,
  Prisma,
} from '../../generated/prisma';
import { PaginatedResponse, paginationToSkipTake, RoutingTrace } from '../../common/dto';
import { AiActorContext, FinalAnswerResult, PendingActionDraft } from '../../common/graph';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionProposalService } from '../agents/actions/action-proposal.service';
import { AgentTaskLogService } from '../agents/agent-task-log.service';
import { ActionOutcomeResponse, ActionOutcomeStatus } from '../agents/actions/confirmation-card.presenter';
import { ExecuteConversationTurnInput, SupervisorAgentService } from '../agents/supervisor-agent.service';
import { SupervisorGateService } from '../agents/supervisor-gate.service';
import {
  ConversationResponseMapper,
  ConversationSummaryResponse,
  ConversationTurnResponse,
  ConversationTurnStreamingResponse,
} from './conversation-response.mapper';
import { ConversationContextService } from './conversation-context.service';
import { ConversationSummarizerService } from './conversation-summarizer.service';
import { ConversationTitleService } from './conversation-title.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationDetailResponse } from './dto/conversation-detail.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PendingTurnStore } from './pending-turn.store';
import { StreamEligibilityService } from './stream-eligibility.service';

export const TURN_FAILURE_MESSAGE =
  'Something went wrong on my side while processing that request. Your message was saved — please send it again in a moment. If this keeps happening, contact your HR admin.';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supervisor: SupervisorAgentService,
    private readonly gate: SupervisorGateService,
    private readonly streamEligibility: StreamEligibilityService,
    private readonly pendingTurns: PendingTurnStore,
    private readonly contextBuilder: ConversationContextService,
    private readonly titles: ConversationTitleService,
    private readonly summarizer: ConversationSummarizerService,
    private readonly proposals: ActionProposalService,
    private readonly taskLogs: AgentTaskLogService,
  ) {}

  /**
   * WHY the `allowStreaming: false` overload: channel adapters (Slack, Telegram)
   * await this call and immediately post the complete text back to their own
   * transport — they have no way to consume an SSE stream. Passing `false`
   * both suppresses the streaming branch and narrows the return type at compile
   * time, so those callers never need a null-check on `assistantMessage`.
   */
  async createConversation(actor: AiActorContext, dto: CreateConversationDto, allowStreaming: false): Promise<ConversationTurnResponse>;
  async createConversation(actor: AiActorContext, dto: CreateConversationDto, allowStreaming?: boolean): Promise<ConversationTurnResponse | ConversationTurnStreamingResponse>;
  async createConversation(
    actor: AiActorContext,
    dto: CreateConversationDto,
    allowStreaming = true,
  ): Promise<ConversationTurnResponse | ConversationTurnStreamingResponse> {
    const conversation = await this.prisma.conversation.create({
      data: {
        ownerUserId: actor.userId,
        ownerEmployeeId: actor.employeeId,
        title: this.titles.initialTitle(),
        lastMessagePreview: this.titles.previewFrom(dto.message),
      },
    });

    return this.executeTurn(conversation, actor, dto.message, allowStreaming);
  }

  async sendMessage(conversationId: string, actor: AiActorContext, dto: CreateMessageDto, allowStreaming: false): Promise<ConversationTurnResponse>;
  async sendMessage(conversationId: string, actor: AiActorContext, dto: CreateMessageDto, allowStreaming?: boolean): Promise<ConversationTurnResponse | ConversationTurnStreamingResponse>;
  async sendMessage(
    conversationId: string,
    actor: AiActorContext,
    dto: CreateMessageDto,
    allowStreaming = true,
  ): Promise<ConversationTurnResponse | ConversationTurnStreamingResponse> {
    const conversation = await this.findOwnedConversation(conversationId, actor.userId);
    /**
     * A confirm/cancel is a typed control signal, routed straight to the action
     * executor and never through the intent classifier (spec 017 T047). Its
     * presence is the ONLY consent signal — plain text like "yes, book it" is an
     * ordinary turn and must never be read as implicit confirmation (FR-003).
     */
    if (dto.confirmed !== undefined) {
      if (!dto.confirmationToken) {
        throw new BadRequestException('confirmationToken is required when confirmed is present.');
      }
      return this.executeDecision(conversation, actor, dto.confirmed, dto.confirmationToken);
    }
    return this.executeTurn(conversation, actor, dto.message, allowStreaming);
  }

  private async executeDecision(
    conversation: Conversation,
    actor: AiActorContext,
    confirmed: boolean,
    confirmationToken: string,
  ): Promise<ConversationTurnResponse> {
    if (conversation.status === ConversationStatus.ARCHIVED) {
      throw new BadRequestException('Archived conversations must be restored before sending messages.');
    }

    const outcome = await this.proposals.decide({
      token: confirmationToken,
      confirmed,
      conversationId: conversation.id,
      actor,
    });

    // Only the ASSISTANT outcome is persisted — see ConversationTurnResponse.userMessage.
    const status = this.outcomeMessageStatus(outcome.status);
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: outcome.summary,
        agentType: AgentType.LEAVE_AGENT,
        nodeType: AgentNodeType.SPECIALIST,
        sourceSummary: [],
        status,
      },
    });
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastAgentType: AgentType.LEAVE_AGENT, lastMessagePreview: this.titles.previewFrom(outcome.summary) },
    });

    return {
      ...ConversationResponseMapper.toTurn(updatedConversation, assistantMessage, assistantMessage, {
        status,
        nodes: [{ nodeType: AgentNodeType.SPECIALIST, agentType: AgentType.LEAVE_AGENT, status, summary: outcome.summary }],
      }),
      userMessage: null,
      actionOutcome: outcome,
    };
  }

  /**
   * FR-009/T055: SUCCESS only on a MATCHED verification; UNVERIFIED and FAILED
   * keep their own statuses; a precondition refusal is REFUSED. Every other
   * outcome (cancel, already-decided, expired, unknown) is an informational
   * turn that completed normally.
   */
  private outcomeMessageStatus(status: ActionOutcomeStatus): AgentRunStatus {
    switch (status) {
      case 'SUCCESS':
        return AgentRunStatus.SUCCESS;
      case 'UNVERIFIED':
        return AgentRunStatus.UNVERIFIED;
      case 'FAILED':
        return AgentRunStatus.FAILED;
      case 'REFUSED':
        return AgentRunStatus.REFUSED;
      default:
        return AgentRunStatus.SUCCESS;
    }
  }

  async list(
    actor: AiActorContext,
    query: ListConversationsQueryDto,
  ): Promise<PaginatedResponse<ConversationSummaryResponse>> {
    const { skip, take } = paginationToSkipTake(query);
    const where: Prisma.ConversationWhereInput = {
      ownerUserId: actor.userId,
      deletedAt: null,
      status: query.status ?? ConversationStatus.ACTIVE,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: items.map(ConversationResponseMapper.toSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(conversationId: string, actor: AiActorContext): Promise<ConversationDetailResponse> {
    const conversation = await this.findOwnedConversation(conversationId, actor.userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    // One query for every proposal in the thread, so a re-fetched conversation
    // re-renders any still-pending card exactly as the original turn did (FR-042).
    const proposals = await this.prisma.agentActionProposal.findMany({
      where: { conversationId: conversation.id },
    });
    const proposalByMessageId = new Map(proposals.map((proposal) => [proposal.messageId, proposal]));
    return {
      conversation: ConversationResponseMapper.toSummary(conversation),
      messages: messages.map((message) =>
        ConversationResponseMapper.toMessage(message, proposalByMessageId.get(message.id) ?? null),
      ),
    };
  }

  async update(
    conversationId: string,
    actor: AiActorContext,
    dto: UpdateConversationDto,
  ): Promise<ConversationSummaryResponse> {
    await this.findOwnedConversation(conversationId, actor.userId);
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: dto.status,
        archivedAt: dto.status === ConversationStatus.ARCHIVED ? new Date() : null,
      },
    });
    return ConversationResponseMapper.toSummary(conversation);
  }

  async delete(conversationId: string, actor: AiActorContext): Promise<void> {
    await this.findOwnedConversation(conversationId, actor.userId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.DELETED,
        deletedAt: new Date(),
      },
    });
  }

  private async executeTurn(
    conversation: Conversation,
    actor: AiActorContext,
    message: string,
    allowStreaming: boolean,
  ): Promise<ConversationTurnResponse | ConversationTurnStreamingResponse> {
    if (conversation.status === ConversationStatus.ARCHIVED) {
      throw new BadRequestException('Archived conversations must be restored before sending messages.');
    }
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: message,
        status: AgentRunStatus.SUCCESS,
      },
    });
    const conversationContext = await this.contextBuilder.build(conversation.id);
    const turnInput: ExecuteConversationTurnInput = {
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userMessage: message,
      actor,
      conversationContext: {
        /**
         * WHY: The rolling summary rides as a synthetic leading assistant turn
         * so every consumer (intent classifier, all specialist tool callers)
         * sees pre-window context without any changes to their history handling.
         */
        recentMessages: [
          ...(conversationContext.contextSummary
            ? [{
                id: 'context-summary',
                role: MessageRole.ASSISTANT as string,
                content: `Summary of the earlier part of this conversation (for context): ${conversationContext.contextSummary}`,
              }]
            : []),
          ...conversationContext.recentMessages.map((recentMessage) => ({
            id: recentMessage.id,
            role: recentMessage.role,
            content: recentMessage.content,
          })),
        ],
        priorHandoffAgents: conversationContext.priorHandoffAgents,
      },
    };

    /**
     * WHY: The user message is already persisted; letting a supervisor failure
     * bubble up as a 500 left a dangling user message with no reply (and a retry
     * duplicated it). A failed turn instead persists an honest FAILED assistant
     * message so the conversation stays consistent and the UI can offer a retry.
     */
    let finalAnswer: FinalAnswerResult;
    let routing: RoutingTrace;
    let pendingAction: PendingActionDraft | undefined;
    let turnFailed = false;
    /**
     * WHY captured outside the try: when the supervisor throws after the gate
     * has already opened a parent AgentTaskLog, that log used to be left on
     * RUNNING forever — a turn that visibly failed to the user but reads as
     * still in flight in the Governance Center. Holding the gate result here
     * lets the catch close the log as FAILED.
     */
    let parentLogId: string | null = null;
    try {
      /**
       * WHY the gate runs here, once, before deciding whether to stream: Phase
       * 1-3 (security guardrail, intent classifier, RBAC/scope guardrail) must
       * never run twice for one turn. When the turn is not stream-eligible, the
       * already-resolved gate is threaded into supervisor.executeTurn() so the
       * LangGraph's own supervisorNode reuses it instead of recomputing it.
       */
      const gateResult = await this.gate.evaluate(turnInput);
      parentLogId = gateResult.parentLog.id;
      const eligibility = allowStreaming ? this.streamEligibility.check(gateResult) : ({ eligible: false } as const);
      if (eligibility.eligible) {
        const turnId = randomUUID();
        this.pendingTurns.put({
          turnId,
          conversationId: conversation.id,
          ownerUserId: actor.userId,
          actor,
          gate: gateResult,
          agentType: eligibility.agentType,
          normalizedIntent: gateResult.classification.normalizedIntent,
          isDraftRequest: gateResult.classification.isDraftIntent,
          input: turnInput,
          conversation,
          userMessage,
          createdAt: Date.now(),
        });
        return ConversationResponseMapper.toStreamingTurn(
          conversation,
          userMessage,
          gateResult.routingNodes,
          turnId,
          `/conversations/${conversation.id}/turns/${turnId}/stream`,
          eligibility.agentType,
        );
      }

      const supervisorResult = await this.supervisor.executeTurn(turnInput, gateResult);
      finalAnswer = supervisorResult.finalAnswer;
      routing = supervisorResult.routing;
      pendingAction = supervisorResult.pendingAction;
    } catch (error: unknown) {
      turnFailed = true;
      this.logger.error(
        `Supervisor turn failed for conversation ${conversation.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      finalAnswer = {
        status: AgentRunStatus.FAILED,
        content: TURN_FAILURE_MESSAGE,
        sourceContext: [],
        routingSummary: '',
      };
      routing = { status: AgentRunStatus.FAILED, nodes: [] };
      await this.closeFailedTaskLog(parentLogId, error);
    }

    return this.persistTurnOutcome(conversation, userMessage, finalAnswer, routing, pendingAction, actor, turnFailed);
  }

  /**
   * Closes a parent task log that a thrown turn would otherwise leave on RUNNING.
   *
   * WHY it swallows its own error: the user already has a persisted failure
   * message on the way, and losing that to a second, audit-only failure would
   * turn a handled outage into the dangling-user-message bug this path exists
   * to prevent.
   */
  private async closeFailedTaskLog(parentLogId: string | null, error: unknown): Promise<void> {
    if (!parentLogId) return;
    try {
      await this.taskLogs.finish(parentLogId, {
        status: AgentRunStatus.FAILED,
        outputSummary: TURN_FAILURE_MESSAGE,
        errorCode: 'TURN_EXECUTION_FAILED',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      });
    } catch (finishError: unknown) {
      this.logger.error(
        `Failed to close task log ${parentLogId} after a failed turn`,
        finishError instanceof Error ? finishError.stack : undefined,
      );
    }
  }

  /**
   * WHY public and shared: this is the one place a turn's final answer becomes a
   * persisted Message, an updated conversation, and (when applicable) a minted
   * action proposal — both the synchronous turn above and
   * ConversationStreamRunnerService's streaming turn need exactly this tail,
   * not a second implementation of it.
   */
  async persistTurnOutcome(
    conversation: Conversation,
    userMessage: Message,
    finalAnswer: FinalAnswerResult,
    routing: RoutingTrace,
    pendingAction: PendingActionDraft | undefined,
    actor: AiActorContext,
    turnFailed: boolean,
  ): Promise<ConversationTurnResponse> {
    let proposalForResponse: AgentActionProposal | null = null;
    let assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: finalAnswer.content,
        agentType: AgentType.SUPERVISOR_AGENT,
        nodeType: AgentNodeType.FINAL_ANSWER,
        sourceSummary: this.sourceContextJson(finalAnswer.sourceContext),
        status: finalAnswer.status,
      },
    });
    /**
     * Propose completes here, not inside the specialist.
     *
     * WHY gated on finalAnswer.status rather than on pendingAction alone:
     * FinalAnswerPolicyService.review() can rewrite the content and force REFUSED
     * after the specialist returned. Minting only when the REVIEWED status is still
     * PENDING_CONFIRMATION means a swept turn never mints — a refusal can never ship
     * with a live confirmation token attached to it.
     */
    if (pendingAction && finalAnswer.status === AgentRunStatus.PENDING_CONFIRMATION) {
      try {
        await this.proposals.mint(pendingAction, {
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          actor,
        });
        proposalForResponse = await this.proposals.findByMessageId(assistantMessage.id);
      } catch (error: unknown) {
        /**
         * A card with no token is worse than no card: the user would see a booking
         * summary with buttons that can never succeed. Demote the message so nothing
         * renders a confirmation affordance.
         */
        this.logger.error(
          `Failed to mint action proposal for message ${assistantMessage.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
        assistantMessage = await this.prisma.message.update({
          where: { id: assistantMessage.id },
          data: { status: AgentRunStatus.FAILED, content: TURN_FAILURE_MESSAGE },
        });
        finalAnswer = { ...finalAnswer, status: AgentRunStatus.FAILED, content: TURN_FAILURE_MESSAGE };
        routing = { ...routing, status: AgentRunStatus.FAILED };
      }
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastAgentType: AgentType.SUPERVISOR_AGENT,
        lastMessagePreview: this.titles.previewFrom(finalAnswer.content),
        // WHY: a failed turn must not overwrite the initial title with the apology text.
        title: conversation.title === this.titles.initialTitle() && !turnFailed
          ? this.titles.titleFrom(finalAnswer.content)
          : conversation.title,
      },
    });

    // WHY: fire-and-forget — the summary refresh must never delay or fail the
    // turn response; maybeSummarize catches its own errors.
    void this.summarizer.maybeSummarize(conversation.id);

    return ConversationResponseMapper.toTurn(
      updatedConversation,
      userMessage,
      assistantMessage,
      routing,
      proposalForResponse,
    );
  }

  private async findOwnedConversation(id: string, userId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
        status: { not: ConversationStatus.DELETED },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private sourceContextJson(sourceContext: Array<{ sourceType: string; title: string; referenceId?: string | null }>): Prisma.InputJsonValue {
    return sourceContext.map((source) => ({
      sourceType: source.sourceType,
      title: source.title,
      referenceId: source.referenceId ?? null,
    }));
  }
}
