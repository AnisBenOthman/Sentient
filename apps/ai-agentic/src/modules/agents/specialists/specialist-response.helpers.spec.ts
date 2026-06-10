import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamResult, DownstreamSummary } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

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
