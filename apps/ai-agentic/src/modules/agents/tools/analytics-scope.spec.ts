import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../../generated/prisma';
import {
  DownstreamRequestContext,
  DownstreamResult,
  HrCoreAiClient,
  HttpJsonClient,
  ScopedDashboardAiContext,
  SocialAiClient,
} from '../../../common/clients';
import { KnowledgeRepository } from '../../knowledge';
import { AgentTool } from './agent-tool.types';
import { ToolRegistryService } from './tool-registry.service';

const HR_DEPARTMENT_ID = '11111111-2222-4333-8444-555555555555';
const PLATFORM_TEAM_ID = '99999999-8888-4777-8666-555555555555';

const context: DownstreamRequestContext = { jwt: 'jwt-token', correlationId: 'corr-1' };

/** Company-wide dashboard payload — the shape HR Core returns for an unqualified call. */
const GLOBAL_DASHBOARD = {
  employees: { total: 201, active: 177 },
  leave: { pendingApprovals: 9 },
  skills: { skillsTracked: 42, topSkill: 'FP&A', averageScore: 3.5 },
};

/** The same endpoint, narrowed to one department — deliberately different numbers. */
const DEPARTMENT_DASHBOARD = {
  employees: { total: 14, active: 12 },
  leave: { pendingApprovals: 1 },
  skills: { skillsTracked: 6, topSkill: 'FP&A', averageScore: 3.5 },
};

interface StubOptions {
  denyTeams?: boolean;
  departmentsNextCursor?: string | null;
}

function buildStubs(paths: string[], options: StubOptions = {}) {
  const config = { get: (): string => 'http://hr-core.local' } as unknown as ConfigService;

  const http = {
    get: async <TData>(
      _baseUrl: string,
      path: string,
      _requestContext: DownstreamRequestContext,
      sourceType: string,
      sourceTitle: string,
    ): Promise<DownstreamResult<TData>> => {
      paths.push(path);

      const deny = <T>(): DownstreamResult<T> => ({
        data: null,
        permissionDecision: PermissionDecision.DENIED,
        degradedReason: 'Caller is not allowed to access this context.',
        sourceType,
        sourceTitle,
      });

      if (path.startsWith('/teams') && options.denyTeams) return deny<TData>();

      const body = path.startsWith('/departments')
        ? {
            data: [
              { id: HR_DEPARTMENT_ID, name: 'Human Resources', code: 'HR' },
              { id: '22222222-3333-4444-8555-666666666666', name: 'Engineering', code: 'ENG' },
            ],
            nextCursor: options.departmentsNextCursor ?? null,
          }
        : path.startsWith('/teams')
          ? { data: [{ id: PLATFORM_TEAM_ID, name: 'Platform', departmentId: HR_DEPARTMENT_ID }], nextCursor: null }
          : path.includes('departmentId=') || path.includes('teamId=')
            ? DEPARTMENT_DASHBOARD
            : GLOBAL_DASHBOARD;

      return {
        data: body as TData,
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType,
        sourceTitle,
      };
    },
  } as unknown as HttpJsonClient;

  return { hrCore: new HrCoreAiClient(config, http), config };
}

