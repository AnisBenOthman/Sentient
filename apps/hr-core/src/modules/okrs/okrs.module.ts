import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { OkrAnalyticsController } from './analytics/okr-analytics.controller';
import { OkrAnalyticsService } from './analytics/okr-analytics.service';
import { OkrCheckInsController } from './check-ins/okr-check-ins.controller';
import { OkrCheckInsService } from './check-ins/okr-check-ins.service';
import { OkrCyclesController } from './cycles/okr-cycles.controller';
import { OkrCyclesService } from './cycles/okr-cycles.service';
import { KeyResultsController } from './key-results/key-results.controller';
import { KeyResultsService } from './key-results/key-results.service';
import { ObjectivesController } from './objectives/objectives.controller';
import { ObjectivesService } from './objectives/objectives.service';
import { OkrReminderScheduler } from './scheduler/okr-reminder.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [
    OkrCyclesController,
    ObjectivesController,
    KeyResultsController,
    OkrCheckInsController,
    OkrAnalyticsController,
  ],
  providers: [
    OkrCyclesService,
    ObjectivesService,
    KeyResultsService,
    OkrCheckInsService,
    OkrAnalyticsService,
    OkrReminderScheduler,
  ],
  exports: [OkrCheckInsService],
})
export class OkrsModule {}
