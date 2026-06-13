import { Injectable, Optional } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DashboardAiContext, DownstreamRequestContext, HrCoreAiClient, KpiAlertContext, TeamAbsenceSummaryContext } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  GeminiToolCallerService,
  GeminiToolCallOutcome,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { downstreamResult } from './specialist-response.helpers';

const ABSENCE_INTENT_PATTERN =
  /\b(absent|absence|absences|absentee|always\s+(out|off|away|missing)|frequently\s+(out|off|away)|most\s+(absent|leave|days\s+off)|who.{0,30}miss|miss.{0,20}most|attendance|time\s+off\s+most|days\s+off\s+most|keep\s+(taking|having)\s+leave)\b/i;

const KPI_RISK_PATTERN =
  /\b(kpi|kpis|threshold|thresholds|alert|alerts|critical|warning|dashboard\s+card|metric|metrics|risk)\b/i;

const ANALYTICS_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient HR analytics assistant. Use the provided tools to answer workforce metrics questions with real data:
- Call get_workforce_dashboard for headcount, pending leave approvals, or skills metrics.
- Call get_team_absence_summary for questions about who is frequently absent, who takes the most leave, or absence frequency.
- Call get_kpi_threshold_alerts for questions about KPI risk, dashboard alerts, which metrics are in a critical or warning state, or which dashboard cards are red or orange.
The tools calculate the numbers — your job is to narrate and interpret results clearly. For absence data, always note it reflects only approved, recorded leave — not unplanned absences or no-shows.

