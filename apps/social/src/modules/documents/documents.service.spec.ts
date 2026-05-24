import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, GoneException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType, EVENT_BUS, JwtPayload } from '@sentient/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { DocumentsService } from './documents.service';
import { DOCUMENT_STORAGE } from './storage/document-storage.interface';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  document: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventBus = { emit: jest.fn() };

const mockStorage = {
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
};

const mockHrCoreClient = {
  getEmployeeRef: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'DOCUMENT_MAX_SIZE_BYTES') return 26_214_400;
    if (key === 'DOCUMENT_MIME_WHITELIST')
      return 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html';
    return undefined;
  }),
};

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('pdf content'),
    size: 100,
    stream: Readable.from([]),
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

const hrContext = { jwt: 'test-jwt', correlationId: 'corr-1' };
const adminUser: JwtPayload = { sub: 'user-1', employeeId: 'emp-1', roles: ['HR_ADMIN'], departmentId: null, teamId: null, businessUnitId: null, channel: ChannelType.WEB, roleAssignments: [], sessionId: 's1', iat: 0, exp: 9999999999 };
const employeeUser: JwtPayload = { ...adminUser, roles: ['EMPLOYEE'] };
const systemUser: JwtPayload = { ...adminUser, roles: ['SYSTEM'] };

