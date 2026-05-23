import { randomUUID } from 'crypto';

import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Audience, DomainEvent, EVENT_BUS, IEventBus, JwtPayload } from '@sentient/shared';

import { Announcement, Audience as PrismaAudience, Prisma } from '../../generated/prisma';
import { HrCoreCallContext, EmployeeRef } from '../../common/clients/employee-ref.interface';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements-query.dto';
import { PinAnnouncementDto } from './dto/pin-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

export interface AnnouncementWithAuthor extends Announcement {
  author: EmployeeRef | null;
  isPinned: boolean;
}

interface AnnouncementPublishedPayload {
  announcementId: string;
  audience: Audience;
  authorId: string;
  targetDepartmentId: string | null;
  targetTeamId: string | null;
  title: string;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrCoreClient: HrCoreClient,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(
    user: JwtPayload,
    dto: CreateAnnouncementDto,
    correlationId: string,
    jwt = '',
  ): Promise<AnnouncementWithAuthor> {
    if (dto.audience === Audience.ROLE || dto.audience === Audience.INDIVIDUAL) {
      throw new BadRequestException('UnsupportedAudienceInThisRelease');
    }

    if (dto.expiresAt !== undefined && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('ExpiryInPast');
    }

    const context: HrCoreCallContext = { jwt, correlationId };

    let targetDepartmentId: string | null = dto.targetDepartmentId ?? null;
    let targetTeamId: string | null = dto.targetTeamId ?? null;

    if (dto.audience === Audience.COMPANY) {
      targetDepartmentId = null;
      targetTeamId = null;
    } else if (dto.audience === Audience.DEPARTMENT) {
      targetDepartmentId = targetDepartmentId ?? user.departmentId ?? null;
      targetTeamId = null;
      if (!targetDepartmentId) {
        throw new BadRequestException('TargetDepartmentRequired');
      }
      const dept = await this.hrCoreClient.getDepartmentRef(targetDepartmentId, context);
      if (dept === null) {
        throw new BadRequestException('UnknownTargetDepartment');
      }
    } else if (dto.audience === Audience.TEAM) {
      targetTeamId = targetTeamId ?? user.teamId ?? null;
      targetDepartmentId = null;
      if (!targetTeamId) {
        throw new BadRequestException('MissingTeamForTeamAudience');
      }
      const team = await this.hrCoreClient.getTeamRef(targetTeamId, context);
      if (team === null) {
        throw new BadRequestException('UnknownTargetTeam');
      }
    }

    const authorId = user.employeeId ?? user.sub;

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience as unknown as PrismaAudience,
        authorId,
        targetDepartmentId,
        targetTeamId,
        publishedAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    try {
      const event: DomainEvent<AnnouncementPublishedPayload> = {
        id: randomUUID(),
        type: 'announcement.published',
        source: 'SOCIAL',
        timestamp: new Date(),
        payload: {
          announcementId: announcement.id,
          audience: dto.audience,
          authorId,
          targetDepartmentId: announcement.targetDepartmentId,
          targetTeamId: announcement.targetTeamId,
          title: announcement.title,
        },
        metadata: {
          userId: user.sub,
          correlationId,
        },
      };
      await this.eventBus.emit(event);
    } catch {
      // best-effort — HTTP 201 returns even if EventBus throws
    }

    const [enriched] = await this.enrichWithAuthor([announcement], context);
    return enriched!;
  }

