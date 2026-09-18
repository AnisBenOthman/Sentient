import { Injectable, Optional } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { DownstreamRequestContext, HrCoreAiClient, OkrAiContext, OkrObjectiveContext } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  FEW_SHOT_OKR_EXAMPLES,
  LlmFallbackOrchestratorService,
  LlmUnavailable,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { downstreamResult, toolCallerResult, withLlmOutageNotice } from './specialist-response.helpers';

const AT_RISK_STATUSES = new Set(['AT_RISK', 'BEHIND', 'BLOCKED', 'CANCELLED']);
const MAX_LISTED_OBJECTIVES = 3;

const OKR_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient OKR assistant. Call get_my_objectives to fetch the user's current objectives, then answer their question accurately. Explain objective status, alignment, and any at-risk items based solely on the returned data. If no objectives are found, say so and offer general OKR guidance.
${FEW_SHOT_OKR_EXAMPLES}
${CONVERSATIONAL_STYLE}`;

@Injectable()
export class OkrAgentService implements SpecialistAgent {
  readonly agentType = AgentType.OKR_AGENT;

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

    /**
     * Holds the classified cause when every configured LLM provider is down, so
     * the deterministic answer below can say so instead of passing itself off as
     * a normal, complete answer.
     */
    let llmFailure: LlmUnavailable | null = null;

    if (this.llmCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getOkrTools(reqContext, input.actorContext.userId);
      const systemPrompt = input.isDraftRequest
        ? `${OKR_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : OKR_SYSTEM_PROMPT;
      const result = await this.llmCaller.call(
        systemPrompt,
        input.userMessage,
        tools,
        input.conversationContext.recentMessages,
        { thinkingLevel: 'medium' },
      );
      if (result.ok) {
        return toolCallerResult(input, this.agentType, result.outcome, {
          sourceType: 'OKR',
          title: 'OKR context',
          referencePrefix: 'okr',
          referenceFallback: 'objectives',
          successSummary: 'OKR guidance prepared.',
          limitedSummary: 'OKR guidance prepared with limited data access.',
          draftLabel: 'OKR draft',
        });
      }
      llmFailure = result.failure;
    }

    const context = await this.hrCore.getOkrContext(input.actorContext.userId, reqContext);
    const content = input.isDraftRequest
      ? 'Draft OKR: Objective - improve a focused Sentient work outcome this quarter. Key results - define one measurable quality metric, one delivery metric, and one stakeholder-feedback metric before submitting in OKRs.'
      : this.describeOkrContext(context.data);
    const deterministic = downstreamResult(input, this.agentType, context, 'OKR guidance prepared.', content, {
      draftLabel: 'OKR draft',
    });
    return llmFailure ? withLlmOutageNotice(deterministic, llmFailure) : deterministic;
  }

  /**
   * WHY: FR-036 requires explaining the user's actual OKRs and their progress
   * or risk — not generic advice. The summary uses the scoped objectives HR
   * Core returned for this caller and falls back to guidance only when no
   * objective data is available.
   */
  private describeOkrContext(context: OkrAiContext | null): string {
    const objectives = context && Array.isArray(context.objectives) ? context.objectives : [];
    if (objectives.length === 0) {
      return 'I did not find objectives assigned to you in the active OKR data. To get started, focus on the active company or department objective, choose a measurable outcome, and keep key results verifiable. I can explain alignment, progress, and risk within your Sentient scope.';
    }

    const atRisk = objectives.filter((objective) => AT_RISK_STATUSES.has((objective.status ?? '').toUpperCase()));
    const lines = [
      `You have ${objectives.length} objective${objectives.length === 1 ? '' : 's'} in scope:`,
    ];
    for (const objective of objectives.slice(0, MAX_LISTED_OBJECTIVES)) {
      lines.push(`- ${this.describeObjective(objective)}`);
    }
    if (objectives.length > MAX_LISTED_OBJECTIVES) {
      lines.push(`...and ${objectives.length - MAX_LISTED_OBJECTIVES} more in the OKRs module.`);
    }
    lines.push(
      atRisk.length > 0
        ? `${atRisk.length} objective${atRisk.length === 1 ? ' looks' : 's look'} at risk - consider a check-in on ${atRisk.map((objective) => `"${objective.title}"`).join(', ')}.`
        : 'No objective is flagged at risk right now. Keep key results measurable and check in regularly.',
    );
    return lines.join('\n');
  }

  private describeObjective(objective: OkrObjectiveContext): string {
    const status = objective.status ? objective.status.replace(/_/g, ' ').toLowerCase() : 'status unknown';
    const level = objective.level ? `${objective.level.toLowerCase()} level, ` : '';
    return `${objective.title} (${level}${status})`;
  }
}
