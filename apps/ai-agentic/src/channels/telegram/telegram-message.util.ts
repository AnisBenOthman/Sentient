import { CardLines } from '../../modules/agents/actions/confirmation-card.presenter';

/**
 * Telegram rejects any sendMessage over 4096 characters outright, and an agent
 * answer (an analytics table, a long policy summary) can exceed that. Chunk on
 * paragraph, then line, then hard boundaries — never mid-word when avoidable —
 * and keep a margin below the cap so a trailing footer never tips a chunk over.
 */
export const TELEGRAM_MESSAGE_MAX_CHARS = 4096;
export const TELEGRAM_CHUNK_TARGET_CHARS = 3500;

export function chunkTelegramMessage(text: string, target = TELEGRAM_CHUNK_TARGET_CHARS): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= target) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;
  while (remaining.length > target) {
    let cut = remaining.lastIndexOf('\n\n', target);
    if (cut < target / 2) cut = remaining.lastIndexOf('\n', target);
    if (cut < target / 2) cut = remaining.lastIndexOf(' ', target);
    if (cut < target / 2) cut = target;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Renders channel-neutral card content as plain text. No parse_mode: one
 * unescaped `_` or `*` in generated content makes Telegram reject the whole
 * message with a 400, and a plain card is always deliverable.
 */
export function renderCardText(card: CardLines): string {
  const sections: string[] = [card.headline];
  if (card.lines.length > 0) {
    sections.push(card.lines.map((line) => `${line.label}: ${line.value}`).join('\n'));
  }
  if (card.citations.length > 0) {
    sections.push(['Policy notes:', ...card.citations.map((citation) => `• ${citation}`)].join('\n'));
  }
  sections.push(card.footer);
  return sections.join('\n\n');
}
