import { AgentRunStatus, AgentType } from '../../src/generated/prisma';
import { ActorContextFactory, AiActorContext } from '../../src/common/graph';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { ConversationsController } from '../../src/modules/conversations/conversations.controller';
import { ConversationTurnResponse } from '../../src/modules/conversations/conversation-response.mapper';
import { ConversationsService } from '../../src/modules/conversations/conversations.service';

const actor: AiActorContext = {
  jwt: 'token',
  userId: 'user-1',
  employeeId: 'employee-1',
  roles: ['EMPLOYEE'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  roleAssignments: [],
  correlationId: 'corr-1',
};

const turn: ConversationTurnResponse = {
  conversation: {
    id: 'conversation-1',
    title: 'Leave question',
    status: 'ACTIVE',
    lastAgentType: AgentType.SUPERVISOR_AGENT,
    lastMessagePreview: 'Answer',
    updatedAt: new Date(0).toISOString(),
  },
  userMessage: {
    id: 'message-user',
    role: 'USER',
    content: 'What is my leave balance?',
    agentType: null,
    status: AgentRunStatus.SUCCESS,
    sourceContext: [],
    createdAt: new Date(0).toISOString(),
  },
  assistantMessage: {
    id: 'message-assistant',
    role: 'ASSISTANT',
    content: 'Leave answer',
    agentType: AgentType.SUPERVISOR_AGENT,
    status: AgentRunStatus.SUCCESS,
    sourceContext: [],
    createdAt: new Date(0).toISOString(),
  },
  routing: {
    status: AgentRunStatus.SUCCESS,
    nodes: [
      { nodeType: 'SUPERVISOR', agentType: AgentType.SUPERVISOR_AGENT, status: AgentRunStatus.SUCCESS },
      { nodeType: 'FINAL_ANSWER', agentType: AgentType.SUPERVISOR_AGENT, status: AgentRunStatus.SUCCESS },
    ],
  },
};

describe('AI conversation API contract', () => {
  it('starts a conversation turn', async () => {
    const controller = new ConversationsController(
      { createConversation: async () => turn } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.create({} as never, { message: 'What is my leave balance?' });

    expect(result.conversation.id).toBe('conversation-1');
    expect(result.assistantMessage?.role).toBe('ASSISTANT');
  });

  it('sends a follow-up message to the supervisor', async () => {
    const controller = new ConversationsController(
      { sendMessage: async () => turn } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.sendMessage({} as never, 'conversation-1', { message: 'And my last leave?' });

    expect(result.routing.nodes[0]?.agentType).toBe(AgentType.SUPERVISOR_AGENT);
  });

  it('returns AI health with roster availability', async () => {
    const controller = new AppController({
      getHealth: async () => ({
        service: 'ai-agentic',
        status: 'healthy',
        agents: [],
        contextSources: [],
        timestamp: new Date(0).toISOString(),
      }),
    } as unknown as AppService);

    const result = await controller.getHealth();

    expect(result.service).toBe('ai-agentic');
  });
});
