import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Correlation ids', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;
  const secret = 'correlation-secret';

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

  it('generates and forwards correlation ids', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    const response = await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(200);

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(upstream.records.at(-1)?.headers['x-correlation-id']).toBe(response.headers['x-correlation-id']);
  });

  it('preserves inbound correlation ids', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer())
      .get('/api/hr/employees')
      .set('authorization', `Bearer ${token}`)
      .set('x-correlation-id', 'smoke-test-015')
      .expect(200)
      .expect('x-correlation-id', 'smoke-test-015');

    expect(upstream.records.at(-1)?.headers['x-correlation-id']).toBe('smoke-test-015');
  });
});

