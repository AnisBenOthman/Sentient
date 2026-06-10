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
import type { AiAgenticConfig } from '../../config';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ai-agentic default is 60s (LLM calls can take 15-45s)
    const aiConfig = this.configService.get<AiAgenticConfig>('aiAgentic');
    const ms = aiConfig?.requestTimeoutMs ?? this.configService.get<number>('REQUEST_TIMEOUT_MS') ?? 60_000;
    return next.handle().pipe(
      timeout(ms),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) throw new RequestTimeoutException();
        throw err;
      }),
    );
  }
}
