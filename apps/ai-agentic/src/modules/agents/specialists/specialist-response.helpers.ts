import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { SpecialistInput, SpecialistResult } from '../../../common/graph';
import { DownstreamResult, DownstreamSummary } from '../../../common/clients';

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
  options?: { draftLabel?: string; nextStep?: string },
): SpecialistResult {
  const hasPriorContext = input.conversationContext.recentMessages.length > 1;
  const continuityPrefix = hasPriorContext
    ? 'I also considered the recent conversation context for this follow-up. '
    : '';
  const status = downstream.permissionDecision === PermissionDecision.ALLOWED
    ? AgentRunStatus.SUCCESS
    : AgentRunStatus.DEGRADED;
  const sourceReference = downstream.data?.id ?? `${downstream.sourceType.toLowerCase()}:scoped`;
  const visibleContent = downstream.permissionDecision === PermissionDecision.ALLOWED
    ? `${continuityPrefix}${allowedContent}`
    : `${continuityPrefix}${downstream.degradedReason ?? `${downstream.sourceTitle} is unavailable.`} I can still provide general Sentient guidance without exposing restricted or missing records.`;

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
