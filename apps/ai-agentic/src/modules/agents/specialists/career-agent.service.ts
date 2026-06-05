import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class CareerAgentService implements SpecialistAgent {
  readonly agentType = AgentType.CAREER_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getSkillsContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const lower = input.normalizedIntent.toLowerCase();
    const content = input.isDraftRequest
      ? this.draftContent(lower)
      : 'Career support can cover growth paths, skill gaps, review preparation, learning focus, and next-step planning using only accessible Sentient context.';
    return downstreamResult(input, this.agentType, context, 'Career guidance prepared.', content, {
      draftLabel: 'Career draft',
    });
  }

  private draftContent(lower: string): string {
    if (lower.includes('manager feedback') || lower.includes('review feedback')) {
      return 'Draft manager feedback: start with observed facts, name the impact, recognize strengths, suggest one improvement, and agree on a follow-up. Review for fairness and context before sharing.';
    }
    if (lower.includes('self-review') || lower.includes('self review')) {
      return 'Draft self-review note: summarize outcomes, evidence, lessons learned, skill growth, and one development next step. Review it before adding it to an official review.';
    }
    return 'Draft development note: describe the growth goal, current strengths, one skill gap, support needed from the manager, and a concrete next step. Review it before adding it to any official review workflow.';
  }
}
