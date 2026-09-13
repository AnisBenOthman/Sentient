import { ChannelType, NotificationCategory, NotificationEventType } from '@sentient/shared';
import { AiAgenticClient } from '../../../common/clients/ai-agentic.client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationRouter } from '../notification-router';
import { NotificationRenderers } from '../notifications.renderers';
import { NotificationsService } from '../notifications.service';
import { NotificationsSseRegistry } from '../sse/notifications-sse.registry';
import { NotificationsEventsBridge } from './notifications-events.bridge';

function buildEvent(type: string) {
  return {
    id: 'evt-1',
    type,
    source: 'HR_CORE',
    timestamp: new Date(),
    payload: { leaveRequestId: 'lr-1', employeeId: 'emp-1', reviewerId: 'mgr-1' },
    metadata: { correlationId: 'corr-1' },
  } as never;
}

function buildNotification(overrides: Partial<NotificationResponseDto> = {}): NotificationResponseDto {
  return {
    id: 'notif-1',
    recipientUserId: 'user-1',
    category: NotificationCategory.LEAVE,
    eventType: NotificationEventType.REQUEST_APPROVED,
    title: 'Your leave request was approved',
    body: 'Alex approved your Annual Leave request (2026-06-01 to 2026-06-02).',
    payload: {},
    referenceType: 'leave_request',
    referenceId: 'lr-1',
    status: 'UNREAD' as never,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  };
}

describe('NotificationsEventsBridge — Telegram push', () => {
  // employee.findUnique -> null makes userIdForEmployee() resolve null, which
  // is enough for onApproved/onRejected/onCancelled to short-circuit to an
  // empty draft list without throwing — bulkCreate's return is mocked
  // directly below, so what the real routing rule actually produces doesn't
  // matter here; only "does it throw" does.
  const mockPrisma = {
    channelIdentity: { findFirst: jest.fn() },
    employee: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const mockNotificationsService = {
    bulkCreate: jest.fn(),
    findOpenByReference: jest.fn().mockResolvedValue([]),
    markResolved: jest.fn().mockResolvedValue({ updatedCount: 0 }),
  };
  const mockSseRegistry = { push: jest.fn() };
  const mockAiAgentic = { notifyTelegram: jest.fn().mockResolvedValue(undefined) };
  const router = new NotificationRouter();
  const renderers = new NotificationRenderers();

  function build(): NotificationsEventsBridge {
    return new NotificationsEventsBridge(
      { subscribe: jest.fn() } as never,
      router,
      mockNotificationsService as unknown as NotificationsService,
      mockPrisma as unknown as PrismaService,
      renderers,
      mockSseRegistry as unknown as NotificationsSseRegistry,
      mockAiAgentic as unknown as AiAgenticClient,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pushes to Telegram when the recipient has a linked chat and the event is a leave decision', async () => {
    const notification = buildNotification();
    mockNotificationsService.bulkCreate.mockResolvedValue([notification]);
    mockPrisma.channelIdentity.findFirst.mockResolvedValue({ externalId: 'chat-42' });

    const bridge = build();
    await (bridge as unknown as { dispatch: (e: unknown) => Promise<void> }).dispatch(
      buildEvent('leave.approved'),
    );

    expect(mockPrisma.channelIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', channel: ChannelType.TELEGRAM },
    });
    expect(mockAiAgentic.notifyTelegram).toHaveBeenCalledWith(
      'chat-42',
      `${notification.title}\n\n${notification.body}`,
    );
  });

  it('does not call AiAgenticClient when the recipient has no linked Telegram chat', async () => {
    mockNotificationsService.bulkCreate.mockResolvedValue([buildNotification()]);
    mockPrisma.channelIdentity.findFirst.mockResolvedValue(null);

    const bridge = build();
    await (bridge as unknown as { dispatch: (e: unknown) => Promise<void> }).dispatch(
      buildEvent('leave.rejected'),
    );

    expect(mockAiAgentic.notifyTelegram).not.toHaveBeenCalled();
  });

  it('never looks up a Telegram identity for event types outside the leave-decision allowlist', async () => {
    // leave.cancelled has a registered rule and produces real notifications
    // (via findOpenByReference/markResolved), but it is not an approve/reject
    // decision — the allowlist, not "did a rule run", is what gates the push.
    mockNotificationsService.bulkCreate.mockResolvedValue([buildNotification()]);

    const bridge = build();
    await (bridge as unknown as { dispatch: (e: unknown) => Promise<void> }).dispatch(
      buildEvent('leave.cancelled'),
    );

    expect(mockPrisma.channelIdentity.findFirst).not.toHaveBeenCalled();
    expect(mockAiAgentic.notifyTelegram).not.toHaveBeenCalled();
  });

  it('swallows a Prisma lookup failure without affecting the notification dispatch outcome', async () => {
    mockNotificationsService.bulkCreate.mockResolvedValue([buildNotification()]);
    mockPrisma.channelIdentity.findFirst.mockRejectedValue(new Error('db unavailable'));

    const bridge = build();
    await expect(
      (bridge as unknown as { dispatch: (e: unknown) => Promise<void> }).dispatch(buildEvent('leave.approved')),
    ).resolves.toBeUndefined();

    expect(mockSseRegistry.push).toHaveBeenCalledTimes(1);
  });
});
