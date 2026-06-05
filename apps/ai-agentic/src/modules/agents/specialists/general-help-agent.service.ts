import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge';

@Injectable()
export class GeneralHelpAgentService implements SpecialistAgent {
  readonly agentType = AgentType.GENERAL_HELP_AGENT;

  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly social: SocialAiClient,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const [matches, policyContext] = await Promise.all([
      this.knowledgeRepository.searchApproved(input.normalizedIntent, 3),
      this.social.getPolicyKnowledge({
        jwt: input.actorContext.jwt,
        correlationId: input.actorContext.correlationId,
      }),
    ]);
    const sourceText = matches.length > 0
      ? `I found ${matches.length} approved knowledge source(s) that can support this answer.`
      : 'No approved knowledge article matched this prompt yet, so I will stay at high-level Sentient guidance and avoid inventing policy.';
    const lower = input.normalizedIntent.toLowerCase();
    const draftType = lower.includes('announcement') ? 'HR announcement' : 'policy summary';
    const content = input.isDraftRequest
      ? `Draft ${draftType}: ${sourceText} Review the final wording with People team before publishing or relying on it as official policy.`
      : sourceText;
    return {
      agentType: this.agentType,
      status: policyContext.permissionDecision === PermissionDecision.ALLOWED ? AgentRunStatus.SUCCESS : AgentRunStatus.DEGRADED,
      summary: policyContext.permissionDecision === PermissionDecision.ALLOWED
        ? 'General help knowledge checked.'
        : `General help knowledge checked with degraded policy context: ${policyContext.degradedReason ?? 'unavailable'}`,
      userVisibleContent: policyContext.permissionDecision === PermissionDecision.ALLOWED
        ? content
        : `${policyContext.degradedReason ?? 'Policy knowledge is unavailable.'} ${content}`,
      sourceContext: [
        ...matches.map((match) => ({
          sourceType: 'POLICY',
          title: match.item?.title ?? `Knowledge document ${match.document.chunkIndex + 1}`,
          referenceId: match.item?.id ?? match.document.id,
        })),
        {
          sourceType: policyContext.sourceType,
          title: policyContext.sourceTitle,
          referenceId: policyContext.data?.id ?? 'policy:scoped',
        },
      ],
      permissionDecision: policyContext.permissionDecision,
      draftLabel: input.isDraftRequest ? 'Policy or announcement draft' : undefined,
    };
  }
}
