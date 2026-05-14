import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationEventType } from '@sentient/shared';

export interface RenderedNotificationText {
  title: string;
  body: string;
}

type Renderer = (payload: Record<string, unknown>) => RenderedNotificationText;

function asText(value: unknown, fallback = 'Unknown'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

@Injectable()
export class NotificationRenderers {
  private readonly renderers = new Map<string, Renderer>([
    [
      this.key(NotificationCategory.LEAVE, NotificationEventType.REQUEST_SUBMITTED),
      (payload) => ({
        title: `New leave request from ${asText(payload.requesterName)}`,
        body: `${asText(payload.requesterName)} requested ${asNumber(payload.totalDays)} days of ${asText(payload.leaveTypeName, 'leave')} (${asText(payload.startDate)} to ${asText(payload.endDate)}).`,
      }),
    ],
    [
      this.key(NotificationCategory.LEAVE, NotificationEventType.REQUEST_APPROVED),
      (payload) => ({
        title: 'Your leave request was approved',
        body: `${asText(payload.approverName)} approved your ${asText(payload.leaveTypeName, 'leave')} request (${asText(payload.startDate)} to ${asText(payload.endDate)}).`,
      }),
    ],
    [
      this.key(NotificationCategory.LEAVE, NotificationEventType.REQUEST_REJECTED),
      (payload) => ({
        title: 'Your leave request was rejected',
        body: `${asText(payload.approverName)} rejected your ${asText(payload.leaveTypeName, 'leave')} request. Reason: ${truncate(asText(payload.reason, 'No reason provided'), 400)}`,
      }),
    ],
    [
      this.key(NotificationCategory.LEAVE, NotificationEventType.RESOLVED),
      () => ({
        title: 'Leave request cancelled',
        body: 'The pending leave request was cancelled by the requester.',
      }),
    ],
    [
      this.key(NotificationCategory.PROMOTION, NotificationEventType.REQUEST_SUBMITTED),
      (payload) => ({
        title: `Promotion request for ${asText(payload.employeeName)}`,
        body: `${asText(payload.requesterName)} requested ${asText(payload.currentRole)} to ${asText(payload.newRole)} for ${asText(payload.employeeName)} (+${asNumber(payload.salaryDeltaPct)}% salary).`,
      }),
    ],
    [
      this.key(NotificationCategory.PROMOTION, NotificationEventType.REQUEST_APPROVED),
      (payload) => ({
        title: 'Promotion request approved',
        body: `${asText(payload.approverName)} approved the promotion for ${asText(payload.employeeName)}.`,
      }),
    ],
    [
      this.key(NotificationCategory.PROMOTION, NotificationEventType.REQUEST_REJECTED),
      (payload) => ({
        title: 'Promotion request rejected',
        body: `${asText(payload.approverName)} rejected the promotion for ${asText(payload.employeeName)}. Reason: ${truncate(asText(payload.reason, 'No reason provided'), 400)}`,
      }),
    ],
    [
      this.key(NotificationCategory.PROMOTION, NotificationEventType.RESOLVED),
      (payload) => ({
        title: 'Promotion request resolved',
        body: `This promotion request was ${asText(payload.decision).toLowerCase()} by ${asText(payload.decidedByName)}.`,
      }),
    ],
  ]);

  render(
    category: NotificationCategory,
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
  ): RenderedNotificationText {
    const renderer = this.renderers.get(this.key(category, eventType));
    if (renderer) return renderer(payload);
    return {
      title: `${category.replace(/_/g, ' ')} notification`,
      body: eventType.replace(/_/g, ' ').toLowerCase(),
    };
  }

  private key(category: NotificationCategory, eventType: NotificationEventType): string {
    return `${category}:${eventType}`;
  }
}
