import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { AiAgenticConfig } from '../../../config';
import { deterministicResult } from './specialist-response.helpers';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface OpenAiCompatibleChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface OpenAiRewriteSettings {
  apiKey: string;
  apiUrl: string;
  model: string;
  label: 'OpenRouter' | 'Groq';
}

@Injectable()
export class LanguageAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LANGUAGE_AGENT;
  private readonly logger = new Logger(LanguageAgentService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const phrase = this.extractPhrase(input.userMessage);
    if (phrase.length === 0) {
      return deterministicResult(
        input,
        this.agentType,
        'Language support prepared.',
        'Share the exact phrase you want to improve, and I will keep the intent while making the wording clearer, respectful, and workplace-appropriate.',
        'LANGUAGE',
        'Workplace tone guidance',
        { draftLabel: 'Phrase rewrite draft' },
      );
    }

    const rewritten = await this.rewritePhrase(phrase);
    /**
     * WHY: FR-041 — without the LLM the agent cannot actually rewrite, so the
     * fallback labels the echo honestly instead of presenting the unchanged
     * phrase as a "professional version".
     */
    const content = rewritten
      ? `Professional version: ${rewritten}`
      : `AI rewriting is not available right now, so here is your phrase unchanged: "${phrase}". Quick tips: lead with the request, keep it factual, and avoid blame-focused wording.`;
    return deterministicResult(input, this.agentType, 'Language support prepared.', content, 'LANGUAGE', 'Workplace tone guidance', {
      draftLabel: 'Phrase rewrite draft',
    });
  }

  private extractPhrase(message: string): string {
    const quoted = message.match(/["“”']([^"“”']{3,})["“”']/);
    if (quoted?.[1]) return quoted[1].trim();
    const colonIndex = message.indexOf(':');
    if (colonIndex >= 0 && colonIndex < message.length - 1) {
      return message.slice(colonIndex + 1).trim();
    }
    return message
      .replace(/^.*?(reword|rewrite|phrase|wording|professional(?:ize|ly)?)/i, '')
      .replace(/^[\s:,.-]*(this|that|my (?:message|phrase|sentence|email))?[\s:,.-]*/i, '')
      .trim();
  }

  private async rewriteWithGemini(phrase: string): Promise<string | null> {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiConfig.intentClassifierTimeoutMs);
    try {
      const response = await fetch(
        `${aiConfig.geminiApiUrl}/models/${encodeURIComponent(aiConfig.geminiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: [
                      'Rewrite this workplace phrase to be clear, respectful, and professional.',
                      'Preserve the meaning and the facts. Do not add new claims.',
                      'Return only the rewritten phrase, no quotes, no markdown.',
                      `Phrase: ${phrase}`,
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.2 },
          }),
        },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as GeminiGenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch (error: unknown) {
      this.logger.warn(`Phrase rewrite failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async rewritePhrase(phrase: string): Promise<string | null> {
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig) return null;

    const order = aiConfig.llmProviderOrder.length > 0 ? aiConfig.llmProviderOrder : ['GEMINI'];
    for (const provider of order) {
      const normalizedProvider = provider.trim().toUpperCase();
      const rewritten =
        normalizedProvider === 'OPENROUTER'
          ? await this.rewriteWithOpenRouter(phrase, aiConfig)
          : normalizedProvider === 'GROQ'
            ? await this.rewriteWithGroq(phrase, aiConfig)
            : normalizedProvider === 'GEMINI'
              ? await this.rewriteWithGemini(phrase)
              : null;
      if (rewritten) return rewritten;
    }

    return null;
  }

  private async rewriteWithOpenRouter(phrase: string, aiConfig: AiAgenticConfig): Promise<string | null> {
    const apiKey = aiConfig.openRouterApiKey;
    if (!apiKey) return null;
    return this.rewriteWithOpenAiCompatibleProvider(phrase, aiConfig, {
      apiKey,
      apiUrl: aiConfig.openRouterApiUrl,
      model: aiConfig.openRouterModel,
      label: 'OpenRouter',
    });
  }

  private async rewriteWithGroq(phrase: string, aiConfig: AiAgenticConfig): Promise<string | null> {
    const apiKey = aiConfig.groqApiKey;
    if (!apiKey) return null;
    return this.rewriteWithOpenAiCompatibleProvider(phrase, aiConfig, {
      apiKey,
      apiUrl: aiConfig.groqApiUrl,
      model: aiConfig.groqModel,
      label: 'Groq',
    });
  }

  private async rewriteWithOpenAiCompatibleProvider(
    phrase: string,
    aiConfig: AiAgenticConfig,
    settings: OpenAiRewriteSettings,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiConfig.intentClassifierTimeoutMs);
    try {
      const response = await fetch(`${settings.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Sentient AI Agentic',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          messages: [
            {
              role: 'user',
              content: [
                'Rewrite this workplace phrase to be clear, respectful, and professional.',
                'Preserve the meaning and the facts. Do not add new claims.',
                'Return only the rewritten phrase, no quotes, no markdown.',
                `Phrase: ${phrase}`,
              ].join('\n'),
            },
          ],
          temperature: 0.2,
        }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as OpenAiCompatibleChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content?.trim();
      return text && text.length > 0 ? text : null;
    } catch (error: unknown) {
      this.logger.warn(`${settings.label} phrase rewrite failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
