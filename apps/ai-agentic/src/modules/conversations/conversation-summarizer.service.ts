import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Message } from '../../generated/prisma';
import { AiAgenticConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { RECENT_MESSAGE_WINDOW } from './conversation-context.service';

/**
 * WHY: Context sent to the LLM is a fixed window of the newest messages, so
 * long conversations silently forget everything older. This service maintains
 * a rolling summary of the messages that fell out of that window, refreshed in
 * batches so we never re-summarize the same turns on every message.
 */

/** Regenerate the summary only after this many new messages left the window. */
const SUMMARY_BATCH_STEP = 4;
/** Upper bound for the stored summary; the tail (most recent facts) is kept on overflow. */
const MAX_SUMMARY_CHARS = 2_000;
/** Per-message cap for the deterministic fallback summary. */
const MAX_FALLBACK_MESSAGE_CHARS = 160;
/** Per-message cap for text forwarded to the LLM summarizer. */
const MAX_LLM_MESSAGE_CHARS = 1_000;

const SUMMARY_SYSTEM_PROMPT =
  'You summarize HR assistant conversations. Produce a compact factual summary (max 150 words) of the exchange below, ' +
  'preserving concrete facts the assistant may need later: dates, leave types, balances, names of policies, decisions made, ' +
  'and open questions. Merge it with the previous summary when one is provided. Output only the summary text.';

@Injectable()
export class ConversationSummarizerService {
  private readonly logger = new Logger(ConversationSummarizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /**
   * Refreshes the conversation's rolling summary when enough messages have
   * fallen out of the recent-message window. Never throws — summarization is
   * best-effort and must not fail a turn.
   */
  async maybeSummarize(conversationId: string): Promise<void> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contextSummary: true, summarizedMessageCount: true },
      });
      if (!conversation) return;

      const totalMessages = await this.prisma.message.count({ where: { conversationId } });
      const overflow = totalMessages - RECENT_MESSAGE_WINDOW;
      if (overflow <= 0 || overflow < conversation.summarizedMessageCount + SUMMARY_BATCH_STEP) return;

      const newlyExpired = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: conversation.summarizedMessageCount,
        take: overflow - conversation.summarizedMessageCount,
      });
      if (newlyExpired.length === 0) return;

      const summary = await this.compose(conversation.contextSummary, newlyExpired);
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          contextSummary: summary,
          summarizedMessageCount: overflow,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Conversation summarization skipped for ${conversationId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async compose(previousSummary: string | null, messages: Message[]): Promise<string> {
    const llmSummary = await this.composeWithLlm(previousSummary, messages);
    if (llmSummary) return this.clamp(llmSummary);
    return this.clamp(this.composeDeterministic(previousSummary, messages));
  }

  private async composeWithLlm(previousSummary: string | null, messages: Message[]): Promise<string | null> {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig?.geminiApiKey) return null;

    const transcript = messages
      .map((message) => `${message.role}: ${message.content.slice(0, MAX_LLM_MESSAGE_CHARS)}`)
      .join('\n');
    const prompt = previousSummary
      ? `Previous summary:\n${previousSummary}\n\nNew messages:\n${transcript}`
      : `Messages:\n${transcript}`;

    try {
      const ai = new GoogleGenAI({
        apiKey: aiConfig.geminiApiKey,
        httpOptions: { timeout: aiConfig.downstreamTimeoutMs ?? 8_000 },
      });
      const response = await ai.models.generateContent({
        model: aiConfig.geminiModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction: SUMMARY_SYSTEM_PROMPT },
      });
      const text = response.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch (error: unknown) {
      this.logger.warn(
        `LLM summary unavailable, using extractive fallback: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  /**
   * WHY: The summary must still exist when no LLM provider is configured
   * (tests, local dev without keys) — an extractive digest beats forgetting.
   */
  private composeDeterministic(previousSummary: string | null, messages: Message[]): string {
    const lines = messages.map((message) => {
      const singleLine = message.content.replace(/\s+/g, ' ').trim();
      const truncated =
        singleLine.length > MAX_FALLBACK_MESSAGE_CHARS
          ? `${singleLine.slice(0, MAX_FALLBACK_MESSAGE_CHARS)}…`
          : singleLine;
      return `${message.role.toLowerCase()}: ${truncated}`;
    });
    return [previousSummary, ...lines].filter((part): part is string => Boolean(part)).join('\n');
  }

  /** Keeps the tail on overflow — the most recent facts matter most in a rolling summary. */
  private clamp(summary: string): string {
    if (summary.length <= MAX_SUMMARY_CHARS) return summary;
    return `…${summary.slice(summary.length - MAX_SUMMARY_CHARS)}`;
  }
}
