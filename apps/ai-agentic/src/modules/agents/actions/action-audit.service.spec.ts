import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../../generated/prisma';
import { AiActorContext } from '../../../common/graph';
import { AgentTaskLogService, FinishTaskLogInput, StartTaskLogInput } from '../agent-task-log.service';
import { ActionAuditService } from './action-audit.service';

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

function fakeLog(id: string, overrides: Partial<AgentTaskLog> = {}): AgentTaskLog {
  return {
    id,
    conversationId: 'conversation-1',
    parentLogId: null,
    agentType: AgentType.LEAVE_AGENT,
    nodeType: AgentNodeType.SPECIALIST,
    taskType: 'action.proposed',
    trigger: 'USER_MESSAGE' as never,
    actorUserId: 'user-1',
    actorEmployeeId: 'employee-1',
    status: AgentRunStatus.RUNNING,
    permissionDecision: null,
    sourceCategories: [],
    inputSummary: null,
    outputSummary: null,
    generatedSql: null,
    errorCode: null,
    errorMessage: null,
    tokensIn: null,
    tokensOut: null,
    correlationId: 'corr-1',
    startedAt: new Date(0),
    finishedAt: null,
    ...overrides,
  } as AgentTaskLog;
}

describe('ActionAuditService', () => {
  it('records action.proposed with no parentLogId (it is the root of the chain)', async () => {
    const starts: StartTaskLogInput[] = [];
    const finishes: Array<{ id: string; input: FinishTaskLogInput }> = [];
    const taskLogs = {
      start: async (input: StartTaskLogInput) => {
        starts.push(input);
        return fakeLog('proposal-log-1');
      },
      finish: async (id: string, input: FinishTaskLogInput) => {
        finishes.push({ id, input });
        return fakeLog(id, { status: input.status });
      },
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    const result = await service.logProposed({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      payloadSummary: 'Annual Leave, 3 days, 2026-08-01 to 2026-08-03',
      policySourcesSummary: 'Leave Policy v2',
    });

    expect(starts[0]?.parentLogId).toBeUndefined();
    expect(starts[0]?.taskType).toBe('action.proposed');
    expect(finishes[0]?.input.status).toBe(AgentRunStatus.SUCCESS);
    expect(finishes[0]?.input.outputSummary).toBe('Leave Policy v2');
    expect(result.id).toBe('proposal-log-1');
  });

  it('states no policy document was available rather than leaving the field blank', async () => {
    const finishes: Array<{ input: FinishTaskLogInput }> = [];
    const taskLogs = {
      start: async () => fakeLog('proposal-log-1'),
      finish: async (_id: string, input: FinishTaskLogInput) => {
        finishes.push({ input });
        return fakeLog('proposal-log-1');
      },
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    await service.logProposed({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      payloadSummary: 'Sick Leave, 1 day, today',
      policySourcesSummary: null,
    });

    expect(finishes[0]?.input.outputSummary).toBe('No approved policy document was available.');
  });

  it('links action.executed to its originating proposal via parentLogId', async () => {
    const starts: StartTaskLogInput[] = [];
    const taskLogs = {
      start: async (input: StartTaskLogInput) => {
        starts.push(input);
        return fakeLog('execution-log-1');
      },
      finish: async (id: string, input: FinishTaskLogInput) => fakeLog(id, { status: input.status, errorMessage: input.errorMessage ?? null }),
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    const result = await service.logExecuted({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      proposalLogId: 'proposal-log-1',
      status: AgentRunStatus.SUCCESS,
      httpStatus: 201,
      resultSummary: 'Created leave request lr-1',
    });

    expect(starts[0]?.parentLogId).toBe('proposal-log-1');
    expect(starts[0]?.taskType).toBe('action.executed');
    expect(result.id).toBe('execution-log-1');
  });

  it('records a FAILED execution with the specific downstream reason, never swallowed (FR-010)', async () => {
    const finishes: FinishTaskLogInput[] = [];
    const taskLogs = {
      start: async () => fakeLog('execution-log-1'),
      finish: async (_id: string, input: FinishTaskLogInput) => {
        finishes.push(input);
        return fakeLog('execution-log-1', { status: input.status });
      },
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    await service.logExecuted({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      proposalLogId: 'proposal-log-1',
      status: AgentRunStatus.FAILED,
      httpStatus: 400,
      resultSummary: 'HR Core rejected the request',
      errorCode: 'InsufficientBalance',
      errorMessage: 'HR Core returned: InsufficientBalance',
    });

    expect(finishes[0]?.status).toBe(AgentRunStatus.FAILED);
    expect(finishes[0]?.errorCode).toBe('InsufficientBalance');
    expect(finishes[0]?.errorMessage).toBe('HR Core returned: InsufficientBalance');
  });

  it('links action.verified to its originating execution via parentLogId', async () => {
    const starts: StartTaskLogInput[] = [];
    const taskLogs = {
      start: async (input: StartTaskLogInput) => {
        starts.push(input);
        return fakeLog('verification-log-1');
      },
      finish: async (id: string, input: FinishTaskLogInput) => fakeLog(id, { status: input.status }),
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    await service.logVerified({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      executionLogId: 'execution-log-1',
      status: AgentRunStatus.SUCCESS,
      comparisonSummary: 'Read-back matched the frozen payload',
    });

    expect(starts[0]?.parentLogId).toBe('execution-log-1');
    expect(starts[0]?.taskType).toBe('action.verified');
  });

  it('records UNVERIFIED (not FAILED, not DEGRADED) when the read-back does not match', async () => {
    const finishes: FinishTaskLogInput[] = [];
    const taskLogs = {
      start: async () => fakeLog('verification-log-1'),
      finish: async (_id: string, input: FinishTaskLogInput) => {
        finishes.push(input);
        return fakeLog('verification-log-1', { status: input.status });
      },
    } as unknown as AgentTaskLogService;
    const service = new ActionAuditService(taskLogs);

    await service.logVerified({
      conversationId: 'conversation-1',
      actor,
      agentType: AgentType.LEAVE_AGENT,
      executionLogId: 'execution-log-1',
      status: AgentRunStatus.UNVERIFIED,
      comparisonSummary: 'Read-back timed out',
    });

    expect(finishes[0]?.status).toBe(AgentRunStatus.UNVERIFIED);
  });
});