  async findAll(
    user: JwtPayload,
    query: ListAnnouncementsQueryDto,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<{ items: AnnouncementWithAuthor[]; total: number }> {
    const isHrAdmin = user.roles.includes('HR_ADMIN');

    if (query.scope === 'all' && !isHrAdmin) {
      throw new ForbiddenException('Insufficient permissions: scope=all requires HR_ADMIN');
    }

    const shouldBypassAudienceFilter = query.scope === 'all' && isHrAdmin;
    const shouldIncludeExpired = query.includeExpired === true && isHrAdmin;

    const audienceClause: Prisma.AnnouncementWhereInput = {};
    if (!shouldBypassAudienceFilter) {
      const orClauses: Prisma.AnnouncementWhereInput[] = [{ audience: 'COMPANY' }];
      if (user.departmentId !== null) {
        orClauses.push({ audience: 'DEPARTMENT', targetDepartmentId: user.departmentId });
      }
      if (user.teamId !== null) {
        orClauses.push({ audience: 'TEAM', targetTeamId: user.teamId });
      }
      audienceClause['OR'] = orClauses;
    }

    const expiryClause: Prisma.AnnouncementWhereInput = shouldIncludeExpired
      ? {}
      : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

    const where: Prisma.AnnouncementWhereInput =
      Object.keys(audienceClause).length > 0
        ? { ...audienceClause, AND: [expiryClause] }
        : { AND: [expiryClause] };

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const items = await this.prisma.announcement.findMany({
      where,
      orderBy: [{ pinnedUntil: 'desc' }, { publishedAt: 'desc' }],
      skip,
      take,
    });

    const enriched = await this.enrichWithAuthor(items, context);
    return { items: enriched, total: enriched.length };
  }

  async findOne(
    user: JwtPayload,
    id: string,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<AnnouncementWithAuthor> {
    const announcement = await this.prisma.announcement.findFirst({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);

    if (!user.roles.includes('HR_ADMIN')) {
      if (!this.isVisibleToUser(announcement, user)) {
        throw new NotFoundException(`Announcement ${id} not found`);
      }
    }

    const [enriched] = await this.enrichWithAuthor([announcement], context);
    return enriched!;
  }

  async update(
    user: JwtPayload,
    id: string,
    dto: UpdateAnnouncementDto,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<AnnouncementWithAuthor> {
    const announcement = await this.prisma.announcement.findFirst({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);

    const isHrAdmin = user.roles.includes('HR_ADMIN');
    const callerId = user.employeeId ?? user.sub;
    if (!isHrAdmin && announcement.authorId !== callerId) {
      throw new ForbiddenException('NotAnnouncementAuthor');
    }

    const data: Prisma.AnnouncementUpdateInput = {};

    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.body !== undefined) data['body'] = dto.body;
    if (dto.expiresAt !== undefined) {
      data['expiresAt'] = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    if (dto.audience !== undefined) {
      data['audience'] = dto.audience as unknown as PrismaAudience;

      if (dto.audience === Audience.COMPANY) {
        data['targetDepartmentId'] = null;
        data['targetTeamId'] = null;
      } else if (dto.audience === Audience.DEPARTMENT) {
        const resolvedDept = dto.targetDepartmentId ?? announcement.targetDepartmentId;
        if (!resolvedDept) throw new BadRequestException('TargetDepartmentRequired');
        data['targetDepartmentId'] = resolvedDept;
        data['targetTeamId'] = null;
      } else if (dto.audience === Audience.TEAM) {
        const resolvedTeam = dto.targetTeamId ?? announcement.targetTeamId;
        if (!resolvedTeam) throw new BadRequestException('MissingTeamForTeamAudience');
        data['targetTeamId'] = resolvedTeam;
        data['targetDepartmentId'] = null;
      }
    } else {
      if (dto.targetDepartmentId !== undefined) data['targetDepartmentId'] = dto.targetDepartmentId;
      if (dto.targetTeamId !== undefined) data['targetTeamId'] = dto.targetTeamId;
    }

    const updated = await this.prisma.announcement.update({ where: { id }, data });
    const [enriched] = await this.enrichWithAuthor([updated], context);
    return enriched!;
  }

  async remove(user: JwtPayload, id: string): Promise<void> {
    const announcement = await this.prisma.announcement.findFirst({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);

    const isHrAdmin = user.roles.includes('HR_ADMIN');
    const callerId = user.employeeId ?? user.sub;
    if (!isHrAdmin && announcement.authorId !== callerId) {
      throw new ForbiddenException('NotAnnouncementAuthor');
    }

    await this.prisma.announcement.delete({ where: { id } });
  }

  async pin(
    user: JwtPayload,
    id: string,
    dto: PinAnnouncementDto,
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<AnnouncementWithAuthor> {
    const announcement = await this.prisma.announcement.findFirst({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);

    if (dto.pinnedUntil !== null && new Date(dto.pinnedUntil!) <= new Date()) {
      throw new BadRequestException('PinExpiryInPast');
    }

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { pinnedUntil: dto.pinnedUntil ? new Date(dto.pinnedUntil) : null },
    });

    const [enriched] = await this.enrichWithAuthor([updated], context);
    return enriched!;
  }

  async enrichWithAuthor(
    items: Announcement[],
    context: HrCoreCallContext = { jwt: '' },
  ): Promise<AnnouncementWithAuthor[]> {
    const uniqueAuthorIds = [...new Set(items.map((item) => item.authorId))];

    const authorMap = new Map<string, EmployeeRef | null>();
    await Promise.all(
      uniqueAuthorIds.map(async (authorId) => {
        try {
          const ref = await this.hrCoreClient.getEmployeeRef(authorId, context);
          authorMap.set(authorId, ref);
        } catch (err: unknown) {
          if (err instanceof NotFoundException) {
            authorMap.set(authorId, null);
          } else {
            throw err;
          }
        }
      }),
    );

    return items.map((item) => {
      const now = new Date();
      const isPinned = item.pinnedUntil !== null && new Date(item.pinnedUntil) > now;
      return {
        ...item,
        author: authorMap.get(item.authorId) ?? null,
        isPinned,
      };
    });
  }

  private isVisibleToUser(announcement: Announcement, user: JwtPayload): boolean {
    if (announcement.audience === 'COMPANY') return true;
    if (announcement.audience === 'DEPARTMENT' && announcement.targetDepartmentId === user.departmentId) {
      return true;
    }
    if (announcement.audience === 'TEAM' && announcement.targetTeamId === user.teamId) {
      return true;
    }
    return false;
  }
}
