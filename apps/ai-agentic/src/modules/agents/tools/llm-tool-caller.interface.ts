import { AgentTool, ConversationHistoryMessage, GeminiCallOptions } from './agent-tool.types';
import { LlmCallResult } from './llm-failure';

/**
 * WHY: Gemini is the primary tool-calling LLM, but it can be down, rate-limited,
 * or unconfigured. OpenRouter, Groq, and Grok (xAI) are OpenAI-compatible
 * fallbacks. This interface is the seam LlmFallbackOrchestratorService uses to
 * try providers in order without any specialist needing to know which one
 * actually answered — each implementation runs its OWN complete tool-calling
 * loop from scratch and only returns `ok: false` for an infrastructure failure
 * (never for a produced answer, including refusals — those are routed back to
 * the specialist as-is).
 *
 * WHY a discriminated union rather than `| null`: a bare null conflated a
 * missing API key, a 429, a dead socket, and a hung request into one
 * indistinguishable value, so nothing downstream could tell the user whether to
 * retry in a minute or call their administrator. `ok: false` always carries a
 * classified cause.
 */
export interface LlmToolCallerAdapter {
  readonly providerName: string;

  /** True when this provider has the configuration (API key, etc.) needed to run. */
  isConfigured(): boolean;

  call(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history?: ConversationHistoryMessage[],
    options?: GeminiCallOptions,
  ): Promise<LlmCallResult>;

  /**
   * WHY optional: only providers whose transport supports incremental delivery
   * implement this. Behaves exactly like `call()` — same tool-calling loop, same
   * return contract — except `onToken` fires with each incremental text delta of
   * the *final* round (the one with no more tool calls) as it arrives, instead of
   * the caller only seeing the complete `answer` once the whole call resolves.
   * `signal`, when provided, is honored by transports that support cancellation.
   */
  callStream?(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] | undefined,
    options: GeminiCallOptions | undefined,
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmCallResult>;
}
