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
 * Returns null when Gemini is unavailable so every caller falls back gracefully.
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
  ): Promise<GeminiToolCallOutcome | null> {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey || tools.length === 0) return null;

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
          return { answer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() };
        }
        return null;
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
      return finalAnswer
        ? { answer: finalAnswer, anyToolDenied, anyToolFailed, toolsUsed, providerUsed: this.providerName, ...usageFields() }
        : null;
    } catch (err: unknown) {
      this.logger.warn(`Gemini SDK call failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
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
