import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationCategory as SharedNotificationCategory,
  NotificationEventType as SharedNotificationEventType,
  NotificationStatus as SharedNotificationStatus,
} from '@sentient/shared';
import {
  Notification,
  NotificationCategory,
  NotificationEventType,
  NotificationStatus,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDraft } from './dto/notification-draft.interface';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

export interface NotificationListResult {
  items: NotificationResponseDto[];
  nextCursor?: string;
  unreadCount: number;
}

export interface UpdatedCountResult {
  updatedCount: number;
}

export interface OpenNotificationReference {
  id: string;
  recipientUserId: string;
}

interface DecodedCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkCreate(drafts: NotificationDraft[]): Promise<NotificationResponseDto[]> {
    if (drafts.length === 0) return [];

    await this.prisma.notification.createMany({
      data: drafts.map((draft) => ({
        recipientUserId: draft.recipientUserId,
        actorUserId: draft.actorUserId,
        category: draft.category as unknown as NotificationCategory,
        eventType: draft.eventType as unknown as NotificationEventType,
        title: draft.title,
        body: draft.body,
        payload: draft.payload as Prisma.InputJsonValue,
        referenceType: draft.referenceType,
        referenceId: draft.referenceId,
        correlationId: draft.correlationId,
      })),
    });

    const rows = await this.prisma.notification.findMany({
      where: {
        OR: drafts.map((draft) => ({
          recipientUserId: draft.recipientUserId,
          correlationId: draft.correlationId,
        })),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async list(userId: string, query: NotificationQueryDto): Promise<NotificationListResult> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const filters: Prisma.NotificationWhereInput[] = [
      { recipientUserId: userId },
      query.status
        ? { status: query.status as unknown as NotificationStatus }
        : { status: { not: NotificationStatus.DISMISSED } },
    ];

    if (query.category) {
      filters.push({ category: query.category as unknown as NotificationCategory });
    }
    if (query.referenceType) {
      filters.push({ referenceType: query.referenceType });
    }
    if (cursor) {
      filters.push({
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      });
    }

    const rows = await this.prisma.notification.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.toDto(row)),
      nextCursor: rows.length > limit && last ? this.encodeCursor(last) : undefined,
      unreadCount: await this.getUnreadCount(userId),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientUserId: userId, status: NotificationStatus.UNREAD },
    });
  }

  async markRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.status === NotificationStatus.DISMISSED) {
      throw new ConflictException('Notification dismissed');
    }
    if (row.status === NotificationStatus.READ) return this.toDto(row);

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return this.toDto(updated);
  }

  async markAllRead(
    userId: string,
    category?: SharedNotificationCategory,
  ): Promise<UpdatedCountResult> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: userId,
        status: NotificationStatus.UNREAD,
        ...(category ? { category: category as unknown as NotificationCategory } : {}),
      },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async dismiss(id: string, userId: string): Promise<void> {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: userId },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.status === NotificationStatus.DISMISSED) return;

    await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.DISMISSED, dismissedAt: new Date() },
    });
  }

  async purgeOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return result.count;
  }

  async findOpenByReference(
    referenceType: string,
    referenceId: string,
    recipientUserId?: string,
  ): Promise<OpenNotificationReference[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        referenceType,
        referenceId,
        status: NotificationStatus.UNREAD,
        ...(recipientUserId ? { recipientUserId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => ({ id: row.id, recipientUserId: row.recipientUserId }));
  }

  async markResolved(ids: string[], recipientUserId?: string): Promise<UpdatedCountResult> {
    if (ids.length === 0) return { updatedCount: 0 };
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: ids },
        status: NotificationStatus.UNREAD,
        ...(recipientUserId ? { recipientUserId } : {}),
      },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private toDto(row: Notification): NotificationResponseDto {
    return {
      id: row.id,
      recipientUserId: row.recipientUserId,
      category: row.category as unknown as SharedNotificationCategory,
      eventType: row.eventType as unknown as SharedNotificationEventType,
      title: row.title,
      body: row.body,
      payload: this.toPayloadRecord(row.payload),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      status: row.status as unknown as SharedNotificationStatus,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    };
  }

  private toPayloadRecord(value: Prisma.JsonValue): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private encodeCursor(row: Notification): string {
    const payload: DecodedCursor = { createdAt: row.createdAt.toISOString(), id: row.id };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): DecodedCursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'createdAt' in parsed &&
        'id' in parsed &&
        typeof parsed.createdAt === 'string' &&
        typeof parsed.id === 'string'
      ) {
        return { createdAt: parsed.createdAt, id: parsed.id };
      }
      return null;
    } catch {
      return null;
    }
  }
}
