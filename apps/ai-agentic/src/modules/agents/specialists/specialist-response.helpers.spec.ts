import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamResult, DownstreamSummary } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { GeminiToolCallOutcome } from '../tools';
import { downstreamResult, toolCallerResult, ToolCallerResultMeta } from './specialist-response.helpers';

const input: SpecialistInput = {
  conversationId: 'conversation-1',
  parentTaskLogId: 'task-1',
  userMessage: 'And what about my balance?',
  normalizedIntent: 'And what about my balance?',
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
  conversationContext: {
    recentMessages: [
      { id: 'message-1', role: 'USER', content: 'Can you help with leave?' },
      { id: 'message-2', role: 'ASSISTANT', content: 'Yes, I can help with leave.' },
    ],
    priorHandoffAgents: [AgentType.LEAVE_AGENT],
  },
  sourceHints: [],
  isDraftRequest: false,
  constraints: {
    sentientOnly: true,
    readOnlyOfficialRecords: true,
    mustReturnToSupervisor: true,
  },
};

describe('downstreamResult', () => {
  it('does not expose raw missing-context wording in degraded follow-up replies', () => {
    const downstream: DownstreamResult<DownstreamSummary> = {
      data: null,
      permissionDecision: PermissionDecision.UNAVAILABLE,
      degradedReason: 'Context was not found.',
      sourceType: 'HR_CORE',
      sourceTitle: 'Leave context',
    };

    const result = downstreamResult(
      input,
      AgentType.LEAVE_AGENT,
      downstream,
      'Leave context prepared.',
      'Leave guidance prepared.',
    );

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.userVisibleContent).toContain('I also considered the recent conversation context');
    expect(result.userVisibleContent).toContain('I could not access leave context right now.');
    expect(result.userVisibleContent).not.toContain('Context was not found');
    expect(result.userVisibleContent).not.toContain('missing records');
  });
});

const meta: ToolCallerResultMeta = {
  sourceType: 'LEAVE',
  title: 'Leave context',
  referencePrefix: 'leave',
  referenceFallback: 'tool-caller',
  successSummary: 'Leave context prepared.',
  limitedSummary: 'Leave guidance prepared with limited data access.',
  draftLabel: 'Leave request draft',
};

function buildOutcome(overrides: Partial<GeminiToolCallOutcome> = {}): GeminiToolCallOutcome {
  return {
    answer: 'You have 12 days remaining.',
    anyToolDenied: false,
    anyToolFailed: false,
    toolsUsed: ['get_my_leave_balance'],
    providerUsed: 'GEMINI',
    ...overrides,
  };
}

describe('toolCallerResult', () => {
  it('returns SUCCESS when the primary provider answered cleanly', () => {
    const result = toolCallerResult(input, AgentType.LEAVE_AGENT, buildOutcome(), meta);

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.summary).toBe('Leave context prepared.');
    expect(result.permissionDecision).toBe(PermissionDecision.ALLOWED);
  });

  it('marks DEGRADED and names the provider when the answer came from a fallback provider', () => {
    const result = toolCallerResult(
      input,
      AgentType.LEAVE_AGENT,
      buildOutcome({ providerUsed: 'OPENROUTER', usedFallbackProvider: true }),
      meta,
    );

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.summary).toContain('fallback provider (OPENROUTER)');
    // WHY: a clean fallback answer is still a real answer — never DENIED/PARTIAL.
    expect(result.permissionDecision).toBe(PermissionDecision.ALLOWED);
  });

  it('marks DENIED when a tool was permission-denied, regardless of provider', () => {
    const result = toolCallerResult(
      input,
      AgentType.LEAVE_AGENT,
      buildOutcome({ anyToolDenied: true }),
      meta,
    );

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.summary).toBe(meta.limitedSummary);
    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
  });

  it('uses the reference fallback word when no tools were called', () => {
    const result = toolCallerResult(
      input,
      AgentType.LEAVE_AGENT,
      buildOutcome({ toolsUsed: [] }),
      meta,
    );

    expect(result.sourceContext[0]?.referenceId).toBe('leave:tool-caller');
  });
});
