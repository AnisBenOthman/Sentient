import { Injectable } from '@nestjs/common';
import { DomainEvent } from '@sentient/shared';
import { NotificationDraft } from './dto/notification-draft.interface';

@Injectable()
export class NotificationRouter {
  async route<T>(
    event: DomainEvent<T>,
    drafts: NotificationDraft[],
  ): Promise<NotificationDraft[]> {
    const actorUserId = event.metadata.userId;
    const seen = new Set<string>();
    const routed: NotificationDraft[] = [];

    for (const draft of drafts) {
      if (actorUserId && draft.recipientUserId === actorUserId) continue;
      if (draft.actorUserId && draft.recipientUserId === draft.actorUserId) continue;
      const key = [
        draft.recipientUserId,
        draft.category,
        draft.eventType,
        draft.referenceType ?? '',
        draft.referenceId ?? '',
      ].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      routed.push(draft);
    }

    return routed;
  }
}
