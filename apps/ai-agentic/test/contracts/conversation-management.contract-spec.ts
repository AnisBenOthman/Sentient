import { ConversationStatus } from '../../src/generated/prisma';
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
});
