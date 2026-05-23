import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { gatewayConfig } from '../../config/gateway.config';
import type { RouteKey } from '../../config/route-config.types';

export interface DownstreamHealth {
  key: RouteKey;
  url: string;
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class DownstreamHealthService {
  constructor(
    @Inject(gatewayConfig.KEY)
    private readonly config: ConfigType<typeof gatewayConfig>,
  ) {}

  async probeAll(): Promise<DownstreamHealth[]> {
    return Promise.all(this.config.routes.map((route) => this.probe(route.key, `${route.targetBaseUrl}/health`)));
  }

  private async probe(key: RouteKey, url: string): Promise<DownstreamHealth> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const latencyMs = Date.now() - startedAt;
      if (response.ok) {
        return { key, url, status: 'healthy', latencyMs };
      }

      return {
        key,
        url,
        status: 'unhealthy',
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    } catch (error: unknown) {
      return {
        key,
        url,
        status: 'unhealthy',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Probe failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

