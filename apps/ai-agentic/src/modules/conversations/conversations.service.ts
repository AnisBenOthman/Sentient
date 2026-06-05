import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AgentNodeType,
  AgentRunStatus,
  AgentType,
  Conversation,
  ConversationStatus,
  MessageRole,
  Prisma,
} from '../../generated/prisma';
import { PaginatedResponse, paginationToSkipTake } from '../../common/dto';
import { AiActorContext } from '../../common/graph';
import { PrismaService } from '../../prisma/prisma.service';
import { SupervisorAgentService } from '../agents/supervisor-agent.service';
import {
  ConversationResponseMapper,
  ConversationSummaryResponse,
  ConversationTurnResponse,
} from './conversation-response.mapper';
import { ConversationContextService } from './conversation-context.service';
import { ConversationTitleService } from './conversation-title.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationDetailResponse } from './dto/conversation-detail.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supervisor: SupervisorAgentService,
    private readonly contextBuilder: ConversationContextService,
    private readonly titles: ConversationTitleService,
  ) {}

  async createConversation(
    actor: AiActorContext,
    dto: CreateConversationDto,
  ): Promise<ConversationTurnResponse> {
    const conversation = await this.prisma.conversation.create({
      data: {
        ownerUserId: actor.userId,
        ownerEmployeeId: actor.employeeId,
        title: this.titles.titleFrom(dto.message),
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
    await this.contextBuilder.build(conversation.id);
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
      status: query.status ?? { not: ConversationStatus.DELETED },
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
    return {
      conversation: ConversationResponseMapper.toSummary(conversation),
      messages: messages.map(ConversationResponseMapper.toMessage),
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
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: message,
        status: AgentRunStatus.SUCCESS,
      },
    });
    const supervisorResult = await this.supervisor.executeTurn({
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      userMessage: message,
      actor,
    });
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: supervisorResult.finalAnswer.content,
        agentType: AgentType.SUPERVISOR_AGENT,
        nodeType: AgentNodeType.FINAL_ANSWER,
        sourceSummary: this.sourceContextJson(supervisorResult.finalAnswer.sourceContext),
        status: supervisorResult.finalAnswer.status,
      },
    });
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastAgentType: AgentType.SUPERVISOR_AGENT,
        lastMessagePreview: this.titles.previewFrom(supervisorResult.finalAnswer.content),
      },
    });

    return ConversationResponseMapper.toTurn(
      updatedConversation,
      userMessage,
      assistantMessage,
      supervisorResult.routing,
    );
  }

  private async findOwnedConversation(id: string, userId: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        ownerUserId: userId,
        deletedAt: null,
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
