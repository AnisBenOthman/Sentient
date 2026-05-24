import { Controller, Get, HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Roles } from '@sentient/shared';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

const TEST_JWT_SECRET = 'change-me-in-production-minimum-32-random-characters';
const TEST_SYSTEM_SECRET = 'change-me-system-secret-minimum-32-random-characters';

function makeEmployeeToken(): string {
  return jwt.sign(
    {
      sub: 'user-test-id',
      employeeId: 'emp-test-id',
      roles: ['EMPLOYEE'],
      departmentId: null,
      teamId: null,
      businessUnitId: null,
      channel: 'WEB',
      roleAssignments: [],
      sessionId: 'sess-test',
    },
    TEST_JWT_SECRET,
    { expiresIn: '15m' },
  );
}

function makeSystemToken(): string {
  return jwt.sign(
    { sub: 'system', roles: ['SYSTEM'], scope: 'GLOBAL', taskType: 'test' },
    TEST_SYSTEM_SECRET,
    { expiresIn: '5m' },
  );
}

@Controller('scaffold-ping')
class ScaffoldPingController {
  @Get()
  @Roles('EMPLOYEE')
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Auth wiring smoke (AppModule)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ScaffoldPingController],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 without Authorization', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(HttpStatus.OK)
      .expect(res => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('social');
      });
  });

  it('GET /scaffold-ping returns 401 with no Authorization header', async () => {
    await request(app.getHttpServer())
      .get('/scaffold-ping')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('GET /scaffold-ping returns 401 with a tampered token', async () => {
    await request(app.getHttpServer())
      .get('/scaffold-ping')
      .set('Authorization', 'Bearer this.is.a.tampered.token')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('GET /scaffold-ping returns 200 with a valid EMPLOYEE JWT', async () => {
    await request(app.getHttpServer())
      .get('/scaffold-ping')
      .set('Authorization', `Bearer ${makeEmployeeToken()}`)
      .expect(HttpStatus.OK);
  });

  it('GET /scaffold-ping returns 403 with a SYSTEM JWT', async () => {
    await request(app.getHttpServer())
      .get('/scaffold-ping')
      .set('Authorization', `Bearer ${makeSystemToken()}`)
      .expect(HttpStatus.FORBIDDEN);
  });
});
