import { NotificationCategory, NotificationEventType } from '@sentient/shared';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationDraft } from '../../dto/notification-draft.interface';
import { NotificationRenderers } from '../../notifications.renderers';

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function userIdForEmployee(
  prisma: PrismaService,
  employeeId: string | null,
): Promise<string | null> {
  if (!employeeId) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { user: { select: { id: true } } },
  });
  return employee?.user?.id ?? null;
}

export async function displayNameForEmployee(
  prisma: PrismaService,
  employeeId: string | null,
): Promise<string> {
  if (!employeeId) return 'Unknown';
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true },
  });
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';
}

export async function activeHrAdminUserIds(prisma: PrismaService): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      userRoles: {
        some: {
          revokedAt: null,
          role: { code: { in: ['HR_ADMIN', 'GLOBAL_HR_ADMIN'] } },
        },
      },
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export function buildDraft(input: {
  renderers: NotificationRenderers;
  recipientUserId: string;
  actorUserId: string | null;
  category: NotificationCategory;
  eventType: NotificationEventType;
  payload: Record<string, unknown>;
  referenceType: string;
  referenceId: string;
  correlationId: string;
}): NotificationDraft {
  const rendered = input.renderers.render(input.category, input.eventType, input.payload);
  return {
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    category: input.category,
    eventType: input.eventType,
    title: rendered.title,
    body: rendered.body,
    payload: input.payload,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    correlationId: input.correlationId,
  };
}
