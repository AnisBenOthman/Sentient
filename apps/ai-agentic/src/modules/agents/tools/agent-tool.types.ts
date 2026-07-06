/** Tool declaration parameter, in neutral JSON Schema casing (lowercase types). */
export interface GeminiFunctionParameter {
  type: string;
  description: string;
  enum?: string[];
}

/**
 * WHY: This shape is provider-neutral JSON Schema (`type: 'object'`, lowercase) so
 * ToolRegistryService's declarations work unchanged for Gemini, OpenRouter, and Grok.
 * Gemini's REST API expects its uppercase `'OBJECT'` Type enum, so GeminiToolCallerService
 * is the only place that casing difference is bridged — every other adapter consumes
 * this shape as-is.
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: 'object';
    properties: Record<string, GeminiFunctionParameter>;
    required?: string[];
  };
}

/**
 * An atomic callable unit exposed to the LLM.
 * WHY: Context (jwt, correlationId) is captured in the closure at creation time so it
 * never appears in Gemini function schemas — auth credentials stay internal.
 */
export interface AgentTool {
  declaration: GeminiFunctionDeclaration;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * One prior conversation turn forwarded to Gemini for multi-turn continuity.
 * Shape mirrors ConversationTurnContext.recentMessages so specialists can pass
 * it through without mapping.
 */
export interface ConversationHistoryMessage {
  role: string;
  content: string;
}

export interface GeminiToolCallOutcome {
  /** Natural-language answer synthesized by Gemini after consuming tool results. */
  answer: string;
  /** true if any tool result was permission-denied by the downstream service. */
  anyToolDenied: boolean;
  /** true if any tool errored or reported data unavailable (infrastructure, not RBAC). */
  anyToolFailed: boolean;
  /** Names of the tools Gemini actually invoked, in call order (for governance trails). */
  toolsUsed: string[];
  /** Which LLM provider produced this answer ('GEMINI' | 'OPENROUTER' | 'GROK'). */
  providerUsed: string;
  /**
   * WHY: Set by LlmFallbackOrchestratorService when this answer came from a
   * non-primary provider (the configured one failed for an infrastructure
   * reason). Specialists surface this as a DEGRADED result so governance shows
   * the resilience layer kicked in — never silent, never SUCCESS-masquerading.
   */
  usedFallbackProvider?: boolean;
}

/**
 * Per-call overrides forwarded to the Gemini 3.x REST API.
 * WHY: thinking_level controls the model's reasoning depth per specialist —
 * analytics queries benefit from 'high' while simple balance reads can use 'low'.
 * enableSearch adds the built-in Google Search grounding tool so the general-help
 * agent can answer questions not covered by internal knowledge documents.
 */
export interface GeminiCallOptions {
  /** Override the server-wide GEMINI_THINKING_LEVEL for this specific call. */
  thinkingLevel?: 'low' | 'medium' | 'high' | 'none';
  /** Append the Gemini built-in googleSearch tool for real-time grounding. */
  enableSearch?: boolean;
}
