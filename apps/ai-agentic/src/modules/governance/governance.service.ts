import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, FeedbackRating, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentActivityQueryDto } from './dto/agent-activity-query.dto';

export interface GovernanceActivityResponse {
  totalTurns: number;
  byAgent: Array<{ agentType: AgentType; count: number }>;
  safety: {
    outOfScope: number;
    refused: number;
    escalated: number;
    degraded: number;
  };
  feedback: {
    positive: number;
    negative: number;
  };
}

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivity(query: AgentActivityQueryDto = {}): Promise<GovernanceActivityResponse> {
    const taskWhere = this.taskWhere(query);
    const messageWhere = this.messageWhere(query);
    const feedbackWhere = this.feedbackWhere(query);
    const [
      totalTurns,
      byAgent,
      outOfScope,
      refused,
      escalated,
      degraded,
      positive,
      negative,
    ] = await Promise.all([
      this.prisma.message.count({ where: messageWhere }),
      this.prisma.agentTaskLog.groupBy({
        by: ['agentType'],
        where: taskWhere,
        _count: { agentType: true },
      }),
      this.prisma.agentTaskLog.count({ where: { ...taskWhere, status: AgentRunStatus.OUT_OF_SCOPE } }),
      this.prisma.agentTaskLog.count({ where: { ...taskWhere, status: AgentRunStatus.REFUSED } }),
      this.prisma.agentTaskLog.count({ where: { ...taskWhere, status: AgentRunStatus.ESCALATED } }),
      this.prisma.agentTaskLog.count({ where: { ...taskWhere, status: AgentRunStatus.DEGRADED } }),
      this.prisma.responseFeedback.count({ where: { ...feedbackWhere, rating: FeedbackRating.POSITIVE } }),
      this.prisma.responseFeedback.count({ where: { ...feedbackWhere, rating: FeedbackRating.NEGATIVE } }),
    ]);

    return {
      totalTurns,
      byAgent: byAgent.map((row) => ({ agentType: row.agentType, count: row._count.agentType })),
      safety: { outOfScope, refused, escalated, degraded },
      feedback: { positive, negative },
    };
  }

  private taskWhere(query: AgentActivityQueryDto): Prisma.AgentTaskLogWhereInput {
    return {
      ...(query.agentType ? { agentType: query.agentType } : {}),
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private messageWhere(query: AgentActivityQueryDto): Prisma.MessageWhereInput {
    return {
      role: 'ASSISTANT',
      ...(query.agentType ? { agentType: query.agentType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private feedbackWhere(query: AgentActivityQueryDto): Prisma.ResponseFeedbackWhereInput {
    return {
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }
}
