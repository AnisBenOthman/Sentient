import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReviewCyclesController } from './cycles/review-cycles.controller';
import { ReviewCyclesService } from './cycles/review-cycles.service';
import { PerformanceReviewsController } from './reviews/performance-reviews.controller';
import { PerformanceReviewsService } from './reviews/performance-reviews.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewCyclesController, PerformanceReviewsController],
  providers: [ReviewCyclesService, PerformanceReviewsService],
  exports: [ReviewCyclesService, PerformanceReviewsService],
})
export class PerformanceReviewsModule {}
