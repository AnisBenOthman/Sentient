import { Injectable, Optional } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamRequestContext, SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  LlmFallbackOrchestratorService,
  LlmUnavailable,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { toolCallerResult, withLlmOutageNotice } from './specialist-response.helpers';

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
    @Optional() private readonly llmCaller?: LlmFallbackOrchestratorService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    return this.run(input);
  }

  /** WHY registered as a streaming specialist (AI_AGENT_STREAMING_AGENT_TYPES): its ordinary Q&A path is a single LLM call producing prose — the common case worth streaming. */
  async executeStream(input: SpecialistInput, onToken: (delta: string) => void): Promise<SpecialistResult> {
    return this.run(input, onToken);
  }

  private async run(input: SpecialistInput, onToken?: (delta: string) => void): Promise<SpecialistResult> {
    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    /**
     * Holds the classified cause when every configured LLM provider is down, so
     * the deterministic answer below can say so instead of passing itself off as
     * a normal, complete answer.
     */
    let llmFailure: LlmUnavailable | null = null;

    if (this.llmCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getGeneralHelpTools(reqContext);
      const systemPrompt = input.isDraftRequest
        ? `${GENERAL_HELP_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : GENERAL_HELP_SYSTEM_PROMPT;
      const result = onToken
        ? await this.llmCaller.callStream(
            systemPrompt,
            input.userMessage,
            tools,
            input.conversationContext.recentMessages,
            { enableSearch: true },
            onToken,
          )
        : await this.llmCaller.call(
            systemPrompt,
            input.userMessage,
            tools,
            input.conversationContext.recentMessages,
            { enableSearch: true },
          );
      if (result.ok) {
        return toolCallerResult(input, this.agentType, result.outcome, {
          sourceType: 'POLICY',
          title: 'Policy knowledge',
          referencePrefix: 'policy',
          referenceFallback: 'scoped',
          successSummary: 'General help knowledge checked.',
          limitedSummary: 'General help prepared with limited data access.',
          draftLabel: 'Policy or announcement draft',
        });
      }
      llmFailure = result.failure;
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
    const deterministic: SpecialistResult = {
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

    return llmFailure ? withLlmOutageNotice(deterministic, llmFailure) : deterministic;
  }

}
