import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../../generated/prisma';
import { FinalAnswerPolicyService } from '../../../common/safety';
import { FinalAnswerResult, HumanEscalationResult, SpecialistResult } from '../../../common/graph';
import { SourceContext } from '../../../common/dto';

interface ComposeInput {
  guardrailMessage?: string | null;
  /** Guardrail status to surface when the turn ends on a guardrail message (REFUSED vs OUT_OF_SCOPE). */
  guardrailStatus?: AgentRunStatus | null;
  /** Deterministic policy refusal (e.g., draft mutation block) composed without specialists. */
  policyRefusalMessage?: string | null;
  clarificationQuestion?: string | null;
  specialistResults: SpecialistResult[];
  escalation?: HumanEscalationResult | null;
  declinedTopics?: string[];
  isDraft: boolean;
}

const FAILED_SPECIALIST_STATUSES: AgentRunStatus[] = [
  AgentRunStatus.DEGRADED,
  AgentRunStatus.REFUSED,
  AgentRunStatus.FAILED,
];

@Injectable()
export class FinalAnswerNodeService {
  constructor(private readonly finalPolicy: FinalAnswerPolicyService) {}

  compose(input: ComposeInput): FinalAnswerResult {
    const contentParts: string[] = [];
    const sourceContext: SourceContext[] = [];

    if (input.policyRefusalMessage) contentParts.push(input.policyRefusalMessage);
    if (input.guardrailMessage) contentParts.push(input.guardrailMessage);
    if (input.clarificationQuestion) contentParts.push(input.clarificationQuestion);
    for (const result of input.specialistResults) {
      contentParts.push(result.userVisibleContent);
      sourceContext.push(...result.sourceContext);
    }
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

  /**
   * WHY: The turn status feeds the governance refusal/degraded metrics (FR-021)
   * and the stored assistant-message status. A turn with refused or degraded
   * specialist portions, or with declined mixed topics, must not report SUCCESS,
   * and a guardrail refusal must keep its REFUSED status instead of collapsing
   * into OUT_OF_SCOPE.
   */
  private statusFrom(input: ComposeInput): AgentRunStatus {
    if (input.escalation) return AgentRunStatus.ESCALATED;
    if (input.policyRefusalMessage) return AgentRunStatus.REFUSED;
    if (input.clarificationQuestion) return AgentRunStatus.PARTIAL;
    if (input.specialistResults.length > 0) {
      const failed = input.specialistResults.filter((result) =>
        FAILED_SPECIALIST_STATUSES.includes(result.status),
      );
      if (failed.length === input.specialistResults.length) {
        return failed.every((result) => result.status === AgentRunStatus.REFUSED)
          ? AgentRunStatus.REFUSED
          : AgentRunStatus.DEGRADED;
      }
      const anyNonSuccess = input.specialistResults.some(
        (result) => result.status !== AgentRunStatus.SUCCESS,
      );
      if (anyNonSuccess || (input.declinedTopics?.length ?? 0) > 0) return AgentRunStatus.PARTIAL;
      return AgentRunStatus.SUCCESS;
    }
    if (input.guardrailMessage) return input.guardrailStatus ?? AgentRunStatus.OUT_OF_SCOPE;
    return AgentRunStatus.SUCCESS;
  }
}
