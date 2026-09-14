import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sentient/shared';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { SlackService } from './slack.service';

const mockConfig = { get: jest.fn() } as unknown as ConfigService;

function buildService(hrCore: Partial<HrCoreClient> = {}): SlackService {
  return new SlackService(mockConfig, hrCore as unknown as HrCoreClient);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function internals(service: SlackService): any {
  return service as unknown as Record<string, unknown>;
}

function dm(overrides: Record<string, unknown> = {}): never {
  return {
    type: 'message',
    subtype: undefined,
    channel_type: 'im',
    channel: 'D123',
    user: 'U42',
    text: 'hello',
    ts: '1.0',
    event_ts: '1.0',
    ...overrides,
  } as never;
}

describe('SlackService.sendMessage', () => {
  it('no-ops without throwing when the Slack channel is disabled (web client is null)', async () => {
    const service = buildService();

    await expect(service.sendMessage('U42', 'hello')).resolves.toEqual({ delivered: false });
  });

  it('delivers through chat.postMessage addressed to the Slack user id', async () => {
    const service = buildService();
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };

    const result = await service.sendMessage('U42', 'hello');

    expect(postMessage).toHaveBeenCalledWith({ channel: 'U42', text: 'hello' });
    expect(result).toEqual({ delivered: true });
  });

  it('swallows a Slack API rejection (e.g. app uninstalled) instead of throwing', async () => {
    const service = buildService();
    const postMessage = jest.fn().mockRejectedValue(new Error('An API error occurred: account_inactive'));
    internals(service).web = { chat: { postMessage } };

    await expect(service.sendMessage('U42', 'hello')).resolves.toEqual({ delivered: false });
  });
});

describe('SlackService — events mode', () => {
  const secret = 'signing-secret';

  function sign(timestamp: string, rawBody: string): string {
    return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  }

  it('verifySignature rejects everything while in socket mode, even a correct HMAC', () => {
    const service = buildService();
    internals(service).mode = 'socket';
    internals(service).signingSecret = secret;
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(service.verifySignature(timestamp, sign(timestamp, '{}'), '{}')).toBe(false);
  });

  it('verifySignature accepts only a matching HMAC in events mode', () => {
    const service = buildService();
    internals(service).mode = 'events';
    internals(service).signingSecret = secret;
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(service.verifySignature(timestamp, sign(timestamp, '{}'), '{}')).toBe(true);
    expect(service.verifySignature(timestamp, sign(timestamp, '{}'), '{"tampered":1}')).toBe(false);
    expect(service.verifySignature(timestamp, undefined, '{}')).toBe(false);
  });

  it('handleEventsPayload echoes the url_verification challenge', async () => {
    const service = buildService();

    await expect(service.handleEventsPayload({ type: 'url_verification', challenge: 'abc' })).resolves.toEqual({
      challenge: 'abc',
    });
  });

  it('handleEventsPayload dispatches event_callback to handleEvent and returns nothing', async () => {
    const service = buildService();
    const handleEvent = jest.spyOn(service, 'handleEvent').mockResolvedValue(undefined);
    const event = dm();

    await expect(service.handleEventsPayload({ type: 'event_callback', event })).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));

    expect(handleEvent).toHaveBeenCalledWith(event);
  });
});

describe('SlackService.handleEvent — inbound DMs', () => {
  it('ignores everything when the channel is not running', async () => {
    const redeemLinkCode = jest.fn();
    const service = buildService({ redeemLinkCode });

    await service.handleEvent(dm({ text: 'link 123456' }));

    expect(redeemLinkCode).not.toHaveBeenCalled();
  });

  it('ignores the bot\'s own messages and non-DM channels', async () => {
    const redeemLinkCode = jest.fn();
    const service = buildService({ redeemLinkCode });
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };
    internals(service).botUserId = 'UBOT';

    await service.handleEvent(dm({ text: 'link 123456', bot_id: 'B1' }));
    await service.handleEvent(dm({ text: 'link 123456', user: 'UBOT' }));
    await service.handleEvent(dm({ text: 'link 123456', channel_type: 'channel' }));
    await service.handleEvent(dm({ text: 'link 123456', subtype: 'message_changed' }));

    expect(redeemLinkCode).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('redeems "link <code>" against HR Core with the Slack user id as externalId and confirms in the DM', async () => {
    const redeemLinkCode = jest.fn().mockResolvedValue(undefined);
    const service = buildService({ redeemLinkCode });
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };

    await service.handleEvent(dm({ text: '/link 123456' }));

    expect(redeemLinkCode).toHaveBeenCalledWith(ChannelType.SLACK, 'U42', '123456');
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining('Linked!') });
  });

  it('reports an invalid code without throwing when HR Core rejects it', async () => {
    const redeemLinkCode = jest.fn().mockRejectedValue(new Error('Invalid or expired link code'));
    const service = buildService({ redeemLinkCode });
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };

    await expect(service.handleEvent(dm({ text: 'link 000000' }))).resolves.toBeUndefined();

    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining('invalid or expired') });
  });

  it('tells an unlinked user how to link when they send free text', async () => {
    const exchangeChannelIdentity = jest.fn().mockRejectedValue(new Error('404'));
    const service = buildService({ exchangeChannelIdentity });
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };

    await service.handleEvent(dm({ text: 'how many leave days do I have?' }));

    expect(exchangeChannelIdentity).toHaveBeenCalledWith(ChannelType.SLACK, 'U42');
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining("isn't linked") });
  });

  it('caches the exchanged session so a second message does not hit HR Core again', async () => {
    const exchangeChannelIdentity = jest
      .fn()
      .mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const service = buildService({ exchangeChannelIdentity });
    const postMessage = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage } };

    await service.handleEvent(dm({ text: 'whoami' }));
    await service.handleEvent(dm({ text: 'whoami' }));

    expect(exchangeChannelIdentity).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith({ channel: 'D123', text: expect.stringContaining('is linked') });
  });
});
