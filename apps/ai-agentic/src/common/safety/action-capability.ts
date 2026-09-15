import { AgentActionKind, AgentType } from '../../generated/prisma';

/**
 * WHY a registry rather than a per-specialist boolean: this is the single place
 * that answers "which mutating actions may this specialist propose" for both
 * the compile-time constraints union (agent-graph.types.ts) and the runtime
 * capability check that DraftPolicyService performs before routing "book it"
 * phrasing into Propose (spec 017 D2). Only LEAVE_AGENT is populated today —
 * every other specialist has no entry and therefore no capability.
 */
const ACTION_CAPABILITIES: Partial<Record<AgentType, AgentActionKind[]>> = {
  [AgentType.LEAVE_AGENT]: [AgentActionKind.LEAVE_BOOKING],
};

export function permittedActionsFor(agentType: AgentType): AgentActionKind[] {
  return ACTION_CAPABILITIES[agentType] ?? [];
}

export function hasActionCapability(agentType: AgentType, actionKind: AgentActionKind): boolean {
  return permittedActionsFor(agentType).includes(actionKind);
}
