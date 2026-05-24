import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DomainEvent, EVENT_BUS, IEventBus } from '@sentient/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationRouter } from '../notification-router';
import { NotificationRenderers } from '../notifications.renderers';
import { NotificationsService } from '../notifications.service';
import { NotificationsSseRegistry } from '../sse/notifications-sse.registry';
import { RoutingRule } from './routing-rules/routing-rule.interface';
import * as leaveRules from './routing-rules/leave.rules';
import * as okrRules from './routing-rules/okr.rules';
import * as promotionRules from './routing-rules/promotion.rules';

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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Notification dispatch failed for ${event.type} correlationId=${event.metadata.correlationId}: ${message}`,
      );
    }
  }
}
