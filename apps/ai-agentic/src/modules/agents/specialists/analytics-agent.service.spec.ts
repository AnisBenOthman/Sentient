import { AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { AnalyticsAgentService } from './analytics-agent.service';

const input: SpecialistInput = {
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
};

describe('AnalyticsAgentService', () => {
  it('summarizes scoped dashboard metrics instead of generic guidance (FR-038)', async () => {
    const hrCore = {
      getDashboardContext: async () => ({
        data: {
          employees: { total: 128, active: 110, onLeave: 6, probation: 12 },
          leave: { pendingApprovals: 4 },
          skills: { averageScore: 3.4, skillsTracked: 42, topSkill: 'TypeScript' },
        },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'DASHBOARD',
        sourceTitle: 'Dashboard analytics',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new AnalyticsAgentService(hrCore);

    const result = await agent.execute(input);

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

    const result = await agent.execute(input);

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
  });
});
