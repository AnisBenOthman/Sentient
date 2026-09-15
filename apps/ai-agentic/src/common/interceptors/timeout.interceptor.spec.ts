import { CallHandler, ExecutionContext, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, NEVER, of } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  const executionContext = {} as ExecutionContext;

  it('prefers the typed AI Agentic request timeout config', async () => {
    const requestedKeys: string[] = [];
    const config = {
      get: (key: string) => {
        requestedKeys.push(key);
        if (key === 'aiAgentic') return { requestTimeoutMs: 1 };
        if (key === 'REQUEST_TIMEOUT_MS') return 60_000;
        return undefined;
      },
    } as unknown as ConfigService;
    const interceptor = new TimeoutInterceptor(config);
    const next = { handle: () => NEVER } as CallHandler;

    try {
      await firstValueFrom(interceptor.intercept(executionContext, next));
      throw new Error('Expected request timeout');
    } catch (error) {
      expect(error instanceof RequestTimeoutException).toBe(true);
    }
    expect(requestedKeys).toContain('aiAgentic');
  });

  it('falls back to REQUEST_TIMEOUT_MS when typed AI config is unavailable', async () => {
    const requestedKeys: string[] = [];
    const config = {
      get: (key: string) => {
        requestedKeys.push(key);
        if (key === 'REQUEST_TIMEOUT_MS') return 5_000;
        return undefined;
      },
    } as unknown as ConfigService;
    const interceptor = new TimeoutInterceptor(config);
    const next = { handle: () => of('ok') } as CallHandler;

    const result = await firstValueFrom(interceptor.intercept(executionContext, next));

    expect(result).toBe('ok');
    expect(requestedKeys).toContain('aiAgentic');
    expect(requestedKeys).toContain('REQUEST_TIMEOUT_MS');
  });
});
