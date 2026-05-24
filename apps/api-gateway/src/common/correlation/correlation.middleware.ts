import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { GatewayRequest } from './correlation-context';

const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: GatewayRequest, response: Response, next: NextFunction): void {
    const inbound = request.header(CORRELATION_HEADER);
    const correlationId = this.normalizeCorrelationId(inbound);

    request.correlation = {
      correlationId,
      startedAt: Date.now(),
    };
    response.setHeader(CORRELATION_HEADER, correlationId);

    next();
  }

  private normalizeCorrelationId(value: string | undefined): string {
    if (value && /^[a-zA-Z0-9_.:-]{8,128}$/.test(value)) return value;
    return randomUUID();
  }
}

