import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Gateway throttling', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;
  const secret = 'throttle-secret';

  beforeAll(async () => {
    upstream = await createUpstreamTestServer();
    process.env.API_GATEWAY_JWT_SECRET = secret;
    process.env.API_GATEWAY_AUTH_RATE_LIMIT_MAX = '1';
    process.env.API_GATEWAY_AUTH_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_MAX = '1';
    process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.HR_CORE_URL = upstream.url;
    process.env.SOCIAL_URL = upstream.url;
    process.env.AI_AGENTIC_URL = upstream.url;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GatewayExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    delete process.env.API_GATEWAY_AUTH_RATE_LIMIT_MAX;
    delete process.env.API_GATEWAY_AUTH_RATE_LIMIT_WINDOW_MS;
    delete process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_MAX;
    delete process.env.API_GATEWAY_PUBLIC_RATE_LIMIT_WINDOW_MS;
    await app.close();
    await upstream.close();
  });

  it('returns 429 and does not forward requests beyond the limit', async () => {
    const token = sign({ sub: 'limited-user' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(429).expect((response) => {
      expect(response.headers['retry-after']).toBeDefined();
      expect(response.body).toMatchObject({ code: 'RateLimitExceeded' });
    });

    expect(upstream.records.filter((record) => record.url === '/employees')).toHaveLength(1);
  });

  it('limits public routes per IP', async () => {
    await request(app.getHttpServer()).post('/api/hr/auth/login').send({ email: 'a', password: 'b' }).expect(200);
    await request(app.getHttpServer()).post('/api/hr/auth/login').send({ email: 'a', password: 'b' }).expect(429).expect((response) => {
      expect(response.headers['retry-after']).toBeDefined();
      expect(response.body).toMatchObject({ code: 'RateLimitExceeded' });
    });

    expect(upstream.records.filter((record) => record.url === '/auth/login')).toHaveLength(1);
  });

  it('honors route-specific overrides', async () => {
    const token = sign({ sub: 'streaming-user' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer()).get('/api/ai/conversations').set('authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/ai/conversations').set('authorization', `Bearer ${token}`).expect(200);

    expect(upstream.records.filter((record) => record.url === '/conversations')).toHaveLength(2);
  });
});
