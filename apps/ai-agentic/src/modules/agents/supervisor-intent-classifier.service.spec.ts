import { AgentType } from '../../generated/prisma';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

describe('SupervisorIntentClassifierService', () => {
  let service: SupervisorIntentClassifierService;

  beforeEach(() => {
    service = new SupervisorIntentClassifierService();
  });

  it('routes a leave prompt to the Leave Agent', () => {
    const result = service.classify('What is my leave balance?');

    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
  });

  it('routes manager multi-domain prompts to multiple specialists', () => {
    const result = service.classify('Summarize leave coverage, OKR risk, and dashboard trends for my team.');

    expect(result.requiredAgents).toEqual([
      AgentType.LEAVE_AGENT,
      AgentType.OKR_AGENT,
      AgentType.ANALYTICS_AGENT,
    ]);
  });

  it('detects draft intent', () => {
    const result = service.classify('Draft an objective and key result for my next quarter.');

    expect(result.isDraftIntent).toBe(true);
    expect(result.requiredAgents).toContain(AgentType.OKR_AGENT);
  });

  it('asks for clarification when no safe route is obvious', () => {
    const result = service.classify('Can you help me with my objective?');

    expect(result.requiresClarification).toBe(true);
    expect(result.requiredAgents).toEqual([]);
  });
});
