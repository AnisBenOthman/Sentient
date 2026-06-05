import { AgentRunStatus, FeedbackRating, MessageRole } from '../../src/generated/prisma';
import { GovernanceService } from '../../src/modules/governance/governance.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AI governance activity contract', () => {
  it('returns aggregate usage, safety, escalation, degradation, and feedback counts', async () => {
    const service = new GovernanceService({
      message: {
        count: async () => 3,
      },
      agentTaskLog: {
        groupBy: async () => [{ agentType: 'SUPERVISOR_AGENT', _count: { agentType: 3 } }],
        count: async ({ where }: { where: { status: AgentRunStatus } }) => {
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
  });
});
