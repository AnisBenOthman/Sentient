import { chunkTelegramMessage, renderCardText, TELEGRAM_MESSAGE_MAX_CHARS } from './telegram-message.util';

describe('chunkTelegramMessage', () => {
  it('returns a single chunk for short text and nothing for blank text', () => {
    expect(chunkTelegramMessage('hello')).toEqual(['hello']);
    expect(chunkTelegramMessage('   ')).toEqual([]);
  });

  it('keeps every chunk under the hard Telegram limit for a 10k-char input', () => {
    const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20).trim();
    const text = Array.from({ length: 12 }, () => paragraph).join('\n\n');
    expect(text.length).toBeGreaterThan(10_000);

    const chunks = chunkTelegramMessage(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_MAX_CHARS);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('prefers paragraph boundaries, then line boundaries', () => {
    const a = 'A'.repeat(1_800);
    const b = 'B'.repeat(1_800);
    const c = 'C'.repeat(1_800);
    const chunks = chunkTelegramMessage(`${a}\n\n${b}\n${c}`);
    expect(chunks[0]).toBe(a);
    expect(chunks[1]).toBe(b);
    expect(chunks[2]).toBe(c);
  });

  it('splits an unbroken run at the target length rather than exceeding the limit', () => {
    const chunks = chunkTelegramMessage('X'.repeat(8_000));
    expect(chunks.every((chunk) => chunk.length <= TELEGRAM_MESSAGE_MAX_CHARS)).toBe(true);
    expect(chunks.join('')).toHaveLength(8_000);
  });
});

describe('renderCardText', () => {
  it('renders headline, labelled lines, citations and footer as plain text', () => {
    const text = renderCardText({
      headline: 'Leave booking to confirm: Annual Leave',
      lines: [{ label: 'Dates', value: 'Mon 14 Sept to Tue 15 Sept' }, { label: 'Balance after', value: '6.83 days' }],
      citations: ['Leave Policy: 5 working days notice.'],
      footer: 'Nothing is submitted until you confirm.',
    });
    expect(text).toBe(
      'Leave booking to confirm: Annual Leave\n\nDates: Mon 14 Sept to Tue 15 Sept\nBalance after: 6.83 days\n\nPolicy notes:\n• Leave Policy: 5 working days notice.\n\nNothing is submitted until you confirm.',
    );
  });

  it('omits the policy block when there are no citations', () => {
    const text = renderCardText({ headline: 'H', lines: [], citations: [], footer: 'F' });
    expect(text).toBe('H\n\nF');
  });
});
