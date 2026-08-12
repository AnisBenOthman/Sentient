import { Injectable } from '@nestjs/common';
import { PermissionDecision } from '../../../generated/prisma';
import {
  DashboardScopeSelector,
  DownstreamRequestContext,
  DownstreamResult,
  HrCoreAiClient,
  SocialAiClient,
  isUuid,
} from '../../../common/clients';
import { KnowledgeRepository } from '../../knowledge';
import { AgentTool } from './agent-tool.types';

/**
 * WHY: Converts a typed DownstreamResult to an LLM-friendly payload.
 * Credentials and internal tracing IDs are never forwarded to Gemini.
 * A denied result becomes { denied, reason } so the LLM can explain
 * the limitation naturally without inventing data.
 */
function toolOutput<T>(result: DownstreamResult<T>): unknown {
  if (result.permissionDecision === PermissionDecision.ALLOWED && result.data != null) {
    return result.data;
  }
  if (result.permissionDecision === PermissionDecision.DENIED) {
    return { denied: true, reason: result.degradedReason ?? 'Access denied with current permissions' };
  }
  return { unavailable: true, reason: result.degradedReason ?? 'Data temporarily unavailable' };
}

const SCOPE_ARG_KEYS = ['departmentId', 'teamId', 'businessUnitId'] as const;

/**
 * WHY validate here instead of letting HR Core reject it: HR Core answers a
 * malformed uuid with HTTP 400, which HttpJsonClient flattens to the generic
 * "temporarily unavailable" degradation — the model would read an infrastructure
 * hiccup and give up, rather than a correctable mistake. A named error tells it
 * exactly how to recover, so a hallucinated `departmentId: "HR"` becomes one
 * retry through list_org_units instead of a silent fallback to global figures.
 */
function readScopeSelector(
  args: Record<string, unknown>,
): { selector: DashboardScopeSelector } | { error: string } {
  const selector: DashboardScopeSelector = {};

  for (const key of SCOPE_ARG_KEYS) {
    const raw = args[key];
    if (raw == null || raw === '') continue;
    if (typeof raw !== 'string' || !isUuid(raw)) {
      return {
        error:
          `${key} must be an id returned by list_org_units, not a name. ` +
          'Call list_org_units, find the unit whose name matches what the user asked about, and pass its id.',
      };
    }
    selector[key] = raw;
  }

  return { selector };
}

/**
 * WHY: Per-agent tool sets centralise the binding of HrCoreAiClient / SocialAiClient
 * methods to Gemini function declarations. Each tool's run() closes over the
 * DownstreamRequestContext at creation time so auth never leaks into function args.
 */
@Injectable()
export class ToolRegistryService {
  constructor(
    private readonly hrCore: HrCoreAiClient,
    private readonly social: SocialAiClient,
    private readonly knowledge: KnowledgeRepository,
  ) {}

  getLeaveTools(
    context: DownstreamRequestContext,
    employeeId: string | null,
    businessUnitId: string | null,
    includeTeamTools: boolean,
  ): AgentTool[] {
    const tools: AgentTool[] = [
      {
        declaration: {
          name: 'get_my_leave_balance',
          description:
            "Get the authenticated employee's current leave balances by type, including remaining, used, and pending days for the current year, plus recent leave request history (all statuses: approved, pending, rejected, cancelled).",
        },
        run: async (_args) => toolOutput(await this.hrCore.getLeaveContext(employeeId, context)),
      },
      {
        declaration: {
          name: 'get_holidays',
          description: "Get the company's official public and company holidays for the current year.",
        },
        run: async (_args) => toolOutput(await this.hrCore.getHolidaysContext(businessUnitId, context)),
      },
    ];

    if (includeTeamTools) {
      tools.push(
        {
          declaration: {
            name: 'get_team_leave_calendar',
            description:
              "Get the team's upcoming approved leave entries for the next 30 days. Shows who is on leave and their exact dates.",
          },
          run: async (_args) => toolOutput(await this.hrCore.getTeamLeaveContext(context)),
        },
        {
          declaration: {
            name: 'get_team_absence_summary',
            description:
              'Get a ranked summary of team members by how many distinct leave spells they have taken in the past 12 months, with approximate calendar-day totals. Useful for identifying frequent absence patterns.',
          },
          run: async (_args) => toolOutput(await this.hrCore.getTeamAbsenceSummaryContext(context)),
        },
        {
          declaration: {
            name: 'get_employees_without_leave',
            description:
              'Get the list of employees in scope who have NOT had any approved leave request overlapping the trailing 12 months. This reflects only the absence of an approved leave record — it does not mean the employee was present every day, and does not track attendance or unplanned absence. Only available to managers and HR admins.',
          },
          run: async (_args) => toolOutput(await this.hrCore.getEmployeesWithoutLeaveContext(context)),
        },
      );
    }

    return tools;
  }

