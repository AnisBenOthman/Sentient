import { ConfigService } from '@nestjs/config';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { ActorContextFactory } from '../../common/graph';
import { ActionProposalService } from '../../modules/agents/actions/action-proposal.service';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { TelegramService } from './telegram.service';

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
