import { Module } from '@nestjs/common';
import { EVENT_BUS } from '@sentient/shared';
import { InMemoryEventBus } from '../../common/event-bus/in-memory-event-bus';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    {
      provide: EVENT_BUS,
      useClass: InMemoryEventBus,
    },
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
