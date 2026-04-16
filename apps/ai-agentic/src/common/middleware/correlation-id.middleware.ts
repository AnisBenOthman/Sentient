import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const raw = req.headers['x-correlation-id'];
    const correlationId: string = Array.isArray(raw)
      ? (raw[0] ?? randomUUID())
      : (raw ?? randomUUID());
    (req as unknown as Record<string, unknown>)['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
