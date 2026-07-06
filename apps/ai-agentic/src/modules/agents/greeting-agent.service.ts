import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../generated/prisma';
import { FinalAnswerResult } from '../../common/graph';

@Injectable()
export class GreetingAgentService {
  compose(userMessage = ''): FinalAnswerResult {
    const content = this.isFrenchGreeting(userMessage)
      ? "Bonjour. Comment puis-je vous aider avec Sentient aujourd'hui ? Je peux vous aider avec les conges, les OKR, la carriere, les analyses RH, l'onboarding, les politiques ou la formulation professionnelle."
      : 'Hi. How can I help you with Sentient today? I can help with leave, OKRs, career growth, analytics, onboarding, policy, or workplace wording.';

    return {
      status: AgentRunStatus.SUCCESS,
      content,
      sourceContext: [],
      routingSummary: 'Greeting handled by the supervisor greeting agent.',
    };
  }

  private isFrenchGreeting(userMessage: string): boolean {
    return /^\s*(bonjour|bonsoir|salut|coucou|(?:ca|\u00e7a)\s+va|comment\s+(?:ca|\u00e7a)\s+va|comment\s+allez-vous|comment\s+vas-tu)\s*[?!.]?\s*$/i.test(
      userMessage,
    );
  }
}
