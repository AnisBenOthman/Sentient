import { randomUUID } from 'crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DomainEvent, EVENT_BUS, IEventBus, JwtPayload } from '@sentient/shared';

import { Event, Prisma } from '../../generated/prisma';
import { EmployeeRef, HrCoreCallContext } from '../../common/clients/employee-ref.interface';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { ReactEventDto } from './dto/react-event.dto';
import {
  EventReactionEmoji,
  EventReactionSummary,
  EVENT_REACTION_EMOJIS,
  isEventReactionEmoji,
} from './event-reactions';

export interface EventWithEngagement extends Event {
  organizer: EmployeeRef | null;
  reactionCounts: EventReactionSummary[];
  myReaction: EventReactionEmoji | null;
}

interface EventCreatedPayload {
  eventId: string;
  title: string;
  eventType: string;
  audience: string;
  organizerId: string;
  startAt: string;
  endAt: string;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrCoreClient: HrCoreClient,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(
    user: JwtPayload,
    dto: CreateEventDto,
    correlationId: string,
    jwt = '',
  ): Promise<EventWithEngagement> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('EventEndMustBeAfterStart');
    }

    const organizerId = user.employeeId ?? user.sub;
    const context: HrCoreCallContext = { jwt, correlationId };
    const organizer = await this.hrCoreClient.getEmployeeRef(organizerId, context);
    if (organizer === null) {
      throw new BadRequestException('UnknownOrganizer');
    }

    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        eventType: dto.eventType,
        organizerId,
        startAt,
        endAt,
        location: dto.location?.trim() ? dto.location.trim() : null,
        audience: dto.audience,
        capacity: dto.capacity ?? null,
      },
    });

    try {
      const domainEvent: DomainEvent<EventCreatedPayload> = {
        id: randomUUID(),
        type: 'event.created',
        source: 'SOCIAL',
        timestamp: new Date(),
        payload: {
          eventId: event.id,
          title: event.title,
          eventType: event.eventType,
          audience: event.audience,
          organizerId: event.organizerId,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt.toISOString(),
        },
        metadata: {
          userId: user.sub,
          correlationId,
        },
      };
      await this.eventBus.emit(domainEvent);
    } catch {
      // Event publication is best-effort; event creation remains durable.
    }

    return {
      ...event,
      organizer,
      reactionCounts: this.emptyReactionCounts(),
      myReaction: null,
    };
  }

  async findAll(
    user: JwtPayload,
    query: ListEventsQueryDto,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<{ items: EventWithEngagement[]; total: number }> {
    const where: Prisma.EventWhereInput = {};
    if (query.eventType !== undefined) {
      where.eventType = query.eventType;
    }

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items: await this.enrichEvents(items, user.employeeId ?? user.sub, context),
      total,
    };
  }

  async react(
    user: JwtPayload,
    eventId: string,
    dto: ReactEventDto,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<EventWithEngagement> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    const employeeId = user.employeeId ?? user.sub;
    const current = await this.prisma.eventReaction.findUnique({
      where: { eventId_employeeId: { eventId, employeeId } },
    });

    if (dto.emoji === null || dto.emoji === undefined || current?.emoji === dto.emoji) {
      if (current) {
        await this.prisma.eventReaction.delete({ where: { id: current.id } });
      }
    } else {
      await this.prisma.eventReaction.upsert({
        where: { eventId_employeeId: { eventId, employeeId } },
        create: { eventId, employeeId, emoji: dto.emoji },
        update: { emoji: dto.emoji },
      });
    }

    const [enriched] = await this.enrichEvents([event], employeeId, context);
    return enriched!;
  }

  private async enrichEvents(
    items: Event[],
    employeeId: string,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<EventWithEngagement[]> {
    const eventIds = items.map((item) => item.id);
    const organizerIds = [...new Set(items.map((item) => item.organizerId))];
    const organizerMap = new Map<string, EmployeeRef | null>();

    await Promise.all(
      organizerIds.map(async (organizerId) => {
        try {
          organizerMap.set(organizerId, await this.hrCoreClient.getEmployeeRef(organizerId, context));
        } catch {
          organizerMap.set(organizerId, null);
        }
      }),
    );

    const grouped = eventIds.length
      ? await this.prisma.eventReaction.groupBy({
          by: ['eventId', 'emoji'],
          where: { eventId: { in: eventIds } },
          _count: { emoji: true },
        })
      : [];

    const ownReactions = eventIds.length
      ? await this.prisma.eventReaction.findMany({
          where: { eventId: { in: eventIds }, employeeId },
          select: { eventId: true, emoji: true },
        })
      : [];

    const ownReactionMap = new Map(
      ownReactions.map((reaction) => [
        reaction.eventId,
        isEventReactionEmoji(reaction.emoji) ? reaction.emoji : null,
      ]),
    );

    const reactionMap = new Map<string, EventReactionSummary[]>();
    for (const eventId of eventIds) {
      reactionMap.set(eventId, this.emptyReactionCounts());
    }

    for (const row of grouped) {
      if (!isEventReactionEmoji(row.emoji)) continue;
      const counts = reactionMap.get(row.eventId) ?? this.emptyReactionCounts();
      const target = counts.find((entry) => entry.emoji === row.emoji);
      if (target) target.count = row._count.emoji;
      reactionMap.set(row.eventId, counts);
    }

    return items.map((item) => ({
      ...item,
      organizer: organizerMap.get(item.organizerId) ?? null,
      reactionCounts: reactionMap.get(item.id) ?? this.emptyReactionCounts(),
      myReaction: ownReactionMap.get(item.id) ?? null,
    }));
  }

  private emptyReactionCounts(): EventReactionSummary[] {
    return EVENT_REACTION_EMOJIS.map((emoji) => ({ emoji, count: 0 }));
  }
}
