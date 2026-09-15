import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAgenticConfig } from '../../../config';
import {
  AgentTool,
  ConversationHistoryMessage,
  GeminiCallOptions,
  GeminiFunctionDeclaration,
  GeminiToolCallOutcome,
} from './agent-tool.types';
import { LlmToolCallerAdapter } from './llm-tool-caller.interface';

/** Injection tokens for the configured instances registered in AgentsModule. */
export const OPENROUTER_TOOL_CALLER = Symbol('OPENROUTER_TOOL_CALLER');
export const GROQ_TOOL_CALLER = Symbol('GROQ_TOOL_CALLER');
export const GROK_TOOL_CALLER = Symbol('GROK_TOOL_CALLER');

export type OpenAiCompatibleProviderName = 'OPENROUTER' | 'GROQ' | 'GROK';

const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY_CHARS = 4_000;

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: OpenAiMessage; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface ToolRunResult {
  output: unknown;
  denied: boolean;
  failed: boolean;
}

interface ProviderSettings {
  apiKey: string;
  apiUrl: string;
  model: string;
}

/**
 * WHY: OpenRouter and Grok (xAI) are both OpenAI-compatible chat-completions
 * APIs, so one parameterized adapter class covers the fallback chain for both —
 * only base URL / key / model differ (see AgentsModule's two factory providers).
 * This is a FULL, INDEPENDENT tool-calling loop, not a thin translation layer
 * over GeminiToolCallerService: OpenAI's tool_calls/tool_call_id mechanism is
 * structurally different from Gemini's part-based functionCall/functionResponse
 * id-echo, so each provider runs its own loop from the original input.
 *
 * Feature parity gaps are explicitly degraded, never broken: `enableSearch`
 * (Gemini's built-in googleSearch grounding) and `thinkingLevel` have no
 * OpenAI-compatible equivalent here and are silently ignored.
 */
@Injectable()
export class OpenAiCompatibleToolCallerService implements LlmToolCallerAdapter {
  private readonly logger: Logger;

  constructor(
    private readonly config: ConfigService,
    readonly providerName: OpenAiCompatibleProviderName,
  ) {
    this.logger = new Logger(`OpenAiCompatibleToolCallerService:${providerName}`);
  }

  isConfigured(): boolean {
    return this.resolveSettings() != null;
  }

  async call(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    _options: GeminiCallOptions = {},
  ): Promise<GeminiToolCallOutcome | null> {
    const settings = this.resolveSettings();
    if (!settings || tools.length === 0) return null;

    const toolMap = new Map(tools.map((t) => [t.declaration.name, t]));
    const toolDefs = tools.map((t) => toOpenAiToolDef(t.declaration));
    const messages: OpenAiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.historyMessages(history, userMessage),
      { role: 'user', content: userMessage },
    ];

    let anyToolDenied = false;
    let anyToolFailed = false;
    const toolsUsed: string[] = [];
    const usage = { tokensIn: 0, tokensOut: 0, reported: false };
    const recordUsage = (raw: OpenAiChatResponse): void => {
      if (!raw.usage) return;
      usage.reported = true;
      usage.tokensIn += raw.usage.prompt_tokens ?? 0;
      usage.tokensOut += raw.usage.completion_tokens ?? 0;
    };
    const usageFields = (): { tokensIn?: number; tokensOut?: number } =>
      usage.reported ? { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut } : {};
    const controller = new AbortController();
    const downstreamTimeoutMs = this.aiConfig()?.downstreamTimeoutMs ?? 8_000;
    const timer = setTimeout(() => controller.abort(), downstreamTimeoutMs * MAX_TOOL_ROUNDS);

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        /**
         * WHY: mirrors Gemini's round-0 ANY mode — forcing a tool call on the
         * first round keeps weaker fallback models grounded in real data
         * instead of answering from nothing.
         */
        const toolChoice = round === 0 ? 'required' : 'auto';
        const raw = await this.fetchChatCompletion(settings, messages, toolDefs, controller.signal, toolChoice);
        if (!raw) return null;

        recordUsage(raw);
        const message = raw.choices?.[0]?.message;
        const toolCalls = message?.tool_calls ?? [];

