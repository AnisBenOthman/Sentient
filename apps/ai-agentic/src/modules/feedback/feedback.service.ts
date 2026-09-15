import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole } from '../../generated/prisma';
import { AiActorContext } from '../../common/graph';
import { PrismaService } from '../../prisma/prisma.service';
import { FeedbackDto, FeedbackResponse } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(messageId: string, actor: AiActorContext, dto: FeedbackDto): Promise<FeedbackResponse> {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        role: MessageRole.ASSISTANT,
        conversation: {
          ownerUserId: actor.userId,
          deletedAt: null,
        },
      },
      select: { id: true, conversationId: true },
    });
    if (!message) throw new NotFoundException('Assistant message not found');

    const feedback = await this.prisma.responseFeedback.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: actor.userId,
        },
      },
      create: {
        conversationId: message.conversationId,
        messageId,
        userId: actor.userId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });

    return {
      id: feedback.id,
      messageId: feedback.messageId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}
