import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAgenticConfig } from '../../../config';
import { AgentTool, ConversationHistoryMessage, GeminiCallOptions } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';
import {
  LlmFailureReason,
  LlmProviderFailure,
  LlmTurnResult,
  aggregateFailures,
  llmUnavailableSummary,
} from './llm-failure';
import { LlmToolCallerAdapter } from './llm-tool-caller.interface';
import { GROK_TOOL_CALLER, GROQ_TOOL_CALLER, OPENROUTER_TOOL_CALLER } from './openai-compatible-tool-caller.service';

/** What `/health` reports for one provider in the rotation. */
export interface LlmProviderStatus {
  provider: string;
  /** Position in AI_AGENT_LLM_PROVIDER_ORDER — 1 is the primary. */
  order: number;
  configured: boolean;
  /** Outcome of the last real call this process made through this provider. Never probed on its own. */
  lastOutcome: 'OK' | 'FAILED' | 'UNKNOWN';
  lastFailureReason: LlmFailureReason | null;
  lastCheckedAt: string | null;
}

interface ProviderHealth {
  lastOutcome: 'OK' | 'FAILED' | 'UNKNOWN';
  lastFailureReason: LlmFailureReason | null;
  lastCheckedAt: string | null;
}

/**
 * WHY: Single chokepoint every specialist calls instead of GeminiToolCallerService
 * directly. Tries providers in AI_AGENT_LLM_PROVIDER_ORDER, skipping any that
 * aren't configured. Fails over ONLY on infrastructure failure — never on a
 * produced answer, including refusals or guardrail blocks. Each provider runs
 * its own complete tool-calling loop from the original input; there is no
 * mid-loop handoff between providers.
 *
 * WHY it returns a classified failure rather than null when the whole rotation
 * is exhausted: the specialists are the layer that decides what the user sees,
 * and "every provider is down" used to be indistinguishable from "the primary
 * answered" — so an outage was silently reported to the user, and to the
 * governance audit, as a successful turn.
 */
@Injectable()
export class LlmFallbackOrchestratorService {
  private readonly logger = new Logger(LlmFallbackOrchestratorService.name);
  private readonly providers: LlmToolCallerAdapter[];
  /**
   * Last known outcome per provider, updated only from calls this service
   * already makes. WHY not an active probe: a health endpoint must never burn
   * LLM quota, and a synthetic probe would not exercise the tool-calling path
   * that actually fails in production.
   */
  private readonly health = new Map<string, ProviderHealth>();

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
  ): Promise<LlmTurnResult> {
    const attempts: LlmProviderFailure[] = [];

    for (const [index, provider] of this.providers.entries()) {
      if (!provider.isConfigured()) {
        attempts.push(this.unconfigured(provider));
        continue;
      }

      const result = await provider.call(systemPrompt, userMessage, tools, history, options);
      if (!result.ok) {
        /** WHY: `ok: false` means infrastructure failure for THIS provider only — try the next one. */
        this.recordFailure(provider.providerName, result.failure);
        attempts.push(result.failure);
        this.logger.warn(
          `${provider.providerName} unavailable (${result.failure.reason}); trying next provider.`,
        );
        continue;
      }

      this.recordSuccess(provider.providerName);
      const usedFallbackProvider = index > 0;
      if (usedFallbackProvider) {
        this.logger.warn(`Fell back to ${provider.providerName} after an earlier provider was unavailable.`);
      }
      return { ok: true, outcome: { ...result.outcome, usedFallbackProvider } };
    }

    return this.exhausted(attempts, false);
  }

  /**
   * WHY failover is disabled once a provider has emitted any token: switching
   * providers mid-stream would splice two different models' partial answers
   * into one bubble on the client. A provider that fails before its first
   * token is exactly the `call()` case — try the next one; a provider that
   * fails after starting to stream is a dead end for this turn, and the
   * returned failure carries `partialOutputEmitted` so the specialist can say
   * the answer was cut off rather than that nothing was produced.
   */
  async callStream(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmTurnResult> {
    const attempts: LlmProviderFailure[] = [];

    for (const [index, provider] of this.providers.entries()) {
      if (!provider.callStream) continue;
      if (!provider.isConfigured()) {
        attempts.push(this.unconfigured(provider));
        continue;
      }

      let started = false;
      const wrappedOnToken = (delta: string): void => {
        started = true;
        onToken(delta);
      };

      const result = await provider.callStream(systemPrompt, userMessage, tools, history, options, wrappedOnToken, signal);
      if (!result.ok) {
        this.recordFailure(provider.providerName, result.failure);
        attempts.push(result.failure);
        if (started) {
          this.logger.error(
            `${provider.providerName} streaming failed (${result.failure.reason}) after emitting partial output; not failing over mid-stream.`,
          );
          return this.exhausted(attempts, true);
        }
        this.logger.warn(
          `${provider.providerName} unavailable (${result.failure.reason}) before streaming began; trying next provider.`,
        );
        continue;
      }

      this.recordSuccess(provider.providerName);
      const usedFallbackProvider = index > 0;
      if (usedFallbackProvider) {
        this.logger.warn(`Fell back to ${provider.providerName} after an earlier provider was unavailable.`);
      }
      return { ok: true, outcome: { ...result.outcome, usedFallbackProvider } };
    }

    return this.exhausted(attempts, false);
  }

  /**
   * Rotation status for `/health`. Reports configuration plus the last real
   * outcome seen per provider, so an LLM outage is visible to monitoring
   * instead of only showing up as oddly generic assistant answers.
   */
  describeProviders(): LlmProviderStatus[] {
    return this.providers.map((provider, index) => {
      const health = this.health.get(provider.providerName);
      return {
        provider: provider.providerName,
        order: index + 1,
        configured: provider.isConfigured(),
        lastOutcome: health?.lastOutcome ?? 'UNKNOWN',
        lastFailureReason: health?.lastFailureReason ?? null,
        lastCheckedAt: health?.lastCheckedAt ?? null,
      };
    });
  }

  /** True when at least one provider in the rotation has the credentials it needs. */
  hasConfiguredProvider(): boolean {
    return this.providers.some((provider) => provider.isConfigured());
  }

  private exhausted(attempts: LlmProviderFailure[], partialOutputEmitted: boolean): LlmTurnResult {
    const failure = aggregateFailures(attempts, partialOutputEmitted);
    this.logger.error(llmUnavailableSummary(failure));
    return { ok: false, failure };
  }

  private unconfigured(provider: LlmToolCallerAdapter): LlmProviderFailure {
    return {
      provider: provider.providerName,
      reason: 'NOT_CONFIGURED',
      detail: `${provider.providerName} is in the rotation but has no API key configured.`,
    };
  }

  private recordSuccess(provider: string): void {
    this.health.set(provider, {
      lastOutcome: 'OK',
      lastFailureReason: null,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  private recordFailure(provider: string, failure: LlmProviderFailure): void {
    this.health.set(provider, {
      lastOutcome: 'FAILED',
      lastFailureReason: failure.reason,
      lastCheckedAt: new Date().toISOString(),
    });
  }
}