const fakeDoc = {
  id: randomUUID(),
  title: 'Test Doc',
  description: null,
  category: 'INTERNAL_POLICY',
  sourceUrl: 'documents/id1/v1/test.pdf',
  mimeType: 'application/pdf',
  sizeBytes: BigInt(100),
  uploadedById: 'emp-1',
  version: 1,
  isPublic: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'DOCUMENT_MAX_SIZE_BYTES') return 26_214_400;
      if (key === 'DOCUMENT_MIME_WHITELIST')
        return 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HrCoreClient, useValue: mockHrCoreClient },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: DOCUMENT_STORAGE, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    mockHrCoreClient.getEmployeeRef.mockResolvedValue({ id: 'emp-1', firstName: 'Alice', lastName: 'M', employeeCode: 'EMP-001', departmentId: 'd1', teamId: null, employmentStatus: 'ACTIVE' });
  });

  // -------------------------------------------------------------------------
  // US1 — T008: create happy path + event emission + storage failure
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('persists row with version=1 and calls storage.put exactly once', async () => {
      mockStorage.put.mockResolvedValue(undefined);
      mockPrisma.document.create.mockResolvedValue({ ...fakeDoc });

      const file = buildFile();
      await service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never, isPublic: true }, file, 'corr-1', hrContext);

      expect(mockStorage.put).toHaveBeenCalledTimes(1);
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }),
      );
    });

    it('emits document.uploaded once with correct payload', async () => {
      mockStorage.put.mockResolvedValue(undefined);
      mockPrisma.document.create.mockResolvedValue({ ...fakeDoc });

      const file = buildFile();
      await service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, 'corr-1', hrContext);

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const event = mockEventBus.emit.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(event?.['type']).toBe('document.uploaded');
      expect(event?.['source']).toBe('SOCIAL');
      const payload = event?.['payload'] as Record<string, unknown>;
      expect(payload?.['version']).toBe(1);
      expect(payload?.['category']).toBe('INTERNAL_POLICY');
    });

    it('storage write failure throws StorageUnavailable and does NOT persist row', async () => {
      mockStorage.put.mockRejectedValue(new Error('disk full'));

      const file = buildFile();
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, 'corr-1', hrContext),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockPrisma.document.create).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('EventBus throw does NOT roll back persisted row', async () => {
      mockStorage.put.mockResolvedValue(undefined);
      mockPrisma.document.create.mockResolvedValue({ ...fakeDoc });
      mockEventBus.emit.mockRejectedValue(new Error('bus down'));

      const file = buildFile();
      const result = await service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, 'corr-1', hrContext);
      expect(result).toBeDefined();
      expect(mockPrisma.document.create).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // US1 — T009: input validation
  // -------------------------------------------------------------------------

  describe('create — input validation', () => {
    it('undefined file → MissingFile (400)', async () => {
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, undefined, '', hrContext),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, undefined, '', hrContext),
      ).rejects.toThrow('MissingFile');
    });

    it('empty file → EmptyFile (400)', async () => {
      const file = buildFile({ size: 0, buffer: Buffer.alloc(0) });
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, '', hrContext),
      ).rejects.toThrow('EmptyFile');
    });

    it('oversized file → FileTooLarge (400)', async () => {
      const file = buildFile({ size: 30_000_000 });
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, '', hrContext),
      ).rejects.toThrow('FileTooLarge');
    });

    it('wrong MIME → UnsupportedMimeType (400)', async () => {
      const file = buildFile({ mimetype: 'image/jpeg' });
      await expect(
        service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, '', hrContext),
      ).rejects.toThrow('UnsupportedMimeType');
    });

    it('accepts all 5 whitelisted MIMEs', async () => {
      const mimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'text/html',
      ];
      mockStorage.put.mockResolvedValue(undefined);
      mockPrisma.document.create.mockResolvedValue({ ...fakeDoc });
      for (const mime of mimes) {
        jest.clearAllMocks();
        mockHrCoreClient.getEmployeeRef.mockResolvedValue({ id: 'emp-1', firstName: 'A', lastName: 'B', employeeCode: 'E1', departmentId: 'd1', teamId: null, employmentStatus: 'ACTIVE' });
        mockStorage.put.mockResolvedValue(undefined);
        mockPrisma.document.create.mockResolvedValue({ ...fakeDoc, mimeType: mime });
        const file = buildFile({ mimetype: mime });
        await expect(
          service.create(adminUser, { title: 'T', category: 'INTERNAL_POLICY' as never }, file, '', hrContext),
        ).resolves.toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // US2 — T014: findAll visibility + filters + pagination cap
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('EMPLOYEE — forces isPublic: true in where clause', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll(employeeUser, { page: 1, pageSize: 20 }, hrContext);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true } }),
      );
      expect(mockPrisma.document.count).toHaveBeenCalledWith({ where: { isPublic: true } });
    });

    it('HR_ADMIN does not force isPublic in where clause', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll(adminUser, { page: 1, pageSize: 20 }, hrContext);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(mockPrisma.document.count).toHaveBeenCalledWith({ where: {} });
    });

    it('composes category and search filters with visibility', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll(
        employeeUser,
        { page: 1, pageSize: 20, category: 'HANDBOOK' as never, search: 'leave' },
        hrContext,
      );
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isPublic: true,
            category: 'HANDBOOK',
            title: { contains: 'leave', mode: 'insensitive' },
          },
        }),
      );
    });

    it('caps pageSize at 100', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      const result = await service.findAll(adminUser, { page: 1, pageSize: 500 }, hrContext);
      expect(result.pageSize).toBe(100);
    });

    it('sort is createdAt desc, id asc', async () => {
      mockPrisma.$transaction.mockResolvedValue([[fakeDoc], 1]);
      mockHrCoreClient.getEmployeeRef.mockResolvedValue({ id: 'emp-1', firstName: 'A', lastName: 'B', employeeCode: 'E1', departmentId: 'd1', teamId: null, employmentStatus: 'ACTIVE' });
      await service.findAll(adminUser, { page: 1, pageSize: 20 }, hrContext);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: 0,
          take: 20,
        }),
      );
    });

    it('uploader enrichment de-duplicates: 5 unique uploaders → 5 HR Core calls', async () => {
      const docs = Array.from({ length: 20 }, (_, i) => ({
        ...fakeDoc,
        id: randomUUID(),
        uploadedById: `emp-${i % 5}`,
      }));
      mockPrisma.$transaction.mockResolvedValue([docs, 20]);
      mockHrCoreClient.getEmployeeRef.mockResolvedValue({ id: 'emp-1', firstName: 'A', lastName: 'B', employeeCode: 'E1', departmentId: 'd1', teamId: null, employmentStatus: 'ACTIVE' });
      await service.findAll(adminUser, { page: 1, pageSize: 20 }, hrContext);
      expect(mockHrCoreClient.getEmployeeRef).toHaveBeenCalledTimes(5);
    });
  });

  // -------------------------------------------------------------------------
  // US2 — T015: findOne visibility
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('public doc + any role → 200', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: true });
      const result = await service.findOne(employeeUser, fakeDoc.id, hrContext);
      expect(result).toBeDefined();
    });

    it('private doc + EMPLOYEE → DocumentNotFound (404)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: false });
      await expect(service.findOne(employeeUser, fakeDoc.id, hrContext)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(employeeUser, fakeDoc.id, hrContext)).rejects.toThrow('DocumentNotFound');
    });

    it('private doc + HR_ADMIN → 200', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: false });
      const result = await service.findOne(adminUser, fakeDoc.id, hrContext);
      expect(result).toBeDefined();
    });

    it('row missing → DocumentNotFound (404)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne(adminUser, randomUUID(), hrContext)).rejects.toThrow('DocumentNotFound');
    });
  });

  // -------------------------------------------------------------------------
  // US3 — T020: download visibility + file missing
  // -------------------------------------------------------------------------

  describe('download', () => {
    it('public doc + EMPLOYEE → returns stream bundle', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: true });
      mockStorage.exists.mockResolvedValue(true);
      mockStorage.get.mockResolvedValue({ pipe: jest.fn() });
      const result = await service.download(employeeUser, fakeDoc.id);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('private doc + EMPLOYEE → DocumentNotFound (404)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: false });
      await expect(service.download(employeeUser, fakeDoc.id)).rejects.toThrow('DocumentNotFound');
    });

    it('private doc + HR_ADMIN → returns stream bundle', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: false });
      mockStorage.exists.mockResolvedValue(true);
      mockStorage.get.mockResolvedValue({ pipe: jest.fn() });
      const result = await service.download(adminUser, fakeDoc.id);
      expect(result).toBeDefined();
    });

    it('private doc + SYSTEM JWT → returns stream bundle (visibility bypass)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: false });
      mockStorage.exists.mockResolvedValue(true);
      mockStorage.get.mockResolvedValue({ pipe: jest.fn() });
      const result = await service.download(systemUser, fakeDoc.id);
      expect(result).toBeDefined();
    });

    it('row exists but file missing → DocumentFileMissing (410)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc, isPublic: true });
      mockStorage.exists.mockResolvedValue(false);
      await expect(service.download(adminUser, fakeDoc.id)).rejects.toThrow(GoneException);
      await expect(service.download(adminUser, fakeDoc.id)).rejects.toThrow('DocumentFileMissing');
    });
  });

  // -------------------------------------------------------------------------
  // US4 — T023: update (metadata-only vs version-bump)
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('metadata-only PATCH — version unchanged, no event, no storage call', async () => {
      const existing = { ...fakeDoc, version: 1 };
      mockPrisma.document.findUnique.mockResolvedValue(existing);
      mockPrisma.document.update.mockResolvedValue(existing);

      await service.update(adminUser, fakeDoc.id, { title: 'New' }, undefined, 'corr', hrContext);
      expect(mockStorage.put).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('file-replacement PATCH — version bumps, new sourceUrl uses v2, event emitted', async () => {
      const existing = { ...fakeDoc, version: 1 };
      const updated = { ...existing, version: 2, sourceUrl: 'documents/id1/v2/test.pdf' };
      mockPrisma.document.findUnique.mockResolvedValue(existing);
      mockPrisma.document.update.mockResolvedValue(updated);
      mockStorage.put.mockResolvedValue(undefined);
      mockStorage.delete.mockResolvedValue(undefined);

      const file = buildFile();
      const result = await service.update(adminUser, fakeDoc.id, {}, file, 'corr', hrContext);
      expect(result.version).toBe(2);
      expect(mockStorage.put).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const event = mockEventBus.emit.mock.calls[0]?.[0] as Record<string, unknown>;
      const payload = event?.['payload'] as Record<string, unknown>;
      expect(payload?.['version']).toBe(2);
    });

    it('storage delete failure on old file is logged but does NOT throw, and document.uploaded event IS still emitted', async () => {
      const existing = { ...fakeDoc, version: 1 };
      const updated = { ...existing, version: 2, sourceUrl: 'documents/id1/v2/test.pdf' };
      mockPrisma.document.findUnique.mockResolvedValue(existing);
      mockPrisma.document.update.mockResolvedValue(updated);
      mockStorage.put.mockResolvedValue(undefined);
      mockStorage.delete.mockRejectedValue(new Error('cannot delete'));

      const file = buildFile();
      await expect(
        service.update(adminUser, fakeDoc.id, {}, file, 'corr', hrContext),
      ).resolves.toBeDefined();

      // US4 AC-2: event emission must not be skipped even when the old-file cleanup fails
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const event = mockEventBus.emit.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(event?.['type']).toBe('document.uploaded');
      const payload = event?.['payload'] as Record<string, unknown>;
      expect(payload?.['version']).toBe(2);
    });

    it('bad MIME on file-replacement PATCH → UnsupportedMimeType, row unchanged', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc });
      const file = buildFile({ mimetype: 'image/jpeg' });
      await expect(
        service.update(adminUser, fakeDoc.id, {}, file, 'corr', hrContext),
      ).rejects.toThrow('UnsupportedMimeType');
      expect(mockPrisma.document.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // US5 — T027: remove
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('happy path — DB delete, storage delete, event emitted', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc });
      mockPrisma.document.delete.mockResolvedValue(fakeDoc);
      mockStorage.delete.mockResolvedValue(undefined);

      await service.remove(adminUser, fakeDoc.id, 'corr');
      expect(mockPrisma.document.delete).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'document.deleted' }),
      );
    });

    it('storage delete failure is logged, event STILL fires', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({ ...fakeDoc });
      mockPrisma.document.delete.mockResolvedValue(fakeDoc);
      mockStorage.delete.mockRejectedValue(new Error('no disk'));

      await service.remove(adminUser, fakeDoc.id, 'corr');
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    });

    it('row missing → DocumentNotFound (404)', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.remove(adminUser, randomUUID(), 'corr')).rejects.toThrow('DocumentNotFound');
    });

    it('non-HR_ADMIN reaching the service is rejected', async () => {
      await expect(service.remove(employeeUser, fakeDoc.id, 'corr')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.document.delete).not.toHaveBeenCalled();
    });
  });
});
