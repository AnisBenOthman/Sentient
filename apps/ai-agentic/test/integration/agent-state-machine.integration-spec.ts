import { AgentRunStatus, AgentType } from '../../src/generated/prisma';
import { AgentGuardrailService } from '../../src/common/safety';
import { SupervisorIntentClassifierService } from '../../src/modules/agents/supervisor-intent-classifier.service';

describe('agent state-machine routing fixtures', () => {
  const guardrails = new AgentGuardrailService();
  const classifier = new SupervisorIntentClassifierService();

  it('routes leave questions to Leave Agent', async () => {
    const route = await classifier.classify('What is my leave balance and last leave?');

    expect(route.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
  });

  it('routes manager multi-domain questions to leave, OKR, and analytics specialists', async () => {
    const route = await classifier.classify('Summarize leave coverage, OKR risk, and dashboard trends for my team.');

    expect(route.requiredAgents).toEqual([
      AgentType.LEAVE_AGENT,
      AgentType.OKR_AGENT,
      AgentType.ANALYTICS_AGENT,
    ]);
  });

  it('routes ambiguous prompts to clarification', async () => {
    const route = await classifier.classify('Can you help me with my objective?');

    expect(route.requiresClarification).toBe(true);
  });

  it('routes simple greetings to a supervisor greeting answer instead of clarification', async () => {
    const route = await classifier.classify('hello');

    expect(route.isGreeting).toBe(true);
    expect(route.requiresClarification).toBe(false);
    expect(route.requiredAgents).toEqual([]);
  });

  it('routes off-topic prompts to a final out-of-scope response', () => {
    const result = guardrails.evaluate('Who won the World Cup?');

    expect(result.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
  });

  it('routes interpersonal judgment prompts toward escalation', () => {
    const result = guardrails.evaluate('What do you think about that person? I did not appreciate his behavior.');

    expect(result.shouldEscalate).toBe(true);
    expect(result.allowedAgents).toContain(AgentType.HUMAN_ESCALATION_AGENT);
  });
});
