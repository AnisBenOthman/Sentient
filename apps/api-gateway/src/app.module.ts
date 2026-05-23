import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { gatewayConfig } from './config/gateway.config';
import { PublicRouteMatcher } from './common/auth/public-route.matcher';
import { GatewayJwtGuard } from './common/auth/gateway-jwt.guard';
import { CorrelationMiddleware } from './common/correlation/correlation.middleware';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { GatewayThrottlerGuard } from './common/throttling/gateway-throttler.guard';
import { RateLimitKeyFactory } from './common/throttling/rate-limit-key.factory';
import { ProxyModule } from './modules/proxy/proxy.module';
import { HealthModule } from './modules/health/health.module';
import { DocsModule } from './modules/docs/docs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [gatewayConfig],
    }),
    HealthModule,
    DocsModule,
    ProxyModule,
  ],
  providers: [
    PublicRouteMatcher,
    RateLimitKeyFactory,
    { provide: APP_GUARD, useClass: GatewayJwtGuard },
    { provide: APP_GUARD, useClass: GatewayThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}

