import { DomainEvent } from '@sentient/shared';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationDraft } from '../../dto/notification-draft.interface';
import { NotificationRenderers } from '../../notifications.renderers';
import { NotificationsService } from '../../notifications.service';

export interface RoutingRuleDeps {
  prisma: PrismaService;
  renderers: NotificationRenderers;
  notificationsService: NotificationsService;
}

export type RoutingRule<T = Record<string, unknown>> = (
  event: DomainEvent<T>,
  deps: RoutingRuleDeps,
) => Promise<NotificationDraft[]>;
