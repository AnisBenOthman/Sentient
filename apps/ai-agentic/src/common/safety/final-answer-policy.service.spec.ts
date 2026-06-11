import { AgentRunStatus } from '../../generated/prisma';
import { AgentGuardrailService } from './agent-guardrail.service';
import { FinalAnswerPolicyService } from './final-answer-policy.service';

describe('FinalAnswerPolicyService', () => {
  let service: FinalAnswerPolicyService;

  beforeEach(() => {
    service = new FinalAnswerPolicyService(new AgentGuardrailService());
  });

  it('replaces unauthorized data references in successful answers', () => {
    const result = service.review("Sure - another employee's salary is 58000 this year.", {
      status: AgentRunStatus.SUCCESS,
    });

    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.content).not.toContain('58000');
    expect(result.warnings).toContain('Unauthorized data reference removed from final answer.');
  });

  it('replaces interpersonal judgments in successful answers', () => {
    const result = service.review('Honestly, your coworker was definitely rude to you and you are right to be upset.', {
      status: AgentRunStatus.SUCCESS,
    });

    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.content).toContain('People team');
    expect(result.warnings).toContain('Personal judgment removed from final answer.');
  });

  it('does not re-flag refusal messages that legitimately mention declined topics', () => {
    const refusal =
      'I cannot judge another person or assign blame. If the behavior affected you, please contact your manager.';
    const result = service.review(refusal, { status: AgentRunStatus.ESCALATED });

    expect(result.status).toBe(AgentRunStatus.ESCALATED);
    expect(result.content).toBe(refusal);
  });

  it('redacts emails and long identifiers', () => {
    const result = service.review('Contact alice.martin@sentient.dev or call 0612345678 about leave.', {
      status: AgentRunStatus.SUCCESS,
    });

    expect(result.content).toContain('[email]');
    expect(result.content).toContain('[redacted-number]');
    expect(result.warnings).toContain('Sensitive identifiers redacted from final answer.');
  });

  it('keeps short numbers like day counts and ISO dates readable', () => {
    const result = service.review('Last leave: Annual Leave, 2026-04-15 to 2026-04-18 (4 days).', {
      status: AgentRunStatus.SUCCESS,
    });

    expect(result.content).toContain('2026-04-15');
    expect(result.content).toContain('4 days');
  });

  it('labels drafts and keeps a human review reminder', () => {
    const result = service.review('Objective: improve onboarding completion.', { isDraft: true });

    expect(result.content.startsWith('Draft')).toBe(true);
    expect(result.content.toLowerCase()).toContain('review before');
  });

  it('replaces empty answers with a safe fallback', () => {
    const result = service.review('   ');

    expect(result.content).toContain('could not produce a safe Sentient-scoped answer');
    expect(result.warnings).toContain('Empty answer replaced.');
  });
});
