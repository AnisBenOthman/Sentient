import { ConfigService } from '@nestjs/config';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { TelegramService } from './telegram.service';

describe('TelegramService.sendMessage', () => {
  const mockConfig = { get: jest.fn() } as unknown as ConfigService;
  const mockHrCore = {} as unknown as HrCoreClient;

  it('no-ops without throwing when the Telegram channel is disabled (bot is null)', async () => {
    const service = new TelegramService(mockConfig, mockHrCore);

    const result = await service.sendMessage('chat-1', 'hello');

    expect(result).toEqual({ delivered: false });
  });

  it('delivers through the bot API when the channel is running', async () => {
    const service = new TelegramService(mockConfig, mockHrCore);
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).bot = { api: { sendMessage } };

    const result = await service.sendMessage('chat-1', 'hello');

    expect(sendMessage).toHaveBeenCalledWith('chat-1', 'hello');
    expect(result).toEqual({ delivered: true });
  });

  it('swallows a Telegram API rejection (e.g. user blocked the bot) instead of throwing', async () => {
    const service = new TelegramService(mockConfig, mockHrCore);
    const sendMessage = jest.fn().mockRejectedValue(new Error('403: bot was blocked by the user'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).bot = { api: { sendMessage } };

    const result = await service.sendMessage('chat-1', 'hello');

    expect(result).toEqual({ delivered: false });
  });
});

describe('TelegramService — webhook mode', () => {
  const mockHrCore = {} as unknown as HrCoreClient;

  it('verifyWebhookSecret rejects everything when the service is in polling mode', () => {
    const service = new TelegramService({ get: jest.fn() } as unknown as ConfigService, mockHrCore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).mode = 'polling';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).webhookSecret = 'shh';

    expect(service.verifyWebhookSecret('shh')).toBe(false);
  });

  it('verifyWebhookSecret accepts only an exact match in webhook mode', () => {
    const service = new TelegramService({ get: jest.fn() } as unknown as ConfigService, mockHrCore);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).mode = 'webhook';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).webhookSecret = 'shh';

    expect(service.verifyWebhookSecret('shh')).toBe(true);
    expect(service.verifyWebhookSecret('wrong')).toBe(false);
    expect(service.verifyWebhookSecret(undefined)).toBe(false);
  });

  it('handleWebhookUpdate no-ops when the bot was never started (channel disabled)', async () => {
    const service = new TelegramService({ get: jest.fn() } as unknown as ConfigService, mockHrCore);

    await expect(service.handleWebhookUpdate({} as never)).resolves.toBeUndefined();
  });

  it('handleWebhookUpdate delegates to bot.handleUpdate when running', async () => {
    const service = new TelegramService({ get: jest.fn() } as unknown as ConfigService, mockHrCore);
    const handleUpdate = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).bot = { handleUpdate };
    const update = { update_id: 1 } as never;

    await service.handleWebhookUpdate(update);

    expect(handleUpdate).toHaveBeenCalledWith(update);
  });
});
