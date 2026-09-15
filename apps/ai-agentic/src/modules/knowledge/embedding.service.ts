import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiAgenticConfig } from '../../config';

/** Must match the vector(768) column on vector_documents — reject anything else. */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * WHY: Single owner of text→vector conversion so retrieval and ingestion share
 * one model and one dimension contract. Returns null instead of throwing when
 * the provider is unconfigured or unavailable — callers fall back to keyword
 * search, mirroring the graceful-degradation rule used by every LLM adapter.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  private aiConfig(): AiAgenticConfig | undefined {
    return this.config?.get<AiAgenticConfig>('aiAgentic');
  }

  isConfigured(): boolean {
    return Boolean(this.aiConfig()?.geminiApiKey);
  }

  async embed(text: string): Promise<number[] | null> {
    const results = await this.embedMany([text]);
    return results?.[0] ?? null;
  }

  async embedMany(texts: string[]): Promise<Array<number[] | null> | null> {
    const aiConfig = this.aiConfig();
    if (!aiConfig?.geminiApiKey || texts.length === 0) return null;

    try {
      const ai = new GoogleGenAI({
        apiKey: aiConfig.geminiApiKey,
        httpOptions: { timeout: aiConfig.downstreamTimeoutMs ?? 8_000 },
      });
      const response = await ai.models.embedContent({
        model: aiConfig.geminiEmbeddingModel,
        contents: texts,
      });
      const embeddings = response.embeddings ?? [];
      return texts.map((_, index) => {
        const values = embeddings[index]?.values;
        if (!values || values.length !== EMBEDDING_DIMENSIONS) {
          if (values) {
            this.logger.warn(
              `Embedding dimension mismatch: got ${values.length}, expected ${EMBEDDING_DIMENSIONS} — check GEMINI_EMBEDDING_MODEL.`,
            );
          }
          return null;
        }
        return values;
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Embedding call failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
