import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../../generated/prisma';
import { FinalAnswerPolicyService } from '../../../common/safety';
import { FinalAnswerResult, HumanEscalationResult, SpecialistResult } from '../../../common/graph';
import { SourceContext } from '../../../common/dto';

@Injectable()
export class FinalAnswerNodeService {
  constructor(private readonly finalPolicy: FinalAnswerPolicyService) {}

  compose(input: {
    guardrailMessage?: string | null;
    clarificationQuestion?: string | null;
    specialistResults: SpecialistResult[];
    escalation?: HumanEscalationResult | null;
    declinedTopics?: string[];
    isDraft: boolean;
  }): FinalAnswerResult {
    const contentParts: string[] = [];
    const sourceContext: SourceContext[] = [];

    if (input.guardrailMessage) contentParts.push(input.guardrailMessage);
    if (input.clarificationQuestion) contentParts.push(input.clarificationQuestion);
    for (const result of input.specialistResults) {
      contentParts.push(result.userVisibleContent);
      sourceContext.push(...result.sourceContext);
    }
    if (input.escalation) contentParts.push(input.escalation.nextStep);
    if (input.declinedTopics?.length) {
      contentParts.push(`I left aside: ${input.declinedTopics.join(', ')}.`);
    }

    const rawContent = contentParts.join('\n\n');
    const status = this.statusFrom(input);
    const reviewed = this.finalPolicy.review(rawContent, { isDraft: input.isDraft, status });

    return {
      status: reviewed.status,
      content: reviewed.content,
      sourceContext,
      routingSummary: input.specialistResults.map((result) => result.agentType).join(' -> '),
    };
  }

  private statusFrom(input: {
    clarificationQuestion?: string | null;
    specialistResults: SpecialistResult[];
    escalation?: HumanEscalationResult | null;
    guardrailMessage?: string | null;
  }): AgentRunStatus {
    if (input.escalation) return AgentRunStatus.ESCALATED;
    if (input.clarificationQuestion) return AgentRunStatus.PARTIAL;
    if (input.specialistResults.length > 0) {
      return input.specialistResults.some((result) => result.status === AgentRunStatus.PARTIAL)
        ? AgentRunStatus.PARTIAL
        : AgentRunStatus.SUCCESS;
    }
    if (input.guardrailMessage) return AgentRunStatus.OUT_OF_SCOPE;
    return AgentRunStatus.SUCCESS;
  }
}
