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
}
