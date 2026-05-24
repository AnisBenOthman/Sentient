/**
 * Integration test: expired-announcement expiry filtering (SC-008, T021).
 *
 * Requires a running PostgreSQL instance configured via SOCIAL_DATABASE_URL.
 * Run with: npx jest test/integration/announcements.integration.spec.ts
 *
 * Seeds three announcements directly into the DB:
 *  1. never-expires  (expiresAt = null)
 *  2. future-expiry  (expiresAt = tomorrow)
 *  3. past-expiry    (expiresAt = yesterday)
 *
 * Asserts:
 *  - EMPLOYEE GET /announcements        → 2 items (excludes expired)
 *  - HR_ADMIN GET /announcements?includeExpired=true → 3 items
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters';
import { PrismaService } from '../../src/prisma/prisma.service';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'change-me-in-production-minimum-32-random-characters';

const EMPLOYEE_DEPT = 'dept-integration-test';

function makeToken(roles: string[], departmentId: string | null = null): string {
  return jwt.sign(
    {
      sub: `user-${roles.join('-').toLowerCase()}`,
      employeeId: `emp-${roles.join('-').toLowerCase()}`,
      roles,
      departmentId,
      teamId: null,
      channel: 'WEB',
      sessionId: 'sess-integration',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

const RUN_DB = process.env['SOCIAL_INTEGRATION_DB'] === '1';

(RUN_DB ? describe : describe.skip)('Announcements expiry filtering (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    prisma = moduleRef.get(PrismaService);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [a1, a2, a3] = await Promise.all([
      prisma.announcement.create({
        data: {
          title: 'Never-expires',
          body: 'No expiry set',
          audience: 'COMPANY',
          authorId: 'emp-hr-admin',
          publishedAt: new Date(),
          expiresAt: null,
          targetDepartmentId: null,
          targetTeamId: null,
        },
      }),
      prisma.announcement.create({
        data: {
          title: 'Future-expiry',
          body: 'Expires tomorrow',
          audience: 'COMPANY',
          authorId: 'emp-hr-admin',
          publishedAt: new Date(),
          expiresAt: tomorrow,
          targetDepartmentId: null,
          targetTeamId: null,
        },
      }),
      prisma.announcement.create({
        data: {
          title: 'Past-expiry',
          body: 'Already expired',
          audience: 'COMPANY',
          authorId: 'emp-hr-admin',
          publishedAt: new Date(),
          expiresAt: yesterday,
          targetDepartmentId: null,
          targetTeamId: null,
        },
      }),
    ]);

    createdIds.push(a1.id, a2.id, a3.id);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.announcement.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  it('EMPLOYEE GET /announcements excludes the expired announcement (2 of 3 visible)', async () => {
    const token = makeToken(['EMPLOYEE'], EMPLOYEE_DEPT);

    const res = await request(app.getHttpServer())
      .get('/announcements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const titles: string[] = (res.body.items as Array<{ title: string }>).map((a) => a.title);

    expect(titles).toContain('Never-expires');
    expect(titles).toContain('Future-expiry');
    expect(titles).not.toContain('Past-expiry');
    expect(titles.filter((t) => createdIds.some((id) => res.body.items.find((a: { id: string; title: string }) => a.id === id && a.title === t))).length).toBeGreaterThanOrEqual(2);
  });

  it('HR_ADMIN GET /announcements?includeExpired=true returns all 3 seeded announcements', async () => {
    const token = makeToken(['HR_ADMIN'], EMPLOYEE_DEPT);

    const res = await request(app.getHttpServer())
      .get('/announcements')
      .query({ includeExpired: 'true', scope: 'all' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const returnedIds: string[] = (res.body.items as Array<{ id: string }>).map((a) => a.id);

    for (const id of createdIds) {
      expect(returnedIds).toContain(id);
    }
  });
});
