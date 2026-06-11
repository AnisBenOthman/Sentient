import { AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { OkrAgentService } from './okr-agent.service';

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
    correlationId: 'corr-1',
  },
  conversationContext: {
    recentMessages: [],
    priorHandoffAgents: [],
  },
  sourceHints: [],
  isDraftRequest: false,
  constraints: {
    sentientOnly: true,
    readOnlyOfficialRecords: true,
    mustReturnToSupervisor: true,
  },
};

describe('OkrAgentService', () => {
  it('summarizes the caller actual objectives including risk (FR-036)', async () => {
    let requestedOwner: string | null = null;
    const hrCore = {
      getOkrContext: async (ownerUserId: string | null) => {
        requestedOwner = ownerUserId;
        return {
          data: {
            id: 'okr:objectives',
            objectives: [
              { id: 'objective-1', title: 'Improve onboarding completion', level: 'INDIVIDUAL', status: 'ACTIVE' },
              { id: 'objective-2', title: 'Reduce support backlog', level: 'INDIVIDUAL', status: 'AT_RISK' },
            ],
          },
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType: 'OKR',
          sourceTitle: 'OKR context',
        };
      },
    } as unknown as HrCoreAiClient;
    const agent = new OkrAgentService(hrCore);

    const result = await agent.execute(input);

    expect(requestedOwner).toBe('user-1');
    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('2 objectives');
    expect(result.userVisibleContent).toContain('Improve onboarding completion');
    expect(result.userVisibleContent).toContain('Reduce support backlog');
    expect(result.userVisibleContent).toContain('at risk');
  });

  it('falls back to guidance when no objectives are in scope', async () => {
    const hrCore = {
      getOkrContext: async () => ({
        data: { id: 'okr:objectives', objectives: [] },
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType: 'OKR',
        sourceTitle: 'OKR context',
      }),
    } as unknown as HrCoreAiClient;
    const agent = new OkrAgentService(hrCore);

    const result = await agent.execute(input);

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('did not find objectives');
  });
});
