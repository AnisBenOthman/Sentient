import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsEventsBridge } from './events/notifications-events.bridge';
import { NotificationRouter } from './notification-router';
import { NotificationsController } from './notifications.controller';
import { NotificationRenderers } from './notifications.renderers';
import { NotificationsService } from './notifications.service';
import { RetentionScheduler } from './retention/retention.scheduler';
import { NotificationsSseController } from './sse/notifications-sse.controller';
import { NotificationsSseRegistry } from './sse/notifications-sse.registry';
import { SseAuthGuard } from './sse/sse-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, NotificationsSseController],
  providers: [
    NotificationsService,
    NotificationRouter,
    NotificationRenderers,
    NotificationsEventsBridge,
    NotificationsSseRegistry,
    SseAuthGuard,
    RetentionScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
