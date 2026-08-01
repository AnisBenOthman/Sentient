import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { ActionExecutionOutcome, DownstreamRequestContext, DownstreamResult } from './downstream-client.types';

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
          degradedReason: response.status === 403
            ? 'Caller is not allowed to access this context.'
            : 'Requested context is unavailable.',
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

  /**
   * WHY consume-then-return rather than throwing on non-2xx: FR-007 requires
   * every non-2xx response, timeout, and network failure to resolve to a
   * `FAILED` outcome carrying the specific downstream reason — never an
   * uncaught exception a caller might forget to handle, and never a silently
   * generalized message (FR-010).
   */
  async post<TData>(
    baseUrl: string,
    path: string,
    body: unknown,
    context: DownstreamRequestContext,
    sourceTitle: string,
  ): Promise<ActionExecutionOutcome<TData>> {
    const controller = new AbortController();
    const timeoutMs = this.config.get<number>('aiAgentic.downstreamTimeoutMs') ?? 8_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.jwt}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-correlation-id': context.correlationId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      const parsedBody = HttpJsonClient.parseJsonSafely(rawBody);

      if (!response.ok) {
        this.logger.warn(`${sourceTitle} failed`, {
          path,
          correlationId: context.correlationId,
          status: response.status,
        });
        return {
          status: 'FAILED',
          httpStatus: response.status,
          reason: HttpJsonClient.extractErrorReason(parsedBody, response.status, sourceTitle),
        };
      }

      return {
        status: 'SUCCESS',
        httpStatus: response.status,
        data: parsedBody as TData,
      };
    } catch (error: unknown) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      this.logger.warn(`${sourceTitle} request failed`, {
        path,
        correlationId: context.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        status: 'FAILED',
        httpStatus: null,
        reason: isTimeout ? `${sourceTitle} timed out.` : `${sourceTitle} could not be reached.`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private static parseJsonSafely(raw: string): unknown {
    if (raw.length === 0) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * WHY this shape specifically: HttpExceptionFilter (HR Core) always returns
   * `{ statusCode, message, error, correlationId, timestamp }`, and NestJS's
   * default ValidationPipe response carries `message` as a string[] rather
   * than a string. Both are handled so a validation failure surfaces as
   * readable text instead of "[object Object]".
   */
  private static extractErrorReason(body: unknown, status: number, sourceTitle: string): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as Record<string, unknown>)['message'];
      if (typeof message === 'string' && message.length > 0) return message;
      if (Array.isArray(message) && message.length > 0) {
        return message.filter((entry): entry is string => typeof entry === 'string').join('; ');
      }
    }
    return `${sourceTitle} returned HTTP ${status}.`;
  }
}
