import { createHmac } from 'crypto';
import { SLACK_SIGNATURE_MAX_AGE_SECONDS, verifySlackSignature } from './slack-signature.util';

const SECRET = 'test-signing-secret';
const NOW_MS = 1_700_000_000_000;

function sign(timestamp: string, rawBody: string, secret = SECRET): string {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
}

describe('verifySlackSignature', () => {
  const timestamp = String(Math.floor(NOW_MS / 1000));
  const rawBody = '{"type":"event_callback","event":{"type":"message"}}';

  it('accepts a signature computed over the exact raw body with the shared secret', () => {
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp, signature: sign(timestamp, rawBody), rawBody, now: NOW_MS }),
    ).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp,
        signature: sign(timestamp, rawBody, 'other-secret'),
        rawBody,
        now: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects when the body was altered after signing', () => {
    expect(
      verifySlackSignature({
        signingSecret: SECRET,
        timestamp,
        signature: sign(timestamp, rawBody),
        rawBody: `${rawBody} `,
        now: NOW_MS,
      }),
    ).toBe(false);
  });

  it('rejects a replay older than the allowed window even with a valid signature', () => {
    const stale = String(Math.floor(NOW_MS / 1000) - SLACK_SIGNATURE_MAX_AGE_SECONDS - 1);
    expect(
      verifySlackSignature({ signingSecret: SECRET, timestamp: stale, signature: sign(stale, rawBody), rawBody, now: NOW_MS }),
    ).toBe(false);
  });

  it('rejects missing headers or a missing raw body without throwing', () => {
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp: undefined, signature: 'v0=x', rawBody, now: NOW_MS })).toBe(false);
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp, signature: undefined, rawBody, now: NOW_MS })).toBe(false);
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp, signature: 'v0=x', rawBody: undefined, now: NOW_MS })).toBe(false);
    expect(verifySlackSignature({ signingSecret: SECRET, timestamp: 'not-a-number', signature: 'v0=x', rawBody, now: NOW_MS })).toBe(false);
  });
});
