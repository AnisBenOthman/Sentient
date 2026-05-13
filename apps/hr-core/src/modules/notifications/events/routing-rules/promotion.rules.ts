import { NotificationCategory, NotificationEventType } from '@sentient/shared';
import { RoutingRule } from './routing-rule.interface';
import {
  activeHrAdminUserIds,
  asNumber,
  asString,
  buildDraft,
  displayNameForEmployee,
  userIdForEmployee,
} from './rule-utils';

export const onRequested: RoutingRule = async (event, deps) => {
  const promotionRequestId = asString(event.payload.promotionRequestId);
  const requestedById = asString(event.payload.requestedById);
  const employeeId = asString(event.payload.employeeId);
  if (!promotionRequestId || !requestedById || !employeeId) return [];

  const actorUserId = await userIdForEmployee(deps.prisma, requestedById);
  const recipients = await activeHrAdminUserIds(deps.prisma);
  const payload = {
    requesterId: requestedById,
    requesterName: await displayNameForEmployee(deps.prisma, requestedById),
    employeeId,
    employeeName: await displayNameForEmployee(deps.prisma, employeeId),
    currentRole: asString(event.payload.currentRole),
    newRole: asString(event.payload.newRole),
    currentSalary: asNumber(event.payload.currentGrossSalary) ?? 0,
    newSalary: asNumber(event.payload.newGrossSalary) ?? 0,
    salaryDelta: asNumber(event.payload.salaryDelta) ?? 0,
    salaryDeltaPct: asNumber(event.payload.salaryDeltaPercentage) ?? 0,
  };

  return recipients.map((recipientUserId) =>
    buildDraft({
      renderers: deps.renderers,
      recipientUserId,
      actorUserId,
      category: NotificationCategory.PROMOTION,
      eventType: NotificationEventType.REQUEST_SUBMITTED,
      payload,
      referenceType: 'promotion_request',
      referenceId: promotionRequestId,
      correlationId: event.metadata.correlationId,
    }),
  );
};

export const onApproved: RoutingRule = async (event, deps) => {
  return decisionDraft(event, deps, 'APPROVED', NotificationEventType.REQUEST_APPROVED);
};

export const onRejected: RoutingRule = async (event, deps) => {
  return decisionDraft(event, deps, 'REJECTED', NotificationEventType.REQUEST_REJECTED);
};

async function decisionDraft(
  event: Parameters<RoutingRule>[0],
  deps: Parameters<RoutingRule>[1],
  decision: 'APPROVED' | 'REJECTED',
  eventType: NotificationEventType.REQUEST_APPROVED | NotificationEventType.REQUEST_REJECTED,
) {
  const promotionRequestId = asString(event.payload.promotionRequestId);
  const requestedById = asString(event.payload.requestedById);
  const employeeId = asString(event.payload.employeeId);
  const decidedById = asString(event.payload.decidedById);
  if (!promotionRequestId || !requestedById || !employeeId) return [];

  const submitterUserId = await userIdForEmployee(deps.prisma, requestedById);
  if (!submitterUserId) return [];

  const actorUserId = await userIdForEmployee(deps.prisma, decidedById);
  const open = await deps.notificationsService.findOpenByReference(
    'promotion_request',
    promotionRequestId,
  );
  const toResolve = open.filter((notification) => notification.recipientUserId !== actorUserId);
  await deps.notificationsService.markResolved(toResolve.map((notification) => notification.id));

  const request = await deps.prisma.promotionRequest.findUnique({
    where: { id: promotionRequestId },
    select: { currentRole: true, newRole: true, salaryDelta: true },
  });
  const commonPayload = {
    approverId: decidedById,
    approverName: await displayNameForEmployee(deps.prisma, decidedById),
    employeeId,
    employeeName: await displayNameForEmployee(deps.prisma, employeeId),
    currentRole: request?.currentRole ?? null,
    newRole: request?.newRole ?? null,
    salaryDelta: request ? Number(request.salaryDelta) : 0,
    reason: asString(event.payload.reason),
  };

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId: submitterUserId,
      actorUserId,
      category: NotificationCategory.PROMOTION,
      eventType,
      payload: commonPayload,
      referenceType: 'promotion_request',
      referenceId: promotionRequestId,
      correlationId: event.metadata.correlationId,
    }),
    ...toResolve.map((notification) =>
      buildDraft({
        renderers: deps.renderers,
        recipientUserId: notification.recipientUserId,
        actorUserId,
        category: NotificationCategory.PROMOTION,
        eventType: NotificationEventType.RESOLVED,
        payload: {
          originalNotificationId: notification.id,
          decidedById,
          decidedByName: commonPayload.approverName,
          decision,
        },
        referenceType: 'promotion_request',
        referenceId: promotionRequestId,
        correlationId: event.metadata.correlationId,
      }),
    ),
  ];
}
