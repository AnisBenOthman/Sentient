import { AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { AnalyticsAgentService } from './analytics-agent.service';

function buildInput(overrides: Partial<SpecialistInput> = {}): SpecialistInput {
  return {
    conversationId: 'conversation-1',
    parentTaskLogId: 'task-1',
    userMessage: 'Give me the workforce dashboard highlights.',
    normalizedIntent: 'Give me the workforce dashboard highlights.',
    actorContext: {
      jwt: 'token',
      userId: 'user-1',
      employeeId: 'employee-1',
      roles: ['HR_ADMIN'],
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
    ...overrides,
  };
}

const MOCK_DASHBOARD_CONTEXT = {
  data: {
    employees: { total: 128, active: 110, onLeave: 6, probation: 12 },
    leave: { pendingApprovals: 4 },
    skills: { averageScore: 3.4, skillsTracked: 42, topSkill: 'TypeScript' },
    scope: {
      level: 'ORGANIZATION',
      label: 'Entire organization — every department and team combined, not any single group',
      departmentId: null,
      teamId: null,
      businessUnitId: null,
    },
  },
  permissionDecision: PermissionDecision.ALLOWED,
  degradedReason: null,
  sourceType: 'DASHBOARD',
  sourceTitle: 'Dashboard analytics',
};

const MOCK_ABSENCE_SUMMARY_CONTEXT = {
  data: {
    id: 'leave:absence-summary',
    entries: [
      { employeeId: 'emp-1', employeeName: 'Alice Martin', spells: 5, calendarDays: 18 },
      { employeeId: 'emp-2', employeeName: 'Bob Johnson', spells: 2, calendarDays: 7 },
    ],
    windowStart: '2024-06-12',
    windowEnd: '2025-06-12',
  },
  permissionDecision: PermissionDecision.ALLOWED,
  degradedReason: null,
  sourceType: 'LEAVE_ABSENCE_SUMMARY',
  sourceTitle: 'Team absence summary',
};

const MOCK_ZERO_LEAVE_CONTEXT = {
  data: {
    id: 'leave:zero-leave-summary',
    entries: [
      { employeeId: 'emp-3', employeeName: 'Carla Diaz' },
      { employeeId: 'emp-4', employeeName: 'Dev Patel' },
    ],
    totalConsidered: 6,
    windowStart: '2025-07-29',
    windowEnd: '2026-07-29',
  },
  permissionDecision: PermissionDecision.ALLOWED,
  degradedReason: null,
  sourceType: 'LEAVE_ZERO_SUMMARY',
  sourceTitle: 'Employees without leave',
};

describe('AnalyticsAgentService', () => {
  describe('dashboard queries', () => {
    it('summarizes scoped dashboard metrics instead of generic guidance (FR-038)', async () => {
      const hrCore = {
        getDashboardContext: async () => MOCK_DASHBOARD_CONTEXT,
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const result = await agent.execute(buildInput());

      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.userVisibleContent).toContain('128 total');
      expect(result.userVisibleContent).toContain('4 pending approvals');
      expect(result.userVisibleContent).toContain('TypeScript');
      expect(result.userVisibleContent).not.toContain('Analytics answers are for managers');
    });

    it('degrades gracefully when the dashboard is denied', async () => {
      const hrCore = {
        getDashboardContext: async () => ({
          data: null,
          permissionDecision: PermissionDecision.DENIED,
          degradedReason: 'Caller is not allowed to access this context.',
          sourceType: 'DASHBOARD',
          sourceTitle: 'Dashboard analytics',
        }),
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const result = await agent.execute(buildInput());

      expect(result.status).toBe(AgentRunStatus.DEGRADED);
      expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    });
  });

  describe('absence frequency queries', () => {
    it('routes "who is always absent" to absence summary, not dashboard', async () => {
      let absenceCalls = 0;
      let dashboardCalls = 0;
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => { absenceCalls += 1; return MOCK_ABSENCE_SUMMARY_CONTEXT; },
        getDashboardContext: async () => { dashboardCalls += 1; return MOCK_DASHBOARD_CONTEXT; },
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      await agent.execute(buildInput({ normalizedIntent: 'which person in my team is always absent', userMessage: 'which person in my team is always absent' }));

      expect(absenceCalls).toBe(1);
      expect(dashboardCalls).toBe(0);
    });

    it('routes "who has the most absences" to absence summary', async () => {
      let absenceCalls = 0;
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => { absenceCalls += 1; return MOCK_ABSENCE_SUMMARY_CONTEXT; },
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      await agent.execute(buildInput({ normalizedIntent: 'who has the most absences', userMessage: 'who has the most absences' }));

      expect(absenceCalls).toBe(1);
    });

    it('routes "show me attendance issues" to absence summary', async () => {
      let absenceCalls = 0;
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => { absenceCalls += 1; return MOCK_ABSENCE_SUMMARY_CONTEXT; },
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      await agent.execute(buildInput({ normalizedIntent: 'show me attendance issues in my team', userMessage: 'show me attendance issues' }));

      expect(absenceCalls).toBe(1);
    });

    it('does NOT route a plain dashboard query to absence summary', async () => {
      let absenceCalls = 0;
      const hrCore = {
        getDashboardContext: async () => MOCK_DASHBOARD_CONTEXT,
        getTeamAbsenceSummaryContext: async () => { absenceCalls += 1; return MOCK_ABSENCE_SUMMARY_CONTEXT; },
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      await agent.execute(buildInput());

      expect(absenceCalls).toBe(0);
    });

    it('returns ranked employee list with honest caveat', async () => {
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => MOCK_ABSENCE_SUMMARY_CONTEXT,
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const result = await agent.execute(
        buildInput({ normalizedIntent: 'who is always absent', userMessage: 'who is always absent' }),
      );

      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.userVisibleContent).toContain('Alice Martin');
      expect(result.userVisibleContent).toContain('5 leave spells');
      expect(result.userVisibleContent).toContain('Bob Johnson');
      expect(result.userVisibleContent).toContain('approved, recorded leave only');
    });

    it('handles empty team leave data gracefully', async () => {
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => ({
          ...MOCK_ABSENCE_SUMMARY_CONTEXT,
          data: { ...MOCK_ABSENCE_SUMMARY_CONTEXT.data, entries: [] },
        }),
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const result = await agent.execute(
        buildInput({ normalizedIntent: 'who has the most absences', userMessage: 'who has the most absences' }),
      );

      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.userVisibleContent).toContain('No approved leave was recorded');
    });

    it('degrades gracefully when absence summary is denied', async () => {
      const hrCore = {
        getTeamAbsenceSummaryContext: async () => ({
          data: null,
          permissionDecision: PermissionDecision.DENIED,
          degradedReason: 'MANAGER scope required.',
          sourceType: 'LEAVE_ABSENCE_SUMMARY',
          sourceTitle: 'Team absence summary',
        }),
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const result = await agent.execute(
        buildInput({ normalizedIntent: 'who is always absent', userMessage: 'who is always absent' }),
      );

      expect(result.status).toBe(AgentRunStatus.DEGRADED);
      expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    });
  });

  describe('zero-leave queries', () => {
    it('routes "which employees have not taken leave" to the zero-leave tool, not absence summary', async () => {
      let zeroLeaveCalls = 0;
      let absenceCalls = 0;
      const hrCore = {
        getEmployeesWithoutLeaveContext: async () => { zeroLeaveCalls += 1; return MOCK_ZERO_LEAVE_CONTEXT; },
        getTeamAbsenceSummaryContext: async () => { absenceCalls += 1; return MOCK_ABSENCE_SUMMARY_CONTEXT; },
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const message = "Which employees who doesn't have taken leave yet?";
      await agent.execute(buildInput({ normalizedIntent: message, userMessage: message }));

      expect(zeroLeaveCalls).toBe(1);
      expect(absenceCalls).toBe(0);
    });

    it('routes "who has never taken leave" and "without any leave" phrasing to zero-leave', async () => {
      for (const message of ['who has never taken leave', 'list employees without any leave']) {
        let zeroLeaveCalls = 0;
        const hrCore = {
          getEmployeesWithoutLeaveContext: async () => { zeroLeaveCalls += 1; return MOCK_ZERO_LEAVE_CONTEXT; },
        } as unknown as HrCoreAiClient;
        const agent = new AnalyticsAgentService(hrCore);

        await agent.execute(buildInput({ normalizedIntent: message, userMessage: message }));

        expect(zeroLeaveCalls).toBe(1);
      }
    });

    it('returns named employees with the inverted honesty caveat and window dates', async () => {
      const hrCore = {
        getEmployeesWithoutLeaveContext: async () => MOCK_ZERO_LEAVE_CONTEXT,
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const message = "which employees haven't taken leave";
      const result = await agent.execute(buildInput({ normalizedIntent: message, userMessage: message }));

      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.userVisibleContent).toContain('Carla Diaz');
      expect(result.userVisibleContent).toContain('Dev Patel');
      expect(result.userVisibleContent).toContain('2025-07-29');
      expect(result.userVisibleContent).toContain('2026-07-29');
      expect(result.userVisibleContent).toContain('does not mean these employees were present every day');
    });

    it('handles the everyone-has-taken-leave case gracefully', async () => {
      const hrCore = {
        getEmployeesWithoutLeaveContext: async () => ({
          ...MOCK_ZERO_LEAVE_CONTEXT,
          data: { ...MOCK_ZERO_LEAVE_CONTEXT.data, entries: [] },
        }),
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const message = 'who has not taken any leave';
      const result = await agent.execute(buildInput({ normalizedIntent: message, userMessage: message }));

      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.userVisibleContent).toContain('Everyone in scope');
    });

    it('degrades gracefully when the zero-leave endpoint is denied', async () => {
      const hrCore = {
        getEmployeesWithoutLeaveContext: async () => ({
          data: null,
          permissionDecision: PermissionDecision.DENIED,
          degradedReason: 'MANAGER scope required.',
          sourceType: 'LEAVE_ZERO_SUMMARY',
          sourceTitle: 'Employees without leave',
        }),
      } as unknown as HrCoreAiClient;
      const agent = new AnalyticsAgentService(hrCore);

      const message = 'which employees have not taken leave';
      const result = await agent.execute(buildInput({ normalizedIntent: message, userMessage: message }));

      expect(result.status).toBe(AgentRunStatus.DEGRADED);
      expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    });
  });
});
