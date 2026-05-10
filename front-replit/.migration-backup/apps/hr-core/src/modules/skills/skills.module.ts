import { Module } from '@nestjs/common';
import { EVENT_BUS } from '@sentient/shared';
import { InMemoryEventBus } from '../../common/event-bus/in-memory-event-bus';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { EmployeeSkillsController } from './employee-skills/employee-skills.controller';
import { EmployeeSkillsService } from './employee-skills/employee-skills.service';
import { SkillEmployeesController } from './employee-skills/skill-employees.controller';
import { HistoryController } from './history/history.controller';
import { HistoryService } from './history/history.service';

@Module({
  imports: [PrismaModule],
  // Controller order matters for NestJS route resolution:
  // SkillEmployeesController (/skills/:skillId/employees) and HistoryController (/skills/history)
  // must be registered before CatalogController (/skills/:id) to prevent the :id wildcard
  // from matching "history" or ":skillId/employees" segments.
  controllers: [
    SkillEmployeesController,
    HistoryController,
    EmployeeSkillsController,
    CatalogController,
  ],
  providers: [
    EmployeeSkillsService,
    CatalogService,
    HistoryService,
    { provide: EVENT_BUS, useClass: InMemoryEventBus },
  ],
})
export class SkillsModule {}
