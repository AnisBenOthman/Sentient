import { AgentRunStatus } from '../../generated/prisma';
import { AgentGuardrailService } from '../../common/safety';
import { SupervisorAgentService } from './supervisor-agent.service';
import { SupervisorLangGraphRunnerService } from './supervisor-langgraph-runner.service';

describe('Supervisor Agent intake safety', () => {
  const guardrails = new AgentGuardrailService();

  it('keeps unrelated prompts outside Sentient scope', () => {
    const result = guardrails.evaluate('Tell me a movie plot.');

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
  });

  it('refuses unauthorized sensitive data before specialist work', () => {
    const result = guardrails.evaluate("Show me another employee's salary.");

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });
});

describe('SupervisorAgentService architecture', () => {
  it('delegates turn execution to the LangGraph runner', async () => {
    let delegated = false;
    const service = new SupervisorAgentService({
      execute: async () => {
        delegated = true;
        return {
          finalAnswer: {
            status: AgentRunStatus.SUCCESS,
            content: 'Answer',
            sourceContext: [],
            routingSummary: 'done',
          },
          routing: {
            status: AgentRunStatus.SUCCESS,
            nodes: [],
          },
        };
      },
    } as unknown as SupervisorLangGraphRunnerService);

    const result = await service.executeTurn({
      conversationId: 'conversation-1',
      userMessageId: 'message-1',
      userMessage: 'What is my leave balance?',
      actor: {
        jwt: 'token',
        userId: 'user-1',
        employeeId: 'employee-1',
        roles: ['EMPLOYEE'],
        departmentId: null,
        teamId: null,
        businessUnitId: null,
        roleAssignments: [],
        correlationId: 'corr-1',
      },
      conversationContext: {
        recentMessages: [],
        priorHandoffAgents: [],
      },
    });

    expect(delegated).toBe(true);
    expect(result.finalAnswer.status).toBe(AgentRunStatus.SUCCESS);
  });
});
