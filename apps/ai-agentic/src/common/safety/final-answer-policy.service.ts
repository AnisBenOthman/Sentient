import { Injectable } from '@nestjs/common';
import { AgentRunStatus } from '../../generated/prisma';
import { FinalAnswerPolicyResult } from './safety.types';

@Injectable()
export class FinalAnswerPolicyService {
  review(content: string, options?: { isDraft?: boolean; status?: AgentRunStatus }): FinalAnswerPolicyResult {
    const warnings: string[] = [];
    let nextContent = content.trim();

    if (options?.isDraft && !/^draft/i.test(nextContent)) {
      nextContent = `Draft - please review before use.\n\n${nextContent}`;
      warnings.push('Draft label added.');
    }

    if (options?.isDraft && !/review before/i.test(nextContent)) {
      nextContent = `${nextContent}\n\nPlease review this draft before copying it into any official Sentient workflow.`;
      warnings.push('Human review reminder added.');
    }

    if (/what do you think about .*colleague/i.test(nextContent)) {
      nextContent = 'I cannot judge another person. Please contact your manager, HR business partner, or People team for support.';
      warnings.push('Personal judgment removed.');
    }

    if (nextContent.length === 0) {
      nextContent = 'I could not produce a safe Sentient-scoped answer for this request.';
      warnings.push('Empty answer replaced.');
    }

    return {
      content: nextContent,
      status: options?.status ?? AgentRunStatus.SUCCESS,
      warnings,
    };
  }
}
