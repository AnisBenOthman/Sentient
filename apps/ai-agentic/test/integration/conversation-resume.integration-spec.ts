import { AgentRunStatus, AgentType, ConversationStatus, MessageRole } from '../../src/generated/prisma';
import { AiActorContext } from '../../src/common/graph';
import { ConversationContextService } from '../../src/modules/conversations/conversation-context.service';
import { ConversationsService } from '../../src/modules/conversations/conversations.service';
import { ExecuteConversationTurnInput } from '../../src/modules/agents/supervisor-agent.service';
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

  it('passes prior conversation context into resumed supervisor turns', async () => {
    const actor: AiActorContext = {
      jwt: 'token',
      userId: 'user-1',
      employeeId: 'employee-1',
      roles: ['EMPLOYEE'],
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      correlationId: 'corr-1',
    };
    let supervisorInput = null as ExecuteConversationTurnInput | null;
    const prisma = {
      conversation: {
        findFirst: async () => ({
          id: 'conversation-1',
          ownerUserId: actor.userId,
          ownerEmployeeId: actor.employeeId,
          title: 'Leave help',
          status: ConversationStatus.ACTIVE,
        }),
        update: async () => ({
          id: 'conversation-1',
          title: 'Leave help',
          status: ConversationStatus.ACTIVE,
          lastAgentType: AgentType.SUPERVISOR_AGENT,
          lastMessagePreview: 'Answer',
          updatedAt: new Date(3),
        }),
      },
      message: {
        create: async ({ data }: { data: { role: MessageRole; content: string } }) => ({
          id: data.role === MessageRole.USER ? 'new-user-message' : 'assistant-message',
          conversationId: 'conversation-1',
          role: data.role,
          content: data.content,
          createdAt: new Date(2),
          status: AgentRunStatus.SUCCESS,
        }),
        findMany: async () => [
          { id: 'new-user-message', role: MessageRole.USER, content: 'And last leave date?', createdAt: new Date(2) },
          { id: 'old-user-message', role: MessageRole.USER, content: 'What is my leave balance?', createdAt: new Date(1) },
        ],
      },
      agentHandoff: {
        findMany: async () => [{ toAgentType: AgentType.LEAVE_AGENT }],
      },
    } as unknown as PrismaService;
    const service = new ConversationsService(
      prisma,
      {
        executeTurn: async (input: ExecuteConversationTurnInput) => {
          supervisorInput = input;
          return {
            finalAnswer: {
              status: AgentRunStatus.SUCCESS,
              content: 'Answer',
              sourceContext: [],
              routingSummary: 'done',
            },
            routing: { status: AgentRunStatus.SUCCESS, nodes: [] },
          };
        },
      } as never,
      new ConversationContextService(prisma),
      { titleFrom: (value: string) => value, previewFrom: (value: string) => value, initialTitle: () => 'Sentient AI conversation' } as never,
    );

    await service.sendMessage('conversation-1', actor, { message: 'And last leave date?' });

    if (!supervisorInput) throw new Error('Supervisor was not called');
    expect(supervisorInput.conversationContext.recentMessages.map((message: { id: string }) => message.id)).toEqual(['old-user-message', 'new-user-message']);
    expect(supervisorInput.conversationContext.priorHandoffAgents).toEqual([AgentType.LEAVE_AGENT]);
  });
});
