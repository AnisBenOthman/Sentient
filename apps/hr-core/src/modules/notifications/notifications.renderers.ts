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
    [
      this.key(NotificationCategory.OKR, NotificationEventType.INFO),
      (payload) => {
        if (payload.approverName !== undefined) {
          return {
            title: `Your check-in on ${asText(payload.keyResultTitle)} was approved`,
            body: `${asText(payload.approverName)} approved your check-in. New KR score: ${asText(payload.newScore)}.`,
          };
        }
        return {
          title: `OKR cycle "${asText(payload.cycleName)}" is active`,
          body: `The ${asText(payload.type).toLowerCase()} cycle "${asText(payload.cycleName)}" runs ${asText(payload.startDate)} to ${asText(payload.endDate)}. Open your OKR workspace to align your goals.`,
        };
      },
    ],
    [
      this.key(NotificationCategory.OKR, NotificationEventType.REQUEST_APPROVED),
      (payload) => ({
        title: `Your objective "${asText(payload.objectiveTitle)}" was approved`,
        body: `${asText(payload.approverName)} activated your objective. You can now add Key Results and start tracking progress.`,
      }),
    ],
    [
      this.key(NotificationCategory.OKR, NotificationEventType.DECISION_PENDING),
      (payload) => {
        if (payload.ownerName !== undefined) {
          return {
            title: `OKR approval needed — ${asText(payload.objectiveTitle)}`,
            body: `${asText(payload.ownerName)} submitted a personal objective for approval: "${asText(payload.objectiveTitle)}". Review it in the OKR Management queue.`,
          };
        }
        if (payload.submitterName !== undefined) {
          return {
            title: `Check-in awaiting review on ${asText(payload.keyResultTitle)}`,
            body: `${asText(payload.submitterName)} submitted a check-in of ${asText(payload.value)} on "${asText(payload.keyResultTitle)}". Approve or reject in the OKR review queue.`,
          };
        }
        if (payload.reviewerName !== undefined) {
          return {
            title: `Your check-in on ${asText(payload.keyResultTitle)} was rejected`,
            body: `${asText(payload.reviewerName)} asked you to resubmit. Reason: ${truncate(asText(payload.reason, 'No reason provided'), 400)}`,
          };
        }
        return {
          title: `Cycle ${asText(payload.cycleName)} closes in 14 days — log your check-ins`,
          body: `You have ${asNumber(payload.openCount)} Key Result(s) without an approved check-in in the last 14 days. Cycle ends on ${asText(payload.dueAt)}.`,
        };
      },
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
