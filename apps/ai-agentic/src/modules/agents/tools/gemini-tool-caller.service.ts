import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAgenticConfig } from '../../../config';
import { AgentTool, ConversationHistoryMessage, GeminiCallOptions, GeminiToolCallOutcome } from './agent-tool.types';

const MAX_TOOL_ROUNDS = 5;

/** Defensive cap per history turn so long prior answers cannot bloat the prompt. */
const MAX_HISTORY_CHARS = 4_000;

interface GeminiPart {
  text?: string;
  /**
   * WHY: Gemini 3.x returns an `id` on every functionCall part. The matching
   * functionResponse must echo the same id or the API rejects the next request
   * with a part-count mismatch error.
   */
  functionCall?: { id?: string; name: string; args: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { role?: string; parts?: GeminiPart[] };
  }>;
}

interface ToolRunResult {
  output: unknown;
  denied: boolean;
  failed: boolean;
}

/**
 * Runs a multi-turn Gemini function-calling loop.
 * WHY: Specialists used to hard-code one method per question type (regex routing).
 * This service lets Gemini pick the right tool(s) from a per-agent set at runtime,
 * making agents flexible without new code per question pattern.
 * Returns null when Gemini is unavailable so every caller falls back gracefully.
 */
@Injectable()
export class GeminiToolCallerService {
  private readonly logger = new Logger(GeminiToolCallerService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  async call(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
  ): Promise<GeminiToolCallOutcome | null> {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey || tools.length === 0) return null;

    /**
     * WHY: Per-call thinkingLevel overrides the server-wide default so analytics
     * can use 'high' while leave balance checks stay at 'medium'. enableSearch
     * appends the built-in Google Search tool for the general-help agent.
     */
    const thinkingLevel = options.thinkingLevel ?? aiConfig.geminiThinkingLevel;
    const enableSearch = options.enableSearch ?? false;

    const toolMap = new Map(tools.map((t) => [t.declaration.name, t]));
    const functionDeclarations = tools.map((t) => t.declaration);
    const contents: GeminiContent[] = [
      ...this.historyContents(history, userMessage),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    let anyToolDenied = false;
    let anyToolFailed = false;
    const toolsUsed: string[] = [];
    const controller = new AbortController();
    const totalTimeoutMs = (aiConfig.downstreamTimeoutMs ?? 8_000) * MAX_TOOL_ROUNDS;
    const timer = setTimeout(() => controller.abort(), totalTimeoutMs);

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        /**
         * WHY: weaker models (e.g. gemini-flash-lite) under-call tools in AUTO
         * mode and answer from nothing — the "static / hallucinated" failure.
         * The request is already routed to a data specialist, so forcing a tool
         * call on the first round guarantees the answer is grounded in real data.
         * Later rounds use AUTO so the model can stop and synthesize.
         */
        const mode = round === 0 ? 'ANY' : 'AUTO';
        const raw = await this.fetchGemini(
          systemPrompt, contents, functionDeclarations, aiConfig, apiKey, controller.signal, mode, enableSearch, thinkingLevel,
        );
        if (!raw) return null;

        const parts = raw.candidates?.[0]?.content?.parts ?? [];
        const functionCalls = parts
          .map((part) => part.functionCall)
          .filter((fnCall): fnCall is NonNullable<GeminiPart['functionCall']> => fnCall != null);

        if (functionCalls.length > 0) {
          /**
           * WHY: Gemini can return several functionCall parts in one turn
           * (parallel calling). History must replay the model turn verbatim and
           * answer every call in one user turn, otherwise the next request fails
           * with a functionCall/functionResponse part-count mismatch.
           * For Gemini 3.x, each functionResponse must echo back the functionCall id.
           */
          contents.push({ role: 'model', parts });
          const responseParts: GeminiPart[] = [];
          for (const fnCall of functionCalls) {
            const ran = await this.runTool(toolMap, fnCall.name, fnCall.args);
            if (ran.denied) anyToolDenied = true;
            if (ran.failed) anyToolFailed = true;
            toolsUsed.push(fnCall.name);
            responseParts.push({
              functionResponse: {
                id: fnCall.id,
                name: fnCall.name,
                response: { result: ran.output as Record<string, unknown> },
              },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
          continue;
        }

        const answer = this.extractText(raw);
        if (answer) return { answer, anyToolDenied, anyToolFailed, toolsUsed };
        return null;
      }

      /**
       * WHY: Exhausting tool rounds used to return null, throwing away every
       * Gemini and downstream call already made. One final request with function
       * calling disabled forces a text synthesis from the results gathered so far.
       */
      const final = await this.fetchGemini(
        systemPrompt, contents, functionDeclarations, aiConfig, apiKey, controller.signal, 'NONE', enableSearch, thinkingLevel,
      );
      const finalAnswer = final ? this.extractText(final) : null;
      return finalAnswer ? { answer: finalAnswer, anyToolDenied, anyToolFailed, toolsUsed } : null;
    } catch (err: unknown) {
      this.logger.warn(`Gemini tool call failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * WHY: Follow-up questions ("what about August?", "and my sick days?") only
   * resolve when Gemini sees the prior turns. The current user message is
   * persisted before the turn executes, so it arrives duplicated as the last
   * history entry — drop it to avoid sending the question twice.
   */
  private historyContents(history: ConversationHistoryMessage[], currentUserMessage: string): GeminiContent[] {
    const turns = history.filter((message) => {
      const role = message.role.toUpperCase();
      return (role === 'USER' || role === 'ASSISTANT') && message.content.trim().length > 0;
    });

    const last = turns[turns.length - 1];
    if (last && last.role.toUpperCase() === 'USER' && last.content.trim() === currentUserMessage.trim()) {
      turns.pop();
    }

    return turns.map((message) => ({
      role: message.role.toUpperCase() === 'USER' ? 'user' : 'model',
      parts: [{ text: message.content.slice(0, MAX_HISTORY_CHARS) }],
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

  private extractText(response: GeminiApiResponse): string | null {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((part) => typeof part.text === 'string' && (part.text ?? '').trim().length > 0);
    return textPart?.text ? textPart.text.trim() : null;
  }

  private async fetchGemini(
    systemPrompt: string,
    contents: GeminiContent[],
    functionDeclarations: unknown[],
    config: AiAgenticConfig,
    apiKey: string,
    signal: AbortSignal,
    mode: 'ANY' | 'AUTO' | 'NONE',
    enableSearch: boolean,
    thinkingLevel: string,
  ): Promise<GeminiApiResponse | null> {
    try {
      const resp = await fetch(
        `${config.geminiApiUrl}/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools: buildToolsArray(functionDeclarations, enableSearch),
            toolConfig: { functionCallingConfig: { mode } },
            /**
             * WHY: Gemini 3.x docs say "strongly recommend not changing default
             * values" for temperature/top_p/top_k — their reasoning capabilities
             * are optimized for defaults. thinking_level controls reasoning depth
             * without interfering with the generation distribution.
             */
            generationConfig: resolveThinkingConfig(thinkingLevel),
          }),
        },
      );
      if (!resp.ok) {
        this.logger.warn(`Gemini API returned ${resp.status}`);
        return null;
      }
      return (await resp.json()) as GeminiApiResponse;
    } catch {
      return null;
    }
  }
}

/**
 * WHY: Google Search is a Gemini built-in tool added alongside custom function
 * declarations so the general-help agent can ground answers in real-time web
 * content when no internal knowledge document covers the question.
 */
function buildToolsArray(functionDeclarations: unknown[], enableSearch: boolean): unknown[] {
  const arr: unknown[] = [{ functionDeclarations }];
  if (enableSearch) arr.push({ googleSearch: {} });
  return arr;
}

/**
 * WHY: Gemini 3.x uses thinking_level (low/medium/high) to control reasoning
 * depth. Temperature is intentionally omitted — 3.x defaults are optimal and
 * overriding them degrades quality. 'none' means no thinking config at all
 * (useful for simple lookups where reasoning adds latency without benefit).
 */
function resolveThinkingConfig(level: string | undefined): Record<string, unknown> {
  if (!level || level === 'none') return {};
  const valid = new Set(['low', 'medium', 'high']);
  if (!valid.has(level)) return {};
  return { thinkingConfig: { thinking_level: level } };
}

function isFlagged(result: unknown, flag: 'denied' | 'unavailable'): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as Record<string, unknown>)[flag] === true;
}
