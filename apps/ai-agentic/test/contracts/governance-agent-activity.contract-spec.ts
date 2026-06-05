import { AgentRunStatus, AgentType, FeedbackRating, MessageRole } from '../../src/generated/prisma';
import { GovernanceService } from '../../src/modules/governance/governance.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AI governance activity contract', () => {
  it('returns aggregate usage, safety, escalation, degradation, and feedback counts', async () => {
    const service = new GovernanceService({
      message: {
        count: async ({ where }: { where: { agentType?: AgentType } }) =>
          where.agentType === AgentType.LEAVE_AGENT ? 1 : 3,
      },
      agentTaskLog: {
        groupBy: async ({ where }: { where: { agentType?: AgentType } }) => [
          { agentType: where.agentType ?? AgentType.SUPERVISOR_AGENT, _count: { agentType: 3 } },
        ],
        count: async ({ where }: { where: { status: AgentRunStatus; agentType?: AgentType } }) => {
          if (where.status === AgentRunStatus.OUT_OF_SCOPE) return 1;
          if (where.status === AgentRunStatus.REFUSED) return 2;
          if (where.status === AgentRunStatus.ESCALATED) return 3;
          if (where.status === AgentRunStatus.DEGRADED) return 4;
          return 0;
        },
      },
      responseFeedback: {
        count: async ({ where }: { where: { rating: FeedbackRating } }) =>
          where.rating === FeedbackRating.POSITIVE ? 5 : 6,
      },
    } as unknown as PrismaService);

    const result = await service.getActivity();

    expect(MessageRole.ASSISTANT).toBe('ASSISTANT');
    expect(result.totalTurns).toBe(3);
    expect(result.safety.escalated).toBe(3);
    expect(result.feedback.negative).toBe(6);

    const filtered = await service.getActivity({ agentType: AgentType.LEAVE_AGENT });

    expect(filtered.totalTurns).toBe(1);
    expect(filtered.byAgent[0]?.agentType).toBe(AgentType.LEAVE_AGENT);
  });
});
