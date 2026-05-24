import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Proxy routes', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;
  const secret = 'test-secret';

  beforeAll(async () => {
    upstream = await createUpstreamTestServer();
    process.env.API_GATEWAY_JWT_SECRET = secret;
    process.env.HR_CORE_URL = upstream.url;
    process.env.SOCIAL_URL = upstream.url;
    process.env.AI_AGENTIC_URL = upstream.url;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GatewayExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  it.each([
    ['/api/hr/employees', '/employees'],
    ['/api/social/announcements', '/announcements'],
    ['/api/ai/conversations', '/conversations'],
  ])('forwards %s to %s', async (gatewayPath, upstreamPath) => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    const response = await request(app.getHttpServer())
      .get(gatewayPath)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ ok: true, path: upstreamPath });
  });

  it('returns a structured 404 for unmapped routes', async () => {
    await request(app.getHttpServer())
      .get('/api/unknown/example')
      .expect(404)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'NoUpstreamRoute' });
      });
  });
});

