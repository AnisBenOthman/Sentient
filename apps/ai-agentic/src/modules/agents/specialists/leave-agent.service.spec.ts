import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
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
      roleAssignments: [],
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

function isoDateOffset(daysFromToday: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function holidayDateOffset(daysFromToday: number): string {
  return `${isoDateOffset(daysFromToday)}T00:00:00.000Z`;
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

describe('LeaveAgentService holiday calendar', () => {
  it('answers bank-holiday questions from real Holiday rows', async () => {
    let holidayCalls = 0;
    const hrCore = {
      getHolidaysContext: async () => {
        holidayCalls += 1;
        return {
          data: {
            id: 'leave:holidays',
            year: 2026,
            holidays: [
              { id: 'h-1', name: 'Independence Day', date: '2026-07-05T00:00:00.000Z', isRecurring: true },
              { id: 'h-2', name: 'Revolution Day', date: '2026-11-01T00:00:00.000Z', isRecurring: true },
            ],
          },
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType: 'HOLIDAYS',
          sourceTitle: 'Company holidays',
        };
      },
      getLeaveContext: async () => {
        throw new Error('Holiday calendar questions must not read individual balances.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(buildInput('bank holidays in my country', ['EMPLOYEE']));

    expect(holidayCalls).toBe(1);
    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('Independence Day');
    expect(result.userVisibleContent).toContain('2026-07-05');
  });

  it('answers next bank-holiday questions with the next upcoming holiday only', async () => {
    const pastDate = holidayDateOffset(-30);
    const nextDate = holidayDateOffset(7);
    const laterDate = holidayDateOffset(60);
    const expectedDate = isoDateOffset(7);
    const hrCore = {
      getHolidaysContext: async () => ({
        data: {
          id: 'leave:holidays',
          year: 2026,
          holidays: [
            { id: 'h-1', name: 'Labour Day', date: pastDate, isRecurring: true },
            { id: 'h-2', name: 'Independence Day', date: nextDate, isRecurring: true },
            { id: 'h-3', name: 'Revolution Day', date: laterDate, isRecurring: true },
          ],
        },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'HOLIDAYS',
        sourceTitle: 'Company holidays',
      }),
      getLeaveContext: async () => {
        throw new Error('Next holiday questions must not read individual balances.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(buildInput('next bank holiday in french', ['EMPLOYEE']));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toBe(`Next company holiday: Independence Day on ${expectedDate}.`);
    expect(result.userVisibleContent).not.toContain('Labour Day');
    expect(result.userVisibleContent).not.toContain('Revolution Day');
  });

  it('keeps a terse next-date follow-up on the holiday calendar path', async () => {
    const pastDate = holidayDateOffset(-30);
    const nextDate = holidayDateOffset(7);
    const expectedDate = isoDateOffset(7);
    let holidayCalls = 0;
    const hrCore = {
      getHolidaysContext: async () => {
        holidayCalls += 1;
        return {
          data: {
            id: 'leave:holidays',
            year: 2026,
            holidays: [
              { id: 'h-1', name: 'Labour Day', date: pastDate, isRecurring: true },
              { id: 'h-2', name: 'Independence Day', date: nextDate, isRecurring: true },
            ],
          },
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType: 'HOLIDAYS',
          sourceTitle: 'Company holidays',
        };
      },
      getLeaveContext: async () => {
        throw new Error('Holiday follow-ups must not read individual balances.');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);
    const input = buildInput('i want only the next date', ['EMPLOYEE']);
    input.conversationContext = {
      recentMessages: [
        { id: 'm-1', role: 'USER', content: 'next bank holiday in french' },
        { id: 'm-2', role: 'ASSISTANT', content: 'Company holidays for 2026 (4): - Labour Day: 2026-04-30' },
        { id: 'm-3', role: 'USER', content: 'i want only the next date' },
      ],
      priorHandoffAgents: [AgentType.LEAVE_AGENT],
    };

    const result = await agent.execute(input);

    expect(holidayCalls).toBe(1);
    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toBe(expectedDate);
  });

  it('keeps British-English holiday balance questions on the balance path', async () => {
    const hrCore = {
      getHolidaysContext: async () => {
        throw new Error('Balance questions must not read the holiday calendar.');
      },
      getLeaveContext: async () => ({
        data: { id: 'leave:current-year', balances: [], recentRequests: [] },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'LEAVE',
        sourceTitle: 'Leave balance and history',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(buildInput('How much holiday do I have left?', ['EMPLOYEE']));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('leave context');
  });

  it('says when no holidays are configured instead of failing', async () => {
    const hrCore = {
      getHolidaysContext: async () => ({
        data: { id: 'leave:holidays', year: 2026, holidays: [] },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'HOLIDAYS',
        sourceTitle: 'Company holidays',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute(buildInput('Which public holidays do we have this year?', ['EMPLOYEE']));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('No company holidays are configured for 2026');
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

describe('LeaveAgentService completion-claim guard', () => {
  function llmCaller(answer: string) {
    return {
      call: async () => ({
        ok: true,
        outcome: { answer, anyToolDenied: false, anyToolFailed: false, toolsUsed: ['get_my_leave_balance'], providerUsed: 'OPENROUTER', usedFallbackProvider: true },
      }),
    } as never;
  }
  const toolRegistry = { getLeaveTools: () => [] } as never;
  const hrCore = {} as unknown as HrCoreAiClient;

  it.each([
    'I have booked 1 day of Annual Leave for you on September 20, 2026.',
    "I've canceled your pending leave requests.",
    'Done! I submitted the request for you.',
  ])('replaces "%s" — this path cannot write', async (answer) => {
    const agent = new LeaveAgentService(hrCore, llmCaller(answer), toolRegistry);
    const result = await agent.execute(buildInput('paid leave, 20 september', ['EMPLOYEE']));

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.userVisibleContent).not.toContain('booked 1 day');
    expect(result.userVisibleContent).toContain("I haven't done so");
    expect(result.summary).toContain('claimed to have booked or cancelled');
  });

  it.each([
    'You have 8 Sick Leave days remaining. I haven\'t booked anything.',
    'Your request for 14–15 September has been approved by your manager.',
    'To book leave, tell me the type and dates.',
  ])('keeps "%s" untouched', async (answer) => {
    const agent = new LeaveAgentService(hrCore, llmCaller(answer), toolRegistry);
    const result = await agent.execute(buildInput('my leave balance', ['EMPLOYEE']));
    expect(result.userVisibleContent).toBe(answer);
  });
});
