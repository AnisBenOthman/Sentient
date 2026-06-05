import { BadRequestException } from '@nestjs/common';
import { AgentRunStatus, ConversationStatus } from '../../src/generated/prisma';
import { ActorContextFactory, AiActorContext } from '../../src/common/graph';
import { ConversationsController } from '../../src/modules/conversations/conversations.controller';
import { ConversationsService } from '../../src/modules/conversations/conversations.service';

const actor: AiActorContext = {
  jwt: 'token',
  userId: 'user-1',
  employeeId: 'employee-1',
  roles: ['EMPLOYEE'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  correlationId: 'corr-1',
};

describe('AI conversation management contract', () => {
  const summary = {
    id: 'conversation-1',
    title: 'Leave',
    status: ConversationStatus.ACTIVE,
    lastAgentType: null,
    lastMessagePreview: 'Preview',
    updatedAt: new Date(0).toISOString(),
  };

  it('lists current user conversations', async () => {
    const controller = new ConversationsController(
      { list: async () => ({ items: [summary], total: 1, page: 1, pageSize: 20 }) } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.list({} as never, { page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
  });

  it('returns conversation detail', async () => {
    const controller = new ConversationsController(
      { detail: async () => ({ conversation: summary, messages: [] }) } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.detail({} as never, 'conversation-1');

    expect(result.conversation.id).toBe('conversation-1');
  });

  it('archives or restores conversations', async () => {
    const controller = new ConversationsController(
      { update: async () => ({ ...summary, status: ConversationStatus.ARCHIVED }) } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    const result = await controller.update({} as never, 'conversation-1', { status: ConversationStatus.ARCHIVED });

    expect(result.status).toBe(ConversationStatus.ARCHIVED);
  });

  it('deletes conversations from active user view', async () => {
    let deleted = false;
    const controller = new ConversationsController(
      { delete: async () => { deleted = true; } } as unknown as ConversationsService,
      { fromRequest: () => actor } as unknown as ActorContextFactory,
    );

    await controller.delete({} as never, 'conversation-1');

    expect(deleted).toBe(true);
  });

  it('defaults conversation lists to active records only', async () => {
    let capturedWhere: unknown;
    const service = new ConversationsService(
      {
        conversation: {
          findMany: async ({ where }: { where: unknown }) => {
            capturedWhere = where;
            return [];
          },
          count: async () => 0,
        },
        $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.list(actor, { page: 1, pageSize: 20 });

    expect(JSON.stringify(capturedWhere)).toContain(`"status":"${ConversationStatus.ACTIVE}"`);
  });

  it('does not allow messages to be sent to archived conversations', async () => {
    const service = new ConversationsService(
      {
        conversation: {
          findFirst: async () => ({
            id: 'conversation-1',
            ownerUserId: actor.userId,
            ownerEmployeeId: actor.employeeId,
            title: 'Archived',
            status: ConversationStatus.ARCHIVED,
          }),
        },
        message: {
          create: async () => {
            throw new Error('message should not be created');
          },
        },
      } as never,
      {
        executeTurn: async () => ({
          finalAnswer: { content: '', sourceContext: [], status: AgentRunStatus.SUCCESS },
          routing: { status: AgentRunStatus.SUCCESS, nodes: [] },
        }),
      } as never,
      {} as never,
      {} as never,
    );

    try {
      await service.sendMessage('conversation-1', actor, { message: 'follow up' });
      throw new Error('Expected archived conversation send to fail');
    } catch (error: unknown) {
      expect(error instanceof BadRequestException).toBe(true);
    }
  });
});
