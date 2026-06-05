import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class OkrAgentService implements SpecialistAgent {
  readonly agentType = AgentType.OKR_AGENT;

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const content = input.isDraftRequest
      ? 'Draft OKR: Objective - improve a focused Sentient work outcome this quarter. Key results - define one measurable quality metric, one delivery metric, and one stakeholder-feedback metric before submitting in OKRs.'
      : 'For OKRs, focus on the active company or department objective, choose a measurable outcome, and keep key results verifiable. I can explain alignment, progress, and risk within your Sentient scope.';
    return deterministicResult(input, this.agentType, 'OKR guidance prepared.', content, 'OKR', 'OKR context', {
      draftLabel: 'OKR draft',
    });
  }
}
