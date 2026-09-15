import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  it('passes through requests and finalizes without throwing', async () => {
    const interceptor = new RequestLoggingInterceptor();
    const logSpy = jest.spyOn((interceptor as unknown as { logger: { log: (payload: unknown) => void } }).logger, 'log').mockImplementation(() => undefined);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/hr/employees',
          originalUrl: '/api/hr/employees',
          correlation: {
            correlationId: 'test-correlation',
            routeKey: 'hr',
            downstreamTarget: 'http://localhost:3001/employees',
            startedAt: Date.now(),
            userId: 'user-1',
          },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe('ok');
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: 'test-correlation',
      method: 'GET',
      path: '/api/hr/employees',
      routeKey: 'hr',
      downstreamTarget: 'http://localhost:3001/employees',
      statusCode: 200,
      userId: 'user-1',
    }));
    logSpy.mockRestore();
  });

  it('skips request logs when gateway request logging is disabled', async () => {
    const configService = {
      get: jest.fn().mockReturnValue({ requestLoggingEnabled: false }),
    } as unknown as ConfigService;
    const interceptor = new RequestLoggingInterceptor(configService);
    const logSpy = jest.spyOn((interceptor as unknown as { logger: { log: (payload: unknown) => void } }).logger, 'log').mockImplementation(() => undefined);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/ai/conversations',
          originalUrl: '/api/ai/conversations',
          correlation: {
            correlationId: 'quiet-correlation',
            routeKey: 'ai',
            downstreamTarget: 'http://localhost:3003/conversations',
            startedAt: Date.now(),
            userId: 'user-1',
          },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as ExecutionContext;
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe('ok');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
