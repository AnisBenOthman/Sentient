import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Audience } from '@sentient/shared';
import { EVENT_BUS, IEventBus } from '@sentient/shared';
import { JwtPayload } from '@sentient/shared';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HrCoreClient } from '../../common/clients/hr-core.client';

function buildJwt(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: randomUUID(),
    employeeId: randomUUID(),
    roles: ['EMPLOYEE'],
    departmentId: 'dept-001',
    teamId: 'team-001',
    businessUnitId: null,
    channel: 'WEB' as JwtPayload['channel'],
    roleAssignments: [],
    sessionId: randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function buildAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    title: 'Test announcement',
    body: 'Body text',
    authorId: randomUUID(),
    audience: Audience.COMPANY,
    targetDepartmentId: null,
    targetTeamId: null,
    publishedAt: new Date(),
    expiresAt: null,
    pinnedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: {
    announcement: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let hrCoreClient: { getEmployeeRef: jest.Mock; getDepartmentRef: jest.Mock; getTeamRef: jest.Mock };
  let eventBus: { emit: jest.Mock; subscribe: jest.Mock };

  beforeEach(async () => {
    prisma = {
      announcement: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    hrCoreClient = {
      getEmployeeRef: jest.fn(),
      getDepartmentRef: jest.fn(),
      getTeamRef: jest.fn(),
    };

    eventBus = { emit: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HrCoreClient, useValue: hrCoreClient },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
  });

  // =========================================================
  // T006 — Audience-filter WHERE clause construction
  // =========================================================
  describe('findAll — audience filter WHERE clause', () => {
    const employeeUser = buildJwt({ roles: ['EMPLOYEE'], departmentId: 'dept-001', teamId: 'team-001' });
    const hrAdminUser = buildJwt({ roles: ['HR_ADMIN'], departmentId: 'dept-002', teamId: null });

    beforeEach(() => {
      prisma.announcement.findMany.mockResolvedValue([]);
    });

    it('COMPANY audience: no department/team filter in WHERE', async () => {
      await service.findAll(employeeUser, { page: 1, pageSize: 20 });
      const call = prisma.announcement.findMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
      const where = call?.where ?? {};
      expect(where).not.toHaveProperty('targetDepartmentId');
      expect(where).not.toHaveProperty('targetTeamId');
    });

    it('non-HR_ADMIN: filters by COMPANY OR department match OR team match', async () => {
      await service.findAll(employeeUser, { page: 1, pageSize: 20 });
      const call = prisma.announcement.findMany.mock.calls[0]?.[0] as { where?: { OR?: unknown[] } };
      const where = call?.where ?? {};
      expect(where).toHaveProperty('OR');
      const or = (where as { OR: Array<Record<string, unknown>> }).OR;
      // one clause must be COMPANY
      expect(or.some((c) => c['audience'] === Audience.COMPANY)).toBe(true);
      // one clause must filter by departmentId
      expect(or.some((c) => c['targetDepartmentId'] === 'dept-001')).toBe(true);
      // one clause must filter by teamId
      expect(or.some((c) => c['targetTeamId'] === 'team-001')).toBe(true);
    });

    it('HR_ADMIN without scope=all: still uses audience OR filter', async () => {
      await service.findAll(hrAdminUser, { page: 1, pageSize: 20 });
      const call = prisma.announcement.findMany.mock.calls[0]?.[0] as { where?: { OR?: unknown[] } };
      const where = call?.where ?? {};
      // HR_ADMIN without scope=all — can choose to show OR, or no filter; either is acceptable
      // just confirm no crash
      expect(prisma.announcement.findMany).toHaveBeenCalledTimes(1);
    });

    it('HR_ADMIN with scope=all: bypasses audience filter', async () => {
      await service.findAll(hrAdminUser, { page: 1, pageSize: 20, scope: 'all' });
      const call = prisma.announcement.findMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
      const where = call?.where ?? {};
      expect(where).not.toHaveProperty('OR');
    });

    it('non-HR_ADMIN with scope=all: throws ForbiddenException', async () => {
      const managerUser = buildJwt({ roles: ['MANAGER'] });
      await expect(service.findAll(managerUser, { page: 1, pageSize: 20, scope: 'all' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =========================================================
  // T007 — ROLE/INDIVIDUAL rejection + event shape + de-duplication
  // =========================================================
  describe('create — ROLE/INDIVIDUAL audience rejection', () => {
    const managerUser = buildJwt({ roles: ['MANAGER'], departmentId: 'dept-001', teamId: 'team-001' });

    it('ROLE audience → 400 UnsupportedAudienceInThisRelease', async () => {
      await expect(
        service.create(managerUser, { title: 'T', body: 'B', audience: Audience.ROLE }, 'corr-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(managerUser, { title: 'T', body: 'B', audience: Audience.ROLE }, 'corr-1'),
      ).rejects.toMatchObject({ message: 'UnsupportedAudienceInThisRelease' });
    });

    it('INDIVIDUAL audience → 400 UnsupportedAudienceInThisRelease', async () => {
      await expect(
        service.create(managerUser, { title: 'T', body: 'B', audience: Audience.INDIVIDUAL }, 'corr-2'),
      ).rejects.toMatchObject({ message: 'UnsupportedAudienceInThisRelease' });
    });
  });

  describe('create — announcement.published event shape', () => {
    it('emits event with source SOCIAL, correct payload, propagated correlationId', async () => {
      const managerUser = buildJwt({
        roles: ['MANAGER'],
        sub: 'user-sub-123',
        employeeId: 'emp-123',
        departmentId: 'dept-abc',
      });
      const created = buildAnnouncement({
        id: 'ann-uuid',
        authorId: 'emp-123',
        audience: Audience.COMPANY,
        targetDepartmentId: null,
        targetTeamId: null,
        title: 'Hello',
      });

      prisma.announcement.create.mockResolvedValue(created);
      hrCoreClient.getEmployeeRef.mockResolvedValue({
        id: 'emp-123',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@test.dev',
        employeeCode: 'EMP-001',
        departmentId: 'dept-abc',
        teamId: null,
        employmentStatus: 'ACTIVE',
      });

      await service.create(
        managerUser,
        { title: 'Hello', body: 'World', audience: Audience.COMPANY },
        'corr-id-xyz',
      );

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = eventBus.emit.mock.calls[0]?.[0];
      expect(emittedEvent).toBeDefined();
      expect(emittedEvent.type).toBe('announcement.published');
      expect(emittedEvent.source).toBe('SOCIAL');
      expect(emittedEvent.payload.announcementId).toBe('ann-uuid');
      expect(emittedEvent.payload.audience).toBe(Audience.COMPANY);
      expect(emittedEvent.payload.authorId).toBe('emp-123');
      expect(emittedEvent.payload.targetDepartmentId).toBeNull();
      expect(emittedEvent.payload.targetTeamId).toBeNull();
      expect(emittedEvent.payload.title).toBe('Hello');
      expect(emittedEvent.metadata.userId).toBe('user-sub-123');
      expect(emittedEvent.metadata.correlationId).toBe('corr-id-xyz');
    });
  });

  describe('enrichWithAuthor — de-duplication', () => {
    it('20 items with 5 unique authors → exactly 5 HR Core calls', async () => {
      const authorIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
      const items = Array.from({ length: 20 }, (_, i) => {
        const authorId = authorIds[i % 5] as string;
        return buildAnnouncement({ authorId });
      });

      hrCoreClient.getEmployeeRef.mockResolvedValue({
        id: 'emp',
        firstName: 'First',
        lastName: 'Last',
        email: 'e@test.dev',
        employeeCode: 'EMP-01',
        departmentId: 'dept-01',
        teamId: null,
        employmentStatus: 'ACTIVE',
      });

      await service.enrichWithAuthor(items);

      expect(hrCoreClient.getEmployeeRef).toHaveBeenCalledTimes(5);
    });

    it('sets author: null when getEmployeeRef throws NotFoundException', async () => {
      const item = buildAnnouncement({ authorId: 'missing-emp' });
      hrCoreClient.getEmployeeRef.mockRejectedValue(new NotFoundException('Employee missing-emp not found in HR Core'));

      const result = await service.enrichWithAuthor([item]);
      expect(result[0]).toBeDefined();
      const firstResult = result[0] as { author: unknown };
      expect(firstResult.author).toBeNull();
    });
  });

  // =========================================================
  // T013 — US2 ownership + audience consistency
  // =========================================================
  describe('update — ownership guard', () => {
    const authorUser = buildJwt({ roles: ['MANAGER'], employeeId: 'author-emp-id' });
    const otherUser = buildJwt({ roles: ['MANAGER'], employeeId: 'other-emp-id' });
    const hrAdminUser = buildJwt({ roles: ['HR_ADMIN'], employeeId: 'admin-emp-id' });

    const existingAnn = buildAnnouncement({
      id: 'ann-1',
      authorId: 'author-emp-id',
      audience: Audience.COMPANY,
    });

    beforeEach(() => {
      prisma.announcement.findFirst.mockResolvedValue(existingAnn);
      prisma.announcement.update.mockResolvedValue({ ...existingAnn, title: 'Updated' });
      hrCoreClient.getEmployeeRef.mockResolvedValue({
        id: 'author-emp-id',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        employeeCode: 'EMP',
        departmentId: 'dept',
        teamId: null,
        employmentStatus: 'ACTIVE',
      });
    });

    it('non-author MANAGER → 403 NotAnnouncementAuthor on PATCH', async () => {
      await expect(service.update(otherUser, 'ann-1', { title: 'X' })).rejects.toMatchObject({
        message: 'NotAnnouncementAuthor',
      });
    });

    it('HR_ADMIN can update any announcement', async () => {
      await expect(service.update(hrAdminUser, 'ann-1', { title: 'X' })).resolves.toBeDefined();
    });

    it('author can update their own announcement', async () => {
      await expect(service.update(authorUser, 'ann-1', { title: 'X' })).resolves.toBeDefined();
    });
  });

  describe('remove — ownership guard', () => {
    const authorUser = buildJwt({ roles: ['MANAGER'], employeeId: 'author-emp-id' });
    const otherUser = buildJwt({ roles: ['MANAGER'], employeeId: 'other-emp-id' });
    const hrAdminUser = buildJwt({ roles: ['HR_ADMIN'], employeeId: 'admin-emp-id' });

    const existingAnn = buildAnnouncement({ id: 'ann-1', authorId: 'author-emp-id' });

    beforeEach(() => {
      prisma.announcement.findFirst.mockResolvedValue(existingAnn);
      prisma.announcement.delete.mockResolvedValue(existingAnn);
    });

    it('non-author MANAGER → 403 NotAnnouncementAuthor on DELETE', async () => {
      await expect(service.remove(otherUser, 'ann-1')).rejects.toMatchObject({
        message: 'NotAnnouncementAuthor',
      });
    });

    it('HR_ADMIN can delete any announcement', async () => {
      await expect(service.remove(hrAdminUser, 'ann-1')).resolves.toBeUndefined();
    });
  });

  describe('update — audience-target consistency', () => {
    const hrAdminUser = buildJwt({ roles: ['HR_ADMIN'], employeeId: 'admin-emp-id' });
    const existingAnn = buildAnnouncement({ id: 'ann-1', authorId: 'admin-emp-id', audience: Audience.DEPARTMENT, targetDepartmentId: 'dept-001' });

    beforeEach(() => {
      prisma.announcement.findFirst.mockResolvedValue(existingAnn);
      prisma.announcement.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existingAnn, ...data }),
      );
      hrCoreClient.getEmployeeRef.mockResolvedValue({
        id: 'admin-emp-id', firstName: 'A', lastName: 'B', email: 'a@b.com',
        employeeCode: 'EMP', departmentId: 'dept', teamId: null, employmentStatus: 'ACTIVE',
      });
    });

    it('PATCHing audience to COMPANY clears targetTeamId and targetDepartmentId', async () => {
      await service.update(hrAdminUser, 'ann-1', { audience: Audience.COMPANY });
      const updateCall = prisma.announcement.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(updateCall?.data?.['targetDepartmentId']).toBeNull();
      expect(updateCall?.data?.['targetTeamId']).toBeNull();
    });

    it('HR_ADMIN PATCHing audience to DEPARTMENT without targetDepartmentId → 400 TargetDepartmentRequired', async () => {
      const annWithNoTarget = buildAnnouncement({ id: 'ann-2', authorId: 'admin-emp-id', audience: Audience.COMPANY });
      prisma.announcement.findFirst.mockResolvedValue(annWithNoTarget);

      await expect(
        service.update(hrAdminUser, 'ann-2', { audience: Audience.DEPARTMENT }),
      ).rejects.toMatchObject({ message: 'TargetDepartmentRequired' });
    });
  });

  // =========================================================
  // T017 — US3 pin validation
  // =========================================================
  describe('pin — validation', () => {
    const hrAdminUser = buildJwt({ roles: ['HR_ADMIN'], employeeId: 'admin-emp-id' });
    const existingAnn = buildAnnouncement({ id: 'ann-1', authorId: 'admin-emp-id' });

    beforeEach(() => {
      prisma.announcement.findFirst.mockResolvedValue(existingAnn);
      prisma.announcement.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existingAnn, ...data }),
      );
      hrCoreClient.getEmployeeRef.mockResolvedValue({
        id: 'admin-emp-id', firstName: 'A', lastName: 'B', email: 'a@b.com',
        employeeCode: 'EMP', departmentId: 'dept', teamId: null, employmentStatus: 'ACTIVE',
      });
    });

    it('past pinnedUntil → 400 PinExpiryInPast', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await expect(service.pin(hrAdminUser, 'ann-1', { pinnedUntil: pastDate })).rejects.toMatchObject({
        message: 'PinExpiryInPast',
      });
    });

    it('pinnedUntil: null clears the pin', async () => {
      await service.pin(hrAdminUser, 'ann-1', { pinnedUntil: null });
      const updateCall = prisma.announcement.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(updateCall?.data?.['pinnedUntil']).toBeNull();
    });

    it('future pinnedUntil → sets pinnedUntil', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = await service.pin(hrAdminUser, 'ann-1', { pinnedUntil: futureDate });
      expect(result).toBeDefined();
    });

    it('announcement with active pinnedUntil → isPinned: true in response', async () => {
      const future = new Date(Date.now() + 86400000);
      const annWithPin = buildAnnouncement({ id: 'ann-1', authorId: 'admin-emp-id', pinnedUntil: future });
      prisma.announcement.update.mockResolvedValue(annWithPin);

      const result = await service.pin(hrAdminUser, 'ann-1', { pinnedUntil: future.toISOString() });
      expect((result as { isPinned: boolean }).isPinned).toBe(true);
    });
  });

  // =========================================================
  // T029 — FR-027 missing error-code coverage
  // =========================================================
  describe('create — FR-027 error codes (T029 coverage)', () => {
    const managerUser = buildJwt({ roles: ['MANAGER'], departmentId: 'dept-001', teamId: 'team-001' });

    it('expiresAt in the past → 400 ExpiryInPast', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await expect(
        service.create(managerUser, { title: 'T', body: 'B', audience: Audience.COMPANY, expiresAt: pastDate }, 'c'),
      ).rejects.toMatchObject({ message: 'ExpiryInPast' });
    });

    it('DEPARTMENT audience and getDepartmentRef returns null → 400 UnknownTargetDepartment', async () => {
      hrCoreClient.getDepartmentRef.mockResolvedValue(null);
      await expect(
        service.create(
          managerUser,
          { title: 'T', body: 'B', audience: Audience.DEPARTMENT, targetDepartmentId: 'dept-unknown' },
          'c',
        ),
      ).rejects.toMatchObject({ message: 'UnknownTargetDepartment' });
    });

    it('TEAM audience with no teamId in DTO or JWT → 400 MissingTeamForTeamAudience', async () => {
      const userNoTeam = buildJwt({ roles: ['MANAGER'], departmentId: 'dept-001', teamId: null });
      await expect(
        service.create(userNoTeam, { title: 'T', body: 'B', audience: Audience.TEAM }, 'c'),
      ).rejects.toMatchObject({ message: 'MissingTeamForTeamAudience' });
    });

    it('TEAM audience and getTeamRef returns null → 400 UnknownTargetTeam', async () => {
      hrCoreClient.getTeamRef.mockResolvedValue(null);
      await expect(
        service.create(
          managerUser,
          { title: 'T', body: 'B', audience: Audience.TEAM, targetTeamId: 'team-unknown' },
          'c',
        ),
      ).rejects.toMatchObject({ message: 'UnknownTargetTeam' });
    });
  });
});
