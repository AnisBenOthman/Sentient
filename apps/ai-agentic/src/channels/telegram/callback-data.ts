/**
 * Encoding for Telegram inline-button `callback_data`.
 *
 * WHY so small: Telegram caps callback_data at 64 bytes. A UUID token is 36
 * characters, so a one-letter action prefix plus a separator leaves plenty of
 * room while staying unmistakable. The token is the only state a tap needs to
 * carry — everything else (user, conversation, payload) is looked up server-side
 * from the proposal row, which is what makes cross-user replay impossible
 * (spec 017 FR-004).
 */

export type CallbackAction = 'confirm' | 'cancel';

export interface ParsedCallback {
  action: CallbackAction;
  token: string;
}

const PREFIX: Record<CallbackAction, string> = { confirm: 'c', cancel: 'k' };
const ACTION_BY_PREFIX: Record<string, CallbackAction> = { c: 'confirm', k: 'cancel' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;

export function encodeCallbackData(action: CallbackAction, token: string): string {
  if (!UUID.test(token)) throw new Error('callback token must be a UUID');
  return `${PREFIX[action]}:${token}`;
}

/** Returns null for anything that is not exactly one of ours — never throws on foreign input. */
export function parseCallbackData(raw: string | undefined): ParsedCallback | null {
  if (typeof raw !== 'string') return null;
  const separator = raw.indexOf(':');
  if (separator !== 1) return null;
  const action = ACTION_BY_PREFIX[raw.slice(0, 1)];
  const token = raw.slice(2);
  if (!action || !UUID.test(token)) return null;
  return { action, token };
}
