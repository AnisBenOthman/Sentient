import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, FeedbackRating } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

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

  async getActivity(): Promise<GovernanceActivityResponse> {
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
      this.prisma.message.count({ where: { role: 'ASSISTANT' } }),
      this.prisma.agentTaskLog.groupBy({
        by: ['agentType'],
        _count: { agentType: true },
      }),
      this.prisma.agentTaskLog.count({ where: { status: AgentRunStatus.OUT_OF_SCOPE } }),
      this.prisma.agentTaskLog.count({ where: { status: AgentRunStatus.REFUSED } }),
      this.prisma.agentTaskLog.count({ where: { status: AgentRunStatus.ESCALATED } }),
      this.prisma.agentTaskLog.count({ where: { status: AgentRunStatus.DEGRADED } }),
      this.prisma.responseFeedback.count({ where: { rating: FeedbackRating.POSITIVE } }),
      this.prisma.responseFeedback.count({ where: { rating: FeedbackRating.NEGATIVE } }),
    ]);

    return {
      totalTurns,
      byAgent: byAgent.map((row) => ({ agentType: row.agentType, count: row._count.agentType })),
      safety: { outOfScope, refused, escalated, degraded },
      feedback: { positive, negative },
    };
  }
}
