import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { RateLimitKeyMode, RouteKey } from '../../config/route-config.types';
import type { GatewayRequest } from '../correlation/correlation-context';

export interface RateLimitKeyInput {
  routeKey: RouteKey;
  keyMode: RateLimitKeyMode;
  overrideKey?: string;
  request: Request;
}

@Injectable()
export class RateLimitKeyFactory {
  create(input: RateLimitKeyInput): string {
    const request = input.request as GatewayRequest;
    const subject = this.resolveSubject(input.keyMode, request);
    const override = input.overrideKey ?? 'default';
    return `${input.routeKey}:${input.keyMode}:${subject}:${override}`;
  }

  private resolveSubject(keyMode: RateLimitKeyMode, request: GatewayRequest): string {
    if (keyMode === 'authenticated-user' && request.correlation?.userId) {
      return request.correlation.userId;
    }
    if (keyMode === 'auto' && request.correlation?.userId) {
      return request.correlation.userId;
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown-ip';
  }
}
