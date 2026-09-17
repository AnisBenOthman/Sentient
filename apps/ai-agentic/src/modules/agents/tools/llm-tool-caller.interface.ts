import { AgentTool, ConversationHistoryMessage, GeminiCallOptions, GeminiToolCallOutcome } from './agent-tool.types';

/**
 * WHY: Gemini is the primary tool-calling LLM, but it can be down, rate-limited,
 * or unconfigured. OpenRouter and Grok (xAI) are OpenAI-compatible fallbacks.
 * This interface is the seam LlmFallbackOrchestratorService uses to try providers
 * in order without any specialist needing to know which one actually answered —
 * each implementation runs its OWN complete tool-calling loop from scratch and
 * only returns null for an infrastructure failure (never for a produced answer,
 * including refusals — those are routed back to the specialist as-is).
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
  ): Promise<GeminiToolCallOutcome | null>;

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
  ): Promise<GeminiToolCallOutcome | null>;
}
