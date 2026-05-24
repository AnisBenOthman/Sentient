import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { gatewayConfig } from '../../config/gateway.config';
import type { RouteKey } from '../../config/route-config.types';

export interface DownstreamOpenApiDocument {
  key: RouteKey;
  url: string;
  status: 'available' | 'unavailable';
  document?: unknown;
  error?: string;
}

@Injectable()
export class OpenApiAggregationService {
  constructor(
    @Inject(gatewayConfig.KEY)
    private readonly config: ConfigType<typeof gatewayConfig>,
  ) {}

  async aggregate(gatewayDocument: unknown): Promise<Record<string, unknown>> {
    const downstreams = await Promise.all(
      this.config.routes.map((route) => this.fetchDocument(route.key, `${route.targetBaseUrl}/api/docs-json`)),
    );

    return {
      title: 'Sentient API Gateway',
      generatedAt: new Date().toISOString(),
      gateway: gatewayDocument,
      downstreams,
    };
  }

  private async fetchDocument(key: RouteKey, url: string): Promise<DownstreamOpenApiDocument> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return { key, url, status: 'unavailable', error: `HTTP ${response.status}` };
      }

      return { key, url, status: 'available', document: await response.json() };
    } catch (error: unknown) {
      return {
        key,
        url,
        status: 'unavailable',
        error: error instanceof Error ? error.message : 'Unable to fetch docs',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

