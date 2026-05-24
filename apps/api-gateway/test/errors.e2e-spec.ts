import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Gateway error envelopes', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;
  const secret = 'error-secret';

  beforeAll(async () => {
    upstream = await createUpstreamTestServer(async (requestMessage, response) => {
      if (requestMessage.url === '/slow') {
        await new Promise((resolve) => setTimeout(resolve, 200));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (requestMessage.url === '/redirect') {
        response.writeHead(302, { location: '/new-location' });
        response.end();
        return;
      }
      response.writeHead(409, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'Conflict from upstream' }));
    });
    process.env.API_GATEWAY_JWT_SECRET = secret;
    process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS = '50';
    process.env.API_GATEWAY_DEFAULT_JSON_BODY_LIMIT_BYTES = '5';
    process.env.HR_CORE_URL = upstream.url;
    process.env.SOCIAL_URL = upstream.url;
    process.env.AI_AGENTIC_URL = 'http://127.0.0.1:1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GatewayExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    delete process.env.API_GATEWAY_UPSTREAM_TIMEOUT_MS;
    delete process.env.API_GATEWAY_DEFAULT_JSON_BODY_LIMIT_BYTES;
    await app.close();
    await upstream.close();
  });

  it('wraps non-conforming upstream error bodies', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer()).get('/api/hr/conflict').set('authorization', `Bearer ${token}`).expect(409).expect((response) => {
      expect(response.body).toMatchObject({
        code: 'UpstreamHttp409',
        message: 'Conflict from upstream',
      });
      expect(response.body.correlationId).toBeDefined();
    });
  });

  it('returns 413 envelopes when request bodies exceed the route limit', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer())
      .post('/api/hr/employees')
      .set('authorization', `Bearer ${token}`)
      .send({ value: 'too-large' })
      .expect(413)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'PayloadTooLarge' });
        expect(response.body.correlationId).toBeDefined();
      });
  });

  it('maps unreachable upstreams to 502 envelopes', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer())
      .get('/api/ai/unavailable')
      .set('authorization', `Bearer ${token}`)
      .expect(502)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'UpstreamUnavailable' });
      });
  });

  it('maps upstream timeouts to 504 envelopes', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer())
      .get('/api/social/slow')
      .set('authorization', `Bearer ${token}`)
      .expect(504)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'UpstreamTimeout' });
      });
  });

  it('wraps non-2xx redirects instead of passing them through raw', async () => {
    const token = sign({ sub: 'user-1' }, secret, { expiresIn: '5m' });
    await request(app.getHttpServer())
      .get('/api/hr/redirect')
      .set('authorization', `Bearer ${token}`)
      .expect(302)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: 'UpstreamHttp302' });
      });
  });
});
