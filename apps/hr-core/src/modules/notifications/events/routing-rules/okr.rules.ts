import { NotificationCategory, NotificationEventType } from '@sentient/shared';

import { RoutingRule } from './routing-rule.interface';
import { asString, buildDraft } from './rule-utils';

export const onCycleActivated: RoutingRule = async (event, deps) => {
  const cycleId = asString(event.payload.cycleId);
  const cycleName = asString(event.payload.cycleName) ?? 'cycle';
  const type = asString(event.payload.type) ?? 'cycle';
  const startDate = asString(event.payload.startDate) ?? '';
  const endDate = asString(event.payload.endDate) ?? '';

  if (!cycleId) return [];

  const users = await deps.prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  return users.map((u) =>
    buildDraft({
      renderers: deps.renderers,
      recipientUserId: u.id,
      actorUserId: null,
      category: NotificationCategory.OKR,
      eventType: NotificationEventType.INFO,
      payload: { cycleName, type, startDate, endDate },
      referenceType: 'okr_cycle',
      referenceId: cycleId,
      correlationId: event.metadata.correlationId,
    }),
  );
};

export const onCheckInSubmitted: RoutingRule = async (event, deps) => {
  const checkInId = asString(event.payload.checkInId);
  const departmentId = asString(event.payload.departmentId);
  const keyResultTitle = asString(event.payload.keyResultTitle) ?? 'Key Result';
  const submitterName = asString(event.payload.submitterName) ?? 'An employee';
  const value = asString(event.payload.value) ?? '0';
  const submitterId = asString(event.payload.submitterId);

  if (!checkInId || !departmentId) return [];

  const managers = await deps.prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      employee: { departmentId },
      userRoles: {
        some: {
          revokedAt: null,
          role: { code: 'MANAGER' },
        },
      },
    },
    select: { id: true },
  });

  const submitterUser = submitterId
    ? await deps.prisma.employee.findUnique({
        where: { id: submitterId },
        select: { user: { select: { id: true } } },
      })
    : null;
  const submitterUserId = submitterUser?.user?.id ?? null;

  return managers
    .filter((m) => m.id !== submitterUserId)
    .map((m) =>
      buildDraft({
        renderers: deps.renderers,
        recipientUserId: m.id,
        actorUserId: submitterUserId,
        category: NotificationCategory.OKR,
        eventType: NotificationEventType.DECISION_PENDING,
        payload: { keyResultTitle, submitterName, value },
        referenceType: 'okr_check_in',
        referenceId: checkInId,
        correlationId: event.metadata.correlationId,
      }),
    );
};

export const onCheckInApproved: RoutingRule = async (event, deps) => {
  const checkInId = asString(event.payload.checkInId);
  const submitterId = asString(event.payload.submitterId);
  const approverId = asString(event.payload.approverId);
  const keyResultTitle = asString(event.payload.keyResultTitle) ?? 'Key Result';
  const approverName = asString(event.payload.approverName) ?? 'Your manager';
  const newScore = asString(event.payload.newScore) ?? '0';

  if (!checkInId || !submitterId) return [];

  const submitterUser = await deps.prisma.employee.findUnique({
    where: { id: submitterId },
    select: { user: { select: { id: true } } },
  });
  const recipientUserId = submitterUser?.user?.id;
  if (!recipientUserId) return [];

  const approverUser = approverId
    ? await deps.prisma.user.findUnique({ where: { id: approverId }, select: { id: true } })
    : null;

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId,
      actorUserId: approverUser?.id ?? null,
      category: NotificationCategory.OKR,
      eventType: NotificationEventType.INFO,
      payload: { keyResultTitle, approverName, newScore },
      referenceType: 'okr_check_in',
      referenceId: checkInId,
      correlationId: event.metadata.correlationId,
    }),
  ];
};

