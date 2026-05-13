import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccrualService } from './accrual/accrual.service';
import { BalancesController } from './balances/balances.controller';
import { BalancesService } from './balances/balances.service';
import { HolidaysController } from './holidays/holidays.controller';
import { HolidaysService } from './holidays/holidays.service';
import { LeaveTypesController } from './leave-types/leave-types.controller';
import { LeaveTypesService } from './leave-types/leave-types.service';
import { RequestsController } from './requests/requests.controller';
import { RequestsService } from './requests/requests.service';

@Module({
  imports: [PrismaModule],
  // Controller order matters for NestJS route resolution:
  // BalancesController has /leave-balances/accrual/trigger and /leave-balances/:id — register before parameterized paths
  controllers: [
    BalancesController,
    HolidaysController,
    LeaveTypesController,
    RequestsController,
  ],
  providers: [
    BalancesService,
    HolidaysService,
    LeaveTypesService,
    RequestsService,
    AccrualService,
  ],
  exports: [BalancesService, RequestsService],
})
export class LeavesModule {}
