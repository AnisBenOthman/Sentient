import { KnowledgeItemStatus } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeRepository } from './knowledge.repository';

interface CapturedQuery {
  where: Record<string, unknown>;
}

function buildRepository(documents: Array<{ id: string; content: string }>): {
  repository: KnowledgeRepository;
  queries: CapturedQuery[];
} {
  const queries: CapturedQuery[] = [];
  const prisma = {
    vectorDocument: {
      findMany: async (query: CapturedQuery) => {
        queries.push(query);
        return documents.map((document) => ({
          ...document,
          chunkIndex: 0,
          knowledgeItem: { id: 'item-1', title: 'Leave policy', status: KnowledgeItemStatus.ACTIVE },
        }));
      },
    },
  } as unknown as PrismaService;
  return { repository: new KnowledgeRepository(prisma), queries };
}

describe('KnowledgeRepository.searchApproved', () => {
  it('matches documents by significant query tokens instead of the whole message', async () => {
    const { repository, queries } = buildRepository([
      { id: 'doc-1', content: 'Annual leave carryover is limited to 5 days per year.' },
      { id: 'doc-2', content: 'Performance reviews run twice a year.' },
    ]);

    const results = await repository.searchApproved('What is the carryover rule for annual leave?', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.document.id).toBe('doc-1');
    const where = queries[0]?.where as { OR?: unknown[]; knowledgeItem?: unknown };
    expect(Array.isArray(where.OR)).toBe(true);
    // WHY: the previous knowledgeItemId:null escape allowed unapproved chunks.
    expect(where.knowledgeItem).toEqual({ status: KnowledgeItemStatus.ACTIVE });
  });

  it('returns no results for queries with no significant tokens', async () => {
    const { repository, queries } = buildRepository([]);

    const results = await repository.searchApproved('is it so?', 5);

    expect(results).toEqual([]);
    expect(queries.length).toBe(0);
  });
});
