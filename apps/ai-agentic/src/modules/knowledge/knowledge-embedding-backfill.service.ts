import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { KnowledgeRepository } from './knowledge.repository';

const BATCH_SIZE = 16;
/** Safety cap per boot so a huge corpus cannot hammer the embedding API at startup. */
const MAX_DOCUMENTS_PER_RUN = 500;

/**
 * WHY: Vector search only works for rows that carry an embedding, but the
 * corpus was seeded before the embedding column existed. This backfill runs
 * once per boot, off the request path, and embeds approved documents in small
 * batches — searches served meanwhile simply use the keyword fallback.
 */
@Injectable()
export class KnowledgeEmbeddingBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeEmbeddingBackfillService.name);

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly embedder: EmbeddingService,
  ) {}

  onApplicationBootstrap(): void {
    // WHY: unit tests bootstrap Nest modules without network access; never
    // fire embedding calls from inside a Jest worker.
    if (process.env.JEST_WORKER_ID) return;
    if (!this.embedder.isConfigured()) {
      this.logger.log('Embedding provider not configured; knowledge retrieval stays on keyword fallback.');
      return;
    }
    void this.backfill().catch((error: unknown) => {
      this.logger.warn(
        `Embedding backfill aborted: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }

  async backfill(): Promise<number> {
    let embedded = 0;
    while (embedded < MAX_DOCUMENTS_PER_RUN) {
      const batch = await this.repository.findUnembeddedApproved(BATCH_SIZE);
      if (batch.length === 0) break;

      const embeddings = await this.embedder.embedMany(batch.map((document) => document.content));
      if (!embeddings) break;

      let storedInBatch = 0;
      for (const [index, document] of batch.entries()) {
        const embedding = embeddings[index];
        if (!embedding) continue;
        await this.repository.storeEmbedding(document.id, embedding);
        storedInBatch += 1;
        embedded += 1;
      }
      /** WHY: if nothing in the batch embedded (all dimension-mismatched), the
       *  same rows would be re-fetched forever — stop instead of spinning. */
      if (storedInBatch === 0) break;
      if (batch.length < BATCH_SIZE) break;
    }

    if (embedded > 0) {
      this.logger.log(`Embedded ${embedded} knowledge document(s) for vector retrieval.`);
    }
    return embedded;
  }
}
