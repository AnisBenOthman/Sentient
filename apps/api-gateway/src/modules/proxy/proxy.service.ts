import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import { gatewayConfig } from '../../config/gateway.config';
import type { MatchedRoute, RouteConfig } from '../../config/route-config.types';
import type { GatewayRequest } from '../../common/correlation/correlation-context';
import { createErrorEnvelope, GatewayErrorCode } from '../../common/errors/error-envelope';
import { mapUpstreamBodyError, mapUpstreamFailure } from '../../common/errors/upstream-error.mapper';
import { applyAllowedResponseHeaders, filterRequestHeaders } from './header-policy';

@Injectable()
export class ProxyService {
  constructor(
    @Inject(gatewayConfig.KEY)
    private readonly config: ConfigType<typeof gatewayConfig>,
  ) {}

  async forward(request: Request, response: Response): Promise<void> {
    const gatewayRequest = request as GatewayRequest;
    const correlationId = gatewayRequest.correlation?.correlationId ?? 'unknown';
    const matched = this.matchRoute(request.path, request.url);

    if (!matched) {
      response.status(404).json(
        createErrorEnvelope(
          GatewayErrorCode.NoUpstreamRoute,
          'No upstream route is configured for this path.',
          correlationId,
        ),
      );
      return;
    }

    const downstreamTarget = new URL(matched.downstreamPath, matched.route.targetBaseUrl).toString();
    gatewayRequest.correlation = {
      ...(gatewayRequest.correlation ?? { correlationId, startedAt: Date.now() }),
      routeKey: matched.route.key,
      downstreamTarget,
    };

    const maxBodyBytes = this.resolveMaxBodyBytes(matched.route, request.path);
    if (this.isContentLengthTooLarge(request, maxBodyBytes)) {
      response.status(413).json(
        createErrorEnvelope(
          GatewayErrorCode.PayloadTooLarge,
          'Request body exceeds the configured gateway limit.',
          correlationId,
        ),
      );
      return;
    }

    await this.streamToUpstream(matched, gatewayRequest, response, correlationId, maxBodyBytes);
  }

  matchRoute(path: string, originalUrl: string): MatchedRoute | undefined {
    const route = this.config.routes.find((candidate) => path === candidate.inboundPrefix || path.startsWith(`${candidate.inboundPrefix}/`));
    if (!route) return undefined;

    const query = originalUrl.includes('?') ? originalUrl.slice(originalUrl.indexOf('?')) : '';
    const stripped = path.slice(route.inboundPrefix.length);
    const downstreamPath = `${stripped.length > 0 ? stripped : '/'}${query}`;
    return { route, downstreamPath };
  }

  private resolveMaxBodyBytes(route: RouteConfig, path: string): number {
    if (route.key === 'social' && path.startsWith('/api/social/documents')) {
      return this.config.uploadBodyLimitBytes;
    }

    return route.maxBodyBytes;
  }

  private isContentLengthTooLarge(request: Request, maxBodyBytes: number): boolean {
    const header = request.headers['content-length'];
    if (typeof header !== 'string') return false;
    const length = Number(header);
    return Number.isFinite(length) && length > maxBodyBytes;
  }

  private streamToUpstream(
    matched: MatchedRoute,
    request: GatewayRequest,
    response: Response,
    correlationId: string,
    maxBodyBytes: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const targetUrl = new URL(matched.downstreamPath, matched.route.targetBaseUrl);
      const client = targetUrl.protocol === 'https:' ? https : http;
      const headers = filterRequestHeaders(request.headers);
      headers.host = targetUrl.host;
      headers['x-correlation-id'] = correlationId;

      const upstreamRequest = client.request(
        targetUrl,
        {
          method: request.method,
          headers,
          timeout: matched.route.timeoutMs,
        },
        (upstreamResponse) => {
          const statusCode = upstreamResponse.statusCode ?? 502;
          if (statusCode >= 200 && statusCode < 300) {
            response.status(statusCode);
            applyAllowedResponseHeaders(upstreamResponse.headers, response);
            upstreamResponse.pipe(response);
            upstreamResponse.on('end', resolve);
            return;
          }

          const chunks: Buffer[] = [];
          upstreamResponse.on('data', (chunk: Buffer) => chunks.push(chunk));
          upstreamResponse.on('end', () => {
            const mapped = mapUpstreamBodyError(
              statusCode,
              Buffer.concat(chunks),
              upstreamResponse.headers['content-type'],
              correlationId,
            );
            response.status(mapped.statusCode).json(mapped.body);
            resolve();
          });
        },
      );

      let observedBytes = 0;
      request.on('data', (chunk: Buffer) => {
        observedBytes += chunk.length;
        if (observedBytes > maxBodyBytes && !response.headersSent) {
          upstreamRequest.destroy();
          response.status(413).json(
            createErrorEnvelope(
              GatewayErrorCode.PayloadTooLarge,
              'Request body exceeds the configured gateway limit.',
              correlationId,
            ),
          );
          resolve();
        }
      });

      upstreamRequest.on('timeout', () => {
        upstreamRequest.destroy(Object.assign(new Error('Upstream timeout'), { code: 'ETIMEDOUT' }));
      });
      upstreamRequest.on('error', (error: NodeJS.ErrnoException) => {
        if (response.headersSent) {
          resolve();
          return;
        }
        const mapped = mapUpstreamFailure(error, correlationId);
        response.status(mapped.statusCode).json(mapped.body);
        resolve();
      });

      request.pipe(upstreamRequest);
    });
  }
}
