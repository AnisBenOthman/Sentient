import { HttpStatus } from '@nestjs/common';
import { createErrorEnvelope, GatewayErrorCode, isErrorEnvelope } from './error-envelope';

export interface MappedUpstreamError {
  statusCode: number;
  body: object;
}

export function mapUpstreamBodyError(
  statusCode: number,
  rawBody: Buffer,
  contentType: string | undefined,
  correlationId: string,
): MappedUpstreamError {
  const text = rawBody.toString('utf8');
  if (contentType?.includes('application/json')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (isErrorEnvelope(parsed)) {
        return {
          statusCode,
          body: parsed.correlationId ? parsed : { ...parsed, correlationId },
        };
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Record<string, unknown>;
        const message = typeof record.message === 'string' ? record.message : `Upstream returned HTTP ${statusCode}.`;
        const code = typeof record.code === 'string' ? record.code : `UpstreamHttp${statusCode}`;
        return {
          statusCode,
          body: createErrorEnvelope(code, message, correlationId, record),
        };
      }
    } catch {
      return nonConforming(statusCode, correlationId, text);
    }
  }

  return nonConforming(statusCode, correlationId, text);
}

export function mapUpstreamFailure(error: NodeJS.ErrnoException, correlationId: string): MappedUpstreamError {
  const timeout = error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT';
  return {
    statusCode: timeout ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
    body: createErrorEnvelope(
      timeout ? GatewayErrorCode.UpstreamTimeout : GatewayErrorCode.UpstreamUnavailable,
      timeout ? 'The upstream service timed out.' : 'The upstream service is unavailable.',
      correlationId,
    ),
  };
}

function nonConforming(statusCode: number, correlationId: string, text: string): MappedUpstreamError {
  return {
    statusCode,
    body: createErrorEnvelope(
      `UpstreamHttp${statusCode}`,
      text.trim() || `Upstream returned HTTP ${statusCode}.`,
      correlationId,
    ),
  };
}

