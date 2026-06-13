import { Injectable, Optional } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamRequestContext, SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  GeminiToolCallerService,
  GeminiToolCallOutcome,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';

const GENERAL_HELP_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient general HR help assistant. Answer HR policy and guidance questions using the provided tools:
- Call get_policy_knowledge to retrieve internal policy documents.
- Call search_knowledge_base with a focused query when you need to find a specific policy or FAQ.
- If no internal document covers the question, use Google Search to find relevant, publicly available HR guidance or labour law information, and clearly note the source is external.
Stay within Sentient scope. Do not invent policies not found in retrieved documents or search results.

${CONVERSATIONAL_STYLE}`;

@Injectable()
export class GeneralHelpAgentService implements SpecialistAgent {
  readonly agentType = AgentType.GENERAL_HELP_AGENT;

  constructor(
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly social: SocialAiClient,
    @Optional() private readonly geminiToolCaller?: GeminiToolCallerService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    if (this.geminiToolCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getGeneralHelpTools(reqContext);
      const systemPrompt = input.isDraftRequest
        ? `${GENERAL_HELP_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : GENERAL_HELP_SYSTEM_PROMPT;
      const outcome = await this.geminiToolCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
        { enableSearch: true },
      );
      if (outcome) return this.toToolCallerResult(input, outcome);
    }

    const [matches, policyContext] = await Promise.all([
      this.knowledgeRepository.searchApproved(input.normalizedIntent, 3),
      this.social.getPolicyKnowledge(reqContext),
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

  private toToolCallerResult(input: SpecialistInput, outcome: GeminiToolCallOutcome): SpecialistResult {
    const limited = outcome.anyToolDenied || outcome.anyToolFailed;
    return {
      agentType: this.agentType,
      status: limited ? AgentRunStatus.DEGRADED : AgentRunStatus.SUCCESS,
      summary: limited ? 'General help prepared with limited data access.' : 'General help knowledge checked.',
      userVisibleContent: outcome.answer,
      sourceContext: [{
        sourceType: 'POLICY',
        title: 'Policy knowledge',
        referenceId: `policy:${outcome.toolsUsed.join('+') || 'scoped'}`,
      }],
      permissionDecision: outcome.anyToolDenied
        ? PermissionDecision.DENIED
        : outcome.anyToolFailed
          ? PermissionDecision.PARTIAL
          : PermissionDecision.ALLOWED,
      draftLabel: input.isDraftRequest ? 'Policy or announcement draft' : undefined,
    };
  }
}
