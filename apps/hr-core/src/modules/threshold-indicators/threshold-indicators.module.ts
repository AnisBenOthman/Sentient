import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ThresholdIndicatorsController } from './threshold-indicators.controller';
import { ThresholdIndicatorsService } from './threshold-indicators.service';

@Module({
  imports: [PrismaModule],
  controllers: [ThresholdIndicatorsController],
  providers: [ThresholdIndicatorsService],
  exports: [ThresholdIndicatorsService],
})
export class ThresholdIndicatorsModule {}
