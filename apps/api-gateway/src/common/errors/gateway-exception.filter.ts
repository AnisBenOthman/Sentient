import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getCorrelationId } from '../correlation/correlation-context';
import { createErrorEnvelope, GatewayErrorCode } from './error-envelope';

@Catch()
export class GatewayExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GatewayExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const correlationId = getCorrelationId(request);

    if (response.headersSent) return;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = this.extractMessage(body, exception.message);
      const details = this.extractDetails(body);
      const code = this.extractCode(body, status);
      response.status(status).json(createErrorEnvelope(code, message, correlationId, details));
      return;
    }

    this.logger.error(
      { correlationId, path: request.originalUrl ?? request.url, exception },
      'Unhandled gateway exception',
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        createErrorEnvelope(
          GatewayErrorCode.GatewayInternalError,
          'The gateway failed to process the request.',
          correlationId,
        ),
      );
  }

  private extractMessage(body: string | object, fallback: string): string {
    if (typeof body === 'string') return body;
    const value = (body as Record<string, unknown>).message;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join(', ');
    return fallback;
  }

  private extractDetails(body: string | object): unknown {
    if (typeof body === 'string') return undefined;
    const value = (body as Record<string, unknown>).details;
    return value;
  }

  private extractCode(body: string | object, status: number): string {
    if (typeof body !== 'string') {
      const code = (body as Record<string, unknown>).code;
      if (typeof code === 'string') return code;
    }

    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return GatewayErrorCode.MissingAuthorization;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return GatewayErrorCode.PayloadTooLarge;
      case HttpStatus.TOO_MANY_REQUESTS:
        return GatewayErrorCode.RateLimitExceeded;
      default:
        return `Http${status}`;
    }
  }
}

