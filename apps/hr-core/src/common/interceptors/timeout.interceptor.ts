import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms = this.configService.get<number>('REQUEST_TIMEOUT_MS') ?? 30_000;
    return next.handle().pipe(
      timeout(ms),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) throw new RequestTimeoutException();
        throw err;
      }),
    );
  }
}
