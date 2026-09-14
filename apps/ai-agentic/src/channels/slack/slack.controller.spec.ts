import { ForbiddenException } from '@nestjs/common';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';

function request(rawBody: string): never {
  return { rawBody: Buffer.from(rawBody, 'utf8') } as never;
}

describe('SlackController', () => {
  it('relays the notify payload to SlackService.sendMessage', async () => {
    const sendMessage = jest.fn().mockResolvedValue({ delivered: true });
    const controller = new SlackController({ sendMessage } as unknown as SlackService);

    await controller.notify({ externalId: 'U42', text: 'Your leave was approved.' });

    expect(sendMessage).toHaveBeenCalledWith('U42', 'Your leave was approved.');
  });

  describe('events', () => {
    it('rejects a request whose signature does not verify before touching the payload', async () => {
      const verifySignature = jest.fn().mockReturnValue(false);
      const handleEventsPayload = jest.fn();
      const controller = new SlackController({ verifySignature, handleEventsPayload } as unknown as SlackService);

      await expect(
        controller.events(request('{}'), { type: 'event_callback' }, '1', 'v0=bad', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(verifySignature).toHaveBeenCalledWith('1', 'v0=bad', '{}');
      expect(handleEventsPayload).not.toHaveBeenCalled();
    });

    it('returns the url_verification challenge once the signature verifies', async () => {
      const verifySignature = jest.fn().mockReturnValue(true);
      const handleEventsPayload = jest.fn().mockResolvedValue({ challenge: 'abc' });
      const controller = new SlackController({ verifySignature, handleEventsPayload } as unknown as SlackService);
      const payload = { type: 'url_verification', challenge: 'abc' };

      await expect(controller.events(request('{}'), payload, '1', 'v0=ok', undefined)).resolves.toEqual({
        challenge: 'abc',
      });
      expect(handleEventsPayload).toHaveBeenCalledWith(payload);
    });

    it('acks an event_callback with an empty body', async () => {
      const verifySignature = jest.fn().mockReturnValue(true);
      const handleEventsPayload = jest.fn().mockResolvedValue(undefined);
      const controller = new SlackController({ verifySignature, handleEventsPayload } as unknown as SlackService);

      await expect(
        controller.events(request('{}'), { type: 'event_callback' }, '1', 'v0=ok', undefined),
      ).resolves.toEqual({});
    });

    it('acks an http_timeout retry without re-processing the event', async () => {
      const verifySignature = jest.fn().mockReturnValue(true);
      const handleEventsPayload = jest.fn();
      const controller = new SlackController({ verifySignature, handleEventsPayload } as unknown as SlackService);

      await expect(
        controller.events(request('{}'), { type: 'event_callback' }, '1', 'v0=ok', 'http_timeout'),
      ).resolves.toEqual({});
      expect(handleEventsPayload).not.toHaveBeenCalled();
    });
  });
});