export const onCheckInRejected: RoutingRule = async (event, deps) => {
  const checkInId = asString(event.payload.checkInId);
  const submitterId = asString(event.payload.submitterId);
  const reviewerId = asString(event.payload.reviewerId);
  const keyResultTitle = asString(event.payload.keyResultTitle) ?? 'Key Result';
  const reviewerName = asString(event.payload.reviewerName) ?? 'Your manager';
  const reason = asString(event.payload.reason) ?? '';

  if (!checkInId || !submitterId) return [];

  const submitterUser = await deps.prisma.employee.findUnique({
    where: { id: submitterId },
    select: { user: { select: { id: true } } },
  });
  const recipientUserId = submitterUser?.user?.id;
  if (!recipientUserId) return [];

  const reviewerUser = reviewerId
    ? await deps.prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true } })
    : null;

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId,
      actorUserId: reviewerUser?.id ?? null,
      category: NotificationCategory.OKR,
      eventType: NotificationEventType.DECISION_PENDING,
      payload: { keyResultTitle, reviewerName, reason: reason.slice(0, 400) + (reason.length > 400 ? '…' : '') },
      referenceType: 'okr_check_in',
      referenceId: checkInId,
      correlationId: event.metadata.correlationId,
    }),
  ];
};

export const onObjectiveCreated: RoutingRule = async (event, deps) => {
  const objectiveId = asString(event.payload.objectiveId);
  const objectiveTitle = asString(event.payload.objectiveTitle) ?? 'New objective';
  const departmentId = asString(event.payload.departmentId);
  const ownerId = asString(event.payload.ownerId);

  if (!objectiveId || !departmentId) return [];

  const ownerUser = ownerId
    ? await deps.prisma.user.findUnique({
        where: { id: ownerId },
        select: { employee: { select: { firstName: true, lastName: true } } },
      })
    : null;
  const ownerName = ownerUser?.employee
    ? `${ownerUser.employee.firstName} ${ownerUser.employee.lastName}`
    : 'An employee';

  const managers = await deps.prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      employee: { departmentId },
      userRoles: {
        some: {
          revokedAt: null,
          role: { code: 'MANAGER' },
        },
      },
    },
    select: { id: true },
  });

  return managers
    .filter((m) => m.id !== ownerId)
    .map((m) =>
      buildDraft({
        renderers: deps.renderers,
        recipientUserId: m.id,
        actorUserId: ownerId ?? null,
        category: NotificationCategory.OKR,
        eventType: NotificationEventType.DECISION_PENDING,
        payload: { ownerName, objectiveTitle, objectiveId },
        referenceType: 'okr_objective',
        referenceId: objectiveId,
        correlationId: event.metadata.correlationId,
      }),
    );
};

export const onObjectiveActivated: RoutingRule = async (event, deps) => {
  const objectiveId = asString(event.payload.objectiveId);
  const objectiveTitle = asString(event.payload.objectiveTitle) ?? 'Objective';
  const ownerId = asString(event.payload.ownerId);
  const approverId = asString(event.payload.approverId);

  if (!objectiveId || !ownerId) return [];

  const recipientUser = await deps.prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, status: true },
  });
  if (!recipientUser || recipientUser.status !== 'ACTIVE') return [];

  const approverUser = approverId
    ? await deps.prisma.user.findUnique({
        where: { id: approverId },
        select: { employee: { select: { firstName: true, lastName: true } } },
      })
    : null;
  const approverName = approverUser?.employee
    ? `${approverUser.employee.firstName} ${approverUser.employee.lastName}`
    : 'Your manager';

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId: ownerId,
      actorUserId: approverId ?? null,
      category: NotificationCategory.OKR,
      eventType: NotificationEventType.REQUEST_APPROVED,
      payload: { approverName, objectiveTitle, objectiveId },
      referenceType: 'okr_objective',
      referenceId: objectiveId,
      correlationId: event.metadata.correlationId,
    }),
  ];
};

export const onReminderDue: RoutingRule = async (event, deps) => {
  const userId = asString(event.payload.userId);
  const cycleId = asString(event.payload.cycleId);
  const cycleName = asString(event.payload.cycleName) ?? 'cycle';
  const dueAt = asString(event.payload.dueAt) ?? '';
  const openKeyResultIds = Array.isArray(event.payload.openKeyResultIds)
    ? (event.payload.openKeyResultIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  if (!userId || !cycleId) return [];

  return [
    buildDraft({
      renderers: deps.renderers,
      recipientUserId: userId,
      actorUserId: null,
      category: NotificationCategory.OKR,
      eventType: NotificationEventType.DECISION_PENDING,
      payload: { cycleName, dueAt, openCount: openKeyResultIds.length },
      referenceType: 'okr_cycle',
      referenceId: cycleId,
      correlationId: event.metadata.correlationId,
    }),
  ];
};
