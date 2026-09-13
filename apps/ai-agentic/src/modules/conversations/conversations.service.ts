import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgentActionProposal,
  AgentNodeType,
  AgentRunStatus,
  AgentType,
  Conversation,
  ConversationStatus,
  MessageRole,
  Prisma,
} from '../../generated/prisma';
import { PaginatedResponse, paginationToSkipTake, RoutingTrace } from '../../common/dto';
import { AiActorContext, FinalAnswerResult, PendingActionDraft } from '../../common/graph';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionProposalService } from '../agents/actions/action-proposal.service';
import { SupervisorAgentService } from '../agents/supervisor-agent.service';
import {
  ConversationResponseMapper,
  ConversationSummaryResponse,
  ConversationTurnResponse,
} from './conversation-response.mapper';
import { ConversationContextService } from './conversation-context.service';
import { ConversationSummarizerService } from './conversation-summarizer.service';
import { ConversationTitleService } from './conversation-title.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationDetailResponse } from './dto/conversation-detail.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

const TURN_FAILURE_MESSAGE =
  'Something went wrong on my side while processing that request. Your message was saved — please send it again in a moment. If this keeps happening, contact your HR admin.';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supervisor: SupervisorAgentService,
    private readonly contextBuilder: ConversationContextService,
    private readonly titles: ConversationTitleService,
    private readonly summarizer: ConversationSummarizerService,
    private readonly proposals: ActionProposalService,
  ) {}

  async createConversation(
    actor: AiActorContext,
    dto: CreateConversationDto,
  ): Promise<ConversationTurnResponse> {
    const conversation = await this.prisma.conversation.create({
      data: {
        ownerUserId: actor.userId,
        ownerEmployeeId: actor.employeeId,
        title: this.titles.initialTitle(),
        lastMessagePreview: this.titles.previewFrom(dto.message),
      },
    });

    return this.executeTurn(conversation, actor, dto.message);
  }

  async sendMessage(
    conversationId: string,
    actor: AiActorContext,
    dto: CreateMessageDto,
  ): Promise<ConversationTurnResponse> {
    const conversation = await this.findOwnedConversation(conversationId, actor.userId);
    return this.executeTurn(conversation, actor, dto.message);
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
  ): Promise<ConversationTurnResponse> {
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
    try {
      const supervisorResult = await this.supervisor.executeTurn({
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
      });
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
    }

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