function toolNamed(tools: AgentTool[], name: string): AgentTool {
  const tool = tools.find((candidate) => candidate.declaration.name === name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  return tool;
}

function buildRegistry(hrCore: HrCoreAiClient): ToolRegistryService {
  return new ToolRegistryService(
    hrCore,
    {} as unknown as SocialAiClient,
    {} as unknown as KnowledgeRepository,
  );
}

describe('analytics scope selection', () => {
  describe('HrCoreAiClient.getDashboardContext', () => {
    it('forwards departmentId to HR Core so the numbers are actually narrowed', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);

      const result = await hrCore.getDashboardContext(context, { departmentId: HR_DEPARTMENT_ID });

      expect(paths).toEqual([`/analytics/dashboard?departmentId=${HR_DEPARTMENT_ID}`]);
      expect(result.data?.employees?.total).toBe(14);
    });

    it('labels an unscoped result as organization-wide rather than leaving scope unstated', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);

      const result = await hrCore.getDashboardContext(context);

      expect(paths).toEqual(['/analytics/dashboard']);
      expect(result.data?.scope.level).toBe('ORGANIZATION');
      expect(result.data?.scope.label).toContain('Entire organization');
      expect(result.data?.employees?.total).toBe(201);
    });

    it('names the department in the scope echo when the name is known', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);

      const result = await hrCore.getDashboardContext(
        context,
        { departmentId: HR_DEPARTMENT_ID },
        { departmentName: 'Human Resources' },
      );

      expect(result.data?.scope).toEqual({
        level: 'DEPARTMENT',
        label: 'Department: Human Resources',
        departmentId: HR_DEPARTMENT_ID,
        teamId: null,
        businessUnitId: null,
      });
    });

    it('reports TEAM level when a team id is supplied alongside a department id', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);

      const result = await hrCore.getDashboardContext(context, {
        departmentId: HR_DEPARTMENT_ID,
        teamId: PLATFORM_TEAM_ID,
      });

      expect(result.data?.scope.level).toBe('TEAM');
      expect(paths[0]).toContain(`teamId=${PLATFORM_TEAM_ID}`);
    });
  });

  describe('HrCoreAiClient.getOrgUnitsContext', () => {
    it('returns departments and teams with ids', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);

      const result = await hrCore.getOrgUnitsContext(context);

      expect(paths).toContain('/departments?limit=200');
      expect(paths).toContain('/teams?limit=200');
      expect(result.data?.departments).toContainEqual({ id: HR_DEPARTMENT_ID, name: 'Human Resources', code: 'HR' });
      expect(result.data?.listIncomplete).toBe(false);
    });

    it('flags an incomplete list when teams are not visible, so absence is never read as non-existence', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths, { denyTeams: true });

      const result = await hrCore.getOrgUnitsContext(context);

      expect(result.data?.teams).toEqual([]);
      expect(result.data?.listIncomplete).toBe(true);
      expect(result.data?.incompleteReason).toContain('team list is not visible');
    });

    it('flags an incomplete list when more departments exist beyond the page', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths, { departmentsNextCursor: 'cursor-2' });

      const result = await hrCore.getOrgUnitsContext(context);

      expect(result.data?.listIncomplete).toBe(true);
      expect(result.data?.incompleteReason).toContain('More departments exist');
    });
  });

  describe('get_workforce_dashboard tool', () => {
    it('rejects a name in place of an id and tells the model how to recover', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);
      const tools = buildRegistry(hrCore).getAnalyticsTools(context);

      const output = await toolNamed(tools, 'get_workforce_dashboard').run({ departmentId: 'HR' });

      expect(output).toEqual({
        error: expect.stringContaining('list_org_units') as unknown as string,
      });
      // WHY: no HTTP call at all — HR Core would answer a bad uuid with a 400 that
      // flattens to "temporarily unavailable", hiding a correctable mistake.
      expect(paths).toEqual([]);
    });

    it('scopes the dashboard when given an id from list_org_units, and names the unit', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);
      const tools = buildRegistry(hrCore).getAnalyticsTools(context);

      await toolNamed(tools, 'list_org_units').run({});
      const output = (await toolNamed(tools, 'get_workforce_dashboard').run({
        departmentId: HR_DEPARTMENT_ID,
      })) as ScopedDashboardAiContext;

      expect(output.scope.label).toBe('Department: Human Resources');
      expect(output.employees?.total).toBe(14);
      expect(paths).toContain(`/analytics/dashboard?departmentId=${HR_DEPARTMENT_ID}`);
    });

    it('still declares organization scope when called with no arguments', async () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);
      const tools = buildRegistry(hrCore).getAnalyticsTools(context);

      const output = (await toolNamed(tools, 'get_workforce_dashboard').run({})) as ScopedDashboardAiContext;

      expect(output.scope.level).toBe('ORGANIZATION');
      expect(output.employees?.total).toBe(201);
    });

    it('exposes the scope parameters to the model', () => {
      const paths: string[] = [];
      const { hrCore } = buildStubs(paths);
      const tools = buildRegistry(hrCore).getAnalyticsTools(context);

      const properties = toolNamed(tools, 'get_workforce_dashboard').declaration.parameters?.properties ?? {};

      expect(Object.keys(properties).sort()).toEqual(['businessUnitId', 'departmentId', 'teamId']);
    });
  });
});
