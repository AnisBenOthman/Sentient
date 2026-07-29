import { KnowledgeItemStatus } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
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

  it('prefers pgvector ANN results when an embedder is configured', async () => {
    const rawQueries: string[] = [];
    const prisma = {
      $queryRaw: async (strings: TemplateStringsArray, ..._values: unknown[]) => {
        rawQueries.push(strings.join('?'));
        return [{ id: 'doc-2' }, { id: 'doc-1' }];
      },
      vectorDocument: {
        findMany: async ({ where }: { where: { id?: { in: string[] } } }) => {
          // Vector path fetches by id; keyword path would pass an OR filter instead.
          expect(where.id?.in).toEqual(['doc-2', 'doc-1']);
          return [
            { id: 'doc-1', content: 'first', chunkIndex: 0, knowledgeItem: { id: 'item-1', status: KnowledgeItemStatus.ACTIVE } },
            { id: 'doc-2', content: 'second', chunkIndex: 1, knowledgeItem: { id: 'item-1', status: KnowledgeItemStatus.ACTIVE } },
          ];
        },
      },
    } as unknown as PrismaService;
    const embedder = {
      isConfigured: () => true,
      embed: async () => [0.1, 0.2, 0.3],
    } as unknown as EmbeddingService;
    const repository = new KnowledgeRepository(prisma, embedder);

    const results = await repository.searchApproved('parental leave entitlement', 5);

    // WHY: ANN ordering (doc-2 closest) must survive the id-batch refetch.
    expect(results.map((result) => result.document.id)).toEqual(['doc-2', 'doc-1']);
    expect(rawQueries[0]).toContain('embedding_vec');
  });

  it('falls back to keyword retrieval when the embedder is unavailable', async () => {
    const { repository, queries } = buildRepository([
      { id: 'doc-1', content: 'Annual leave carryover is limited to 5 days per year.' },
    ]);
    // No embedder injected at all — vector search must be skipped silently.
    const results = await repository.searchApproved('annual leave carryover', 5);

    expect(results.length).toBeGreaterThan(0);
    expect(queries.length).toBe(1);
  });

  it('falls back to keyword retrieval when the vector query fails', async () => {
    const keywordQueries: CapturedQuery[] = [];
    const prisma = {
      $queryRaw: async () => {
        throw new Error('column "embedding_vec" does not exist');
      },
      vectorDocument: {
        findMany: async (query: CapturedQuery) => {
          keywordQueries.push(query);
          return [];
        },
      },
    } as unknown as PrismaService;
    const embedder = {
      isConfigured: () => true,
      embed: async () => [0.1, 0.2],
    } as unknown as EmbeddingService;
    const repository = new KnowledgeRepository(prisma, embedder);

    const results = await repository.searchApproved('annual leave carryover', 5);

    expect(results).toEqual([]);
    expect(keywordQueries.length).toBe(1);
  });
});
