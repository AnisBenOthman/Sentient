import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ChannelType, DomainEvent, EVENT_BUS, IEventBus } from '@sentient/shared';
import { AiAgenticClient } from '../../../common/clients/ai-agentic.client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { NotificationRouter } from '../notification-router';
import { NotificationRenderers } from '../notifications.renderers';
import { NotificationsService } from '../notifications.service';
import { NotificationsSseRegistry } from '../sse/notifications-sse.registry';
import { RoutingRule } from './routing-rules/routing-rule.interface';
import * as leaveRules from './routing-rules/leave.rules';
import * as okrRules from './routing-rules/okr.rules';
import * as promotionRules from './routing-rules/promotion.rules';

/**
 * WHY only these two event types: NotificationsEventsBridge.dispatch() runs
 * synchronously inside the awaited eventBus.emit() call on the leave
 * approve/reject request path (requests.service.ts). Pushing to chat apps
 * for every notification category (OKR reminders, performance cycles,
 * announcements...) would put an identity lookup plus an HTTP round-trip on
 * a dozen endpoints nobody asked to touch. Scoped to the one thing the
 * feature actually is: a Telegram/Slack ping when a manager decides your leave.
 */
const CHAT_PUSH_ELIGIBLE_EVENT_TYPES = new Set(['leave.approved', 'leave.rejected']);

/** Channels AI Agentic exposes a `POST /channels/<x>/notify` relay for. */
const CHAT_PUSH_CHANNELS = [ChannelType.TELEGRAM, ChannelType.SLACK];

const SUBSCRIBED_EVENT_TYPES = [
  'leave.requested',
  'leave.approved',
  'leave.rejected',
  'leave.cancelled',
  'promotion.requested',
  'promotion.approved',
  'promotion.rejected',
  'skill.endorsement_requested',
  'skill.endorsement_completed',
  'skill.review_due',
  'performance.cycle_launched',
  'performance.review_assigned',
  'performance.review_submitted',
  'performance.review_completed',
  'probation.started',
  'probation.evaluation_due',
  'probation.decision.confirmed',
  'probation.decision.extended',
  'probation.decision.terminated',
  'contract.amendment_submitted',
  'contract.amendment_approved',
  'contract.amendment_rejected',
  'complaint.submitted',
  'complaint.resolved',
  'announcement.published',
  'event.created',
  'exit_survey.sent',
  'exit_survey.completed',
  'okr.cycle_activated',
  'okr.checkin_submitted',
  'okr.checkin_approved',
  'okr.checkin_rejected',
  'okr.checkin_reminder_due',
] as const;

@Injectable()
export class NotificationsEventsBridge implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsEventsBridge.name);
  private readonly rules = new Map<string, RoutingRule>([
    ['leave.requested', leaveRules.onRequested],
    ['leave.approved', leaveRules.onApproved],
    ['leave.rejected', leaveRules.onRejected],
    ['leave.cancelled', leaveRules.onCancelled],
    ['promotion.requested', promotionRules.onRequested],
    ['promotion.approved', promotionRules.onApproved],
    ['promotion.rejected', promotionRules.onRejected],
    ['okr.cycle_activated', okrRules.onCycleActivated],
    ['okr.checkin_submitted', okrRules.onCheckInSubmitted],
    ['okr.checkin_approved', okrRules.onCheckInApproved],
    ['okr.checkin_rejected', okrRules.onCheckInRejected],
    ['okr.checkin_reminder_due', okrRules.onReminderDue],
  ]);
  private bootstrapped = false;

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly router: NotificationRouter,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly renderers: NotificationRenderers,
    private readonly sseRegistry: NotificationsSseRegistry,
    private readonly aiAgentic: AiAgenticClient,
  ) {}

  onApplicationBootstrap(): void {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    for (const eventType of SUBSCRIBED_EVENT_TYPES) {
      this.eventBus.subscribe<Record<string, unknown>>(eventType, (event) => this.dispatch(event));
    }
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    const rule = this.rules.get(event.type);
    if (!rule) {
      this.logger.debug(`No notification rule registered for ${event.type}`);
      return;
    }

    try {
      const drafts = await rule(event, {
        prisma: this.prisma,
        renderers: this.renderers,
        notificationsService: this.notificationsService,
      });
      const routed = await this.router.route(event, drafts);
      const created = await this.notificationsService.bulkCreate(routed);
      for (const notification of created) {
        this.sseRegistry.push(notification.recipientUserId, {
          type: 'notification.created',
          data: notification,
        });
      }

      if (CHAT_PUSH_ELIGIBLE_EVENT_TYPES.has(event.type)) {
        await Promise.all(created.map((notification) => this.pushChatChannels(notification)));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Notification dispatch failed for ${event.type} correlationId=${event.metadata.correlationId}: ${message}`,
      );
    }
  }

  /**
   * WHY a dedicated try/catch here rather than letting failures bubble into
   * dispatch()'s own catch: a Telegram/Slack/AI-Agentic outage must never
   * look like "notification dispatch failed" in logs when the in-app
   * Notification row and SSE push above already succeeded. AiAgenticClient
   * itself never throws; this also guards the Prisma lookup. One findMany
   * covers every linked chat app, so a user linked to both gets both pings
   * from a single query.
   */
  private async pushChatChannels(notification: NotificationResponseDto): Promise<void> {
    try {
      const identities = await this.prisma.channelIdentity.findMany({
        where: { userId: notification.recipientUserId, channel: { in: CHAT_PUSH_CHANNELS } },
      });
      if (identities.length === 0) return;

      const text = `${notification.title}\n\n${notification.body}`;
      await Promise.all(
        identities.map((identity) => {
          const channel: string = identity.channel;
          return channel === ChannelType.SLACK
            ? this.aiAgentic.notifySlack(identity.externalId, text)
            : this.aiAgentic.notifyTelegram(identity.externalId, text);
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Chat push skipped for notification ${notification.id}: ${message}`);
    }
  }
}
