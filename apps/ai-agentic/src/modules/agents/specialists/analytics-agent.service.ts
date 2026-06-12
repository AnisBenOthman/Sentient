import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { DashboardAiContext, HrCoreAiClient, TeamAbsenceSummaryContext } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

const ABSENCE_INTENT_PATTERN =
  /\b(absent|absence|absences|absentee|always\s+(out|off|away|missing)|frequently\s+(out|off|away)|most\s+(absent|leave|days\s+off)|who.{0,30}miss|miss.{0,20}most|attendance|time\s+off\s+most|days\s+off\s+most|keep\s+(taking|having)\s+leave)\b/i;

@Injectable()
export class AnalyticsAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ANALYTICS_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    if (ABSENCE_INTENT_PATTERN.test(input.normalizedIntent)) {
      return this.handleAbsenceSummaryQuery(input);
    }
    return this.handleDashboardQuery(input);
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
