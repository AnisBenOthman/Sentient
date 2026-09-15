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
    const configured = Number(this.configService.get<string>('REQUEST_TIMEOUT_MS'));
    const ms = Number.isFinite(configured) && configured > 0 ? configured : 30_000;
    return next.handle().pipe(
      timeout(ms),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) throw new RequestTimeoutException();
        throw err;
      }),
    );
  }
}
