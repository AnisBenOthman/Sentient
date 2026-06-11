import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../generated/prisma';
import { AgentGuardrailService } from './agent-guardrail.service';
import { redactSensitiveText } from './redaction.util';
import { FinalAnswerPolicyResult } from './safety.types';

const REFUSAL_LIKE_STATUSES: AgentRunStatus[] = [
  AgentRunStatus.REFUSED,
  AgentRunStatus.ESCALATED,
  AgentRunStatus.OUT_OF_SCOPE,
];

@Injectable()
export class FinalAnswerPolicyService {
  constructor(private readonly guardrails: AgentGuardrailService) {}

  /**
   * WHY: This is the FR-034 output backstop. It reuses the input guardrail's
   * pattern sets (instead of maintaining a second regex library) and only
   * sweeps content that claims to be a normal answer — refusal and escalation
   * messages legitimately mention the sensitive topics they decline.
   */
  review(content: string, options?: { isDraft?: boolean; status?: AgentRunStatus }): FinalAnswerPolicyResult {
    const warnings: string[] = [];
    let status = options?.status ?? AgentRunStatus.SUCCESS;
    let nextContent = content.trim();

    if (!REFUSAL_LIKE_STATUSES.includes(status)) {
      if (this.guardrails.matchesUnauthorizedData(nextContent)) {
        nextContent =
          'I cannot share private employee information that is outside your Sentient permissions. I can help with your own records or with summaries you are authorized to view.';
        status = AgentRunStatus.REFUSED;
        warnings.push('Unauthorized data reference removed from final answer.');
      } else if (this.guardrails.matchesInterpersonalJudgment(nextContent)) {
        nextContent =
          'I cannot judge another person. Please contact your manager, HR business partner, or People team for support.';
        status = AgentRunStatus.REFUSED;
        warnings.push('Personal judgment removed from final answer.');
      }
    }

    const redacted = redactSensitiveText(nextContent);
    if (redacted !== nextContent) {
      nextContent = redacted;
      warnings.push('Sensitive identifiers redacted from final answer.');
    }

    if (options?.isDraft && !/^draft/i.test(nextContent)) {
      nextContent = `Draft - please review before use.\n\n${nextContent}`;
      warnings.push('Draft label added.');
    }

    if (options?.isDraft && !/review before/i.test(nextContent)) {
      nextContent = `${nextContent}\n\nPlease review this draft before copying it into any official Sentient workflow.`;
      warnings.push('Human review reminder added.');
    }

    if (nextContent.length === 0) {
      nextContent = 'I could not produce a safe Sentient-scoped answer for this request.';
      warnings.push('Empty answer replaced.');
    }

    return {
      content: nextContent,
      status,
      warnings,
    };
  }
}
