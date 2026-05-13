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
  const leaveRequestId = asString(event.payload.leaveRequestId);
  const employeeId = asString(event.payload.employeeId);
  if (!leaveRequestId || !employeeId) return [];

  const employee = await deps.prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      managerId: true,
      firstName: true,
      lastName: true,
      user: { select: { id: true } },
    },
  });
  if (!employee) return [];

  const managerUserId = await userIdForEmployee(deps.prisma, employee.managerId);
  const recipients = managerUserId ? [managerUserId] : await activeHrAdminUserIds(deps.prisma);
  const payload = {
    requesterId: employeeId,
    requesterName: `${employee.firstName} ${employee.lastName}`,
    leaveTypeId: asString(event.payload.leaveTypeId),
    leaveTypeName: await resolveLeaveTypeName(deps.prisma, asString(event.payload.leaveTypeId)),
    startDate: asString(event.payload.startDate),
    endDate: asString(event.payload.endDate),
    totalDays: asNumber(event.payload.totalDays) ?? 0,
  };

  return recipients.map((recipientUserId) =>
    buildDraft({
      renderers: deps.renderers,
      recipientUserId,
      actorUserId: employee.user?.id ?? null,
      category: NotificationCategory.LEAVE,
      eventType: NotificationEventType.REQUEST_SUBMITTED,
      payload,
      referenceType: 'leave_request',
      referenceId: leaveRequestId,
      correlationId: event.metadata.correlationId,
    }),
  );
};

export const onApproved: RoutingRule = async (event, deps) => {
  return decisionDraft(event, deps, NotificationEventType.REQUEST_APPROVED);
};

export const onRejected: RoutingRule = async (event, deps) => {
  return decisionDraft(event, deps, NotificationEventType.REQUEST_REJECTED);
};

export const onCancelled: RoutingRule = async (event, deps) => {
  const leaveRequestId = asString(event.payload.leaveRequestId);
  const employeeId = asString(event.payload.employeeId);
  if (!leaveRequestId) return [];

  const open = await deps.notificationsService.findOpenByReference('leave_request', leaveRequestId);
  await deps.notificationsService.markResolved(open.map((notification) => notification.id));
  const actorUserId = await userIdForEmployee(deps.prisma, employeeId);

  return open.map((notification) =>
    buildDraft({
      renderers: deps.renderers,
      recipientUserId: notification.recipientUserId,
      actorUserId,
      category: NotificationCategory.LEAVE,
      eventType: NotificationEventType.RESOLVED,
      payload: {
        originalNotificationId: notification.id,
        reason: 'CANCELLED_BY_REQUESTER',
      },
      referenceType: 'leave_request',
      referenceId: leaveRequestId,
      correlationId: event.metadata.correlationId,
    }),
  );
};

async function decisionDraft(
  event: Parameters<RoutingRule>[0],
  deps: Parameters<RoutingRule>[1],
  eventType: NotificationEventType.REQUEST_APPROVED | NotificationEventType.REQUEST_REJECTED,
) {
  const leaveRequestId = asString(event.payload.leaveRequestId);
  const employeeId = asString(event.payload.employeeId);
  const reviewerId = asString(event.payload.reviewerId);
  if (!leaveRequestId || !employeeId) return [];

  const recipientUserId = await userIdForEmployee(deps.prisma, employeeId);
  if (!recipientUserId) return [];

  const request = await deps.prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { leaveType: { select: { name: true } } },
  });
  const actorUserId = await userIdForEmployee(deps.prisma, reviewerId);
  const payload = {
    approverId: reviewerId,
    approverName: await displayNameForEmployee(deps.prisma, reviewerId),
    leaveTypeName: request?.leaveType.name ?? 'leave',
    startDate: request?.startDate.toISOString().slice(0, 10) ?? null,
    endDate: request?.endDate.toISOString().slice(0, 10) ?? null,
    totalDays: request ? Number(request.totalDays) : 0,
    reason: asString(event.payload.reviewNote),
  };

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId,
      actorUserId,
      category: NotificationCategory.LEAVE,
      eventType,
      payload,
      referenceType: 'leave_request',
      referenceId: leaveRequestId,
      correlationId: event.metadata.correlationId,
    }),
  ];
}

async function resolveLeaveTypeName(
  prisma: Parameters<RoutingRule>[1]['prisma'],
  leaveTypeId: string | null,
): Promise<string> {
  if (!leaveTypeId) return 'leave';
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { name: true },
  });
  return leaveType?.name ?? 'leave';
}
