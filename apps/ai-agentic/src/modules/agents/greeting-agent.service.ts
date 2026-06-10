import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../generated/prisma';
import { FinalAnswerResult } from '../../common/graph';

@Injectable()
export class GreetingAgentService {
  compose(): FinalAnswerResult {
    return {
      status: AgentRunStatus.SUCCESS,
      content:
        'Hi. How can I help you with Sentient today? I can help with leave, OKRs, career growth, analytics, onboarding, policy, or workplace wording.',
      sourceContext: [],
      routingSummary: 'Greeting handled by the supervisor greeting agent.',
    };
  }
}
