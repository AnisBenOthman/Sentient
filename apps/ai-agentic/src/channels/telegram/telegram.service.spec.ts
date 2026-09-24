import { ConfigService } from '@nestjs/config';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { ActorContextFactory } from '../../common/graph';
import { ActionProposalService } from '../../modules/agents/actions/action-proposal.service';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { deriveWebhookSecret, TelegramService } from './telegram.service';

/**
 * WHY stubs rather than a Nest testing module: every method under test here
 * (proactive sendMessage, webhook secret verification, update forwarding) runs
 * off the agent pipeline entirely — it needs a bot handle and nothing else. The
 * four collaborators exist only to satisfy the constructor.
 */
function buildService(config: Partial<ConfigService> = { get: jest.fn() }): TelegramService {
  return new TelegramService(
    config as ConfigService,
    {} as HrCoreClient,
    {} as ActorContextFactory,
    {} as ConversationsService,
    {} as ChannelConversationLinkService,
    {} as ActionProposalService,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function internals(service: TelegramService): any {
  return service as unknown as Record<string, unknown>;
}

describe('TelegramService.sendMessage', () => {
  it('no-ops without throwing when the Telegram channel is disabled (bot is null)', async () => {
    const service = buildService();

    const result = await service.sendMessage('chat-1', 'hello');

    expect(result).toEqual({ delivered: false });
  });

  it('delivers through the bot API when the channel is running', async () => {
    const service = buildService();
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    internals(service).bot = { api: { sendMessage } };

    const result = await service.sendMessage('chat-1', 'hello');

    expect(sendMessage).toHaveBeenCalledWith('chat-1', 'hello');
    expect(result).toEqual({ delivered: true });
  });

  it('swallows a Telegram API rejection (e.g. user blocked the bot) instead of throwing', async () => {
    const service = buildService();
    const sendMessage = jest.fn().mockRejectedValue(new Error('403: bot was blocked by the user'));
    internals(service).bot = { api: { sendMessage } };

    const result = await service.sendMessage('chat-1', 'hello');

    expect(result).toEqual({ delivered: false });
  });
});

describe('TelegramService — webhook mode', () => {
  it('verifyWebhookSecret rejects everything when the service is in polling mode', () => {
    const service = buildService();
    internals(service).mode = 'polling';
    internals(service).webhookSecret = 'shh';

    expect(service.verifyWebhookSecret('shh')).toBe(false);
  });

  it('verifyWebhookSecret accepts only an exact match in webhook mode', () => {
    const service = buildService();
    internals(service).mode = 'webhook';
    internals(service).webhookSecret = 'shh';

    expect(service.verifyWebhookSecret('shh')).toBe(true);
    expect(service.verifyWebhookSecret('wrong')).toBe(false);
    expect(service.verifyWebhookSecret(undefined)).toBe(false);
  });

  it('handleWebhookUpdate no-ops when the bot was never started (channel disabled)', async () => {
    const service = buildService();

    await expect(service.handleWebhookUpdate({} as never)).resolves.toBeUndefined();
  });

  it('handleWebhookUpdate delegates to bot.handleUpdate when running', async () => {
    const service = buildService();
    const handleUpdate = jest.fn().mockResolvedValue(undefined);
    internals(service).bot = { handleUpdate };
    const update = { update_id: 1 } as never;

    await service.handleWebhookUpdate(update);

    expect(handleUpdate).toHaveBeenCalledWith(update);
  });
});

describe('TelegramService — webhook registration', () => {
  function configWith(values: Record<string, string>): Partial<ConfigService> {
    return { get: jest.fn((key: string) => values[key]) } as Partial<ConfigService>;
  }

  function fakeBot(): { init: jest.Mock; api: { setWebhook: jest.Mock } } {
    return { init: jest.fn().mockResolvedValue(undefined), api: { setWebhook: jest.fn().mockResolvedValue(true) } };
  }

  afterEach(() => jest.restoreAllMocks());

  it('registers a concrete URL once, with the configured secret', async () => {
    const service = buildService(
      configWith({ TELEGRAM_WEBHOOK_URL: 'https://hr.example.com/api/ai/channels/telegram/webhook', TELEGRAM_WEBHOOK_SECRET: 'shh' }),
    );
    const bot = fakeBot();
    internals(service).mode = 'webhook';

    await internals(service).startWebhook(bot, 'bot-token');

    expect(bot.api.setWebhook).toHaveBeenCalledWith('https://hr.example.com/api/ai/channels/telegram/webhook', {
      secret_token: 'shh',
    });
    expect(service.verifyWebhookSecret('shh')).toBe(true);
  });

  it('fills the {tunnel} placeholder from cloudflared and verifies with the token-derived secret', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ hostname: 'calm-river.trycloudflare.com' }),
    } as Response);
    const service = buildService(configWith({ TELEGRAM_WEBHOOK_URL: '{tunnel}/api/ai/channels/telegram/webhook' }));
    const bot = fakeBot();
    internals(service).mode = 'webhook';

    await internals(service).startWebhook(bot, 'bot-token');
    await new Promise((resolve) => setImmediate(resolve));
    internals(service).tunnelWatcher.stop();

    expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:20241/quicktunnel', expect.anything());
    expect(bot.api.setWebhook).toHaveBeenCalledWith(
      'https://calm-river.trycloudflare.com/api/ai/channels/telegram/webhook',
      { secret_token: deriveWebhookSecret('bot-token') },
    );
    expect(service.verifyWebhookSecret(deriveWebhookSecret('bot-token'))).toBe(true);
  });

  it('derives a stable secret inside the charset Telegram accepts', () => {
    const secret = deriveWebhookSecret('123:abc');

    expect(secret).toBe(deriveWebhookSecret('123:abc'));
    expect(secret).not.toBe(deriveWebhookSecret('123:abd'));
    expect(secret).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });
});

