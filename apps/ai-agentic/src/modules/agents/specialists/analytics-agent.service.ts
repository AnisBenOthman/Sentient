import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { DashboardAiContext, HrCoreAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class AnalyticsAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ANALYTICS_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
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
}
