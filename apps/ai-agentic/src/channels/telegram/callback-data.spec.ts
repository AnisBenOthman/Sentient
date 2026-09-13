import { encodeCallbackData, parseCallbackData, TELEGRAM_CALLBACK_DATA_MAX_BYTES } from './callback-data';

const TOKEN = '3f2a9c14-8b6e-4d21-9a77-5c0e1b8f4d33';

describe('Telegram callback_data codec', () => {
  it('round-trips confirm and cancel', () => {
    expect(parseCallbackData(encodeCallbackData('confirm', TOKEN))).toEqual({ action: 'confirm', token: TOKEN });
    expect(parseCallbackData(encodeCallbackData('cancel', TOKEN))).toEqual({ action: 'cancel', token: TOKEN });
  });

  it('stays under the 64-byte Telegram limit', () => {
    const encoded = encodeCallbackData('confirm', TOKEN);
    expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(TELEGRAM_CALLBACK_DATA_MAX_BYTES);
  });

  it.each([
    undefined,
    '',
    'c:',
    'x:' + TOKEN,
    'c:not-a-uuid',
    'confirm:' + TOKEN,
    TOKEN,
    'c:' + TOKEN + ':extra',
  ])('returns null for foreign or malformed input %p', (raw) => {
    expect(parseCallbackData(raw as string | undefined)).toBeNull();
  });

  it('refuses to encode a non-UUID token', () => {
    expect(() => encodeCallbackData('confirm', 'abc')).toThrow();
  });
});
