import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class OnboardingAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ONBOARDING_AGENT;

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    return deterministicResult(
      input,
      this.agentType,
      'Onboarding guidance prepared.',
      'For onboarding, I can welcome new hires, outline first-week steps, and explain manager or HR onboarding progress where you have access. This scaffold does not change onboarding records.',
      'ONBOARDING',
      'Onboarding context',
    );
  }
}
