import { Injectable, Optional } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { DownstreamRequestContext, HrCoreAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  LlmFallbackOrchestratorService,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { downstreamResult, toolCallerResult } from './specialist-response.helpers';

const CAREER_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient career development assistant. Use the provided tools to personalise your guidance:
- Call get_my_skills to see the employee's current skills profile and proficiency levels.
- Call get_my_performance_reviews to see review history and ratings.
Base your advice on the actual data. Focus on skill gaps, growth paths, and preparing for performance discussions. Be specific and encouraging.

${CONVERSATIONAL_STYLE}`;

@Injectable()
export class CareerAgentService implements SpecialistAgent {
  readonly agentType = AgentType.CAREER_AGENT;

  constructor(
    private readonly hrCore: HrCoreAiClient,
    @Optional() private readonly llmCaller?: LlmFallbackOrchestratorService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    if (this.llmCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getCareerTools(reqContext, input.actorContext.employeeId);
      const systemPrompt = input.isDraftRequest
        ? `${CAREER_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : CAREER_SYSTEM_PROMPT;
      const outcome = await this.llmCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
        { thinkingLevel: 'medium' },
      );
      if (outcome) {
        return toolCallerResult(input, this.agentType, outcome, {
          sourceType: 'CAREER',
          title: 'Career context',
          referencePrefix: 'career',
          referenceFallback: 'skills',
          successSummary: 'Career guidance prepared.',
          limitedSummary: 'Career guidance prepared with limited data access.',
          draftLabel: 'Career draft',
        });
      }
    }

    const context = await this.hrCore.getSkillsContext(input.actorContext.employeeId, reqContext);
    const lower = input.normalizedIntent.toLowerCase();
    const content = input.isDraftRequest
      ? this.draftContent(lower)
      : 'Career support can cover growth paths, skill gaps, review preparation, learning focus, and next-step planning using only accessible Sentient context.';
    return downstreamResult(input, this.agentType, context, 'Career guidance prepared.', content, {
      draftLabel: 'Career draft',
    });
  }

  private draftContent(lower: string): string {
    if (lower.includes('manager feedback') || lower.includes('review feedback')) {
      return 'Draft manager feedback: start with observed facts, name the impact, recognize strengths, suggest one improvement, and agree on a follow-up. Review for fairness and context before sharing.';
    }
    if (lower.includes('self-review') || lower.includes('self review')) {
      return 'Draft self-review note: summarize outcomes, evidence, lessons learned, skill growth, and one development next step. Review it before adding it to an official review.';
    }
    return 'Draft development note: describe the growth goal, current strengths, one skill gap, support needed from the manager, and a concrete next step. Review it before adding it to any official review workflow.';
  }
}
