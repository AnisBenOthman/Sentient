import { Injectable } from '@nestjs/common';
import { AgentActionKind, AgentType } from '../../generated/prisma';
import { hasActionCapability } from './action-capability';

export interface DraftPolicyResult {
  allowed: boolean;
  /**
   * WHY boolean rather than the literal `true` this used to be: this field
   * describes what this gate's OWN decision was, not a compile-time capability
   * guarantee — that guarantee lives entirely in SpecialistInput.constraints
   * (agent-graph.types.ts), a real discriminated union enforced by the
   * compiler. Widening this field to boolean does not weaken anything; it
   * makes the field honest once a capability bypass exists (spec 017 D2).
   */
  readOnlyOfficialRecords: boolean;
  label: string;
  humanReviewReminder: string;
  blockedReason: string | null;
}

const MUTATION_TERMS = ['submit', 'approve', 'reject', 'delete', 'publish now', 'book it', 'save it to', 'update the record'];

/**
 * WHY a term→action map rather than "does this agent hold ANY capability":
 * spec 017 D2 permits the bypass only when the specialist holds the capability
 * **for that action**. An agent-level check would let LEAVE_AGENT — whose only
 * capability is LEAVE_BOOKING — sail past a request phrased "approve", "reject"
 * or "delete", none of which it can perform. Terms mapped to `null` name
 * actions no specialist has a capability for, so they stay hard-blocked for
 * every agent and remain blocked until such an action kind actually exists.
 */
const TERM_ACTION_KINDS: Record<string, AgentActionKind | null> = {
  submit: AgentActionKind.LEAVE_BOOKING,
  'book it': AgentActionKind.LEAVE_BOOKING,
  'save it to': AgentActionKind.LEAVE_BOOKING,
  approve: null,
  reject: null,
  delete: null,
  'publish now': null,
  'update the record': null,
};

@Injectable()
export class DraftPolicyService {
  evaluate(agentType: AgentType, request: string): DraftPolicyResult {
    const lower = request.toLowerCase();
    const blockedTerm = MUTATION_TERMS.find((term) => lower.includes(term));

    if (blockedTerm) {
      /**
       * WHY a capability check instead of a blanket block (spec 017 D2): a
       * specialist holding capability for THIS action (today: only
       * LEAVE_AGENT, for LEAVE_BOOKING) is allowed to route into that action's
       * own Propose→Confirm→Execute→Verify flow instead of being refused
       * outright. This does NOT grant broader mutation ability — the compiler
       * still permits that specialist to construct ONLY the action kinds named
       * in permittedActionsFor(agentType) (agent-graph.types.ts). Every other
       * specialist, and every term naming an action nobody has a capability
       * for, is refused exactly as before.
       */
      const requestedActionKind = TERM_ACTION_KINDS[blockedTerm] ?? null;
      const isActionCapable =
        requestedActionKind !== null && hasActionCapability(agentType, requestedActionKind);
      if (isActionCapable) {
        return {
          allowed: true,
          readOnlyOfficialRecords: false,
          label: 'Action-capable',
          humanReviewReminder: 'You will be asked to explicitly confirm before anything is submitted.',
          blockedReason: null,
        };
      }

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
