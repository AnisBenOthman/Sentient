import { ConfigService } from '@nestjs/config';
import { PermissionScope, RoleAssignmentClaim } from '@sentient/shared';
import { AgentRunStatus } from '../../generated/prisma';
import { AiActorContext, SpecialistInput } from '../../common/graph';
import { AnalyticsQueryOutcome, AnalyticsScopeBinding, AnalyticsSqlClient } from './analytics-sql.client';
import { AnalyticsSqlService } from './analytics-sql.service';
import { GeneratedSql, SqlGeneratorService } from './sql-generator.service';
import { SqlValidatorService } from './sql-validator.service';

interface Overrides {
  generated?: GeneratedSql | null;
  outcome?: AnalyticsQueryOutcome;
  enabled?: boolean;
  rowLimit?: number;
}

const finishedLogs: Array<{ status: AgentRunStatus; generatedSql?: string | null }> = [];
let lastBinding: AnalyticsScopeBinding | null = null;

function buildService(overrides: Overrides = {}): AnalyticsSqlService {
  const rowLimit = overrides.rowLimit ?? 1000;
  const config = {
    get: () => ({
      analyticsSqlEnabled: overrides.enabled ?? true,
      analyticsSqlRowLimit: rowLimit,
      analyticsSqlTimeoutMs: 5000,
    }),
  } as unknown as ConfigService;

  const generator = {
    generate: async (): Promise<GeneratedSql | null> =>
      overrides.generated === undefined
        ? { sql: 'SELECT department_name FROM hr_analytics.v_employees', explanation: 'Headcount.', source: 'gemini' }
        : overrides.generated,
  } as unknown as SqlGeneratorService;

  const client = {
    run: async (_sql: string, binding: AnalyticsScopeBinding): Promise<AnalyticsQueryOutcome> => {
      lastBinding = binding;
      return overrides.outcome ?? { status: 'OK', rows: [{ department_name: 'Engineering' }] };
    },
  } as unknown as AnalyticsSqlClient;

  const taskLog = {
    start: async () => ({ id: `log-${finishedLogs.length}` }),
    finish: async (_id: string, input: { status: AgentRunStatus; generatedSql?: string | null }) => {
      finishedLogs.push(input);
      return {};
    },
  } as never;

  return new AnalyticsSqlService(config, generator, new SqlValidatorService(), client, taskLog);
}

function buildActor(overrides: Partial<AiActorContext> = {}): AiActorContext {
  return {
    jwt: 'token',
    userId: 'user-1',
    employeeId: 'employee-1',
    roles: ['HR_ADMIN'],
    departmentId: 'dept-1',
    teamId: 'team-1',
    businessUnitId: 'bu-1',
    roleAssignments: [],
    correlationId: 'corr-1',
    ...overrides,
  };
}

function assignment(scope: PermissionScope, scopeEntityId: string | null, roleCode = 'MANAGER'): RoleAssignmentClaim {
  return { roleCode, scope, scopeEntityId };
}

function buildInput(actor: AiActorContext): SpecialistInput {
  return {
    conversationId: 'conversation-1',
    parentTaskLogId: 'parent-1',
    userMessage: 'Average leave by department over the last three years',
    normalizedIntent: 'Average leave by department over the last three years',
    actorContext: actor,
    conversationContext: { recentMessages: [], priorHandoffAgents: [] },
    sourceHints: [],
    isDraftRequest: false,
    constraints: { sentientOnly: true, readOnlyOfficialRecords: true, mustReturnToSupervisor: true },
  };
}

beforeEach(() => {
  finishedLogs.length = 0;
  lastBinding = null;
});

