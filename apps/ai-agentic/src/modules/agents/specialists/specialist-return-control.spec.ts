import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient, SocialAiClient } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge';
import { AnalyticsAgentService } from './analytics-agent.service';
import { CareerAgentService } from './career-agent.service';
import { GeneralHelpAgentService } from './general-help-agent.service';
import { LanguageAgentService } from './language-agent.service';
import { LeaveAgentService } from './leave-agent.service';
import { OkrAgentService } from './okr-agent.service';
import { OnboardingAgentService } from './onboarding-agent.service';

const input: SpecialistInput = {
  conversationId: 'conversation-1',
  parentTaskLogId: 'task-1',
  userMessage: 'Summarize my Sentient context.',
  normalizedIntent: 'Summarize my Sentient context.',
  actorContext: {
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
  sourceHints: [],
  isDraftRequest: false,
  constraints: {
    sentientOnly: true,
    readOnlyOfficialRecords: true,
    mustReturnToSupervisor: true,
  },
};

describe('specialist agents return structured control to supervisor', () => {
  it('returns structured results for every deterministic specialist', async () => {
    const knowledge = {
      searchApproved: async () => [],
    } as unknown as KnowledgeRepository;
    const downstream = {
      data: { id: 'context-1', balances: [], recentRequests: [] },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'TEST_CONTEXT',
      sourceTitle: 'Test context',
    };
    const hrCore = {
      getLeaveContext: async () => downstream,
      getOkrContext: async () => downstream,
      getSkillsContext: async () => downstream,
      // WHY its own shape: getDashboardContext always pairs the payload with the
      // population it covers, so the generic downstream stub would not be realistic.
      getDashboardContext: async () => ({
        ...downstream,
        data: {
          id: 'context-1',
          scope: {
            level: 'ORGANIZATION',
            label: 'Entire organization — every department and team combined, not any single group',
            departmentId: null,
            teamId: null,
            businessUnitId: null,
          },
        },
      }),
    } as unknown as HrCoreAiClient;
    const social = {
      getOnboardingContext: async () => downstream,
      getPolicyKnowledge: async () => downstream,
    } as unknown as SocialAiClient;
    const agents = [
      new LeaveAgentService(hrCore),
      new OkrAgentService(hrCore),
      new CareerAgentService(hrCore),
      new AnalyticsAgentService(hrCore),
      new OnboardingAgentService(social),
      new LanguageAgentService(),
      new GeneralHelpAgentService(knowledge, social),
    ];

    for (const agent of agents) {
      const result = await agent.execute(input);
      expect(result.status).toBe(AgentRunStatus.SUCCESS);
      expect(result.summary.length > 0).toBe(true);
      expect(result.agentType).toBeDefined();
    }
  });

  it('keeps the expected specialist roster explicit', () => {
    const roster = [
      AgentType.OKR_AGENT,
      AgentType.CAREER_AGENT,
      AgentType.ANALYTICS_AGENT,
      AgentType.ONBOARDING_AGENT,
      AgentType.LEAVE_AGENT,
      AgentType.LANGUAGE_AGENT,
      AgentType.GENERAL_HELP_AGENT,
      AgentType.HUMAN_ESCALATION_AGENT,
    ];

    expect(roster).toContain(AgentType.HUMAN_ESCALATION_AGENT);
  });

  it('passes the actor employee id to the leave context lookup', async () => {
    const downstream = {
      data: {
        id: 'leave-context',
        balances: [],
        recentRequests: [],
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'LEAVE',
      sourceTitle: 'Leave balance and history',
    };
    const calls: Array<{ employeeId: string | null; jwt: string; correlationId: string }> = [];
    const hrCore = {
      getLeaveContext: async (
        employeeId: string | null,
        context: { jwt: string; correlationId: string },
      ): Promise<typeof downstream> => {
        calls.push({ employeeId, jwt: context.jwt, correlationId: context.correlationId });
        return downstream;
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    await agent.execute(input);

    expect(calls.length).toBe(1);
    expect(calls[0]?.employeeId).toBe('employee-1');
    expect(calls[0]?.jwt).toBe('token');
    expect(calls[0]?.correlationId).toBe('corr-1');
  });

  it('returns concrete leave balance and last approved leave details', async () => {
    const downstream = {
      data: {
        id: 'leave-context',
        balances: [
          {
            id: 'balance-1',
            leaveTypeName: 'Annual Leave',
            year: 2026,
            totalDays: 20,
            usedDays: 4,
            pendingDays: 1,
            remainingDays: 15,
          },
          {
            id: 'balance-2',
            leaveTypeName: 'Sick Leave',
            year: 2026,
            totalDays: 10,
            usedDays: 2,
            pendingDays: 0,
            remainingDays: 8,
          },
        ],
        recentRequests: [
          {
            id: 'request-older',
            leaveType: { name: 'Sick Leave' },
            startDate: '2026-01-02T00:00:00.000Z',
            endDate: '2026-01-03T00:00:00.000Z',
            totalDays: 2,
            status: 'APPROVED',
          },
          {
            id: 'request-latest',
            leaveType: { name: 'Annual Leave' },
            startDate: '2026-04-15T00:00:00.000Z',
            endDate: '2026-04-18T00:00:00.000Z',
            totalDays: 4,
            status: 'APPROVED',
          },
        ],
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'LEAVE',
      sourceTitle: 'Leave balance and history',
    };
    const hrCore = {
      getLeaveContext: async (): Promise<typeof downstream> => downstream,
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute({
      ...input,
      userMessage: 'What is my leave balance and when was my last leave?',
      normalizedIntent: 'What is my leave balance and when was my last leave?',
    });

    expect(result.userVisibleContent).toContain('23 days remaining across all leave types');
    expect(result.userVisibleContent).toContain('Annual Leave: 15 days remaining');
    expect(result.userVisibleContent).toContain('Sick Leave: 8 days remaining');
    expect(result.userVisibleContent).toContain('Last leave: Annual Leave, 2026-04-15 to 2026-04-18 (4 days).');
  });

  it('returns the last approved leave even when it is outside the current balance year', async () => {
    const downstream = {
      data: {
        id: 'leave-context',
        balances: [
          {
            id: 'balance-1',
            leaveTypeName: 'Annual Leave',
            year: 2026,
            totalDays: 22,
            usedDays: 15,
            pendingDays: 0,
            remainingDays: 7,
          },
        ],
        recentRequests: [
          {
            id: 'request-rejected-current-year',
            leaveType: { name: 'Annual Leave' },
            startDate: '2026-05-18T00:00:00.000Z',
            endDate: '2026-05-18T00:00:00.000Z',
            totalDays: 1,
            status: 'REJECTED',
          },
          {
            id: 'request-approved-prior-year',
            leaveType: { name: 'Annual Leave' },
            startDate: '2025-01-19T00:00:00.000Z',
            endDate: '2025-01-23T00:00:00.000Z',
            totalDays: 5,
            status: 'APPROVED',
          },
        ],
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'LEAVE',
      sourceTitle: 'Leave balance and history',
    };
    const hrCore = {
      getLeaveContext: async (): Promise<typeof downstream> => downstream,
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute({
      ...input,
      userMessage: 'the last date of my paid leave',
      normalizedIntent: 'the last date of my paid leave',
    });

    expect(result.userVisibleContent).toContain('Last leave: Annual Leave, 2025-01-19 to 2025-01-23 (5 days).');
    expect(result.userVisibleContent).not.toContain('for this year');
  });

  it('refuses individual third-party leave balances without calling HR Core', async () => {
    let calls = 0;
    const hrCore = {
      getLeaveContext: async (): Promise<never> => {
        calls += 1;
        throw new Error('Unexpected leave context lookup');
      },
    } as unknown as HrCoreAiClient;
    const agent = new LeaveAgentService(hrCore);

    const result = await agent.execute({
      ...input,
      userMessage: "what's the leave balance of my manager",
      normalizedIntent: "what's the leave balance of my manager",
    });

    expect(calls).toBe(0);
    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    expect(result.userVisibleContent).toContain("another individual employee's leave balance");
  });
});
