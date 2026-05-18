import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  DomainEvent,
  EVENT_BUS,
  IEventBus,
  JwtPayload,
  OkrCycleStatus,
  OkrCycleType,
} from '@sentient/shared';

import {
  OkrCycle,
  OkrCycleStatus as PrismaOkrCycleStatus,
  OkrCycleType as PrismaOkrCycleType,
  Prisma,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateOkrCycleDto } from '../dto/cycles/create-okr-cycle.dto';
import { OkrCycleQueryDto } from '../dto/cycles/okr-cycle-query.dto';
import { OkrCycleResponseDto } from '../dto/response/okr-cycle-response.dto';

export interface OkrCycleListResult {
  items: OkrCycleResponseDto[];
  nextCursor: string | null;
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

@Injectable()
export class OkrCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(dto: CreateOkrCycleDto, user: JwtPayload): Promise<OkrCycleResponseDto> {
    if (dto.type === OkrCycleType.ANNUAL && dto.quarter != null) {
      throw new BadRequestException('InvalidQuarter');
    }
    if (dto.type === OkrCycleType.QUARTERLY && (dto.quarter == null || dto.quarter < 1 || dto.quarter > 4)) {
      throw new BadRequestException('InvalidQuarter');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) {
      throw new BadRequestException('EndBeforeStart');
    }

    const existing = await this.prisma.okrCycle.findFirst({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException('CycleNameTaken');
    }

    if (dto.parentCycleId) {
      const parent = await this.prisma.okrCycle.findUnique({ where: { id: dto.parentCycleId } });
      if (!parent || parent.type !== PrismaOkrCycleType.ANNUAL) {
        throw new BadRequestException('ParentMustBeAnnual');
      }
    }

    const cycle = await this.prisma.okrCycle.create({
      data: {
        name: dto.name,
        type: dto.type as unknown as PrismaOkrCycleType,
        year: dto.year,
        quarter: dto.quarter ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        parentCycleId: dto.parentCycleId ?? null,
        createdById: user.sub,
        status: PrismaOkrCycleStatus.DRAFT,
      },
    });

    return this.toDto(cycle);
  }

  async list(query: OkrCycleQueryDto, _user: JwtPayload): Promise<OkrCycleListResult> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;

    const filters: Prisma.OkrCycleWhereInput[] = [];
    if (query.type) filters.push({ type: query.type as unknown as PrismaOkrCycleType });
    if (query.year) filters.push({ year: query.year });
    if (query.status) filters.push({ status: query.status as unknown as PrismaOkrCycleStatus });
    if (query.parentCycleId) filters.push({ parentCycleId: query.parentCycleId });
    if (cursor) {
      filters.push({
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      });
    }

    const rows = await this.prisma.okrCycle.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((r) => this.toDto(r)),
      nextCursor: rows.length > limit && last ? this.encodeCursor(last) : null,
    };
  }

  async findOne(id: string, _user: JwtPayload): Promise<OkrCycleResponseDto> {
    const cycle = await this.prisma.okrCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException('OKR cycle not found');
    return this.toDto(cycle);
  }

  async activate(id: string, user: JwtPayload): Promise<OkrCycleResponseDto> {
    const cycle = await this.prisma.okrCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException('OKR cycle not found');
    if (cycle.status !== PrismaOkrCycleStatus.DRAFT) {
      throw new BadRequestException('CycleNotDraft');
    }
    if (new Date(cycle.endDate) < new Date()) {
      throw new BadRequestException('EndDateInPast');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.okrCycle.update({
        where: { id },
        data: {
          status: PrismaOkrCycleStatus.ACTIVE,
          activatedAt: new Date(),
          activatedById: user.sub,
        },
      });
    });

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'okr.cycle_activated',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        cycleId: updated.id,
        cycleName: updated.name,
        type: updated.type,
        startDate: updated.startDate instanceof Date
          ? updated.startDate.toISOString().slice(0, 10)
          : String(updated.startDate),
        endDate: updated.endDate instanceof Date
          ? updated.endDate.toISOString().slice(0, 10)
          : String(updated.endDate),
      },
      metadata: { userId: user.sub, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return this.toDto(updated);
  }

  async close(id: string, user: JwtPayload): Promise<OkrCycleResponseDto> {
    const cycle = await this.prisma.okrCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException('OKR cycle not found');

    const now = new Date();

    const closedObjectiveIds = await this.prisma.$transaction(async (tx) => {
      const activeObjectives = await tx.objective.findMany({
        where: { cycleId: id, status: 'ACTIVE' },
        select: { id: true },
      });

      const objectiveIds = activeObjectives.map((o) => o.id);

      if (objectiveIds.length > 0) {
        await tx.objective.updateMany({
          where: { id: { in: objectiveIds } },
          data: { status: 'CLOSED', closedAt: now, closedById: user.sub },
        });
      }

      await tx.okrCheckIn.updateMany({
        where: {
          status: 'PENDING',
          keyResult: { objective: { cycleId: id } },
        },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Cycle closed before review',
          reviewedAt: now,
          reviewedById: null,
        },
      });

      await tx.okrCycle.update({
        where: { id },
        data: { status: PrismaOkrCycleStatus.CLOSED, closedAt: now, closedById: user.sub },
      });

      return objectiveIds;
    });

    for (const objectiveId of closedObjectiveIds) {
      await this.eventBus.emit<Record<string, unknown>>({
        id: randomUUID(),
        type: 'okr.objective_closed',
        source: 'HR_CORE',
        timestamp: new Date(),
        payload: { objectiveId, finalScore: '0' },
        metadata: { userId: user.sub, correlationId: randomUUID() },
      } satisfies DomainEvent<Record<string, unknown>>);
    }

    const updated = await this.prisma.okrCycle.findUniqueOrThrow({ where: { id } });
    return this.toDto(updated);
  }

  private toDto(cycle: OkrCycle): OkrCycleResponseDto {
    const dto = new OkrCycleResponseDto();
    dto.id = cycle.id;
    dto.name = cycle.name;
    dto.type = cycle.type as unknown as OkrCycleType;
    dto.year = cycle.year;
    dto.quarter = cycle.quarter;
    dto.status = cycle.status as unknown as OkrCycleStatus;
    dto.startDate = cycle.startDate instanceof Date
      ? cycle.startDate.toISOString().slice(0, 10)
      : String(cycle.startDate);
    dto.endDate = cycle.endDate instanceof Date
      ? cycle.endDate.toISOString().slice(0, 10)
      : String(cycle.endDate);
    dto.parentCycleId = cycle.parentCycleId;
    dto.createdAt = cycle.createdAt.toISOString();
    dto.updatedAt = cycle.updatedAt.toISOString();
    return dto;
  }

  private encodeCursor(cycle: OkrCycle): string {
    const payload: CursorPayload = { createdAt: cycle.createdAt.toISOString(), id: cycle.id };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'createdAt' in parsed &&
        'id' in parsed &&
        typeof (parsed as Record<string, unknown>).createdAt === 'string' &&
        typeof (parsed as Record<string, unknown>).id === 'string'
      ) {
        return parsed as CursorPayload;
      }
      return null;
    } catch {
      return null;
    }
  }
}
