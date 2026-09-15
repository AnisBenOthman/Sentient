import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ChannelType } from '@sentient/shared';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { ActorContextFactory } from '../../common/graph';
import { ActionProposalService } from '../../modules/agents/actions/action-proposal.service';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { encodeCallbackData } from '../telegram/callback-data';
import { SlackService } from './slack.service';

const mockConfig = { get: jest.fn() } as unknown as ConfigService;

interface Deps {
  hrCore: Partial<HrCoreClient>;
  actors: Partial<ActorContextFactory>;
  conversations: Partial<ConversationsService>;
  links: Partial<ChannelConversationLinkService>;
  proposals: Partial<ActionProposalService>;
}

function buildService(overrides: Partial<Deps> = {}): SlackService {
  return new SlackService(
    mockConfig,
    (overrides.hrCore ?? {}) as unknown as HrCoreClient,
    (overrides.actors ?? {}) as unknown as ActorContextFactory,
    (overrides.conversations ?? {}) as unknown as ConversationsService,
    (overrides.links ?? { find: jest.fn().mockResolvedValue(null), set: jest.fn(), clear: jest.fn() }) as unknown as ChannelConversationLinkService,
    (overrides.proposals ?? {}) as unknown as ActionProposalService,
  );
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

function withWeb(service: SlackService): jest.Mock {
  const postMessage = jest.fn().mockResolvedValue({ ok: true });
  const update = jest.fn().mockResolvedValue({ ok: true });
  internals(service).web = { chat: { postMessage, update } };
  return postMessage;
}

describe('SlackService.sendMessage', () => {
  it('no-ops without throwing when the Slack channel is disabled (web client is null)', async () => {
    const service = buildService();

    await expect(service.sendMessage('U42', 'hello')).resolves.toEqual({ delivered: false });
  });

  it('delivers through chat.postMessage addressed to the Slack user id', async () => {
    const service = buildService();
    const postMessage = withWeb(service);

    const result = await service.sendMessage('U42', 'hello');

    expect(postMessage).toHaveBeenCalledWith({ channel: 'U42', text: 'hello' });
    expect(result).toEqual({ delivered: true });
  });

  it('swallows a Slack API rejection (e.g. app uninstalled) instead of throwing', async () => {
    const service = buildService();
    internals(service).web = { chat: { postMessage: jest.fn().mockRejectedValue(new Error('An API error occurred: account_inactive')) } };

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

describe('SlackService.handleEvent — commands', () => {
  it('ignores everything when the channel is not running', async () => {
    const redeemLinkCode = jest.fn();
    const service = buildService({ hrCore: { redeemLinkCode } });

    await service.handleEvent(dm({ text: 'link 123456' }));

    expect(redeemLinkCode).not.toHaveBeenCalled();
  });

  it("ignores the bot's own messages and non-DM channels", async () => {
    const redeemLinkCode = jest.fn();
    const service = buildService({ hrCore: { redeemLinkCode } });
    const postMessage = withWeb(service);
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
    const service = buildService({ hrCore: { redeemLinkCode } });
    const postMessage = withWeb(service);

    await service.handleEvent(dm({ text: '/link 123456' }));

    expect(redeemLinkCode).toHaveBeenCalledWith(ChannelType.SLACK, 'U42', '123456');
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining('Linked!') });
  });

  it('reports an invalid code without throwing when HR Core rejects it', async () => {
    const redeemLinkCode = jest.fn().mockRejectedValue(new Error('Invalid or expired link code'));
    const service = buildService({ hrCore: { redeemLinkCode } });
    const postMessage = withWeb(service);

    await expect(service.handleEvent(dm({ text: 'link 000000' }))).resolves.toBeUndefined();

    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining('invalid or expired') });
  });

  it('does not let a command word hijack a full sentence starting with it (e.g. "new leave request")', async () => {
    const exchangeChannelIdentity = jest.fn().mockRejectedValue(new NotFoundException());
    const clear = jest.fn();
    const service = buildService({ hrCore: { exchangeChannelIdentity }, links: { clear, find: jest.fn(), set: jest.fn() } });
    const postMessage = withWeb(service);

    await service.handleEvent(dm({ text: 'new leave request please' }));

    // Reaches the "not linked" reply from the free-text path, not the `new` command's clear+confirm.
    expect(clear).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining("isn't linked") });
  });
});

