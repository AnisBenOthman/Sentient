import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DownstreamHealthService } from './downstream-health.service';

@Module({
  controllers: [HealthController],
  providers: [DownstreamHealthService],
})
export class HealthModule {}

