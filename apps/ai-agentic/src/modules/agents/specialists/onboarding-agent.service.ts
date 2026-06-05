import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class OnboardingAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ONBOARDING_AGENT;

  constructor(private readonly social: SocialAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.social.getOnboardingContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    return downstreamResult(
      input,
      this.agentType,
      context,
      'Onboarding guidance prepared.',
      'For onboarding, I can welcome new hires, outline first-week steps, and explain manager or HR onboarding progress where you have access. This scaffold does not change onboarding records.',
    );
  }
}
