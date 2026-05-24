import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GatewayExceptionFilter } from '../src/common/errors/gateway-exception.filter';

describe('API Gateway app', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_GATEWAY_JWT_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GatewayExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('adds a correlation id to health responses', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.body).toMatchObject({ gateway: { status: 'healthy' } });
  });
});

