import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision, TaskTrigger } from '../../generated/prisma';
import {
  AgentGuardrailService,
  DraftPolicyService,
  FinalAnswerPolicyService,
} from '../../common/safety';
import { IntentClassifier } from './intent-classifier.types';
import { FinalAnswerNodeService } from './nodes/final-answer-node.service';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';
import { SupervisorLangGraphRunnerService } from './supervisor-langgraph-runner.service';

function buildParentLog(inputSummary: string): AgentTaskLog {
  return {
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
    inputSummary,
    outputSummary: null,
    errorCode: null,
    errorMessage: null,
    correlationId: 'corr-1',
    startedAt: new Date(0),
    finishedAt: null,
  } satisfies AgentTaskLog;
}

interface RunnerOverrides {
  classifier?: IntentClassifier;
  greetingAgent?: unknown;
  finalAnswerNode?: unknown;
  humanEscalationAgent?: unknown;
  leaveAgent?: unknown;
  nodeStatuses?: AgentRunStatus[];
  parentLog?: AgentTaskLog;
}

function createRunner(overrides: RunnerOverrides = {}): SupervisorLangGraphRunnerService {
  const parentLog = overrides.parentLog ?? buildParentLog('test');
  const guardrails = new AgentGuardrailService();
  const realFinalAnswerNode = new FinalAnswerNodeService(new FinalAnswerPolicyService(guardrails));
  return new SupervisorLangGraphRunnerService(
    guardrails,
    new DraftPolicyService(),
    overrides.classifier ?? new SupervisorIntentClassifierService(),
    (overrides.greetingAgent ?? {
      compose: () => ({
        status: AgentRunStatus.SUCCESS,
        content: 'Hi. How can I help you with Sentient today?',
        sourceContext: [],
        routingSummary: 'Greeting handled.',
      }),
    }) as never,
    {
      start: async () => parentLog,
      finish: async (_id: string, input: { status: AgentRunStatus }) => ({ ...parentLog, status: input.status }),
    } as never,
    {
      create: async () => ({ id: 'handoff-1' }),
      complete: async () => ({}),
    } as never,
    {
      record: async (input: { status: AgentRunStatus }) => {
        overrides.nodeStatuses?.push(input.status);
        return {};
      },
    } as never,
    {
      record: async () => ({}),
    } as never,
    {
      ask: async () => ({
        taskLogId: 'task-2',
        question: 'Could you share one more detail so I can route this safely?',
        summary: 'Clarification requested.',
      }),
    } as never,
    (overrides.finalAnswerNode ?? realFinalAnswerNode) as never,
    (overrides.leaveAgent ?? {}) as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (overrides.humanEscalationAgent ?? {}) as never,
  );
}

