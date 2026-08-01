import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RbacGuard, SharedJwtGuard } from '@sentient/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationIdMiddleware } from './common/middleware';
import { aiAgenticConfig } from './config';
import { AgentsModule } from './modules/agents';
import { ConversationsModule } from './modules/conversations';
import { FeedbackModule } from './modules/feedback';
import { GovernanceModule } from './modules/governance';
import { KnowledgeModule } from './modules/knowledge';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [aiAgenticConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL') ?? 60_000,
          limit: config.get<number>('THROTTLE_LIMIT') ?? 100,
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AgentsModule,
    KnowledgeModule,
    ConversationsModule,
    FeedbackModule,
    GovernanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: SharedJwtGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
