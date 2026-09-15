import { createHmac, timingSafeEqual } from 'crypto';

/** Slack rejects replayed requests older than this; so do we. */
export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 300;

export interface SlackSignatureInput {
  signingSecret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string | undefined;
  /** Injectable clock (ms since epoch) so the replay window is unit-testable. */
  now?: number;
}

/**
 * WHY a standalone function rather than a method on SlackService: Slack's
 * request signing (https://api.slack.com/authentication/verifying-requests-from-slack)
 * is pure math over the raw body — keeping it free of Nest/DI makes the
 * timing-safe comparison and the replay window trivially testable without
 * booting anything. `@slack/web-api` and `@slack/socket-mode` don't export a
 * verifier (only `@slack/bolt` does, and Bolt's receiver model doesn't fit a
 * Nest controller), so this is the whole implementation.
 */
export function verifySlackSignature(input: SlackSignatureInput): boolean {
  const { signingSecret, timestamp, signature, rawBody } = input;
  if (!timestamp || !signature || rawBody === undefined) return false;

  const requestSeconds = Number(timestamp);
  if (!Number.isFinite(requestSeconds)) return false;

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - requestSeconds) > SLACK_SIGNATURE_MAX_AGE_SECONDS) return false;

  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
