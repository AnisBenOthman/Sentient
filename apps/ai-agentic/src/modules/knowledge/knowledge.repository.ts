import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  KnowledgeItem,
  KnowledgeItemStatus,
  KnowledgeSourceType,
  Prisma,
  VectorDocument,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

export interface KnowledgeSearchResult {
  document: VectorDocument;
  item: KnowledgeItem | null;
}

/**
 * WHY: Retrieval is vector-first (pgvector ANN over Gemini embeddings) so
 * paraphrased questions match policy text semantically. The keyword token
 * search below remains as the fallback for environments without an embedding
 * provider, for corpora that have not been backfilled yet, and for queries
 * where the ANN search finds nothing.
 */
const SEARCH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'when', 'where', 'which',
  'who', 'whom', 'how', 'why', 'can', 'could', 'should', 'would', 'will', 'are',
  'was', 'were', 'has', 'have', 'had', 'does', 'did', 'about', 'into', 'from',
  'please', 'tell', 'show', 'give', 'need', 'want', 'know', 'help', 'our',
  'your', 'their', 'them', 'they', 'you', 'not', 'all', 'any', 'get', 'its',
]);
const MAX_SEARCH_TOKENS = 6;

function tokenizeQuery(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token));
  return [...new Set(tokens)].slice(0, MAX_SEARCH_TOKENS);
}

/** pgvector text input format: '[0.1,0.2,...]' — passed as a parameter and cast with ::vector. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

@Injectable()
export class KnowledgeRepository {
  private readonly logger = new Logger(KnowledgeRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly embedder?: EmbeddingService,
  ) {}

  async listActiveItems(limit = 20): Promise<KnowledgeItem[]> {
    return this.prisma.knowledgeItem.findMany({
      where: { status: KnowledgeItemStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async searchApproved(query: string, limit = 5): Promise<KnowledgeSearchResult[]> {
    const vectorResults = await this.searchByVector(query, limit);
    if (vectorResults && vectorResults.length > 0) return vectorResults;
    return this.searchByKeywords(query, limit);
  }

  /**
   * ANN search over pgvector. Returns null when the embedder is unavailable or
   * the raw query fails (e.g. migration not applied) so the caller falls back
   * to keyword retrieval instead of surfacing an error to the agent.
   */
  private async searchByVector(query: string, limit: number): Promise<KnowledgeSearchResult[] | null> {
    if (!this.embedder?.isConfigured()) return null;
    const embedding = await this.embedder.embed(query);
    if (!embedding) return null;

    try {
      const vectorLiteral = toVectorLiteral(embedding);
      // WHY: filter FIRST (approved knowledge item, embedded rows), then ANN on
      // the filtered subset — the hybrid-query rule from the RAG architecture.
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT vd."id"
        FROM "ai_agent"."vector_documents" vd
        JOIN "ai_agent"."knowledge_items" ki ON ki."id" = vd."knowledge_item_id"
        WHERE ki."status" = 'ACTIVE'
          AND vd."embedding_vec" IS NOT NULL
        ORDER BY vd."embedding_vec" <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;
      if (rows.length === 0) return [];

      const orderedIds = rows.map((row) => row.id);
      const documents = await this.prisma.vectorDocument.findMany({
        where: { id: { in: orderedIds } },
        include: { knowledgeItem: true },
      });
      const byId = new Map(documents.map((document) => [document.id, document]));
      return orderedIds
        .map((id) => byId.get(id))
        .filter((document): document is (typeof documents)[number] => document != null)
        .map((document) => ({ document, item: document.knowledgeItem }));
    } catch (error: unknown) {
      this.logger.warn(
        `Vector search unavailable, falling back to keyword retrieval: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private async searchByKeywords(query: string, limit: number): Promise<KnowledgeSearchResult[]> {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    // WHY: documents without an approved KnowledgeItem must never be cited —
    // the previous knowledgeItemId:null escape let unapproved chunks through.
    const documents = await this.prisma.vectorDocument.findMany({
      where: {
        OR: tokens.map((token) => ({
          content: { contains: token, mode: 'insensitive' as const },
        })),
        knowledgeItem: { status: KnowledgeItemStatus.ACTIVE },
      },
      include: { knowledgeItem: true },
      orderBy: { createdAt: 'desc' },
      take: limit * 4,
    });

    const scored = documents
      .map((document) => {
        const content = document.content.toLowerCase();
        const matchCount = tokens.filter((token) => content.includes(token)).length;
        return { document, matchCount };
      })
      .sort((left, right) => right.matchCount - left.matchCount)
      .slice(0, limit);

    return scored.map(({ document }) => ({
      document,
      item: document.knowledgeItem,
    }));
  }

  /** Documents that still need an embedding (backfill + future ingestion both use this). */
  async findUnembeddedApproved(limit: number): Promise<Array<{ id: string; content: string }>> {
    return this.prisma.$queryRaw<Array<{ id: string; content: string }>>`
      SELECT vd."id", vd."content"
      FROM "ai_agent"."vector_documents" vd
      JOIN "ai_agent"."knowledge_items" ki ON ki."id" = vd."knowledge_item_id"
      WHERE ki."status" = 'ACTIVE'
        AND vd."embedding_vec" IS NULL
      ORDER BY vd."created_at" ASC
      LIMIT ${limit}
    `;
  }

  /** Raw update because Prisma cannot write Unsupported("vector") columns. */
  async storeEmbedding(documentId: string, embedding: number[]): Promise<void> {
    const vectorLiteral = toVectorLiteral(embedding);
    await this.prisma.$executeRaw`
      UPDATE "ai_agent"."vector_documents"
      SET "embedding_vec" = ${vectorLiteral}::vector
      WHERE "id" = ${documentId}
    `;
  }

  async upsertKnowledgeItem(input: {
    sourceType: KnowledgeSourceType;
    sourceId?: string | null;
    title: string;
    contentHash: string;
    metadata?: Prisma.InputJsonObject;
  }): Promise<KnowledgeItem> {
    const existing = await this.prisma.knowledgeItem.findFirst({
      where: {
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
      },
    });

    if (!existing) {
      return this.prisma.knowledgeItem.create({
        data: {
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          title: input.title,
          contentHash: input.contentHash,
          metadata: input.metadata ?? {},
        },
      });
    }

    return this.prisma.knowledgeItem.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        contentHash: input.contentHash,
        metadata: input.metadata ?? {},
        status: KnowledgeItemStatus.ACTIVE,
      },
    });
  }
}