        if (toolCalls.length > 0) {
          messages.push({ role: 'assistant', content: message?.content ?? null, tool_calls: toolCalls });
          for (const toolCall of toolCalls) {
            const args = parseArguments(toolCall.function.arguments);
            const ran = await this.runTool(toolMap, toolCall.function.name, args);
            if (ran.denied) anyToolDenied = true;
            if (ran.failed) anyToolFailed = true;
            toolsUsed.push(toolCall.function.name);
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(ran.output) });
          }
          continue;
        }

        const answer = message?.content?.trim();
        if (answer) return { answer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() };
        return null;
      }

      /** WHY: mirrors Gemini's final forced-synthesis round — never discard gathered tool results. */
      const final = await this.fetchChatCompletion(settings, messages, toolDefs, controller.signal, 'none');
      if (final) recordUsage(final);
      const finalAnswer = final?.choices?.[0]?.message?.content?.trim();
      return finalAnswer
        ? { answer: finalAnswer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() }
        : null;
    } catch (err: unknown) {
      this.logger.warn(`${this.providerName} tool call failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveSettings(): ProviderSettings | null {
    const aiConfig = this.aiConfig();
    if (!aiConfig) return null;
    if (this.providerName === 'OPENROUTER') {
      if (!aiConfig.openRouterApiKey) return null;
      return { apiKey: aiConfig.openRouterApiKey, apiUrl: aiConfig.openRouterApiUrl, model: aiConfig.openRouterModel };
    }
    if (this.providerName === 'GROQ') {
      if (!aiConfig.groqApiKey) return null;
      return { apiKey: aiConfig.groqApiKey, apiUrl: aiConfig.groqApiUrl, model: aiConfig.groqModel };
    }
    if (!aiConfig.xaiApiKey) return null;
    return { apiKey: aiConfig.xaiApiKey, apiUrl: aiConfig.xaiApiUrl, model: aiConfig.xaiModel };
  }

  private aiConfig(): AiAgenticConfig | undefined {
    return this.config.get<AiAgenticConfig>('aiAgentic');
  }

  /** Mirrors GeminiToolCallerService.historyContents: drop the duplicated trailing user turn. */
  private historyMessages(history: ConversationHistoryMessage[], currentUserMessage: string): OpenAiMessage[] {
    const turns = history.filter((message) => {
      const role = message.role.toUpperCase();
      return (role === 'USER' || role === 'ASSISTANT') && message.content.trim().length > 0;
    });

    const last = turns[turns.length - 1];
    if (last && last.role.toUpperCase() === 'USER' && last.content.trim() === currentUserMessage.trim()) {
      turns.pop();
    }

    return turns.map((message) => ({
      role: message.role.toUpperCase() === 'USER' ? 'user' : 'assistant',
      content: message.content.slice(0, MAX_HISTORY_CHARS),
    }));
  }

  private async runTool(
    toolMap: Map<string, AgentTool>,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolRunResult> {
    const tool = toolMap.get(name);
    if (!tool) {
      return { output: { error: `Unknown tool: ${name}` }, denied: false, failed: true };
    }
    try {
      const output = await tool.run(args);
      return { output, denied: isFlagged(output, 'denied'), failed: isFlagged(output, 'unavailable') };
    } catch (err: unknown) {
      return {
        output: { error: `Tool execution failed: ${err instanceof Error ? err.message : 'unknown'}` },
        denied: false,
        failed: true,
      };
    }
  }

  private async fetchChatCompletion(
    settings: ProviderSettings,
    messages: OpenAiMessage[],
    tools: unknown[],
    signal: AbortSignal,
    toolChoice: 'required' | 'auto' | 'none',
  ): Promise<OpenAiChatResponse | null> {
    const url = `${settings.apiUrl}/chat/completions`;
    const requestBody = JSON.stringify({ model: settings.model, messages, tools, tool_choice: toolChoice });
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      signal,
      body: requestBody,
    } as const;

    try {
      const resp = await fetch(url, fetchOptions);
      /** WHY: mirrors GeminiToolCallerService's single 429 retry-after-backoff. */
      if (resp.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        if (signal.aborted) return null;
        const retry = await fetch(url, { ...fetchOptions, body: requestBody });
        if (!retry.ok) {
          this.logger.warn(
            `${this.providerName} API returned ${retry.status} (after 429 retry): ${await safeReadBody(retry)}`,
          );
          return null;
        }
        return (await retry.json()) as OpenAiChatResponse;
      }
      if (!resp.ok) {
        /**
         * WHY: A bare status code makes fallback causes undiagnosable (a Groq 400
         * can be tool-schema rejection, model incompatibility with tool_choice,
         * or context overflow). The truncated body names the actual reason.
         */
        this.logger.warn(`${this.providerName} API returned ${resp.status}: ${await safeReadBody(resp)}`);
        return null;
      }
      return (await resp.json()) as OpenAiChatResponse;
    } catch {
      return null;
    }
  }
}

function toOpenAiToolDef(declaration: GeminiFunctionDeclaration): unknown {
  return {
    type: 'function',
    function: {
      name: declaration.name,
      description: declaration.description,
      parameters: declaration.parameters ?? { type: 'object', properties: {} },
    },
  };
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isFlagged(result: unknown, flag: 'denied' | 'unavailable'): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as Record<string, unknown>)[flag] === true;
}

const MAX_ERROR_BODY_CHARS = 500;

/** Reads an error response body for logging; never throws, never logs secrets. */
async function safeReadBody(resp: { text?: () => Promise<string> }): Promise<string> {
  try {
    const body = typeof resp.text === 'function' ? await resp.text() : '';
    const trimmed = body.replace(/\s+/g, ' ').trim();
    return trimmed.length > MAX_ERROR_BODY_CHARS ? `${trimmed.slice(0, MAX_ERROR_BODY_CHARS)}…` : trimmed || '<empty body>';
  } catch {
    return '<unreadable body>';
  }
}
