import { Injectable, Optional } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamRequestContext, SocialAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  GeminiToolCallerService,
  GeminiToolCallOutcome,
  ToolRegistryService,
} from '../tools';
import { downstreamResult } from './specialist-response.helpers';

const ONBOARDING_SYSTEM_PROMPT = `You are the Sentient onboarding companion. Call get_onboarding_guides to find relevant orientation materials from the company's document library. Help new employees and their managers navigate the onboarding process using the actual company guides. If no guides are found, offer general first-week guidance.

${CONVERSATIONAL_STYLE}`;

@Injectable()
export class OnboardingAgentService implements SpecialistAgent {
  readonly agentType = AgentType.ONBOARDING_AGENT;

  constructor(
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
      const tools = this.toolRegistry.getOnboardingTools(reqContext);
      const systemPrompt = input.isDraftRequest
        ? `${ONBOARDING_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : ONBOARDING_SYSTEM_PROMPT;
      const outcome = await this.geminiToolCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
      );
      if (outcome) return this.toToolCallerResult(input, outcome);
    }

    const context = await this.social.getOnboardingContext(reqContext);
    return downstreamResult(
      input,
      this.agentType,
      context,
      'Onboarding guidance prepared.',
      'For onboarding, I can welcome new hires, outline first-week steps, and explain manager or HR onboarding progress where you have access. This scaffold does not change onboarding records.',
    );
  }

  private toToolCallerResult(input: SpecialistInput, outcome: GeminiToolCallOutcome): SpecialistResult {
    const limited = outcome.anyToolDenied || outcome.anyToolFailed;
    return {
      agentType: this.agentType,
      status: limited ? AgentRunStatus.DEGRADED : AgentRunStatus.SUCCESS,
      summary: limited ? 'Onboarding guidance prepared with limited data access.' : 'Onboarding guidance prepared.',
      userVisibleContent: outcome.answer,
      sourceContext: [{
        sourceType: 'ONBOARDING',
        title: 'Onboarding guides',
        referenceId: `onboarding:${outcome.toolsUsed.join('+') || 'guides'}`,
      }],
      permissionDecision: outcome.anyToolDenied
        ? PermissionDecision.DENIED
        : outcome.anyToolFailed
          ? PermissionDecision.PARTIAL
          : PermissionDecision.ALLOWED,
      draftLabel: input.isDraftRequest ? 'Onboarding draft' : undefined,
    };
  }
}
