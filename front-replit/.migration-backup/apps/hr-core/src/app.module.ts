import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RbacGuard, SharedJwtGuard } from '@sentient/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationIdMiddleware } from './common/middleware';
import { EmployeesModule } from './modules/employees/employees.module';
import { IamModule } from './modules/iam/iam.module';
import { UserStatusGuard } from './modules/iam/guards/user-status.guard';
import { LeavesModule } from './modules/leaves/leaves.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { SkillsModule } from './modules/skills/skills.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    IamModule,
    OrganizationModule,
    EmployeesModule,
    SkillsModule,
    LeavesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SharedJwtGuard },
    { provide: APP_GUARD, useClass: UserStatusGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
