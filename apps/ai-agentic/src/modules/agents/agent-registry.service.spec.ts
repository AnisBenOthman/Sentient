import { AgentType } from '../../generated/prisma';
import { AgentRegistryService } from './agent-registry.service';

describe('AgentRegistryService', () => {
  let service: AgentRegistryService;

  beforeEach(() => {
    service = new AgentRegistryService();
  });

  it('contains the full supervisor and specialist roster', () => {
    const roster = service.list().map((entry) => entry.agentType);

    expect(roster).toEqual([
      AgentType.SUPERVISOR_AGENT,
      AgentType.OKR_AGENT,
      AgentType.CAREER_AGENT,
      AgentType.ANALYTICS_AGENT,
      AgentType.ONBOARDING_AGENT,
      AgentType.LEAVE_AGENT,
      AgentType.LANGUAGE_AGENT,
      AgentType.GENERAL_HELP_AGENT,
      AgentType.HUMAN_ESCALATION_AGENT,
    ]);
  });

  it('returns only specialists when asked for specialist roster', () => {
    const specialists = service.specialists().map((entry) => entry.agentType);

    expect(specialists).not.toContain(AgentType.SUPERVISOR_AGENT);
    expect(specialists).toContain(AgentType.HUMAN_ESCALATION_AGENT);
  });
});
