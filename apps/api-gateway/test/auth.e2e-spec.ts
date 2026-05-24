import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Gateway JWT validation', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;
  const secret = 'auth-secret';

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

  it('rejects missing JWTs before proxying', async () => {
    await request(app.getHttpServer()).get('/api/hr/employees').expect(401).expect((response) => {
      expect(response.body).toMatchObject({ code: 'MissingAuthorization' });
    });
    expect(upstream.records).toHaveLength(0);
  });

  it('rejects malformed JWT headers', async () => {
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', 'bad').expect(401).expect((response) => {
      expect(response.body).toMatchObject({ code: 'MalformedAuthorization' });
    });
  });

  it('rejects expired JWTs', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '-1s' });
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(401).expect((response) => {
      expect(response.body).toMatchObject({ code: 'JwtExpired' });
    });
  });

  it('rejects invalid-signature JWTs', async () => {
    const token = sign({ sub: 'user-1' }, 'wrong-secret', { expiresIn: '5m' });
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(401).expect((response) => {
      expect(response.body).toMatchObject({ code: 'JwtInvalid' });
    });
  });

  it('forwards valid JWTs unchanged', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer()).get('/api/hr/employees').set('authorization', `Bearer ${token}`).expect(200);

    expect(upstream.records.at(-1)?.headers.authorization).toBe(`Bearer ${token}`);
  });

  it('allows configured public routes without JWTs', async () => {
    await request(app.getHttpServer()).post('/api/hr/auth/login').send({ email: 'a', password: 'b' }).expect(200);
  });

  it('validates notification SSE accessToken query tokens at the edge', async () => {
    const token = sign({ sub: 'user-sse' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer()).get(`/api/hr/notifications/stream?accessToken=${token}`).expect(200);

    expect(upstream.records.at(-1)?.url).toBe(`/notifications/stream?accessToken=${token}`);
  });
});
