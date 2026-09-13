import { createHmac } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SlackController } from './slack.controller';
import { verifySlackSignature } from './slack-signature.util';
import { SlackService } from './slack.service';

/**
 * WHY this test exists alongside the unit specs: two framework behaviours
 * decide whether Slack's Events API can reach the handler at all, and
 * neither is visible from a unit test that calls the controller method
 * directly — (1) `rawBody: true` must actually populate req.rawBody with
 * the bytes Slack signed, and (2) the global ValidationPipe with
 * forbidNonWhitelisted must NOT 400 an envelope full of fields the
 * SlackEventsPayload interface doesn't declare. Both are asserted over a
 * real HTTP round-trip against a listening Nest app.
 */
describe('POST /channels/slack/events over HTTP', () => {
  const secret = 'http-test-signing-secret';
  let app: INestApplication;
  let baseUrl: string;
  const handleEventsPayload = jest.fn();

  function sign(timestamp: string, rawBody: string): string {
    return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  }

  async function post(rawBody: string, headers: Record<string, string>): Promise<Response> {
    return fetch(`${baseUrl}/channels/slack/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: rawBody,
    });
  }

  beforeAll(async () => {
    const slackStub: Pick<SlackService, 'verifySignature' | 'handleEventsPayload' | 'sendMessage'> = {
      verifySignature: (timestamp, signature, rawBody) =>
        verifySlackSignature({ signingSecret: secret, timestamp, signature, rawBody }),
      handleEventsPayload,
      sendMessage: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SlackController],
      providers: [
        { provide: SlackService, useValue: slackStub },
        // The sibling /notify route's SharedJwtGuard resolves ConfigService at
        // module init even though no test here ever hits it.
        { provide: ConfigService, useValue: { get: () => undefined, getOrThrow: () => 'unused' } },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true, logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    handleEventsPayload.mockReset();
  });

  it('echoes the url_verification challenge for a correctly signed request', async () => {
    handleEventsPayload.mockImplementation(async (payload: { challenge?: string }) => ({
      challenge: payload.challenge ?? '',
    }));
    const rawBody = JSON.stringify({ type: 'url_verification', challenge: 'xyz', token: 'legacy-verification-token' });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await post(rawBody, {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': sign(timestamp, rawBody),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ challenge: 'xyz' });
  });

  it('accepts a full event_callback envelope with fields the payload interface does not declare', async () => {
    handleEventsPayload.mockResolvedValue(undefined);
    const rawBody = JSON.stringify({
      token: 'legacy',
      team_id: 'T1',
      api_app_id: 'A1',
      type: 'event_callback',
      event_id: 'Ev1',
      event_time: 1,
      authorizations: [{ user_id: 'UBOT', is_bot: true }],
      event: { type: 'message', channel_type: 'im', channel: 'D1', user: 'U42', text: 'link 123456', ts: '1.0' },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await post(rawBody, {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': sign(timestamp, rawBody),
    });

    expect(response.status).toBe(200);
    expect(handleEventsPayload).toHaveBeenCalledWith(expect.objectContaining({ type: 'event_callback', event_id: 'Ev1' }));
  });

  it('returns 403 when the body bytes differ from what was signed', async () => {
    const signedBody = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    const sentBody = JSON.stringify({ type: 'event_callback', event: { type: 'message', text: 'injected' } });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await post(sentBody, {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': sign(timestamp, signedBody),
    });

    expect(response.status).toBe(403);
    expect(handleEventsPayload).not.toHaveBeenCalled();
  });

  it('returns 403 when the signature headers are absent', async () => {
    const response = await post(JSON.stringify({ type: 'url_verification', challenge: 'x' }), {});

    expect(response.status).toBe(403);
    expect(handleEventsPayload).not.toHaveBeenCalled();
  });
});
