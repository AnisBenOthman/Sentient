import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { GatewayRequest } from '../correlation/correlation-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('GatewayRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>() as GatewayRequest;
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      finalize(() => {
        const startedAt = request.correlation?.startedAt ?? Date.now();
        this.logger.log({
          correlationId: request.correlation?.correlationId ?? 'unknown',
          method: request.method,
          path: request.originalUrl ?? request.url,
          routeKey: request.correlation?.routeKey,
          statusCode: response.statusCode,
          latencyMs: Date.now() - startedAt,
          userId: request.correlation?.userId,
        });
      }),
    );
  }
}

