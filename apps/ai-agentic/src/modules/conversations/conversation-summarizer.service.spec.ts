import { MessageRole } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationSummarizerService } from './conversation-summarizer.service';

interface UpdateCall {
  data: { contextSummary: string; summarizedMessageCount: number };
}

function buildPrisma(options: {
  summarizedMessageCount: number;
  contextSummary: string | null;
  totalMessages: number;
  expiredMessages: Array<{ role: MessageRole; content: string }>;
}): { prisma: PrismaService; updates: UpdateCall[] } {
  const updates: UpdateCall[] = [];
  const prisma = {
    conversation: {
      findUnique: async () => ({
        contextSummary: options.contextSummary,
        summarizedMessageCount: options.summarizedMessageCount,
      }),
      update: async (call: UpdateCall) => {
        updates.push(call);
        return {};
      },
    },
    message: {
      count: async () => options.totalMessages,
      findMany: async ({ skip, take }: { skip: number; take: number }) =>
        options.expiredMessages.slice(skip, skip + take).map((message, index) => ({
          id: `message-${skip + index}`,
          role: message.role,
          content: message.content,
          createdAt: new Date(skip + index),
        })),
    },
  } as unknown as PrismaService;
  return { prisma, updates };
}

describe('ConversationSummarizerService', () => {
  it('does nothing while the conversation still fits the recent window', async () => {
    const { prisma, updates } = buildPrisma({
      summarizedMessageCount: 0,
      contextSummary: null,
      totalMessages: 6,
      expiredMessages: [],
    });
    const service = new ConversationSummarizerService(prisma);

    await service.maybeSummarize('conversation-1');

    expect(updates).toEqual([]);
  });

  it('summarizes expired messages with the deterministic fallback when no LLM is configured', async () => {
    const { prisma, updates } = buildPrisma({
      summarizedMessageCount: 0,
      contextSummary: null,
      totalMessages: 12, // overflow = 4 → meets the batch step
      expiredMessages: [
        { role: MessageRole.USER, content: 'What is my leave balance?' },
        { role: MessageRole.ASSISTANT, content: 'You have 12 days of annual leave remaining.' },
        { role: MessageRole.USER, content: 'And public holidays this year?' },
        { role: MessageRole.ASSISTANT, content: 'There are 11 company holidays in 2026.' },
      ],
    });
    const service = new ConversationSummarizerService(prisma);

    await service.maybeSummarize('conversation-1');

    expect(updates.length).toBe(1);
    const update = updates[0];
    expect(update?.data.summarizedMessageCount).toBe(4);
    expect(update?.data.contextSummary).toContain('12 days of annual leave');
    expect(update?.data.contextSummary).toContain('user:');
  });

  it('waits for the batch step before re-summarizing', async () => {
    const { prisma, updates } = buildPrisma({
      summarizedMessageCount: 4,
      contextSummary: 'existing summary',
      totalMessages: 14, // overflow = 6 < 4 + 4
      expiredMessages: [],
    });
    const service = new ConversationSummarizerService(prisma);

    await service.maybeSummarize('conversation-1');

    expect(updates).toEqual([]);
  });

  it('carries the previous summary forward when extending it', async () => {
    const { prisma, updates } = buildPrisma({
      summarizedMessageCount: 4,
      contextSummary: 'Earlier: user asked about leave balance (12 days left).',
      totalMessages: 16, // overflow = 8 ≥ 4 + 4
      expiredMessages: [
        { role: MessageRole.USER, content: 'skip-0' },
        { role: MessageRole.USER, content: 'skip-1' },
        { role: MessageRole.USER, content: 'skip-2' },
        { role: MessageRole.USER, content: 'skip-3' },
        { role: MessageRole.USER, content: 'Can I carry days over to next year?' },
        { role: MessageRole.ASSISTANT, content: 'Carryover is capped at 5 days.' },
        { role: MessageRole.USER, content: 'What about sick leave?' },
        { role: MessageRole.ASSISTANT, content: 'Sick leave has a separate balance of 8 days.' },
      ],
    });
    const service = new ConversationSummarizerService(prisma);

    await service.maybeSummarize('conversation-1');

    expect(updates.length).toBe(1);
    const summary = updates[0]?.data.contextSummary ?? '';
    expect(summary).toContain('12 days left');
    expect(summary).toContain('Carryover is capped at 5 days');
    expect(summary).not.toContain('skip-0'); // already-summarized rows are skipped
    expect(updates[0]?.data.summarizedMessageCount).toBe(8);
  });

  it('never throws when the database read fails', async () => {
    const prisma = {
      conversation: {
        findUnique: async () => {
          throw new Error('database offline');
        },
      },
    } as unknown as PrismaService;
    const service = new ConversationSummarizerService(prisma);

    await expect(service.maybeSummarize('conversation-1')).resolves.toBeUndefined();
  });
});
