import { Injectable, Optional } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { DownstreamRequestContext, SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  LlmFallbackOrchestratorService,
  LlmUnavailable,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { downstreamResult, toolCallerResult, withLlmOutageNotice } from './specialist-response.helpers';

const ONBOARDING_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient onboarding companion. Call get_onboarding_guides to find relevant orientation materials from the company's document library. Help new employees and their managers navigate the onboarding process using the actual company guides. If no guides are found, offer general first-week guidance.

${CONVERSATIONAL_STYLE}`;

@Injectable()
export class OnboardingAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ONBOARDING_AGENT;

  constructor(
    private readonly social: SocialAiClient,
    @Optional() private readonly llmCaller?: LlmFallbackOrchestratorService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
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
      const tools = this.toolRegistry.getOnboardingTools(reqContext);
      const systemPrompt = input.isDraftRequest
        ? `${ONBOARDING_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : ONBOARDING_SYSTEM_PROMPT;
      const result = await this.llmCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
        { thinkingLevel: 'medium' },
      );
      if (result.ok) {
        return toolCallerResult(input, this.agentType, result.outcome, {
          sourceType: 'ONBOARDING',
          title: 'Onboarding guides',
          referencePrefix: 'onboarding',
          referenceFallback: 'guides',
          successSummary: 'Onboarding guidance prepared.',
          limitedSummary: 'Onboarding guidance prepared with limited data access.',
          draftLabel: 'Onboarding draft',
        });
      }
      llmFailure = result.failure;
    }

    const context = await this.social.getOnboardingContext(reqContext);
    const deterministic = downstreamResult(
      input,
      this.agentType,
      context,
      'Onboarding guidance prepared.',
      'For onboarding, I can welcome new hires, outline first-week steps, and explain manager or HR onboarding progress where you have access. This scaffold does not change onboarding records.',
    );
    return llmFailure ? withLlmOutageNotice(deterministic, llmFailure) : deterministic;
  }
}
