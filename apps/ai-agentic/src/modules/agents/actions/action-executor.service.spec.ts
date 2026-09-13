import { ActionProposalStatus, AgentActionKind, AgentActionProposal, AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { AiActorContext } from '../../../common/graph';
import { ActionAuditService } from './action-audit.service';
import { ActionExecutorService } from './action-executor.service';

const actor: AiActorContext = {
  jwt: 'jwt', userId: 'user-1', employeeId: 'employee-1', roles: ['EMPLOYEE'],
  departmentId: null, teamId: null, businessUnitId: 'bu-1', roleAssignments: [], correlationId: 'corr-1',
};

const FROZEN = {
  leaveTypeId: 'lt-annual', leaveTypeName: 'Annual Leave',
  startDate: '2026-10-05', endDate: '2026-10-07', businessDays: 3,
  currentBalance: 10, balanceAfter: 7, employeeId: 'employee-1',
};

function proposal(overrides: Partial<AgentActionProposal> = {}): AgentActionProposal {
  return {
    id: 'prop-1', conversationId: 'conv-1', messageId: 'msg-1', token: 'tok-1',
    actionKind: AgentActionKind.LEAVE_BOOKING, status: ActionProposalStatus.PENDING,
    actorUserId: 'user-1', actorEmployeeId: 'employee-1',
    payload: FROZEN, policyCitations: [],
    executedAt: null, resultRecordId: null, resultStatusCode: null, resultErrorCode: null,
    verifiedAt: null, verificationState: null, proposalLogId: 'log-proposed',
    expiresAt: new Date(Date.now() + 60_000), consumedAt: null, createdAt: new Date(),
    ...overrides,
  } as AgentActionProposal;
}

function allowed<T>(data: T) {
  return { data, permissionDecision: PermissionDecision.ALLOWED, degradedReason: null, sourceType: 'X', sourceTitle: 'X' };
}

interface Calls { create: Array<Record<string, unknown>>; readBack: string[]; executed: Array<Record<string, unknown>>; verified: Array<Record<string, unknown>> }

function build(options: {
  balances?: Array<{ leaveTypeName: string; year: number; remainingDays: number }>;
  recentRequests?: Array<{ startDate: string; endDate: string; status: string }>;
  leaveContextDenied?: boolean;
  createOutcome?: 'SUCCESS' | { httpStatus: number | null; reason: string };
  readBackRecord?: Partial<{ id: string; employeeId: string; leaveTypeId: string; startDate: string; endDate: string; totalDays: number; status: string }> | 'unavailable';
} = {}) {
  const calls: Calls = { create: [], readBack: [], executed: [], verified: [] };
  const hrCore = {
    getLeaveContext: async () =>
      options.leaveContextDenied
        ? { data: null, permissionDecision: PermissionDecision.DENIED, degradedReason: 'denied', sourceType: 'X', sourceTitle: 'X' }
        : allowed({
            id: 'leave:ctx',
            balances: (options.balances ?? [{ leaveTypeName: 'Annual Leave', year: 2026, remainingDays: 10 }]).map((b, i) => ({ id: `b${i}`, totalDays: 25, usedDays: 0, pendingDays: 0, ...b })),
            recentRequests: (options.recentRequests ?? []).map((r, i) => ({ id: `r${i}`, totalDays: 1, leaveType: { name: 'Annual Leave' }, ...r })),
          }),
    createLeaveRequest: async (payload: Record<string, unknown>) => {
      calls.create.push(payload);
      if (options.createOutcome && options.createOutcome !== 'SUCCESS') {
        return { status: 'FAILED', httpStatus: options.createOutcome.httpStatus, reason: options.createOutcome.reason };
      }
      return { status: 'SUCCESS', httpStatus: 201, data: { id: 'lr-1', employeeId: 'employee-1', leaveTypeId: 'lt-annual', startDate: '2026-10-05T00:00:00.000Z', endDate: '2026-10-07T00:00:00.000Z', totalDays: '3', status: 'PENDING' } };
    },
    getLeaveRequestById: async (id: string) => {
      calls.readBack.push(id);
      if (options.readBackRecord === 'unavailable') {
        return { data: null, permissionDecision: PermissionDecision.UNAVAILABLE, degradedReason: 'HR Core unreachable', sourceType: 'X', sourceTitle: 'X' };
      }
      return allowed({
        id: 'lr-1', employeeId: 'employee-1', leaveTypeId: 'lt-annual',
        startDate: '2026-10-05T00:00:00.000Z', endDate: '2026-10-07T00:00:00.000Z',
        totalDays: '3', status: 'PENDING', startHalfDay: null, endHalfDay: null, reason: null,
        reviewedById: null, reviewedAt: null, reviewNote: null, createdAt: '', updatedAt: '',
        ...(options.readBackRecord ?? {}),
      });
    },
  } as unknown as HrCoreAiClient;
  const audit = {
    logExecuted: async (input: Record<string, unknown>) => { calls.executed.push(input); return { id: 'log-executed' }; },
    logVerified: async (input: Record<string, unknown>) => { calls.verified.push(input); return { id: 'log-verified' }; },
  } as unknown as ActionAuditService;
  return { service: new ActionExecutorService(hrCore, audit), calls };
}

describe('ActionExecutorService.revalidate — preconditions re-checked at Confirm (T040, FR-005)', () => {
  it('passes when balance and overlap still hold', async () => {
    const { service } = build();
    expect(await service.revalidate(proposal(), actor)).toEqual({ ok: true });
  });

  it('refuses when the balance was consumed since Propose, without any downstream call', async () => {
    const { service, calls } = build({ balances: [{ leaveTypeName: 'Annual Leave', year: 2026, remainingDays: 2 }] });
    const result = await service.revalidate(proposal(), actor);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('no longer covers');
    expect(calls.create).toHaveLength(0);
  });

  it('refuses when a new overlapping request appeared since Propose', async () => {
    const { service, calls } = build({ recentRequests: [{ startDate: '2026-10-06', endDate: '2026-10-06', status: 'PENDING' }] });
    const result = await service.revalidate(proposal(), actor);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('overlaps');
    expect(calls.create).toHaveLength(0);
  });

  it('refuses rather than proceeding blind when the balance cannot be read', async () => {
    const { service } = build({ leaveContextDenied: true });
    const result = await service.revalidate(proposal(), actor);
    expect(result.ok).toBe(false);
  });
});

describe('ActionExecutorService.execute — exactly one write with the frozen payload (T044, FR-001)', () => {
  it('sends the frozen payload, never a re-derived one, and logs action.executed linked to the proposal', async () => {
    const { service, calls } = build();
    const result = await service.execute(proposal(), actor);
    expect(result.status).toBe('SUCCESS');
    expect(calls.create).toEqual([{ leaveTypeId: 'lt-annual', startDate: '2026-10-05', endDate: '2026-10-07' }]);
    expect(calls.executed[0]).toEqual(expect.objectContaining({ proposalLogId: 'log-proposed', status: AgentRunStatus.SUCCESS, httpStatus: 201 }));
  });

  it.each([
    [{ httpStatus: 409, reason: 'HR Core returned: OverlappingRequest' }, 'HTTP_409'],
    [{ httpStatus: 400, reason: 'HR Core returned: InsufficientBalance' }, 'HTTP_400'],
    [{ httpStatus: null, reason: 'Leave request submission timed out.' }, 'NO_RESPONSE'],
    [{ httpStatus: null, reason: 'Leave request submission could not be reached.' }, 'NO_RESPONSE'],
  ])('classifies %j as FAILED carrying the downstream reason verbatim, never SUCCESS (T039, FR-007, FR-010)', async (outcome, errorCode) => {
    const { service, calls } = build({ createOutcome: outcome });
    const result = await service.execute(proposal(), actor);
    expect(result.status).toBe('FAILED');
    expect(result.status === 'FAILED' && result.reason).toBe(outcome.reason);
    expect(result.status === 'FAILED' && result.httpStatus).toBe(outcome.httpStatus);
    expect(calls.executed[0]).toEqual(expect.objectContaining({ status: AgentRunStatus.FAILED, errorCode, errorMessage: outcome.reason }));
    expect(calls.create).toHaveLength(1);
  });
});

describe('ActionExecutorService.verify — independent read-back (T050, T051)', () => {
  it('reports MATCHED when leave type, dates, employee and status agree', async () => {
    const { service, calls } = build();
    const result = await service.verify(proposal(), 'lr-1', 'log-executed', actor);
    expect(result.state).toBe('MATCHED');
    expect(calls.readBack).toEqual(['lr-1']);
    expect(calls.verified[0]).toEqual(expect.objectContaining({ executionLogId: 'log-executed', status: AgentRunStatus.SUCCESS }));
  });

  it('NEVER compares totalDays — a different authoritative count still verifies as MATCHED (T051, research.md R4)', async () => {
    const { service } = build({ readBackRecord: { totalDays: 2.5 } });
    const result = await service.verify(proposal(), 'lr-1', 'log-executed', actor);
    expect(result.state).toBe('MATCHED');
  });

  it('reports MISMATCHED when the record disagrees on a compared field', async () => {
    const { service, calls } = build({ readBackRecord: { endDate: '2026-10-08T00:00:00.000Z' } });
    const result = await service.verify(proposal(), 'lr-1', 'log-executed', actor);
    expect(result.state).toBe('MISMATCHED');
    expect(result.detail).toContain('endDate');
    expect(calls.verified[0]).toEqual(expect.objectContaining({ status: AgentRunStatus.UNVERIFIED }));
  });

  it('reports UNAVAILABLE when the read-back cannot be performed', async () => {
    const { service } = build({ readBackRecord: 'unavailable' });
    const result = await service.verify(proposal(), 'lr-1', 'log-executed', actor);
    expect(result.state).toBe('UNAVAILABLE');
  });
});
