import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getCorrelationId } from '../../common/correlation/correlation-context';
import { DownstreamHealthService } from './downstream-health.service';
import type { DownstreamHealth } from './downstream-health.service';

export interface GatewayHealthResponse {
  status: 'healthy' | 'degraded';
  gateway: { status: 'healthy' };
  downstreams: DownstreamHealth[];
  correlationId: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly downstreamHealthService: DownstreamHealthService) {}

  @Get()
  async health(@Req() request: Request): Promise<GatewayHealthResponse> {
    const downstreams = await this.downstreamHealthService.probeAll();
    const degraded = downstreams.some((downstream) => downstream.status === 'unhealthy');

    return {
      status: degraded ? 'degraded' : 'healthy',
      gateway: { status: 'healthy' },
      downstreams,
      correlationId: getCorrelationId(request),
    };
  }
}

