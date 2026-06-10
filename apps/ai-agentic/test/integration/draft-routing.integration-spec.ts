import { AgentType } from '../../src/generated/prisma';
import { SupervisorIntentClassifierService } from '../../src/modules/agents/supervisor-intent-classifier.service';

describe('draft routing', () => {
  const classifier = new SupervisorIntentClassifierService();
  const cases: Array<{ prompt: string; category: string; agentType: AgentType }> = [
    { prompt: 'Draft an objective and key result', category: 'OBJECTIVE', agentType: AgentType.OKR_AGENT },
    { prompt: 'Draft a self-review note', category: 'SELF_REVIEW', agentType: AgentType.CAREER_AGENT },
    { prompt: 'Draft manager feedback for a review', category: 'MANAGER_FEEDBACK', agentType: AgentType.CAREER_AGENT },
    { prompt: 'Draft an HR announcement', category: 'HR_ANNOUNCEMENT', agentType: AgentType.GENERAL_HELP_AGENT },
    { prompt: 'Draft a policy summary', category: 'POLICY_SUMMARY', agentType: AgentType.GENERAL_HELP_AGENT },
    { prompt: 'Draft a workforce insight from dashboard trends', category: 'WORKFORCE_INSIGHT', agentType: AgentType.ANALYTICS_AGENT },
    { prompt: 'Rewrite this phrase professionally', category: 'PHRASE_REWRITE', agentType: AgentType.LANGUAGE_AGENT },
  ];

  for (const item of cases) {
    it(`routes ${item.prompt}`, async () => {
      const result = await classifier.classify(item.prompt);

      expect(result.isDraftIntent).toBe(true);
      expect(result.draftCategory).toBe(item.category);
      expect(result.requiredAgents).toContain(item.agentType);
    });
  }
});
