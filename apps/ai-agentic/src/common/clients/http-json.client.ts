import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { DownstreamRequestContext, DownstreamResult } from './downstream-client.types';

@Injectable()
export class HttpJsonClient {
  private readonly logger = new Logger(HttpJsonClient.name);

  constructor(private readonly config: ConfigService) {}

  async get<TData>(
    baseUrl: string,
    path: string,
    context: DownstreamRequestContext,
    sourceType: string,
    sourceTitle: string,
  ): Promise<DownstreamResult<TData>> {
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>('aiAgentic.downstreamTimeoutMs') ?? 8_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.jwt}`,
          Accept: 'application/json',
          'x-correlation-id': context.correlationId,
        },
        signal: controller.signal,
      });

      if (response.status === 403 || response.status === 404) {
        return {
          data: null,
          permissionDecision: response.status === 403 ? PermissionDecision.DENIED : PermissionDecision.UNAVAILABLE,
          degradedReason: response.status === 403 ? 'Caller is not allowed to access this context.' : 'Context was not found.',
          sourceType,
          sourceTitle,
        };
      }

      if (!response.ok) {
        return {
          data: null,
          permissionDecision: PermissionDecision.UNAVAILABLE,
          degradedReason: `${sourceTitle} is unavailable (${response.status}).`,
          sourceType,
          sourceTitle,
        };
      }

      const data = (await response.json()) as TData;
      return {
        data,
        permissionDecision: PermissionDecision.ALLOWED,
        degradedReason: null,
        sourceType,
        sourceTitle,
      };
    } catch (error: unknown) {
      this.logger.warn(`${sourceTitle} request failed`, {
        path,
        correlationId: context.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        data: null,
        permissionDecision: PermissionDecision.UNAVAILABLE,
        degradedReason: `${sourceTitle} is temporarily unavailable.`,
        sourceType,
        sourceTitle,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
