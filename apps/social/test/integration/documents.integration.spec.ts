/**
 * Integration test: documents CRUD, visibility, download bytes, and events.
 *
 * Requires a running PostgreSQL instance configured via SOCIAL_DATABASE_URL.
 * Run with: SOCIAL_INTEGRATION_DB=1 pnpm --filter @sentient/social exec jest --runInBand test/integration/documents.integration.spec.ts
 */

import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_BUS } from '@sentient/shared';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { HrCoreClient } from '../../src/common/clients/hr-core.client';
import { HttpExceptionFilter } from '../../src/common/filters';
import { PrismaService } from '../../src/prisma/prisma.service';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'change-me-in-production-minimum-32-random-characters';
const RUN_DB = process.env['SOCIAL_INTEGRATION_DB'] === '1';

function makeToken(roles: string[], employeeId: string): string {
  return jwt.sign(
    {
      sub: `user-${employeeId}`,
      employeeId,
      roles,
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      channel: 'WEB',
      roleAssignments: [],
      sessionId: 'sess-documents-integration',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

(RUN_DB ? describe : describe.skip)('Documents module (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storageRoot: string;
  const createdIds: string[] = [];
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'sentient-documents-integration-'));
    process.env['DOCUMENT_STORAGE_PATH'] = storageRoot;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HrCoreClient)
      .useValue({
        getEmployeeRef: jest.fn(async (id: string) => ({
          id,
          firstName: 'Integration',
          lastName: 'Uploader',
          email: `${id}@example.test`,
          employeeCode: 'EMP-DOC',
          departmentId: 'dept-doc',
          teamId: null,
          employmentStatus: 'ACTIVE',
        })),
      })
      .overrideProvider(EVENT_BUS)
      .useValue({
        emit: jest.fn(async (event: { type: string; payload: Record<string, unknown> }) => {
          events.push(event);
        }),
        subscribe: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.document.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  // SC-008 — RBAC: EMPLOYEE and MANAGER must receive 403 on mutation endpoints
  it('SC-008: EMPLOYEE is forbidden from POST, PATCH, DELETE', async () => {
    const employeeToken = makeToken(['EMPLOYEE'], 'emp-sc008-employee');
    const dummyBytes = Buffer.from('%PDF-1.4 rbac-test');

    // POST /documents
    await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('title', 'SC008 Employee Upload Attempt')
      .field('category', 'INTERNAL_POLICY')
      .field('isPublic', 'true')
      .attach('file', dummyBytes, { filename: 'rbac.pdf', contentType: 'application/pdf' })
      .expect(403);

    // Seed a document to attempt PATCH and DELETE against
    const adminToken = makeToken(['HR_ADMIN'], 'emp-sc008-admin');
    const seedUpload = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'SC008 Seed Doc')
      .field('category', 'INTERNAL_POLICY')
      .field('isPublic', 'true')
      .attach('file', dummyBytes, { filename: 'seed.pdf', contentType: 'application/pdf' })
      .expect(201);
    const seedId = seedUpload.body.id as string;
    createdIds.push(seedId);

    // PATCH /documents/:id
    await request(app.getHttpServer())
      .patch(`/documents/${seedId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('title', 'EMPLOYEE patch attempt')
      .expect(403);

    // DELETE /documents/:id
    await request(app.getHttpServer())
      .delete(`/documents/${seedId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('SC-008: MANAGER is forbidden from POST, PATCH, DELETE', async () => {
    const managerToken = makeToken(['MANAGER'], 'emp-sc008-manager');
    const adminToken = makeToken(['HR_ADMIN'], 'emp-sc008-admin2');
    const dummyBytes = Buffer.from('%PDF-1.4 manager-rbac-test');

    // POST /documents
    await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'SC008 Manager Upload Attempt')
      .field('category', 'GUIDE')
      .field('isPublic', 'true')
      .attach('file', dummyBytes, { filename: 'manager.pdf', contentType: 'application/pdf' })
      .expect(403);

    // Seed a document for PATCH/DELETE attempts
    const seedUpload = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'SC008 Manager Seed Doc')
      .field('category', 'GUIDE')
      .field('isPublic', 'true')
      .attach('file', dummyBytes, { filename: 'manager-seed.pdf', contentType: 'application/pdf' })
      .expect(201);
    const seedId = seedUpload.body.id as string;
    createdIds.push(seedId);

    // PATCH /documents/:id
    await request(app.getHttpServer())
      .patch(`/documents/${seedId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .field('title', 'MANAGER patch attempt')
      .expect(403);

    // DELETE /documents/:id
    await request(app.getHttpServer())
      .delete(`/documents/${seedId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(403);
  });

  // US3 scenario 4 — SYSTEM JWT can download a private document
  it('SYSTEM JWT can download a private document (visibility bypass)', async () => {
    const adminToken = makeToken(['HR_ADMIN'], 'emp-system-bypass-admin');
    const systemToken = makeToken(['SYSTEM'], 'system');
    const privateBytes = Buffer.from('%PDF-1.4 private-system-bypass');

    const upload = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'System Bypass Private Doc')
      .field('category', 'INTERNAL_POLICY')
      .field('isPublic', 'false')
      .attach('file', privateBytes, { filename: 'private-system.pdf', contentType: 'application/pdf' })
      .expect(201);
    const docId = upload.body.id as string;
    createdIds.push(docId);

    // EMPLOYEE cannot download private doc
    const employeeToken = makeToken(['EMPLOYEE'], 'emp-system-bypass-employee');
    await request(app.getHttpServer())
      .get(`/documents/${docId}/download`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(404); // service returns 404 for non-visible docs, not 403

    // SYSTEM JWT bypasses visibility restriction
    const download = await request(app.getHttpServer())
      .get(`/documents/${docId}/download`)
      .set('Authorization', `Bearer ${systemToken}`)
      .expect(200);
    expect(Buffer.compare(download.body as Buffer, privateBytes)).toBe(0);
  });

  // 410 — DocumentFileMissing when the DB row exists but the file is gone from storage
  it('returns 410 when document row exists but storage file is missing', async () => {
    const adminToken = makeToken(['HR_ADMIN'], 'emp-410-admin');
    const employeeToken = makeToken(['EMPLOYEE'], 'emp-410-employee');

    // Insert a row with a sourceUrl that points to a non-existent file
    const orphan = await prisma.document.create({
      data: {
        title: '410 Orphan Document',
        description: null,
        category: 'OTHER',
        sourceUrl: 'documents/nonexistent-id/v1/ghost.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(42),
        uploadedById: 'emp-410-admin',
        version: 1,
        isPublic: true,
      },
    });
    createdIds.push(orphan.id);

    await request(app.getHttpServer())
      .get(`/documents/${orphan.id}/download`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(410);

    // Cleanup
    await prisma.document.delete({ where: { id: orphan.id } });
    createdIds.splice(createdIds.indexOf(orphan.id), 1);
  });

  it('uploads, lists by visibility, downloads byte-identical content, updates version, and deletes', async () => {
    const adminToken = makeToken(['HR_ADMIN'], 'emp-hr-admin');
    const employeeToken = makeToken(['EMPLOYEE'], 'emp-employee');
    const original = Buffer.from('%PDF-1.4 public policy');
    const replacement = Buffer.from('%PDF-1.4 replacement policy');

    const upload = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'Integration Leave Policy')
      .field('category', 'INTERNAL_POLICY')
      .field('isPublic', 'true')
      .attach('file', original, { filename: 'leave-policy.pdf', contentType: 'application/pdf' })
      .expect(201);

    const publicId = upload.body.id as string;
    createdIds.push(publicId);
    expect(upload.body.version).toBe(1);
    expect(events.some((event) => event.type === 'document.uploaded')).toBe(true);

    const privateDoc = await prisma.document.create({
      data: {
        title: 'Integration Private Policy',
        description: null,
        category: 'INTERNAL_POLICY',
        sourceUrl: 'documents/integration-private/v1/private.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(3),
        uploadedById: 'emp-hr-admin',
        version: 1,
        isPublic: false,
      },
    });
    createdIds.push(privateDoc.id);

    const employeeList = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect((employeeList.body.items as Array<{ id: string }>).some((doc) => doc.id === publicId)).toBe(true);
    expect((employeeList.body.items as Array<{ id: string }>).some((doc) => doc.id === privateDoc.id)).toBe(false);

    const adminList = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((adminList.body.items as Array<{ id: string }>).some((doc) => doc.id === privateDoc.id)).toBe(true);

    const download = await request(app.getHttpServer())
      .get(`/documents/${publicId}/download`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    expect(Buffer.compare(download.body as Buffer, original)).toBe(0);
    expect(download.headers['content-type']).toContain('application/pdf');

    const patch = await request(app.getHttpServer())
      .patch(`/documents/${publicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('title', 'Integration Leave Policy v2')
      .attach('file', replacement, { filename: 'leave-policy-v2.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(patch.body.version).toBe(2);
    expect(events.filter((event) => event.type === 'document.uploaded')).toHaveLength(2);

    await request(app.getHttpServer())
      .delete(`/documents/${publicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    createdIds.splice(createdIds.indexOf(publicId), 1);
    expect(events.some((event) => event.type === 'document.deleted')).toBe(true);
  });
});
