import { Logger } from '@nestjs/common';
import { AgentRunStatus } from '../../generated/prisma';
import { PendingActionDraft, SpecialistResult } from '../../common/graph';
import { permittedActionsFor } from '../../common/safety';

const logger = new Logger('AgentResultUtil');

/**
 * WHY a plain exported function rather than a method on the runner: both the
 * synchronous LangGraph final-answer node and the streaming turn runner need
 * to roll a turn's specialist results up into the same governance fields, and
 * neither should reach into the other's private methods to do it.
 */
export function sourceCategories(results: SpecialistResult[]): string[] {
  return [...new Set(results.flatMap((result) => result.sourceContext.map((source) => source.sourceType)))];
}

/** Turn-level token rollup: null when no specialist reported usage (e.g. deterministic paths). */
export function sumTokens(results: SpecialistResult[]): { tokensIn: number | null; tokensOut: number | null } {
  const reported = results.filter((result) => result.tokensIn != null || result.tokensOut != null);
  if (reported.length === 0) return { tokensIn: null, tokensOut: null };
  return {
    tokensIn: reported.reduce((sum, result) => sum + (result.tokensIn ?? 0), 0),
    tokensOut: reported.reduce((sum, result) => sum + (result.tokensOut ?? 0), 0),
  };
}

/**
 * WHY keyed off the specialist's own status rather than the turn's final status:
 * FinalAnswerPolicyService.review() can rewrite content and force REFUSED after
 * the specialist returned. Callers lift the draft unconditionally here and gate
 * the mint on the REVIEWED status themselves, so a swept turn simply never mints
 * — a refusal can never ship with a live confirmation token attached.
 *
 * WHY exported rather than kept private on the LangGraph runner: a stream-
 * eligible turn's specialist can still short-circuit to a deterministic booking
 * proposal (e.g. LeaveAgentService's tryPropose() path) without ever reaching
 * the LLM, so ConversationStreamRunnerService needs this exact same capability
 * check — not a second, drifting implementation of it.
 */
export function pendingActionFrom(specialistResults: SpecialistResult[]): PendingActionDraft | undefined {
  const pending = specialistResults.find((result) => result.status === AgentRunStatus.PENDING_CONFIRMATION);
  if (!pending?.confirmationPayload) return undefined;
  if (!pending.pendingActionKind) return undefined;

  /**
   * Defence in depth: re-check the capability registry here, not just inside the
   * specialist. permittedActionsFor is the same source the specialist's own
   * constraints were built from, so a specialist that somehow emitted an action
   * kind it was never granted is dropped rather than minted.
   */
  if (!permittedActionsFor(pending.agentType).includes(pending.pendingActionKind)) {
    logger.error(
      `Specialist ${pending.agentType} proposed ${pending.pendingActionKind} without the capability; draft discarded.`,
    );
    return undefined;
  }

  return {
    agentType: pending.agentType,
    actionKind: pending.pendingActionKind,
    payload: pending.confirmationPayload,
    policyCitations: pending.policyCitations ?? [],
  };
}
