import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Content, Part, FunctionCallingConfigMode } from '@google/genai';
import { AiAgenticConfig } from '../../../config';
import {
  AgentTool,
  ConversationHistoryMessage,
  GeminiCallOptions,
  GeminiFunctionDeclaration,
  GeminiToolCallOutcome,
} from './agent-tool.types';
import { LlmCallResult, LlmFailureSink } from './llm-failure';
import { LlmToolCallerAdapter } from './llm-tool-caller.interface';

const MAX_TOOL_ROUNDS = 5;

/** Defensive cap per history turn so long prior answers cannot bloat the prompt. */
const MAX_HISTORY_CHARS = 4_000;

interface ToolRunResult {
  output: unknown;
  denied: boolean;
  failed: boolean;
}

/**
 * Runs a multi-turn Gemini function-calling loop using the official @google/genai SDK.
 * WHY: Replaces the raw-fetch implementation to get proper SDK type safety, automatic
 * retries, and correct auth handling — the SDK passes the API key as a query param
 * exactly as the generativelanguage.googleapis.com REST endpoint expects.
 * Returns a classified `ok: false` result when Gemini is unavailable, so the
 * orchestrator can fail over and — when every provider is down — the specialists
 * can tell the user what actually happened instead of silently answering without AI.
 */
@Injectable()
export class GeminiToolCallerService implements LlmToolCallerAdapter {
  private readonly logger = new Logger(GeminiToolCallerService.name);
  readonly providerName = 'GEMINI';

  constructor(@Optional() private readonly config?: ConfigService) {}

  isConfigured(): boolean {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    return Boolean(aiConfig?.geminiApiKey);
  }

  async call(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
  ): Promise<LlmCallResult> {
    const sink = new LlmFailureSink(this.providerName);
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey || tools.length === 0) {
      sink.record(
        apiKey ? 'PROVIDER_ERROR' : 'NOT_CONFIGURED',
        apiKey ? 'No tools were supplied for this call.' : 'GEMINI has no API key configured.',
      );
      return { ok: false, failure: sink.result() };
    }