  getOkrTools(context: DownstreamRequestContext, userId: string | null): AgentTool[] {
    return [
      {
        declaration: {
          name: 'get_my_objectives',
          description:
            "Get the authenticated user's current OKR objectives, their status (ACTIVE, AT_RISK, COMPLETED, etc.), and level (COMPANY, DEPARTMENT, INDIVIDUAL).",
        },
        run: async (_args) => toolOutput(await this.hrCore.getOkrContext(userId, context)),
      },
    ];
  }

  getCareerTools(context: DownstreamRequestContext, employeeId: string | null): AgentTool[] {
    return [
      {
        declaration: {
          name: 'get_my_skills',
          description:
            "Get the authenticated employee's current skills profile, including skill names, proficiency levels, and endorsements.",
        },
        run: async (_args) => toolOutput(await this.hrCore.getSkillsContext(employeeId, context)),
      },
      {
        declaration: {
          name: 'get_my_performance_reviews',
          description:
            "Get the authenticated employee's performance review history, including ratings and review periods.",
        },
        run: async (_args) => toolOutput(await this.hrCore.getPerformanceContext(context)),
      },
    ];
  }

  getAnalyticsTools(context: DownstreamRequestContext): AgentTool[] {
    /**
     * WHY a per-toolset map rather than a second HTTP lookup: the scope echo reads
     * better as "Department: Human Resources" than as a bare uuid, and the names
     * are already in hand once list_org_units has run. If the model skips that
     * lookup the map is empty and the echo falls back to the id — degraded label,
     * never a wrong one, and never an extra round trip.
     */
    const knownUnitNames = new Map<string, string>();

    return [
      {
        declaration: {
          name: 'list_org_units',
          description:
            'List the departments and teams that workforce metrics can be filtered by, with the id of each. Call this FIRST whenever the question names a group — "the HR team", "engineering", "sales department" — so you can look up that group\'s id, then pass the id to get_workforce_dashboard. This includes short follow-ups that narrow an earlier question ("i want for HR team", "and for engineering?", "what about sales"): those name a group too, and answering one without a scope id would just repeat the previous, wider numbers.',
        },
        run: async (_args) => {
          const result = await this.hrCore.getOrgUnitsContext(context);
          for (const unit of [...(result.data?.departments ?? []), ...(result.data?.teams ?? [])]) {
            knownUnitNames.set(unit.id, unit.name);
          }
          return toolOutput(result);
        },
      },
      {
        declaration: {
          name: 'get_workforce_dashboard',
          description:
            'Get workforce dashboard metrics: headcount, average age and tenure, pending leave approvals, promotions, and skills summary. Called with no arguments it returns ORGANIZATION-WIDE figures covering every department combined. To get figures for one department or team, first call list_org_units, then pass that unit\'s id here. The response always includes a "scope" object naming the population the numbers describe — report that population, never a different one.',
          parameters: {
            type: 'object',
            properties: {
              departmentId: {
                type: 'string',
                description: 'Optional department id from list_org_units. Restricts every metric to that department.',
              },
              teamId: {
                type: 'string',
                description: 'Optional team id from list_org_units. Restricts every metric to that team.',
              },
              businessUnitId: {
                type: 'string',
                description: 'Optional business unit id. Restricts every metric to that business unit.',
              },
            },
          },
        },
        run: async (args) => {
          const parsed = readScopeSelector(args);
          if ('error' in parsed) return parsed;
          const { selector } = parsed;
          return toolOutput(
            await this.hrCore.getDashboardContext(context, selector, {
              departmentName: selector.departmentId ? knownUnitNames.get(selector.departmentId) ?? null : null,
              teamName: selector.teamId ? knownUnitNames.get(selector.teamId) ?? null : null,
              businessUnitName: selector.businessUnitId ? knownUnitNames.get(selector.businessUnitId) ?? null : null,
            }),
          );
        },
      },
      {
        declaration: {
          name: 'get_team_absence_summary',
          description:
            'Get a ranked list of team members by recorded leave frequency over the past 12 months — spell count and approximate calendar days per person. Only available to managers and HR admins.',
        },
        run: async (_args) => toolOutput(await this.hrCore.getTeamAbsenceSummaryContext(context)),
      },
      {
        declaration: {
          name: 'get_employees_without_leave',
          description:
            'Get the list of employees in scope who have NOT had any approved leave request overlapping the trailing 12 months. This reflects only the absence of an approved leave record — it does not mean the employee was present every day, and does not track attendance or unplanned absence. Only available to managers and HR admins.',
        },
        run: async (_args) => toolOutput(await this.hrCore.getEmployeesWithoutLeaveContext(context)),
      },
      {
        declaration: {
          name: 'get_kpi_threshold_alerts',
          description:
            'Check which dashboard KPI cards have crossed their configured warning or critical thresholds. Returns alerts with the metric name, current value, severity (WARNING or CRITICAL), and the threshold that was crossed. Use this when asked about KPI risk, dashboard alerts, which metrics are critical, or which cards are in a warning or critical state.',
        },
        run: async (_args) => toolOutput(await this.hrCore.getKpiAlertsContext(context)),
      },
    ];
  }

