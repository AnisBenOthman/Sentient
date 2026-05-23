import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  it('passes through requests and finalizes without throwing', (done) => {
    const interceptor = new RequestLoggingInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/hr/employees',
          originalUrl: '/api/hr/employees',
          correlation: {
            correlationId: 'test-correlation',
            routeKey: 'hr',
            startedAt: Date.now(),
            userId: 'user-1',
          },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;
    const next = { handle: () => of('ok') } as CallHandler;

    interceptor.intercept(context, next).subscribe({
      next: (value) => expect(value).toBe('ok'),
      complete: done,
      error: done,
    });
  });
});

