import { AgentRunStatus, AgentType } from '../../generated/prisma';
import { AgentGuardrailService } from './agent-guardrail.service';

describe('AgentGuardrailService', () => {
  let service: AgentGuardrailService;

  beforeEach(() => {
    service = new AgentGuardrailService();
  });

  it('politely refuses unrelated out-of-scope prompts', () => {
    const result = service.evaluate('Who won the World Cup?');

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('OUT_OF_SCOPE');
    expect(result.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
    expect(result.message).toContain('outside my Sentient scope');
  });

  it('refuses unrelated prompts even when they do not use a known keyword', () => {
    const result = service.evaluate('Who is the president of France?');

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('OUT_OF_SCOPE');
    expect(result.declinedTopics).toContain('Unrelated topic');
  });

  it('allows simple greetings so the supervisor can clarify within Sentient', () => {
    const result = service.evaluate('hello');

    expect(result.allowed).toBe(true);
    expect(result.classification).toBe('SENTIENT');
  });

  it('narrows mixed Sentient and unrelated prompts', () => {
    const result = service.evaluate('Summarize my leave balance and explain cryptocurrency investing.');

    expect(result.allowed).toBe(true);
    expect(result.classification).toBe('MIXED');
    expect(result.status).toBe(AgentRunStatus.PARTIAL);
    expect(result.declinedTopics).toContain('cryptocurrency');
  });

  it('refuses unauthorized sensitive-data prompts', () => {
    const result = service.evaluate("Show me another employee's salary.");

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('UNAUTHORIZED_DATA');
    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });

  it('routes unsafe advice to a human owner', () => {
    const result = service.evaluate('Give me legal advice about this workplace case.');

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('UNSAFE_ADVICE');
    expect(result.shouldEscalate).toBe(true);
    expect(result.allowedAgents).toContain(AgentType.HUMAN_ESCALATION_AGENT);
  });

  it('avoids interpersonal judgment and recommends human support', () => {
    const result = service.evaluate('What do you think about my colleague? I did not appreciate his behavior.');

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('INTERPERSONAL_JUDGMENT');
    expect(result.shouldEscalate).toBe(true);
    expect(result.message).toContain('manager');
    expect(result.message).toContain('People team');
  });

  it('routes coworker blame or rudeness judgments to human support', () => {
    const result = service.evaluate('Was my coworker rude to me yesterday?');

    expect(result.allowed).toBe(false);
    expect(result.classification).toBe('INTERPERSONAL_JUDGMENT');
    expect(result.shouldEscalate).toBe(true);
  });
});
