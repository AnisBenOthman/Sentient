import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAgenticConfig } from '../../../config';
import { AgentTool, ConversationHistoryMessage, GeminiCallOptions, GeminiToolCallOutcome } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';
import { LlmToolCallerAdapter } from './llm-tool-caller.interface';
import { GROK_TOOL_CALLER, GROQ_TOOL_CALLER, OPENROUTER_TOOL_CALLER } from './openai-compatible-tool-caller.service';

/**
 * WHY: Single chokepoint every specialist calls instead of GeminiToolCallerService
 * directly. Tries providers in AI_AGENT_LLM_PROVIDER_ORDER, skipping any that
 * aren't configured. Fails over ONLY on infrastructure failure (a provider
 * returning null) — never on a produced answer, including refusals or guardrail
 * blocks. Each provider runs its own complete tool-calling loop from the original
 * input; there is no mid-loop handoff between providers.
 */
@Injectable()
export class LlmFallbackOrchestratorService {
  private readonly logger = new Logger(LlmFallbackOrchestratorService.name);
  private readonly providers: LlmToolCallerAdapter[];

  constructor(
    config: ConfigService,
    gemini: GeminiToolCallerService,
    @Inject(OPENROUTER_TOOL_CALLER) openRouter: LlmToolCallerAdapter,
    @Inject(GROQ_TOOL_CALLER) groq: LlmToolCallerAdapter,
    @Inject(GROK_TOOL_CALLER) grok: LlmToolCallerAdapter,
  ) {
    const aiConfig = config.get<AiAgenticConfig>('aiAgentic');
    const order = aiConfig?.llmProviderOrder ?? ['GEMINI'];
    const byName = new Map<string, LlmToolCallerAdapter>([
      ['GEMINI', gemini],
      ['OPENROUTER', openRouter],
      ['GROQ', groq],
      ['GROK', grok],
    ]);
    this.providers = order
      .map((name) => byName.get(name.trim().toUpperCase()))
      .filter((adapter): adapter is LlmToolCallerAdapter => adapter != null);
  }

  async call(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
  ): Promise<GeminiToolCallOutcome | null> {
    for (const [index, provider] of this.providers.entries()) {
      if (!provider.isConfigured()) continue;

      const outcome = await provider.call(systemPrompt, userMessage, tools, history, options);
      if (outcome === null) {
        /** WHY: null means infrastructure failure for THIS provider only — try the next one. */
        this.logger.warn(`${provider.providerName} unavailable; trying next provider.`);
        continue;
      }

      const usedFallbackProvider = index > 0;
      if (usedFallbackProvider) {
        this.logger.warn(`Fell back to ${provider.providerName} after an earlier provider was unavailable.`);
      }
      return { ...outcome, usedFallbackProvider };
    }
    return null;
  }

  /**
   * WHY fallover is disabled once a provider has emitted any token: switching
   * providers mid-stream would splice two different models' partial answers
   * into one bubble on the client. A provider that fails before its first
   * token is exactly the `call()` case — try the next one; a provider that
   * fails after starting to stream is a dead end for this turn.
   */
  async callStream(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<GeminiToolCallOutcome | null> {
    for (const [index, provider] of this.providers.entries()) {
      if (!provider.isConfigured() || !provider.callStream) continue;

      let started = false;
      const wrappedOnToken = (delta: string): void => {
        started = true;
        onToken(delta);
      };

      const outcome = await provider.callStream(systemPrompt, userMessage, tools, history, options, wrappedOnToken, signal);
      if (outcome === null) {
        if (started) {
          this.logger.error(`${provider.providerName} streaming failed after emitting partial output; not failing over mid-stream.`);
          return null;
        }
        this.logger.warn(`${provider.providerName} unavailable before streaming began; trying next provider.`);
        continue;
      }

      const usedFallbackProvider = index > 0;
      if (usedFallbackProvider) {
        this.logger.warn(`Fell back to ${provider.providerName} after an earlier provider was unavailable.`);
      }
      return { ...outcome, usedFallbackProvider };
    }
    return null;
  }
}
