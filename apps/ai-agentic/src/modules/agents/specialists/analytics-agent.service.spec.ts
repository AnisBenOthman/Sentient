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
});
