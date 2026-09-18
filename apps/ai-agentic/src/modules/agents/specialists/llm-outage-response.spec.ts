import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistInput, SpecialistResult } from '../../../common/graph';
import { FinalAnswerPolicyService, AgentGuardrailService } from '../../../common/safety';
import { FinalAnswerNodeService } from '../nodes/final-answer-node.service';
import { LlmFallbackOrchestratorService, LlmTurnResult, LlmUnavailable } from '../tools';
import { OkrAgentService } from './okr-agent.service';
import { llmUnavailableResult, withLlmOutageNotice } from './specialist-response.helpers';

const input: SpecialistInput = {
  conversationId: 'conversation-1',
  parentTaskLogId: 'task-1',
  userMessage: 'How are my OKRs doing this quarter?',
  normalizedIntent: 'How are my OKRs doing this quarter?',
  actorContext: {
    jwt: 'token',
    userId: 'user-1',
    employeeId: 'employee-1',
    roles: ['EMPLOYEE'],
    departmentId: null,
    teamId: null,
    businessUnitId: null,
    roleAssignments: [],
    correlationId: 'corr-1',
  },
  conversationContext: { recentMessages: [], priorHandoffAgents: [] },
  sourceHints: [],
  isDraftRequest: false,
  constraints: { sentientOnly: true, readOnlyOfficialRecords: true, mustReturnToSupervisor: true },
};

const outage: LlmUnavailable = {
  reason: 'RATE_LIMITED',
  attempts: [
    { provider: 'GEMINI', reason: 'RATE_LIMITED', detail: 'HTTP 429' },
    { provider: 'OPENROUTER', reason: 'CONNECTION', detail: 'fetch failed' },
  ],
  partialOutputEmitted: false,
};

/** Every configured provider is down: the orchestrator reports the classified cause. */
function downOrchestrator(failure: LlmUnavailable = outage): LlmFallbackOrchestratorService {
  const result: LlmTurnResult = { ok: false, failure };
  return {
    call: async () => result,
    callStream: async () => result,
  } as unknown as LlmFallbackOrchestratorService;
}

function okrHrCore(): HrCoreAiClient {
  return {
    getOkrContext: async () => ({
      data: {
        id: 'okr:objectives',
        objectives: [{ id: 'objective-1', title: 'Improve onboarding completion', level: 'INDIVIDUAL', status: 'ACTIVE' }],
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'OKR',
      sourceTitle: 'OKR context',
    }),
  } as unknown as HrCoreAiClient;
}

/**
 * The regression this whole feature exists for: with every LLM provider down,
 * a specialist used to fall through to its deterministic path and return
 * SUCCESS with generic prose. The user was told nothing, and the governance
 * audit recorded an outage as a successful turn.
 */
describe('specialist behaviour when every LLM provider is down', () => {
  it('never reports SUCCESS for a turn the LLM could not answer', async () => {
    const agent = new OkrAgentService(okrHrCore(), downOrchestrator(), { getOkrTools: () => [] } as never);

    const result = await agent.execute(input);

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
  });

  it('tells the user the AI service is unavailable and what to do about it', async () => {
    const agent = new OkrAgentService(okrHrCore(), downOrchestrator(), { getOkrTools: () => [] } as never);

    const result = await agent.execute(input);

    expect(result.userVisibleContent).toContain('over its request limit');
    expect(result.userVisibleContent).toContain('without AI assistance');
  });

  it('still serves the real HR Core data it was able to read', async () => {
    const agent = new OkrAgentService(okrHrCore(), downOrchestrator(), { getOkrTools: () => [] } as never);

    const result = await agent.execute(input);

    expect(result.userVisibleContent).toContain('Improve onboarding completion');
  });

  it('records the provider attempts in the summary for the governance trail', async () => {
    const agent = new OkrAgentService(okrHrCore(), downOrchestrator(), { getOkrTools: () => [] } as never);

    const result = await agent.execute(input);

    expect(result.summary).toContain('GEMINI=RATE_LIMITED');
    expect(result.summary).toContain('OPENROUTER=CONNECTION');
  });

  it('keeps answering normally when the LLM is healthy', async () => {
    const healthy = {
      call: async (): Promise<LlmTurnResult> => ({
        ok: true,
        outcome: {
          answer: 'Your objectives are on track.',
          anyToolDenied: false,
          anyToolFailed: false,
          toolsUsed: ['get_my_objectives'],
          providerUsed: 'GEMINI',
          usedFallbackProvider: false,
        },
      }),
    } as unknown as LlmFallbackOrchestratorService;
    const agent = new OkrAgentService(okrHrCore(), healthy, { getOkrTools: () => [] } as never);

    const result = await agent.execute(input);

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toBe('Your objectives are on track.');
  });
});

describe('withLlmOutageNotice', () => {
  const base: SpecialistResult = {
    agentType: AgentType.LEAVE_AGENT,
    status: AgentRunStatus.SUCCESS,
    summary: 'Leave context prepared.',
    userVisibleContent: 'You have 12 days of annual leave remaining.',
    sourceContext: [],
    permissionDecision: PermissionDecision.ALLOWED,
  };

  it('demotes SUCCESS to DEGRADED and keeps the underlying answer intact', () => {
    const result = withLlmOutageNotice(base, outage);

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.userVisibleContent).toContain('You have 12 days of annual leave remaining.');
  });

  /** An outage does not make a refusal less of a refusal. */
  it('leaves a status that is already worse than DEGRADED alone', () => {
    const refused = withLlmOutageNotice({ ...base, status: AgentRunStatus.REFUSED }, outage);
    expect(refused.status).toBe(AgentRunStatus.REFUSED);
  });

  it('says the answer was cut short when the stream had already started', () => {
    const result = withLlmOutageNotice(base, { ...outage, partialOutputEmitted: true });
    expect(result.userVisibleContent).toContain('mid-answer');
  });
});

describe('llmUnavailableResult', () => {
  it('produces a DEGRADED, permission-UNAVAILABLE result with no invented sources', () => {
    const result = llmUnavailableResult(AgentType.GENERAL_HELP_AGENT, outage);

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.permissionDecision).toBe(PermissionDecision.UNAVAILABLE);
    expect(result.sourceContext).toEqual([]);
    expect(result.userVisibleContent).toContain('Nothing in your Sentient records was changed or submitted.');
  });
});

/**
 * The status must survive composition: a turn built only from outage-degraded
 * specialists has to reach the stored Message (and the governance metrics) as
 * DEGRADED, not collapse back into SUCCESS.
 */
describe('final answer composition of an outage turn', () => {
  it('composes a DEGRADED turn from outage-degraded specialists', () => {
    const node = new FinalAnswerNodeService(new FinalAnswerPolicyService(new AgentGuardrailService()));

    const composed = node.compose({
      specialistResults: [llmUnavailableResult(AgentType.LEAVE_AGENT, outage)],
      isDraft: false,
    });

    expect(composed.status).toBe(AgentRunStatus.DEGRADED);
    expect(composed.content).toContain('try again in a minute');
  });
});
