import { AgentRunStatus } from '../../../generated/prisma';
import { SpecialistInput } from '../../../common/graph';
import { LanguageAgentService } from './language-agent.service';

const baseInput: SpecialistInput = {
  conversationId: 'conversation-1',
  parentTaskLogId: 'task-1',
  userMessage: 'Please reword this professionally: I need the report today because the deadline is blocked.',
  normalizedIntent: 'Please reword this professionally',
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
  sourceHints: [],
  isDraftRequest: true,
  constraints: {
    sentientOnly: true,
    readOnlyOfficialRecords: true,
    mustReturnToSupervisor: true,
  },
};

describe('LanguageAgentService', () => {
  it('professionalizes phrases while preserving user intent', async () => {
    const result = await new LanguageAgentService().execute(baseInput);

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('deadline');
    expect(result.draftLabel).toBe('Phrase rewrite draft');
  });
});