describe('SlackService.handleEvent — free text (agent pipeline)', () => {
  function actorStub() {
    return { fromChannelToken: jest.fn().mockReturnValue({ userId: 'user-1', jwt: 'jwt', roles: ['EMPLOYEE'] }) };
  }

  it('tells an unlinked user how to link instead of reaching the agent pipeline', async () => {
    const exchangeChannelIdentity = jest.fn().mockRejectedValue(new NotFoundException());
    const service = buildService({ hrCore: { exchangeChannelIdentity } });
    const postMessage = withWeb(service);

    await service.handleEvent(dm({ text: 'how many leave days do I have?' }));

    expect(exchangeChannelIdentity).toHaveBeenCalledWith(ChannelType.SLACK, 'U42');
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: expect.stringContaining("isn't linked") });
  });

  it('starts a new conversation and posts the assistant reply for a linked user', async () => {
    const exchangeChannelIdentity = jest.fn().mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const createConversation = jest.fn().mockResolvedValue({
      conversation: { id: 'conv-1' },
      assistantMessage: { content: 'You have 10 days remaining.' },
    });
    const set = jest.fn();
    const service = buildService({
      hrCore: { exchangeChannelIdentity },
      actors: actorStub(),
      conversations: { createConversation } as unknown as Partial<ConversationsService>,
      links: { find: jest.fn().mockResolvedValue(null), set, clear: jest.fn() },
    });
    const postMessage = withWeb(service);

    await service.handleEvent(dm({ text: 'my current leave balance' }));

    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), { message: 'my current leave balance' });
    expect(set).toHaveBeenCalledWith('SLACK', 'U42', 'conv-1');
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: 'You have 10 days remaining.' });
  });

  it('continues the linked conversation and renders a confirmation card when the turn proposes one', async () => {
    const exchangeChannelIdentity = jest.fn().mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const sendMessage = jest.fn().mockResolvedValue({
      conversation: { id: 'conv-1' },
      assistantMessage: {
        content: "Here's what I found.",
        confirmationPayload: {
          confirmationToken: '11111111-1111-1111-1111-111111111111',
          leaveTypeName: 'Annual Leave',
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          businessDays: 1,
          currentBalance: 10,
          balanceAfter: 9,
          expiresAt: new Date().toISOString(),
          policyCitations: [],
        },
      },
    });
    const service = buildService({
      hrCore: { exchangeChannelIdentity },
      actors: actorStub(),
      conversations: { sendMessage } as unknown as Partial<ConversationsService>,
      links: { find: jest.fn().mockResolvedValue('conv-1'), set: jest.fn(), clear: jest.fn() },
    });
    const postMessage = withWeb(service);

    await service.handleEvent(dm({ text: 'book 1 day off' }));

    expect(sendMessage).toHaveBeenCalledWith('conv-1', expect.objectContaining({ userId: 'user-1' }), { message: 'book 1 day off' });
    // Placeholder, then (no ts came back, so a fresh post) the text reply, then the card with Confirm/Cancel blocks.
    expect(postMessage).toHaveBeenNthCalledWith(1, { channel: 'D123', text: '_Thinking…_' });
    expect(postMessage).toHaveBeenNthCalledWith(2, { channel: 'D123', text: "Here's what I found." });
    const cardCall = postMessage.mock.calls[2][0] as { blocks: Array<{ type: string; elements?: Array<{ action_id?: string }> }> };
    const actionsBlock = cardCall.blocks.find((b) => b.type === 'actions');
    expect(actionsBlock?.elements?.map((e) => e.action_id)).toEqual(['confirm_action', 'cancel_action']);
  });
});