${CONVERSATIONAL_STYLE}`;

@Injectable()
export class AnalyticsAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ANALYTICS_AGENT;

  constructor(
    private readonly hrCore: HrCoreAiClient,
    @Optional() private readonly geminiToolCaller?: GeminiToolCallerService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    if (this.geminiToolCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getAnalyticsTools(reqContext);
      const systemPrompt = input.isDraftRequest
        ? `${ANALYTICS_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : ANALYTICS_SYSTEM_PROMPT;
      const outcome = await this.geminiToolCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
        { thinkingLevel: 'high' },
      );
      if (outcome) return this.toToolCallerResult(input, outcome);
    }

    if (ABSENCE_INTENT_PATTERN.test(input.normalizedIntent)) {
      return this.handleAbsenceSummaryQuery(input);
    }
    if (KPI_RISK_PATTERN.test(input.normalizedIntent)) {
      return this.handleKpiRiskQuery(input);
    }
    return this.handleDashboardQuery(input);
  }

  private toToolCallerResult(input: SpecialistInput, outcome: GeminiToolCallOutcome): SpecialistResult {
    const limited = outcome.anyToolDenied || outcome.anyToolFailed;
    return {
      agentType: this.agentType,
      status: limited ? AgentRunStatus.DEGRADED : AgentRunStatus.SUCCESS,
      summary: limited ? 'Analytics prepared with limited data access.' : 'Analytics explanation prepared.',
      userVisibleContent: outcome.answer,
      sourceContext: [{
        sourceType: 'ANALYTICS',
        title: 'Workforce analytics',
        referenceId: `analytics:${outcome.toolsUsed.join('+') || 'dashboard'}`,
      }],
      permissionDecision: outcome.anyToolDenied
        ? PermissionDecision.DENIED
        : outcome.anyToolFailed
          ? PermissionDecision.PARTIAL
          : PermissionDecision.ALLOWED,
      draftLabel: input.isDraftRequest ? 'Workforce insight draft' : undefined,
    };
  }

  private async handleDashboardQuery(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getDashboardContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const content = input.isDraftRequest
      ? 'Draft workforce insight summary: state the metric, scope, observed trend, possible business impact, and one question for HR or the manager to validate before action.'
      : this.describeDashboard(context.data);
    return downstreamResult(input, this.agentType, context, 'Analytics explanation prepared.', content, {
      draftLabel: 'Workforce insight draft',
    });
  }

  private async handleAbsenceSummaryQuery(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getTeamAbsenceSummaryContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const content = input.isDraftRequest
      ? 'Draft team absence summary: identify who has the most recorded leave spells in the past 12 months, note that this reflects approved leave only (not unplanned absence), and suggest one follow-up action for the manager.'
      : this.describeAbsenceSummary(context.data);
    return downstreamResult(input, this.agentType, context, 'Team absence summary prepared.', content, {
      draftLabel: 'Team absence summary draft',
    });
  }

  private async handleKpiRiskQuery(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getKpiAlertsContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const content = this.describeKpiAlerts(context.data);
    return downstreamResult(input, this.agentType, context, 'KPI threshold assessment prepared.', content, {
      draftLabel: undefined,
    });
  }

  /**
   * WHY: FR-038 requires interpreting the caller's scoped workforce stats, not
   * describing what analytics could do. HR Core already scope-filters the
   * dashboard payload by the caller's JWT, so headline figures are safe to
   * repeat. Salary figures are intentionally excluded from assistant answers.
   */
  private describeDashboard(context: DashboardAiContext | null): string {
    if (!context) {
      return 'I could not read the dashboard data right now. You can open the Dashboard module directly, or ask me again later for headcount, leave, and skills highlights.';
    }

    const lines: string[] = ['Here are your scoped workforce highlights:'];
    const employees = context.employees;
    if (employees && typeof employees.total === 'number') {
      const segments: string[] = [`${employees.total} total`];
      if (typeof employees.active === 'number') segments.push(`${employees.active} active`);
      if (typeof employees.onLeave === 'number') segments.push(`${employees.onLeave} on leave`);
      if (typeof employees.probation === 'number') segments.push(`${employees.probation} on probation`);
      lines.push(`- Headcount: ${segments.join(', ')}.`);
    }
    const leave = context.leave;
    if (leave && typeof leave.pendingApprovals === 'number') {
      lines.push(`- Leave: ${leave.pendingApprovals} pending approval${leave.pendingApprovals === 1 ? '' : 's'}.`);
    }
    const skills = context.skills;
    if (skills && typeof skills.skillsTracked === 'number') {
      const top = skills.topSkill ? `, top skill ${skills.topSkill}` : '';
      const average = typeof skills.averageScore === 'number' ? `, average score ${skills.averageScore}` : '';
      lines.push(`- Skills: ${skills.skillsTracked} tracked${top}${average}.`);
    }

    if (lines.length === 1) {
      return 'The dashboard responded but no headline metrics were available for your scope. Open the Dashboard module for the full charts, or narrow your question to headcount, leave, or skills.';
    }
    lines.push('Open the Dashboard module for trends and charts; I can explain any specific metric.');
    return lines.join('\n');
  }

  private describeKpiAlerts(context: KpiAlertContext | null): string {
    if (!context) {
      return 'I could not retrieve your KPI threshold configuration right now. You can open the Dashboard and Settings modules to review configured thresholds and current values.';
    }
    if (context.checkedCount === 0 && context.alerts.length === 0) {
      return 'No KPI thresholds have been configured yet. Your HR admin can set warning and critical thresholds for each dashboard metric in Settings → Dashboard Alert Thresholds.';
    }
    const criticalAlerts = context.alerts.filter((a) => a.severity === 'CRITICAL');
    const warningAlerts = context.alerts.filter((a) => a.severity === 'WARNING');

    if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
      const uncheckedNote = context.uncheckedMetrics.length > 0
        ? ` (${context.uncheckedMetrics.join(', ')} ${context.uncheckedMetrics.length === 1 ? 'has' : 'have'} no current data available)`
        : '';
      return `All ${context.checkedCount} monitored KPI${context.checkedCount === 1 ? '' : 's'} are within their configured thresholds${uncheckedNote}. Open the Dashboard module to review current metric values.`;
    }

    const lines: string[] = [];

    if (criticalAlerts.length > 0) {
      lines.push(`${criticalAlerts.length} critical KPI alert${criticalAlerts.length === 1 ? '' : 's'}:`);
      for (const alert of criticalAlerts) {
        const direction = alert.direction === 'ABOVE' ? `≥ ${alert.threshold}` : `≤ ${alert.threshold}`;
        lines.push(`  - ${alert.label}: current value is ${alert.currentValue} (critical threshold is ${direction})`);
      }
    }

    if (warningAlerts.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push(`${warningAlerts.length} warning KPI alert${warningAlerts.length === 1 ? '' : 's'}:`);
      for (const alert of warningAlerts) {
        const direction = alert.direction === 'ABOVE' ? `≥ ${alert.threshold}` : `≤ ${alert.threshold}`;
        lines.push(`  - ${alert.label}: current value is ${alert.currentValue} (warning threshold is ${direction})`);
      }
    }

    if (context.uncheckedMetrics.length > 0) {
      lines.push('');
      lines.push(`No current data available for: ${context.uncheckedMetrics.join(', ')}.`);
    }

    lines.push('');
    lines.push('Open the Dashboard module for full metric charts and trend details, or review threshold settings in Settings → Dashboard Alert Thresholds.');

    return lines.join('\n');
  }

  /**
   * WHY: Absence frequency answers must be factual and honest about data limits.
   * The system only records approved leave — unplanned/unexcused absences are not
   * tracked. Presenting "most absent" without this caveat would be misleading.
   */
  private describeAbsenceSummary(context: TeamAbsenceSummaryContext | null): string {
    if (!context) {
      return 'I could not retrieve leave data for your team right now. You can open the Leave Management module to view the team calendar directly.';
    }
    if (context.entries.length === 0) {
      return `No approved leave was recorded for your team between ${context.windowStart} and ${context.windowEnd}. If you are concerned about unplanned absences, those are not tracked in this system — please check with your HR admin.`;
    }
    const top = context.entries.slice(0, 5);
    const lines: string[] = [
      `Here are your team members ranked by recorded leave frequency (${context.windowStart} to ${context.windowEnd}):`,
      '',
      ...top.map(
        (e, i) =>
          `${i + 1}. ${e.employeeName} — ${e.spells} leave spell${e.spells === 1 ? '' : 's'}, approx. ${e.calendarDays} calendar day${e.calendarDays === 1 ? '' : 's'}`,
      ),
      '',
      'This reflects approved, recorded leave only — not unplanned or unexcused absence. The system does not track attendance or no-shows. If attendance is a concern, please follow up directly with those employees or consult HR.',
    ];
    return lines.join('\n');
  }
}
