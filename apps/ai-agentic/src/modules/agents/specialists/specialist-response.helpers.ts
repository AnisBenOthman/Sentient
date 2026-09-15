import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { SpecialistInput, SpecialistResult } from '../../../common/graph';
import { DownstreamResult, DownstreamSummary } from '../../../common/clients';
import { GeminiToolCallOutcome } from '../tools';

export function deterministicResult(
  input: SpecialistInput,
  agentType: AgentType,
  summary: string,
  userVisibleContent: string,
  sourceType: string,
  title: string,
  options?: { draftLabel?: string; status?: AgentRunStatus; nextStep?: string },
): SpecialistResult {
  return {
    agentType,
    status: options?.status ?? AgentRunStatus.SUCCESS,
    summary,
    userVisibleContent,
    sourceContext: [{ sourceType, title, referenceId: `${sourceType.toLowerCase()}:scaffold` }],
    permissionDecision: PermissionDecision.ALLOWED,
    recommendedNextStep: options?.nextStep,
    draftLabel: input.isDraftRequest ? options?.draftLabel ?? 'Draft suggestion' : undefined,
  };
}

export function downstreamResult(
  input: SpecialistInput,
  agentType: AgentType,
  downstream: DownstreamResult<DownstreamSummary>,
  summary: string,
  allowedContent: string,
  options?: { draftLabel?: string; nextStep?: string; suppressContinuityPrefix?: boolean },
): SpecialistResult {
  const hasPriorContext = input.conversationContext.recentMessages.length > 1;
  const continuityPrefix = hasPriorContext && options?.suppressContinuityPrefix !== true
    ? 'I also considered the recent conversation context for this follow-up. '
    : '';
  const status = downstream.permissionDecision === PermissionDecision.ALLOWED
    ? AgentRunStatus.SUCCESS
    : AgentRunStatus.DEGRADED;
  const sourceReference = downstream.data?.id ?? `${downstream.sourceType.toLowerCase()}:scoped`;
  const degradedContent = downstream.permissionDecision === PermissionDecision.DENIED
    ? 'I could not access the requested Sentient records with your current permissions.'
    : `I could not access ${downstream.sourceTitle.toLowerCase()} right now.`;
  const visibleContent = downstream.permissionDecision === PermissionDecision.ALLOWED
    ? `${continuityPrefix}${allowedContent}`
    : `${continuityPrefix}${degradedContent} I can still provide general Sentient guidance without exposing restricted records.`;

  return {
    agentType,
    status,
    summary: downstream.permissionDecision === PermissionDecision.ALLOWED
      ? summary
      : `${summary} Context degraded: ${downstream.degradedReason ?? 'unavailable'}`,
    userVisibleContent: visibleContent,
    sourceContext: [{
      sourceType: downstream.sourceType,
      title: downstream.sourceTitle,
      referenceId: sourceReference,
    }],
    permissionDecision: downstream.permissionDecision,
    recommendedNextStep: options?.nextStep,
    draftLabel: input.isDraftRequest ? options?.draftLabel ?? 'Draft suggestion' : undefined,
  };
}

export interface ToolCallerResultMeta {
  sourceType: string;
  title: string;
  referencePrefix: string;
  referenceFallback: string;
  successSummary: string;
  limitedSummary: string;
  draftLabel?: string;
}

/**
 * WHY: All 6 LLM-tool-calling specialists shared near-identical logic for turning
 * a GeminiToolCallOutcome into a SpecialistResult. Centralising it here means the
 * fallback-provider DEGRADED rule (multi-provider resilience layer) is written
 * once instead of drifting across 6 files. A produced answer from a non-primary
 * provider (outcome.usedFallbackProvider) is honestly surfaced as DEGRADED, the
 * same governance treatment as a permission-denied or failed tool call.
 */
export function toolCallerResult(
  input: SpecialistInput,
  agentType: AgentType,
  outcome: GeminiToolCallOutcome,
  meta: ToolCallerResultMeta,
): SpecialistResult {
  const usedFallback = outcome.usedFallbackProvider === true;
  const limited = outcome.anyToolDenied || outcome.anyToolFailed || usedFallback;
  const fallbackOnly = usedFallback && !outcome.anyToolDenied && !outcome.anyToolFailed;

  return {
    agentType,
    status: limited ? AgentRunStatus.DEGRADED : AgentRunStatus.SUCCESS,
    summary: fallbackOnly
      ? `${meta.successSummary} Answered via fallback provider (${outcome.providerUsed}) after the primary provider was unavailable.`
      : limited
        ? meta.limitedSummary
        : meta.successSummary,
    userVisibleContent: outcome.answer,
    sourceContext: [{
      sourceType: meta.sourceType,
      title: meta.title,
      referenceId: `${meta.referencePrefix}:${outcome.toolsUsed.join('+') || meta.referenceFallback}`,
    }],
    permissionDecision: outcome.anyToolDenied
      ? PermissionDecision.DENIED
      : outcome.anyToolFailed
        ? PermissionDecision.PARTIAL
        : PermissionDecision.ALLOWED,
    draftLabel: input.isDraftRequest ? meta.draftLabel : undefined,
    tokensIn: outcome.tokensIn,
    tokensOut: outcome.tokensOut,
  };
}
