import { AgentType } from '../../src/generated/prisma';
import { AgentGuardrailService } from '../../src/common/safety';

describe('human escalation safety fixtures', () => {
  const guardrails = new AgentGuardrailService();

  it('escalates interpersonal judgment prompts without judging the person', () => {
    const result = guardrails.evaluate('What do you think about that person? I did not appreciate his behavior.');

    expect(result.shouldEscalate).toBe(true);
    expect(result.allowedAgents).toContain(AgentType.HUMAN_ESCALATION_AGENT);
    expect(result.message).toContain('cannot judge');
  });

  it('includes urgent support wording for immediate safety risk', () => {
    const result = guardrails.evaluate('There is immediate danger and an urgent safety issue.');

    expect(result.shouldEscalate).toBe(true);
    expect(result.message).toContain('urgent local help');
  });
});
