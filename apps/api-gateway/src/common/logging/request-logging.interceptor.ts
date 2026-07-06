import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { GatewayRequest } from '../correlation/correlation-context';
import type { GatewayConfig } from '../../config/route-config.types';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('GatewayRequest');

  constructor(@Optional() private readonly configService?: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>() as GatewayRequest;
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      finalize(() => {
        if (this.configService?.get<GatewayConfig>('gateway')?.requestLoggingEnabled === false) {
          return;
        }

        const startedAt = request.correlation?.startedAt ?? Date.now();
        this.logger.log({
          correlationId: request.correlation?.correlationId ?? 'unknown',
          method: request.method,
          path: request.originalUrl ?? request.url,
          routeKey: request.correlation?.routeKey,
          downstreamTarget: request.correlation?.downstreamTarget,
          statusCode: response.statusCode,
          latencyMs: Date.now() - startedAt,
          userId: request.correlation?.userId,
        });
      }),
    );
  }
}