  getOnboardingTools(context: DownstreamRequestContext): AgentTool[] {
    return [
      {
        declaration: {
          name: 'get_onboarding_guides',
          description:
            "Get onboarding guide documents from the company's document library, including first-week checklists, IT setup guides, and company orientation materials.",
        },
        run: async (_args) => toolOutput(await this.social.getOnboardingContext(context)),
      },
    ];
  }

  getGeneralHelpTools(context: DownstreamRequestContext): AgentTool[] {
    return [
      {
        declaration: {
          name: 'get_policy_knowledge',
          description:
            "Get internal HR policy documents from the company's document library. Use this to answer questions about HR policies, procedures, and guidelines.",
        },
        run: async (_args) => toolOutput(await this.social.getPolicyKnowledge(context)),
      },
      {
        declaration: {
          name: 'search_knowledge_base',
          description:
            'Search the approved knowledge base for articles matching a query. Useful for finding specific policy answers, FAQs, or guidance on a topic.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query, e.g. "parental leave policy" or "remote work guidelines"' },
            },
            required: ['query'],
          },
        },
        run: async (args) => {
          const query = typeof args['query'] === 'string' ? args['query'] : '';
          const matches = await this.knowledge.searchApproved(query, 3);
          if (matches.length === 0) {
            return { found: false, message: 'No matching knowledge articles found for this query.' };
          }
          return {
            found: true,
            articles: matches.map((m) => ({
              title: m.item?.title ?? `Knowledge document ${m.document.chunkIndex + 1}`,
              excerpt: m.document.content.slice(0, 600),
            })),
          };
        },
      },
    ];
  }
}
