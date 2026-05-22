import { Module } from '@nestjs/common';

import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

// PrismaModule, ClientsModule, and EventBusModule are all @Global() — no explicit import needed.
@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
