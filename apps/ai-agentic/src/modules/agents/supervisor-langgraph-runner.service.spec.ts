import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, TaskTrigger } from '../../generated/prisma';
import { AgentGuardrailService } from '../../common/safety';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';
import { SupervisorLangGraphRunnerService } from './supervisor-langgraph-runner.service';

describe('SupervisorLangGraphRunnerService', () => {
  it('executes the supervisor and final-answer nodes through LangGraph', async () => {
    const parentLog = {
      id: 'task-1',
      conversationId: 'conversation-1',
      parentLogId: null,
      agentType: AgentType.SUPERVISOR_AGENT,
      nodeType: AgentNodeType.SUPERVISOR,
      taskType: 'supervisor_turn',
      trigger: TaskTrigger.USER_MESSAGE,
      actorUserId: 'user-1',
      actorEmployeeId: 'employee-1',
      status: AgentRunStatus.RUNNING,
      permissionDecision: null,
      sourceCategories: [],
      inputSummary: 'Who is the president of France?',
      outputSummary: null,
      errorCode: null,
      errorMessage: null,
      correlationId: 'corr-1',
      startedAt: new Date(0),
      finishedAt: null,
    } satisfies AgentTaskLog;
    const nodeStatuses: AgentRunStatus[] = [];
    const runner = new SupervisorLangGraphRunnerService(
      new AgentGuardrailService(),
      new SupervisorIntentClassifierService(),
      {
        start: async () => parentLog,
        finish: async (_id: string, input: { status: AgentRunStatus }) => ({ ...parentLog, status: input.status }),
      } as never,
      {} as never,
      {
        record: async (input: { status: AgentRunStatus }) => {
          nodeStatuses.push(input.status);
          return {};
        },
      } as never,
      {} as never,
      {} as never,
      {
        compose: (input: { guardrailMessage: string | null }) => ({
          status: AgentRunStatus.OUT_OF_SCOPE,
          content: input.guardrailMessage ?? 'No answer',
          sourceContext: [],
          routingSummary: 'Final answer composed.',
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await runner.execute({
      conversationId: 'conversation-1',
      userMessageId: 'message-1',
      userMessage: 'Who is the president of France?',
      actor: {
        jwt: 'token',
        userId: 'user-1',
        employeeId: 'employee-1',
        roles: ['EMPLOYEE'],
        departmentId: null,
        teamId: null,
        businessUnitId: null,
        correlationId: 'corr-1',
      },
      conversationContext: {
        recentMessages: [],
        priorHandoffAgents: [],
      },
    });

    expect(result.finalAnswer.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
    expect(result.routing.nodes.map((node) => node.nodeType)).toEqual([
      AgentNodeType.SUPERVISOR,
      AgentNodeType.FINAL_ANSWER,
    ]);
    expect(nodeStatuses).toEqual([AgentRunStatus.SUCCESS, AgentRunStatus.OUT_OF_SCOPE]);
  });
});
