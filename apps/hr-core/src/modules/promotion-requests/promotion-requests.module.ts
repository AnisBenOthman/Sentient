import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PromotionRequestsController } from './promotion-requests.controller';
import { PromotionRequestsService } from './promotion-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionRequestsController],
  providers: [PromotionRequestsService],
  exports: [PromotionRequestsService],
})
export class PromotionRequestsModule {}
