import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { SpecialistInput, SpecialistResult } from '../../../common/graph';

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
