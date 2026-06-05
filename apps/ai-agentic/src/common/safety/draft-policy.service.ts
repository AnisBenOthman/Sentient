import { Injectable } from '@nestjs/common';
import { AgentType } from '../../generated/prisma';

export interface DraftPolicyResult {
  allowed: boolean;
  readOnlyOfficialRecords: true;
  label: string;
  humanReviewReminder: string;
  blockedReason: string | null;
}

const MUTATION_TERMS = ['submit', 'approve', 'reject', 'delete', 'publish now', 'book it', 'save it to', 'update the record'];

@Injectable()
export class DraftPolicyService {
  evaluate(agentType: AgentType, request: string): DraftPolicyResult {
    const lower = request.toLowerCase();
    const blockedTerm = MUTATION_TERMS.find((term) => lower.includes(term));

    if (blockedTerm) {
      return {
        allowed: false,
        readOnlyOfficialRecords: true,
        label: 'Draft only',
        humanReviewReminder: 'Please review and submit any official change through the relevant Sentient workflow.',
        blockedReason: `${agentType} cannot mutate official records during draft assistance (${blockedTerm}).`,
      };
    }

    return {
      allowed: true,
      readOnlyOfficialRecords: true,
      label: 'Draft only',
      humanReviewReminder: 'Please review before copying this into any official Sentient workflow.',
      blockedReason: null,
    };
  }
}
