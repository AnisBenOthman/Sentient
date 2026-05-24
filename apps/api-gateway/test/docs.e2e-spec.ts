import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';
import { createUpstreamTestServer } from '../src/test-support/upstream-test-server';
import type { UpstreamTestServer } from '../src/test-support/upstream-test-server';

describe('Docs aggregation', () => {
  let app: INestApplication;
  let upstream: UpstreamTestServer;

  beforeAll(async () => {
    upstream = await createUpstreamTestServer((requestMessage, response) => {
      if (requestMessage.url === '/api/docs-json') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'upstream' },
          paths: { '/employees': { get: {} } },
        }));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    process.env.API_GATEWAY_JWT_SECRET = 'docs-secret';
    process.env.HR_CORE_URL = upstream.url;
    process.env.SOCIAL_URL = upstream.url;
    process.env.AI_AGENTIC_URL = 'http://127.0.0.1:1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GatewayExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  it('returns grouped downstream docs availability', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.downstreams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'hr', status: 'available' }),
        expect.objectContaining({ key: 'ai', status: 'unavailable' }),
      ]),
    );
  });

  it('renders a browsable grouped documentation page', async () => {
    await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200)
      .expect('content-type', /text\/html/)
      .expect((response) => {
        expect(response.text).toContain('HR Core');
        expect(response.text).toContain('GET /employees');
        expect(response.text).toContain('AI Agentic');
        expect(response.text).toContain('Unavailable');
      });
  });
});
