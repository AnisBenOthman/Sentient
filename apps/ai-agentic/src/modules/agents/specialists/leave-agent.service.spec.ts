import { AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { LeaveAgentService } from './leave-agent.service';

function buildInput(userMessage: string, roles: string[]): SpecialistInput {
  return {
    conversationId: 'conversation-1',
    parentTaskLogId: 'task-1',
    userMessage,
    normalizedIntent: userMessage,
    actorContext: {
      jwt: 'token',
      userId: 'user-1',
      employeeId: 'employee-1',
      roles,
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      correlationId: 'corr-1',
    },
    conversationContext: {
      recentMessages: [],
      priorHandoffAgents: [],
    },
    sourceHints: [],
    isDraftRequest: false,
    constraints: {
      sentientOnly: true,
      readOnlyOfficialRecords: true,
      mustReturnToSupervisor: true,
    },
  };
}

describe('LeaveAgentService manager team coverage (FR-008)', () => {
  it('returns the team leave calendar for managers asking about team coverage', async () => {
    let teamCalls = 0;
    const hrCore = {
      getTeamLeaveContext: async () => {
        teamCalls += 1;
        return {
          data: {
            id: 'leave:team-coverage',
            entries: [
              {
                employeeId: 'employee-2',
                employeeName: 'Alice Martin',
                startDate: '2026-06-15T00:00:00.000Z',
                endDate: '2026-06-19T00:00:00.000Z',
              },
            ],
            windowStart: '2026-06-10',
            windowEnd: '2026-07-10',
          },
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType: 'LEAVE_COVERAGE',
          sourceTitle: 'Team leave coverage',
        };
      },
      getLeaveContext: async () => {
        throw new Error('Team coverage requests must not read individual balances.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(
      buildInput('Show leave coverage for my team this month.', ['MANAGER', 'EMPLOYEE']),
    );

    expect(teamCalls).toBe(1);
    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('Alice Martin');
    expect(result.userVisibleContent).toContain('2026-06-15');
  });

  it('refuses team coverage for employees without team scope', async () => {
    const hrCore = {
      getTeamLeaveContext: async () => {
        throw new Error('Employees must not reach the team calendar.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(
      buildInput('Show leave coverage for my team this month.', ['EMPLOYEE']),
    );

    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    expect(result.userVisibleContent).toContain('managers and HR admins');
  });

  it('degrades gracefully when HR Core denies the team calendar', async () => {
    const hrCore = {
      getTeamLeaveContext: async () => ({
        data: null,
        permissionDecision: PermissionDecision.DENIED,
        degradedReason: 'Caller is not allowed to access this context.',
        sourceType: 'LEAVE_COVERAGE',
        sourceTitle: 'Team leave coverage',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(
      buildInput('Show leave coverage for my team this month.', ['MANAGER']),
    );

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
  });
});

describe('LeaveAgentService named-individual targeting', () => {
  it('refuses named third-party leave questions instead of answering with own records', async () => {
    let ownCalls = 0;
    const hrCore = {
      getLeaveContext: async () => {
        ownCalls += 1;
        throw new Error('Named third-party requests must not read the caller balance.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(
      buildInput("What is John's leave balance this year?", ['EMPLOYEE']),
    );

    expect(ownCalls).toBe(0);
    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
  });

  it('still answers own-balance questions that start with capitalized words', async () => {
    const hrCore = {
      getLeaveContext: async () => ({
        data: { id: 'leave:current-year', balances: [], recentRequests: [] },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'LEAVE',
        sourceTitle: 'Leave balance and history',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(buildInput("What's my leave balance?", ['EMPLOYEE']));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('leave context');
  });
});
