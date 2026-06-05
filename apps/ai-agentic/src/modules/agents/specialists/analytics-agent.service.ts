import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
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
      : 'Analytics answers are for managers and HR users with scoped dashboard access. I can explain trends, coverage, review status, skill gaps, and workforce metrics without exposing private conversation content.';
    return downstreamResult(input, this.agentType, context, 'Analytics explanation prepared.', content, {
      draftLabel: 'Workforce insight draft',
    });
  }
}