describe('SlackService — typing placeholder', () => {
  it('posts "Thinking…" first and edits that same message into the answer', async () => {
    const exchangeChannelIdentity = jest.fn().mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const createConversation = jest.fn().mockResolvedValue({ conversation: { id: 'conv-1' }, assistantMessage: { content: 'Answer.' } });
    const service = buildService({
      hrCore: { exchangeChannelIdentity },
      actors: { fromChannelToken: jest.fn().mockReturnValue({ userId: 'user-1', jwt: 'jwt', roles: ['EMPLOYEE'] }) },
      conversations: { createConversation } as unknown as Partial<ConversationsService>,
    });
    const postMessage = jest.fn().mockResolvedValue({ ok: true, ts: '777.1' });
    const update = jest.fn().mockResolvedValue({ ok: true });
    internals(service).web = { chat: { postMessage, update } };

    await service.handleEvent(dm({ text: 'my leave balance' }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ channel: 'D123', text: '_Thinking…_' });
    expect(update).toHaveBeenCalledWith({ channel: 'D123', ts: '777.1', text: 'Answer.', blocks: [] });
  });

  it('edits the placeholder into the "not linked" hint too, and falls back to a fresh post when the edit is rejected', async () => {
    const exchangeChannelIdentity = jest.fn().mockRejectedValue(new NotFoundException());
    const service = buildService({ hrCore: { exchangeChannelIdentity } });
    const postMessage = jest.fn().mockResolvedValue({ ok: true, ts: '777.2' });
    const update = jest.fn().mockRejectedValue(new Error('message_not_found'));
    internals(service).web = { chat: { postMessage, update } };

    await service.handleEvent(dm({ text: 'my leave balance' }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ts: '777.2', text: expect.stringContaining("isn't linked") }));
    expect(postMessage).toHaveBeenLastCalledWith({ channel: 'D123', text: expect.stringContaining("isn't linked") });
  });
});

describe('SlackService — interactive Confirm/Cancel taps', () => {
  function actorStub() {
    return { fromChannelToken: jest.fn().mockReturnValue({ userId: 'user-1', jwt: 'jwt', roles: ['EMPLOYEE'] }) };
  }

  function interactiveBody(action: 'confirm' | 'cancel', token: string, overrides: Record<string, unknown> = {}) {
    return {
      type: 'block_actions',
      user: { id: 'U42' },
      channel: { id: 'D123' },
      message: { ts: '999.1' },
      actions: [{ action_id: `${action}_action`, value: encodeCallbackData(action, token) }],
      ...overrides,
    };
  }

  it('routes a Confirm tap to sendMessage with confirmed:true and the proposal token, and strips the card', async () => {
    const token = '22222222-2222-2222-2222-222222222222';
    const exchangeChannelIdentity = jest.fn().mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const sendMessage = jest.fn().mockResolvedValue({
      conversation: { id: 'conv-1' },
      assistantMessage: { content: 'ok' },
      actionOutcome: { status: 'SUCCESS', summary: 'Done — booked and verified.' },
    });
    const findByToken = jest.fn().mockResolvedValue({ conversationId: 'conv-1', actorUserId: 'user-1' });
    const service = buildService({
      hrCore: { exchangeChannelIdentity },
      actors: actorStub(),
      conversations: { sendMessage } as unknown as Partial<ConversationsService>,
      proposals: { findByToken },
    });
    const postMessage = withWeb(service);
    const update = internals(service).web.chat.update as jest.Mock;

    await internals(service).handleInteractive(interactiveBody('confirm', token));

    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ channel: 'D123', ts: '999.1', text: 'One moment…', blocks: [] }));
    expect(sendMessage).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ userId: 'user-1' }),
      { message: 'Confirm', confirmed: true, confirmationToken: token },
    );
    // The outcome replaces the stripped card in place; nothing new is posted.
    expect(update).toHaveBeenNthCalledWith(2, { channel: 'D123', ts: '999.1', text: 'Done — booked and verified.', blocks: [] });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("refuses a tap for another user's proposal without revealing why", async () => {
    const token = '33333333-3333-3333-3333-333333333333';
    const exchangeChannelIdentity = jest.fn().mockResolvedValue({ accessToken: 'jwt', refreshToken: 'r', expiresIn: 900 });
    const sendMessage = jest.fn();
    const findByToken = jest.fn().mockResolvedValue({ conversationId: 'conv-1', actorUserId: 'someone-else' });
    const service = buildService({
      hrCore: { exchangeChannelIdentity },
      actors: actorStub(),
      conversations: { sendMessage } as unknown as Partial<ConversationsService>,
      proposals: { findByToken },
    });
    const postMessage = withWeb(service);

    const update = internals(service).web.chat.update as jest.Mock;

    await internals(service).handleInteractive(interactiveBody('confirm', token));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ channel: 'D123', ts: '999.1', text: expect.stringContaining("don't recognise that confirmation"), blocks: [] });
    expect(postMessage).not.toHaveBeenCalled();
  });
});
