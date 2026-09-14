import { ForbiddenException } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

describe('TelegramController', () => {
  it('relays the notify payload to TelegramService.sendMessage', async () => {
    const sendMessage = jest.fn().mockResolvedValue({ delivered: true });
    const controller = new TelegramController({ sendMessage } as unknown as TelegramService);

    await controller.notify({ externalId: 'chat-42', text: 'Your leave was approved.' });

    expect(sendMessage).toHaveBeenCalledWith('chat-42', 'Your leave was approved.');
  });

  describe('webhook', () => {
    it('rejects a request with a missing or wrong secret token before touching the update', async () => {
      const verifyWebhookSecret = jest.fn().mockReturnValue(false);
      const handleWebhookUpdate = jest.fn();
      const controller = new TelegramController({
        verifyWebhookSecret,
        handleWebhookUpdate,
      } as unknown as TelegramService);
      const update = { update_id: 1 } as never;

      await expect(controller.webhook(update, 'wrong-secret')).rejects.toBeInstanceOf(ForbiddenException);
      expect(handleWebhookUpdate).not.toHaveBeenCalled();
    });

    it('forwards the update to TelegramService once the secret token matches', async () => {
      const verifyWebhookSecret = jest.fn().mockReturnValue(true);
      const handleWebhookUpdate = jest.fn().mockResolvedValue(undefined);
      const controller = new TelegramController({
        verifyWebhookSecret,
        handleWebhookUpdate,
      } as unknown as TelegramService);
      const update = { update_id: 1 } as never;

      await controller.webhook(update, 'correct-secret');

      expect(verifyWebhookSecret).toHaveBeenCalledWith('correct-secret');
      expect(handleWebhookUpdate).toHaveBeenCalledWith(update);
    });
  });
});