    const thinkingLevel = options.thinkingLevel ?? aiConfig.geminiThinkingLevel;
    const enableSearch = options.enableSearch ?? false;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: (aiConfig.downstreamTimeoutMs ?? 8_000) * MAX_TOOL_ROUNDS },
    });

    const toolMap = new Map(tools.map((t) => [t.declaration.name, t]));
    const functionDeclarations = tools.map((t) => toSdkDeclaration(t.declaration));

    const sdkTools: object[] = [{ functionDeclarations }];
    if (enableSearch) sdkTools.push({ googleSearch: {} });

    const contents: Content[] = [
      ...this.buildHistoryContents(history, userMessage),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    let anyToolDenied = false;
    let anyToolFailed = false;
    const toolsUsed: string[] = [];
    const usage = { tokensIn: 0, tokensOut: 0, reported: false };
    const recordUsage = (metadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): void => {
      if (!metadata) return;
      usage.reported = true;
      usage.tokensIn += metadata.promptTokenCount ?? 0;
      usage.tokensOut += (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0);
    };
    const usageFields = (): { tokensIn?: number; tokensOut?: number } =>
      usage.reported ? { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut } : {};

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        /**
         * WHY: Force a tool call on round 0 (ANY mode) so weaker models don't skip
         * tools and answer from nothing. Later rounds use AUTO so the model can stop
         * and synthesize once it has enough data.
         */
        const mode = round === 0 ? FunctionCallingConfigMode.ANY : FunctionCallingConfigMode.AUTO;

        const response = await ai.models.generateContent({
          model: aiConfig.geminiModel,
          contents,
          config: {
            systemInstruction: systemPrompt,
            tools: sdkTools,
            toolConfig: { functionCallingConfig: { mode } },
            ...resolveThinkingConfig(thinkingLevel),
          },
        });

        recordUsage(response.usageMetadata);
        const candidateContent = response.candidates?.[0]?.content;
        const parts: Part[] = candidateContent?.parts ?? [];
        const functionCalls = parts.filter(
          (p): p is Part & { functionCall: NonNullable<Part['functionCall']> } =>
            p.functionCall != null,
        );

        if (functionCalls.length > 0) {
          /**
           * WHY: Gemini can return several functionCall parts in one turn (parallel
           * calling). History must replay the model turn verbatim and answer every
           * call in one user turn — otherwise the next request fails with a
           * functionCall/functionResponse part-count mismatch.
           */
          if (candidateContent) contents.push(candidateContent);

          const responseParts: Part[] = [];
          for (const part of functionCalls) {
            const { name, args, id } = part.functionCall;
            const ran = await this.runTool(toolMap, name ?? '', (args as Record<string, unknown>) ?? {});
            if (ran.denied) anyToolDenied = true;
            if (ran.failed) anyToolFailed = true;
            toolsUsed.push(name ?? '');
            responseParts.push({
              functionResponse: {
                id,
                name: name ?? '',
                response: { result: ran.output as Record<string, unknown> },
              },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
          continue;
        }

        const answer = response.text?.trim();
        if (answer) {
          return {
            ok: true,
            outcome: { answer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() },
          };
        }
        sink.record('EMPTY_RESPONSE', 'Gemini returned a round with neither function calls nor text.');
        return { ok: false, failure: sink.result() };
      }

      /**
       * WHY: Exhausting tool rounds used to discard everything gathered.
       * One final NONE-mode request forces text synthesis from the accumulated
       * tool results instead of wasting every downstream call already made.
       */
      const finalResponse = await ai.models.generateContent({
        model: aiConfig.geminiModel,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: sdkTools,
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } },
          ...resolveThinkingConfig(thinkingLevel),
        },
      });

      recordUsage(finalResponse.usageMetadata);
      const finalAnswer = finalResponse.text?.trim();
      if (finalAnswer) {
        return {
          ok: true,
          outcome: { answer: finalAnswer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() },
        };
      }
      sink.record('EMPTY_RESPONSE', 'Gemini produced no text in the final synthesis round.');
      return { ok: false, failure: sink.result() };
    } catch (err: unknown) {
      sink.recordThrown(err);
      this.logger.warn(`Gemini SDK call failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { ok: false, failure: sink.result() };
    }
  }

  /**
   * WHY a separate loop rather than sharing call()'s: the non-streaming loop
   * commits to `generateContent` per round and reads the whole answer off the
   * resolved response; this one commits to `generateContentStream` and has to
   * accumulate parts/text across chunks as they arrive to reconstruct the same
   * per-round outcome (function-call replay content, or a final answer) — the
   * two control flows diverge enough that inlining a flag into call() would
   * make both harder to follow.
   */
  async callStream(
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history: ConversationHistoryMessage[] = [],
    options: GeminiCallOptions = {},
    onToken: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmCallResult> {
    const sink = new LlmFailureSink(this.providerName);
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey || tools.length === 0) {
      sink.record(
        apiKey ? 'PROVIDER_ERROR' : 'NOT_CONFIGURED',
        apiKey ? 'No tools were supplied for this call.' : 'GEMINI has no API key configured.',
      );
      return { ok: false, failure: sink.result() };
    }

    const thinkingLevel = options.thinkingLevel ?? aiConfig.geminiThinkingLevel;
    const enableSearch = options.enableSearch ?? false;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: (aiConfig.downstreamTimeoutMs ?? 8_000) * MAX_TOOL_ROUNDS },
    });

    const toolMap = new Map(tools.map((t) => [t.declaration.name, t]));
    const functionDeclarations = tools.map((t) => toSdkDeclaration(t.declaration));
    const sdkTools: object[] = [{ functionDeclarations }];
    if (enableSearch) sdkTools.push({ googleSearch: {} });

    const contents: Content[] = [
      ...this.buildHistoryContents(history, userMessage),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    let anyToolDenied = false;
    let anyToolFailed = false;
    const toolsUsed: string[] = [];
    const usage = { tokensIn: 0, tokensOut: 0, reported: false };
    const recordUsage = (metadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): void => {
      if (!metadata) return;
      usage.reported = true;
      usage.tokensIn += metadata.promptTokenCount ?? 0;
      usage.tokensOut += (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0);
    };
    const usageFields = (): { tokensIn?: number; tokensOut?: number } =>
      usage.reported ? { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut } : {};

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (signal?.aborted) {
          sink.record('TIMEOUT', 'The streaming request was aborted before the round started.');
          return { ok: false, failure: sink.result() };
        }
        const mode = round === 0 ? FunctionCallingConfigMode.ANY : FunctionCallingConfigMode.AUTO;

        const outcome = await this.runStreamingRound(ai, {
          model: aiConfig.geminiModel,
          contents,
          systemPrompt,
          sdkTools,
          mode,
          thinkingLevel,
          onToken,
          signal,
          recordUsage,
        });

        if (outcome.kind === 'toolCalls') {
          contents.push(outcome.modelContent);
          const responseParts: Part[] = [];
          for (const part of outcome.functionCalls) {
            const { name, args, id } = part.functionCall;
            const ran = await this.runTool(toolMap, name ?? '', (args as Record<string, unknown>) ?? {});
            if (ran.denied) anyToolDenied = true;
            if (ran.failed) anyToolFailed = true;
            toolsUsed.push(name ?? '');
            responseParts.push({
              functionResponse: { id, name: name ?? '', response: { result: ran.output as Record<string, unknown> } },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
          continue;
        }

        if (!outcome.answer) {
          sink.record('EMPTY_RESPONSE', 'Gemini streamed a final round with no text.');
          return { ok: false, failure: sink.result() };
        }
        return {
          ok: true,
          outcome: { answer: outcome.answer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() },
        };
      }

      /** WHY mode NONE guarantees a text-only round: safe to stream unconditionally. */
      const finalOutcome = await this.runStreamingRound(ai, {
        model: aiConfig.geminiModel,
        contents,
        systemPrompt,
        sdkTools,
        mode: FunctionCallingConfigMode.NONE,
        thinkingLevel,
        onToken,
        signal,
        recordUsage,
      });
      if (finalOutcome.kind !== 'answer' || !finalOutcome.answer) {
        sink.record('EMPTY_RESPONSE', 'Gemini streamed no text in the final synthesis round.');
        return { ok: false, failure: sink.result() };
      }
      return {
        ok: true,
        outcome: {
          answer: finalOutcome.answer,
          anyToolDenied,
          anyToolFailed,
          toolsUsed,
          providerUsed: this.providerName,
          ...usageFields(),
        },
      };
    } catch (err: unknown) {
      sink.recordThrown(err);
      this.logger.warn(`Gemini SDK streaming call failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { ok: false, failure: sink.result() };
    }
  }

  /**
   * Runs one streamed round and classifies it exactly like the non-streaming
   * loop does: any functionCall part anywhere in the round means "tool round" —
   * nothing is forwarded to onToken (or, if a few characters already were
   * because text preceded the function call in the same round, no more are
   * after detection — the caller's `answer` is discarded either way, since a
   * tool round never returns one). No functionCall parts at all means the whole
   * round's text was genuinely streamed as it arrived, thought-parts already
   * excluded by the SDK's own `.text` getter.
   */
  private async runStreamingRound(
    ai: GoogleGenAI,
    params: {
      model: string;
      contents: Content[];
      systemPrompt: string;
      sdkTools: object[];
      mode: FunctionCallingConfigMode;
      thinkingLevel: string | undefined;
      onToken: (delta: string) => void;
      signal?: AbortSignal;
      recordUsage: (metadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }) => void;
    },
  ): Promise<
    | { kind: 'toolCalls'; modelContent: Content; functionCalls: Array<Part & { functionCall: NonNullable<Part['functionCall']> }> }
    | { kind: 'answer'; answer: string | null }
  > {
    const stream = await ai.models.generateContentStream({
      model: params.model,
      contents: params.contents,
      config: {
        systemInstruction: params.systemPrompt,
        tools: params.sdkTools,
        toolConfig: { functionCallingConfig: { mode: params.mode } },
        ...resolveThinkingConfig(params.thinkingLevel),
      },
    });

    const accumulatedParts: Part[] = [];
    let sawFunctionCall = false;
    let answer = '';

    for await (const chunk of stream) {
      if (params.signal?.aborted) break;
      params.recordUsage(chunk.usageMetadata);
      const parts: Part[] = chunk.candidates?.[0]?.content?.parts ?? [];
      accumulatedParts.push(...parts);
      if (parts.some((part) => part.functionCall != null)) sawFunctionCall = true;

      if (!sawFunctionCall && chunk.text) {
        answer += chunk.text;
        params.onToken(chunk.text);
      }
    }

    if (sawFunctionCall) {
      const functionCalls = accumulatedParts.filter(
        (p): p is Part & { functionCall: NonNullable<Part['functionCall']> } => p.functionCall != null,
      );
      return { kind: 'toolCalls', modelContent: { role: 'model', parts: accumulatedParts }, functionCalls };
    }
    return { kind: 'answer', answer: answer.trim() || null };
  }

  /**
   * WHY: Follow-up questions only resolve when Gemini sees prior turns.
   * The current user message is persisted before the turn executes, so it
   * arrives duplicated as the last history entry — drop it to avoid sending
   * the question twice.
   */
  private buildHistoryContents(history: ConversationHistoryMessage[], currentUserMessage: string): Content[] {
    const turns = history.filter((m) => {
      const role = m.role.toUpperCase();
      return (role === 'USER' || role === 'ASSISTANT') && m.content.trim().length > 0;
    });

    const last = turns[turns.length - 1];
    if (last && last.role.toUpperCase() === 'USER' && last.content.trim() === currentUserMessage.trim()) {
      turns.pop();
    }

    return turns.map((m) => ({
      role: m.role.toUpperCase() === 'USER' ? 'user' : 'model',
      parts: [{ text: m.content.slice(0, MAX_HISTORY_CHARS) }],
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
}

/**
 * WHY: The SDK's FunctionDeclaration.parameters expects uppercase 'OBJECT' for the
 * type field (matching the Gemini REST API schema). Our AgentTool declarations use
 * lowercase 'object' (neutral JSON Schema) shared with the OpenAI-compatible adapters,
 * so this is the one place that bridges the difference.
 */
function toSdkDeclaration(declaration: GeminiFunctionDeclaration): object {
  if (!declaration.parameters) {
    return { name: declaration.name, description: declaration.description };
  }
  return {
    name: declaration.name,
    description: declaration.description,
    parameters: { ...declaration.parameters, type: 'OBJECT' },
  };
}

/**
 * WHY: Gemini 2.5 uses thinkingBudget (token count) to control reasoning depth.
 * 'none' or missing → no thinking config (fast lookups).
 * low/medium/high → increasing token budgets for progressively deeper reasoning.
 */
function resolveThinkingConfig(level: string | undefined): Record<string, unknown> {
  if (!level || level === 'none') return {};
  const budgets: Record<string, number> = { low: 1024, medium: 4096, high: 8192 };
  const budget = budgets[level];
  if (budget === undefined) return {};
  return { thinkingConfig: { thinkingBudget: budget } };
}

function isFlagged(result: unknown, flag: 'denied' | 'unavailable'): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as Record<string, unknown>)[flag] === true;
}