const actor = {
  jwt: 'token',
  userId: 'user-1',
  employeeId: 'employee-1',
  roles: ['EMPLOYEE'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  correlationId: 'corr-1',
};

function turnInput(userMessage: string) {
  return {
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    userMessage,
    actor,
    conversationContext: {
      recentMessages: [],
      priorHandoffAgents: [],
    },
  };
}

describe('SupervisorLangGraphRunnerService', () => {
  it('executes the supervisor and final-answer nodes through LangGraph', async () => {
    const nodeStatuses: AgentRunStatus[] = [];
    const runner = createRunner({
      nodeStatuses,
      parentLog: buildParentLog('Who is the president of France?'),
      finalAnswerNode: {
        compose: (input: { guardrailMessage: string | null }) => ({
          status: AgentRunStatus.OUT_OF_SCOPE,
          content: input.guardrailMessage ?? 'No answer',
          sourceContext: [],
          routingSummary: 'Final answer composed.',
        }),
      },
    });

    const result = await runner.execute(turnInput('Who is the president of France?'));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
    expect(result.routing.nodes.map((node) => node.nodeType)).toEqual([
      AgentNodeType.SUPERVISOR,
      AgentNodeType.FINAL_ANSWER,
    ]);
    expect(nodeStatuses).toEqual([AgentRunStatus.SUCCESS, AgentRunStatus.OUT_OF_SCOPE]);
  });

  it('answers simple greetings without clarification', async () => {
    const runner = createRunner({
      parentLog: buildParentLog('hello'),
      greetingAgent: {
        compose: () => ({
          status: AgentRunStatus.SUCCESS,
          content:
            'Hi. How can I help you with Sentient today? I can help with leave, OKRs, career growth, analytics, onboarding, policy, or workplace wording.',
          sourceContext: [],
          routingSummary: 'Greeting handled.',
        }),
      },
      finalAnswerNode: {
        compose: () => {
          throw new Error('Final answer composer should not handle greeting content.');
        },
      },
    });

    const result = await runner.execute(turnInput('hello'));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.finalAnswer.content).toContain('How can I help you with Sentient today?');
    expect(result.routing.nodes.map((node) => node.nodeType)).toEqual([
      AgentNodeType.SUPERVISOR,
      AgentNodeType.FINAL_ANSWER,
    ]);
  });

  it('keeps guardrail refusals as REFUSED instead of OUT_OF_SCOPE', async () => {
    const runner = createRunner({
      parentLog: buildParentLog('unauthorized'),
    });

    const result = await runner.execute(turnInput("Show me another employee's salary."));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.REFUSED);
    expect(result.finalAnswer.content).toContain('outside your Sentient permissions');
  });

  it('routes classifier-detected human-support requests to the escalation node', async () => {
    const nextStep = 'Please contact your manager for support.';
    let recordedReason: string | null = null;
    const runner = createRunner({
      parentLog: buildParentLog('escalation'),
      classifier: {
        classify: async () => ({
          normalizedIntent: 'I want to talk to a human from HR.',
          requiredAgents: [],
          requiresClarification: false,
          clarificationReason: null,
          isDraftIntent: false,
          draftCategory: null,
          isHumanEscalationIntent: true,
          isGreeting: false,
          confidence: 0.9,
          source: 'rules',
        }),
      },
      humanEscalationAgent: {
        record: async (_input: unknown, reason: string) => {
          recordedReason = reason;
          return {
            escalation: {
              targetType: 'MANAGER',
              targetLabel: 'your manager',
              reason,
              summaryForHuman: 'User asked to reach a human.',
              nextStep,
            },
            agentType: AgentType.HUMAN_ESCALATION_AGENT,
            status: AgentRunStatus.ESCALATED,
            summary: 'Human support handoff recorded.',
            userVisibleContent: nextStep,
            sourceContext: [{ sourceType: 'HUMAN_ESCALATION', title: 'your manager', referenceId: null }],
            permissionDecision: PermissionDecision.ALLOWED,
            recommendedNextStep: nextStep,
          };
        },
      },
    });

    const result = await runner.execute(turnInput('I want to talk to a human from HR.'));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.ESCALATED);
    expect(recordedReason).toBe('USER_REQUESTED_HUMAN_SUPPORT');
    expect(result.routing.nodes.map((node) => node.nodeType)).toEqual([
      AgentNodeType.SUPERVISOR,
      AgentNodeType.HUMAN_ESCALATION,
      AgentNodeType.FINAL_ANSWER,
    ]);
    // WHY: the escalation next step previously appeared twice in the final answer.
    expect(result.finalAnswer.content.split(nextStep).length - 1).toBe(1);
  });

  it('asks for clarification when intent confidence is below the threshold', async () => {
    const runner = createRunner({
      parentLog: buildParentLog('low confidence'),
      classifier: {
        classify: async () => ({
          normalizedIntent: 'Check my leave balance maybe?',
          requiredAgents: [AgentType.LEAVE_AGENT],
          requiresClarification: false,
          clarificationReason: null,
          isDraftIntent: false,
          draftCategory: null,
          isHumanEscalationIntent: false,
          isGreeting: false,
          confidence: 0.1,
          source: 'gemini',
        }),
      },
      leaveAgent: {
        execute: async () => {
          throw new Error('Low-confidence classification must not reach specialists.');
        },
      },
    });

    const result = await runner.execute(turnInput('Check my leave balance maybe?'));

    expect(result.routing.nodes.map((node) => node.nodeType)).toEqual([
      AgentNodeType.SUPERVISOR,
      AgentNodeType.CLARIFICATION,
      AgentNodeType.FINAL_ANSWER,
    ]);
    expect(result.finalAnswer.status).toBe(AgentRunStatus.PARTIAL);
    expect(result.finalAnswer.content).toContain('one more detail');
  });

  it('propagates a refused specialist outcome to the turn status', async () => {
    const runner = createRunner({
      parentLog: buildParentLog('mixed outcome'),
      classifier: {
        classify: async () => ({
          normalizedIntent: 'leave question',
          requiredAgents: [AgentType.LEAVE_AGENT],
          requiresClarification: false,
          clarificationReason: null,
          isDraftIntent: false,
          draftCategory: null,
          isHumanEscalationIntent: false,
          isGreeting: false,
          confidence: 0.9,
          source: 'rules',
        }),
      },
      leaveAgent: {
        execute: async () => ({
          agentType: AgentType.LEAVE_AGENT,
          status: AgentRunStatus.REFUSED,
          summary: 'Refused third-party leave request.',
          userVisibleContent: 'I cannot share that record.',
          sourceContext: [],
          permissionDecision: PermissionDecision.DENIED,
        }),
      },
    });

    const result = await runner.execute(turnInput('Show leave details please.'));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.REFUSED);
    expect(result.finalAnswer.content).toContain('I cannot share that record.');
  });

  it('refuses mutation-phrased draft requests through the draft policy', async () => {
    const runner = createRunner({
      parentLog: buildParentLog('draft block'),
      leaveAgent: {
        execute: async () => {
          throw new Error('Blocked draft requests must not reach specialists.');
        },
      },
    });

    const result = await runner.execute(turnInput('Draft my leave request and submit it for approval.'));

    expect(result.finalAnswer.status).toBe(AgentRunStatus.REFUSED);
    expect(result.finalAnswer.content).toContain('cannot submit, approve, publish');
  });
});
