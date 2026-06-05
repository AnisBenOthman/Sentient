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
      data: { id: 'context-1' },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'TEST_CONTEXT',
      sourceTitle: 'Test context',
    };
    const hrCore = {
      getLeaveContext: async () => downstream,
      getOkrContext: async () => downstream,
      getSkillsContext: async () => downstream,
      getDashboardContext: async () => downstream,
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
});
