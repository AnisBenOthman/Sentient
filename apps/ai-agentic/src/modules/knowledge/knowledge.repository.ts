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
    const documents = await this.prisma.vectorDocument.findMany({
      where: {
        content: { contains: query, mode: 'insensitive' },
        OR: [
          { knowledgeItemId: null },
          { knowledgeItem: { status: KnowledgeItemStatus.ACTIVE } },
        ],
      },
      include: { knowledgeItem: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return documents.map((document) => ({
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
