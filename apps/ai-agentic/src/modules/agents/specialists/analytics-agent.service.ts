import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class AnalyticsAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ANALYTICS_AGENT;

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const content = input.isDraftRequest
      ? 'Draft workforce insight summary: state the metric, scope, observed trend, possible business impact, and one question for HR or the manager to validate before action.'
      : 'Analytics answers are for managers and HR users with scoped dashboard access. I can explain trends, coverage, review status, skill gaps, and workforce metrics without exposing private conversation content.';
    return deterministicResult(input, this.agentType, 'Analytics explanation prepared.', content, 'DASHBOARD', 'Dashboard analytics', {
      draftLabel: 'Workforce insight draft',
    });
  }
}