describe('AnalyticsSqlService.resolveScope', () => {
  const service = buildService();

  // WHY these cases mirror EmployeesService.buildProfileAccessFilter exactly: the
  // views are a second authorization system, and this table is what pins them to
  // HR Core's precedence chain. Changing HR Core without changing this fails here.
  it('gives privileged roles global scope', () => {
    for (const role of ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE']) {
      expect(service.resolveScope(buildActor({ roles: [role] }))?.scope).toBe('GLOBAL');
    }
  });

  it('prefers a DEPARTMENT assignment over a TEAM assignment for a manager', () => {
    const binding = service.resolveScope(
      buildActor({
        roles: ['MANAGER'],
        roleAssignments: [
          assignment(PermissionScope.TEAM, 'team-9'),
          assignment(PermissionScope.DEPARTMENT, 'dept-9'),
        ],
      }),
    );

    expect(binding?.scope).toBe('DEPARTMENT');
    expect(binding?.scopeEntityId).toBe('dept-9');
  });

  it('uses a TEAM assignment when no DEPARTMENT assignment exists', () => {
    const binding = service.resolveScope(
      buildActor({ roles: ['MANAGER'], roleAssignments: [assignment(PermissionScope.TEAM, 'team-9')] }),
    );

    expect(binding?.scope).toBe('TEAM');
    expect(binding?.scopeEntityId).toBe('team-9');
  });

  // WHY the scopeEntityId and not the flat teamId claim: a manager can be assigned
  // to a team they are not a member of, and the flat claim would scope them to the
  // wrong rows.
  it('ignores the flat teamId claim when an assignment names a different team', () => {
    const binding = service.resolveScope(
      buildActor({
        roles: ['MANAGER'],
        teamId: 'team-i-belong-to',
        roleAssignments: [assignment(PermissionScope.TEAM, 'team-i-manage')],
      }),
    );

    expect(binding?.scopeEntityId).toBe('team-i-manage');
  });

  it('falls back to the head/lead/own-team branch when no assignment carries an entity', () => {
    const binding = service.resolveScope(
      buildActor({ roles: ['MANAGER'], roleAssignments: [assignment(PermissionScope.TEAM, null)] }),
    );

    expect(binding?.scope).toBe('MANAGER_FALLBACK');
    expect(binding?.actorEmployeeId).toBe('employee-1');
  });

  it('gives a non-manager OWN scope', () => {
    expect(service.resolveScope(buildActor({ roles: ['EMPLOYEE'] }))?.scope).toBe('OWN');
  });

  // HR Core throws ForbiddenException here; the SQL branch returns null and refuses.
  it('returns null when the actor has no employee link at all', () => {
    expect(service.resolveScope(buildActor({ roles: ['EMPLOYEE'], employeeId: null, teamId: null }))).toBeNull();
  });

  it('grants compensation visibility to managers and HR, not to employees', () => {
    expect(service.resolveScope(buildActor({ roles: ['MANAGER'] }))?.compensationVisible).toBe(true);
    expect(service.resolveScope(buildActor({ roles: ['TEAM_LEAD'] }))?.compensationVisible).toBe(true);
    expect(service.resolveScope(buildActor({ roles: ['EMPLOYEE'] }))?.compensationVisible).toBe(false);
  });
});

describe('AnalyticsSqlService.execute', () => {
  it('runs the query and passes the resolved scope to the client', async () => {
    const service = buildService();
    const result = await service.execute(buildInput(buildActor({ roles: ['MANAGER'], roleAssignments: [assignment(PermissionScope.TEAM, 'team-9')] })));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('Engineering');
    expect(lastBinding?.scope).toBe('TEAM');
    expect(lastBinding?.scopeEntityId).toBe('team-9');
  });

  it('refuses when the feature flag is off', async () => {
    const service = buildService({ enabled: false });
    const result = await service.execute(buildInput(buildActor()));
    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });

  // WHY re-checked here and not only in the router: this is the authorization,
  // the router check is only a routing decision.
  it('refuses an actor whose role is not permitted, even if routed here', async () => {
    const service = buildService();
    const result = await service.execute(buildInput(buildActor({ roles: ['EMPLOYEE'] })));
    expect(result.status).toBe(AgentRunStatus.REFUSED);
  });

  it('degrades when the generator produces nothing', async () => {
    const service = buildService({ generated: null });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(finishedLogs.at(-1)?.status).toBe(AgentRunStatus.DEGRADED);
  });

  it('refuses and records the rejected SQL when validation fails', async () => {
    const service = buildService({
      generated: { sql: 'SELECT * FROM hr_core.employees', explanation: '', source: 'gemini' },
    });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.status).toBe(AgentRunStatus.REFUSED);
    // The rejected statement is preserved verbatim for audit, but never shown back.
    expect(finishedLogs.at(-1)?.generatedSql).toBe('SELECT * FROM hr_core.employees');
    expect(result.userVisibleContent).not.toContain('hr_core');
  });

  it('reports a timeout as DEGRADED with actionable wording', async () => {
    const service = buildService({ outcome: { status: 'TIMEOUT' } });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.status).toBe(AgentRunStatus.DEGRADED);
    expect(result.userVisibleContent).toMatch(/too long/i);
  });

  it('does not leak Postgres error text to the user', async () => {
    const service = buildService({ outcome: { status: 'ERROR', detail: 'column "secret_col" does not exist' } });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.userVisibleContent).not.toContain('secret_col');
  });

  // WHY explicit: an empty result rendered as 0 or a blank total reads as a real
  // measurement. "No rows matched" is a different claim from "the answer is zero".
  it('says no rows matched instead of implying a zero', async () => {
    const service = buildService({ outcome: { status: 'OK', rows: [] } });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toMatch(/no rows matched/i);
  });

  it('reports PARTIAL and warns the user when the row cap is hit', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({ n: index }));
    const service = buildService({ rowLimit: 3, outcome: { status: 'OK', rows } });
    const result = await service.execute(buildInput(buildActor()));

    expect(result.status).toBe(AgentRunStatus.PARTIAL);
    expect(result.userVisibleContent).toMatch(/not the complete result/i);
  });

  it('writes two sibling audit rows for a successful turn', async () => {
    const service = buildService();
    await service.execute(buildInput(buildActor()));

    expect(finishedLogs).toHaveLength(2);
    expect(finishedLogs.every((log) => log.status === AgentRunStatus.SUCCESS)).toBe(true);
    // The executed statement is the wrapped one — what actually hit the database.
    expect(finishedLogs[1]?.generatedSql).toContain('LIMIT 1001');
  });
});
