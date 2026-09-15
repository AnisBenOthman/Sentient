import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { AgentGuardrailService, FinalAnswerPolicyService } from '../../../common/safety';
import { SpecialistResult } from '../../../common/graph';
import { FinalAnswerNodeService } from './final-answer-node.service';

function specialist(status: AgentRunStatus, content = 'Specialist content.'): SpecialistResult {
  return {
    agentType: AgentType.LEAVE_AGENT,
    status,
    summary: 'Specialist summary.',
    userVisibleContent: content,
    sourceContext: [{ sourceType: 'LEAVE', title: 'Leave context', referenceId: null }],
    permissionDecision: status === AgentRunStatus.REFUSED ? PermissionDecision.DENIED : PermissionDecision.ALLOWED,
  };
}

describe('FinalAnswerNodeService status taxonomy', () => {
  const service = new FinalAnswerNodeService(new FinalAnswerPolicyService(new AgentGuardrailService()));

  it('keeps a guardrail refusal as REFUSED instead of OUT_OF_SCOPE', () => {
    const result = service.compose({
      guardrailMessage: 'I cannot help access private employee information.',
      guardrailStatus: AgentRunStatus.REFUSED,
      specialistResults: [],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });

  it('keeps out-of-scope responses OUT_OF_SCOPE', () => {
    const result = service.compose({
      guardrailMessage: 'That question is outside my Sentient scope.',
      guardrailStatus: AgentRunStatus.OUT_OF_SCOPE,
      specialistResults: [],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.OUT_OF_SCOPE);
  });

  it('returns PARTIAL when one specialist succeeds and another is degraded', () => {
    const result = service.compose({
      specialistResults: [specialist(AgentRunStatus.SUCCESS), specialist(AgentRunStatus.DEGRADED)],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.PARTIAL);
  });

  it('returns PARTIAL when mixed prompts decline an unrelated topic', () => {
    const result = service.compose({
      guardrailMessage: 'I will answer only the Sentient-related part.',
      specialistResults: [specialist(AgentRunStatus.SUCCESS)],
      declinedTopics: ['cryptocurrency'],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.PARTIAL);
    expect(result.content).toContain('I left aside: cryptocurrency.');
  });

  it('returns SUCCESS when every specialist succeeds with nothing declined', () => {
    const result = service.compose({
      specialistResults: [specialist(AgentRunStatus.SUCCESS)],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
  });

  it('returns REFUSED when all specialists refused', () => {
    const result = service.compose({
      specialistResults: [specialist(AgentRunStatus.REFUSED, 'I cannot share that record.')],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });

  it('returns DEGRADED when all specialists are degraded', () => {
    const result = service.compose({
      specialistResults: [specialist(AgentRunStatus.DEGRADED, 'Context unavailable right now.')],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
  });

  it('returns REFUSED for a deterministic policy refusal', () => {
    const result = service.compose({
      policyRefusalMessage: 'I can help prepare a draft, but I cannot submit official records.',
      specialistResults: [],
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.REFUSED);
    expect(result.content).toContain('cannot submit');
  });

  it('includes the escalation next step exactly once', () => {
    const nextStep = 'Please contact your manager for support.';
    const escalationSpecialist: SpecialistResult = {
      agentType: AgentType.HUMAN_ESCALATION_AGENT,
      status: AgentRunStatus.ESCALATED,
      summary: 'Human support handoff recorded.',
      userVisibleContent: nextStep,
      sourceContext: [],
      permissionDecision: PermissionDecision.ALLOWED,
    };
    const result = service.compose({
      specialistResults: [escalationSpecialist],
      escalation: {
        targetType: 'MANAGER' as never,
        targetLabel: 'your manager',
        reason: 'USER_REQUESTED_HUMAN_SUPPORT',
        summaryForHuman: 'User asked for a human.',
        nextStep,
      },
      isDraft: false,
    });

    expect(result.status).toBe(AgentRunStatus.ESCALATED);
    expect(result.content.split(nextStep).length - 1).toBe(1);
  });
});
