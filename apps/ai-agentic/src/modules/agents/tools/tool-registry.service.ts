import { Injectable } from '@nestjs/common';
import { PermissionDecision } from '../../../generated/prisma';
import { DownstreamRequestContext, DownstreamResult, HrCoreAiClient, SocialAiClient } from '../../../common/clients';
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
            "Get the authenticated employee's current leave balances by type, including remaining, used, and pending days for the current year, plus recent approved leave history.",
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
    return [
      {
        declaration: {
          name: 'get_workforce_dashboard',
          description:
            'Get scoped workforce dashboard metrics: headcount (total, active, on leave, on probation), pending leave approvals, and skills summary (tracked skills, top skill, average score).',
        },
        run: async (_args) => toolOutput(await this.hrCore.getDashboardContext(context)),
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
