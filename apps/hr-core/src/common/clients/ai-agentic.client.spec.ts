import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AiAgenticClient } from './ai-agentic.client';

const mockConfig = {
  values: {
    AI_AGENTIC_URL: 'http://ai-agentic.test',
    SYSTEM_JWT_SECRET: 'test-system-secret',
    SYSTEM_JWT_EXPIRY: '5m',
  } as Record<string, unknown>,
  getOrThrow<T>(key: string): T {
    const value = this.values[key];
    if (value === undefined) throw new Error(`Missing config: ${key}`);
    return value as T;
  },
  get<T>(key: string, fallback?: T): T | undefined {
    return (this.values[key] as T | undefined) ?? fallback;
  },
};

describe('AiAgenticClient', () => {
  let client: AiAgenticClient;
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    client = new AiAgenticClient(mockConfig as unknown as ConfigService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postSpy = jest.spyOn((client as any).http, 'post');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts to /channels/telegram/notify with a channel_notify-scoped SYSTEM bearer token', async () => {
    postSpy.mockResolvedValue({ status: 204, data: undefined });

    await client.notifyTelegram('chat-42', 'Your leave was approved.');

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [url, body, config] = postSpy.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(url).toBe('/channels/telegram/notify');
    expect(body).toEqual({ externalId: 'chat-42', text: 'Your leave was approved.' });

    const authHeader = config.headers.Authorization;
    expect(authHeader).toBeDefined();
    const token = (authHeader ?? '').replace('Bearer ', '');
    const decoded = jwt.verify(token, 'test-system-secret') as Record<string, unknown>;
    expect(decoded.sub).toBe('system');
    expect(decoded.roles).toEqual(['SYSTEM']);
    expect(decoded.taskType).toBe('channel_notify');
  });

  it('never throws when the request fails — the caller must not fail on a Telegram/AI Agentic outage', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client.notifyTelegram('chat-42', 'text')).resolves.toBeUndefined();
  });
});
