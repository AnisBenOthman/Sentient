import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class OkrAgentService implements SpecialistAgent {
  readonly agentType = AgentType.OKR_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getOkrContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const content = input.isDraftRequest
      ? 'Draft OKR: Objective - improve a focused Sentient work outcome this quarter. Key results - define one measurable quality metric, one delivery metric, and one stakeholder-feedback metric before submitting in OKRs.'
      : 'For OKRs, focus on the active company or department objective, choose a measurable outcome, and keep key results verifiable. I can explain alignment, progress, and risk within your Sentient scope.';
    return downstreamResult(input, this.agentType, context, 'OKR guidance prepared.', content, {
      draftLabel: 'OKR draft',
    });
  }
}
