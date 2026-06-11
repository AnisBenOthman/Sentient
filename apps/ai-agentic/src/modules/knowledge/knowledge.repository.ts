import { Injectable } from '@nestjs/common';
import {
  KnowledgeItem,
  KnowledgeItemStatus,
  KnowledgeSourceType,
  Prisma,
  VectorDocument,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface KnowledgeSearchResult {
  document: VectorDocument;
  item: KnowledgeItem | null;
}

/**
 * WHY: Whole-message substring matching never hits for natural questions, so
 * retrieval is keyword-based: significant query tokens are OR-matched and the
 * results ranked by how many distinct tokens each chunk contains. Real
 * embedding search can replace this without changing the call sites.
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

@Injectable()
export class KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveItems(limit = 20): Promise<KnowledgeItem[]> {
    return this.prisma.knowledgeItem.findMany({
      where: { status: KnowledgeItemStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async searchApproved(query: string, limit = 5): Promise<KnowledgeSearchResult[]> {
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
