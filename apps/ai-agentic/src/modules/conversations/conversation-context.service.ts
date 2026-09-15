import { Injectable } from '@nestjs/common';
import { Message } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * How many of the newest messages travel with each turn. Messages beyond this
 * window are covered by the conversation's rolling contextSummary instead.
 */
export const RECENT_MESSAGE_WINDOW = 8;

export interface ConversationContext {
  recentMessages: Message[];
  priorHandoffAgents: string[];
  /** Rolling summary of messages older than the recent window (null until the window overflows). */
  contextSummary: string | null;
}

@Injectable()
export class ConversationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(conversationId: string): Promise<ConversationContext> {
    const [recentMessages, handoffs, conversation] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_MESSAGE_WINDOW,
      }),
      this.prisma.agentHandoff.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { toAgentType: true },
      }),
      this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contextSummary: true },
      }),
    ]);

    return {
      recentMessages: [...recentMessages].reverse(),
      priorHandoffAgents: [...new Set(handoffs.map((handoff) => handoff.toAgentType))],
      contextSummary: conversation?.contextSummary ?? null,
    };
  }
}
