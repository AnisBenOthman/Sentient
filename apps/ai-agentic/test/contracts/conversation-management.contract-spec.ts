import { BadRequestException } from '@nestjs/common';
import { AgentRunStatus, ConversationStatus, MessageRole } from '../../src/generated/prisma';
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

  it('maps persisted conversation detail messages without losing mapper context', async () => {
    const createdAt = new Date('2026-06-07T12:43:30.943Z');
    const updatedAt = new Date('2026-06-07T12:43:30.932Z');
    const service = new ConversationsService(
      {
        conversation: {
          findFirst: async () => ({
            id: 'conversation-1',
            ownerUserId: actor.userId,
            ownerEmployeeId: actor.employeeId,
            title: 'Sentient AI conversation',
            status: ConversationStatus.ACTIVE,
            lastAgentType: null,
            lastMessagePreview: 'hi',
            createdAt: updatedAt,
            updatedAt,
            archivedAt: null,
            deletedAt: null,
          }),
        },
        message: {
          findMany: async () => [
            {
              id: 'message-1',
              conversationId: 'conversation-1',
              role: MessageRole.USER,
              content: 'hi',
              agentType: null,
              nodeType: null,
              sourceSummary: null,
              status: AgentRunStatus.SUCCESS,
              createdAt,
            },
          ],
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.detail('conversation-1', actor);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.id).toBe('message-1');
    expect(result.messages[0]?.content).toBe('hi');
    expect(result.messages[0]?.sourceContext).toEqual([]);
    expect(result.messages[0]?.createdAt).toBe(createdAt.toISOString());
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
