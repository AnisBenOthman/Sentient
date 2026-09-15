import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { KnowledgeEmbeddingBackfillService } from './knowledge-embedding-backfill.service';
import { KnowledgeRepository } from './knowledge.repository';

@Module({
  providers: [EmbeddingService, KnowledgeRepository, KnowledgeEmbeddingBackfillService],
  exports: [EmbeddingService, KnowledgeRepository],
})
export class KnowledgeModule {}
