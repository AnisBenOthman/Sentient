import { NotificationCategory, NotificationEventType } from '@sentient/shared';

export interface NotificationDraft {
  recipientUserId: string;
  actorUserId: string | null;
  category: NotificationCategory;
  eventType: NotificationEventType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  referenceType: string | null;
  referenceId: string | null;
  correlationId: string;
}
