import { Injectable } from '@nestjs/common';
import { Message } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface ConversationContext {
  recentMessages: Message[];
  priorHandoffAgents: string[];
}

@Injectable()
export class ConversationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(conversationId: string): Promise<ConversationContext> {
    const [recentMessages, handoffs] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.agentHandoff.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { toAgentType: true },
      }),
    ]);

    return {
      recentMessages: [...recentMessages].reverse(),
      priorHandoffAgents: [...new Set(handoffs.map((handoff) => handoff.toAgentType))],
    };
  }
}
