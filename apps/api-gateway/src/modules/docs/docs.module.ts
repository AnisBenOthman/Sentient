import { Module } from '@nestjs/common';
import { DocsController, GATEWAY_OPENAPI_DOCUMENT } from './docs.controller';
import { OpenApiAggregationService } from './openapi-aggregation.service';

@Module({
  controllers: [DocsController],
  providers: [
    OpenApiAggregationService,
    {
      provide: GATEWAY_OPENAPI_DOCUMENT,
      useValue: {
        openapi: '3.0.3',
        info: {
          title: 'Sentient API Gateway',
          version: '0.1.0',
        },
      },
    },
  ],
})
export class DocsModule {}

