import type { Request } from 'express';
import type { RouteKey } from '../../config/route-config.types';

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  roleHints?: string[];
  routeKey?: RouteKey;
  startedAt: number;
}

export interface GatewayRequest extends Request {
  correlation?: CorrelationContext;
}

export function getCorrelationId(request: Request): string {
  const gatewayRequest = request as GatewayRequest;
  return gatewayRequest.correlation?.correlationId ?? 'unknown';
}

