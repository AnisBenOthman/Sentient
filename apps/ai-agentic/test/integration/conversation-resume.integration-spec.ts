import { ConversationContextService } from '../../src/modules/conversations/conversation-context.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('conversation resume context', () => {
  it('loads prior messages and handoff agents for follow-up turns', async () => {
    const service = new ConversationContextService({
      message: {
        findMany: async () => [
          { id: 'm2', content: 'Assistant', createdAt: new Date(2) },
          { id: 'm1', content: 'User', createdAt: new Date(1) },
        ],
      },
      agentHandoff: {
        findMany: async () => [{ toAgentType: 'LEAVE_AGENT' }, { toAgentType: 'OKR_AGENT' }],
      },
    } as unknown as PrismaService);

    const context = await service.build('conversation-1');

    expect(context.recentMessages[0]?.id).toBe('m1');
    expect(context.priorHandoffAgents).toEqual(['LEAVE_AGENT', 'OKR_AGENT']);
  });
});
