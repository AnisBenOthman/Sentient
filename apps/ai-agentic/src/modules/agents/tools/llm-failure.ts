import { GeminiToolCallOutcome } from './agent-tool.types';

/**
 * WHY this module exists: every LLM adapter used to collapse every possible
 * failure — a missing API key, a 429, a dead socket, a 30s hang — into a bare
 * `null`. The orchestrator could not tell those apart, so neither could the
 * specialists, so the user was told nothing at all and the turn was recorded as
 * a SUCCESS. Classifying the cause once, here, is what makes an honest,
 * actionable failure answer possible further up the stack.
 */
export type LlmFailureReason =
  /** No provider in the rotation has the credentials it needs — an operator fix, not a retry. */
  | 'NOT_CONFIGURED'
  /** The provider rejected our credentials (401/403) — an operator fix, not a retry. */
  | 'AUTH'
  /** The provider throttled us (429) — worth retrying shortly. */
  | 'RATE_LIMITED'
  /** The provider accepted the request but did not answer in time. */
  | 'TIMEOUT'
  /** The provider could not be reached at all (DNS, refused, reset, 502/503). */
  | 'CONNECTION'
  /** The provider answered with an error status or an unusable body. */
  | 'PROVIDER_ERROR'
  /** The provider answered successfully but produced no usable text. */
  | 'EMPTY_RESPONSE';

/** One provider's attempt within a single turn. */
export interface LlmProviderFailure {
  provider: string;
  reason: LlmFailureReason;
  /** Short, credential-scrubbed diagnostic for the logs and the governance trail. Never shown verbatim to the user. */
  detail: string | null;
}

/** The whole rotation's verdict for one turn. */
export interface LlmUnavailable {
  /** The most actionable reason across every attempt — this is what shapes the user-facing message. */
  reason: LlmFailureReason;
  attempts: LlmProviderFailure[];
  /**
   * True when a provider had already streamed text to the client before it died.
   * The user has seen a half-written answer, so the failure message must say the
   * answer was cut off rather than pretend nothing was produced.
   */
  partialOutputEmitted: boolean;
}

/** A single provider's result. `ok: false` always carries a classified cause. */
export type LlmCallResult =
  | { ok: true; outcome: GeminiToolCallOutcome }
  | { ok: false; failure: LlmProviderFailure };

/** The orchestrator's result: on failure it carries every provider's classified cause. */
export type LlmTurnResult =
  | { ok: true; outcome: GeminiToolCallOutcome }
  | { ok: false; failure: LlmUnavailable };

/**
 * WHY ordered rather than "first failure wins": with three providers in the
 * rotation, two unconfigured and one rate-limited, the honest thing to tell the
 * user is "try again in a minute" — not "nothing is configured". The reason that
 * yields the most useful next step for the user ranks first; NOT_CONFIGURED ranks
 * last because it is only the real story when nothing else was even attempted.
 */
const REASON_PRIORITY: LlmFailureReason[] = [
  'RATE_LIMITED',
  'TIMEOUT',
  'CONNECTION',
  'AUTH',
  'PROVIDER_ERROR',
  'EMPTY_RESPONSE',
  'NOT_CONFIGURED',
];

const MAX_DETAIL_CHARS = 200;

/**
 * WHY scrub before storing: provider error bodies are echoed into logs and into
 * AgentTaskLog. An upstream that reflects the Authorization header back in its
 * error payload would otherwise persist a live API key in the audit trail.
 */
export function redactProviderDetail(raw: string): string {
  const scrubbed = raw
    .replace(/\bBearer\s+[\w.\-~+/]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(sk|gsk|xai|or)-[\w-]{8,}/gi, '[redacted-key]')
    .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*"?)[^"',\s}]+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return scrubbed.length > MAX_DETAIL_CHARS ? `${scrubbed.slice(0, MAX_DETAIL_CHARS)}...` : scrubbed;
}

export function classifyHttpStatus(status: number): LlmFailureReason {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status === 502 || status === 503) return 'CONNECTION';
  return 'PROVIDER_ERROR';
}

const TIMEOUT_HINTS = ['abort', 'timeout', 'timed out', 'etimedout', 'deadline'];
const CONNECTION_HINTS = [
  'econnrefused', 'econnreset', 'enotfound', 'eai_again', 'epipe', 'ehostunreach',
  'enetunreach', 'fetch failed', 'socket hang up', 'network', 'getaddrinfo',
];

/**
 * Classifies anything an adapter's try/catch can see: a DOMException from an
 * AbortController, a Node fetch TypeError wrapping a socket error, or a provider
 * SDK error object carrying its own HTTP status.
 */
export function classifyThrownError(err: unknown): { reason: LlmFailureReason; detail: string | null } {
  const status = extractStatus(err);
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';
  const detail = redactProviderDetail(message) || null;

  if (status !== null) return { reason: classifyHttpStatus(status), detail };

  const haystack = `${err instanceof Error ? err.name : ''} ${message}`.toLowerCase();
  if (TIMEOUT_HINTS.some((hint) => haystack.includes(hint))) return { reason: 'TIMEOUT', detail };
  if (CONNECTION_HINTS.some((hint) => haystack.includes(hint))) return { reason: 'CONNECTION', detail };
  return { reason: 'PROVIDER_ERROR', detail };
}

function extractStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const record = err as Record<string, unknown>;
  const direct = record['status'] ?? record['statusCode'] ?? record['code'];
  if (typeof direct === 'number' && direct >= 100 && direct <= 599) return direct;
  const response = record['response'];
  if (typeof response === 'object' && response !== null) {
    const nested = (response as Record<string, unknown>)['status'];
    if (typeof nested === 'number' && nested >= 100 && nested <= 599) return nested;
  }
  return null;
}

/**
 * Collects the classified cause of one provider's attempt.
 *
 * WHY a sink rather than threading a union through every private helper: the
 * innermost HTTP helpers legitimately return `null` for "no usable response";
 * the sink lets each of those sites name its cause without rewriting the whole
 * call graph's return types. One sink is created per public call, so concurrent
 * turns never share one.
 */
export class LlmFailureSink {
  private failure: LlmProviderFailure | null = null;

  constructor(private readonly provider: string) {}

  /** First cause wins: it is the one that actually ended the attempt. */
  record(reason: LlmFailureReason, detail?: string | null): void {
    if (this.failure) return;
    this.failure = {
      provider: this.provider,
      reason,
      detail: detail != null && detail !== '' ? redactProviderDetail(detail) : null,
    };
  }

  recordThrown(err: unknown): void {
    const { reason, detail } = classifyThrownError(err);
    this.record(reason, detail);
  }

  recordHttp(status: number, body?: string): void {
    this.record(classifyHttpStatus(status), `HTTP ${status}${body ? `: ${body}` : ''}`);
  }

  /** WHY a PROVIDER_ERROR default: an attempt that ended without naming a cause still failed. */
  result(): LlmProviderFailure {
    return this.failure ?? { provider: this.provider, reason: 'PROVIDER_ERROR', detail: null };
  }
}

export function aggregateFailures(
  attempts: LlmProviderFailure[],
  partialOutputEmitted = false,
): LlmUnavailable {
  if (attempts.length === 0) {
    return { reason: 'NOT_CONFIGURED', attempts, partialOutputEmitted };
  }
  const reason =
    REASON_PRIORITY.find((candidate) => attempts.some((attempt) => attempt.reason === candidate)) ??
    'PROVIDER_ERROR';
  return { reason, attempts, partialOutputEmitted };
}

/**
 * WHY every message names a next step and states that nothing was changed: this
 * assistant can propose leave bookings. A user who sees a failure mid-booking
 * must never be left wondering whether a request went through anyway.
 */
const USER_MESSAGES: Record<LlmFailureReason, string> = {
  NOT_CONFIGURED:
    'The AI assistant is not connected to a language model in this environment, so I cannot generate an answer. Please ask your Sentient administrator to configure an AI provider.',
  AUTH:
    'I cannot sign in to the AI service right now, so I cannot generate an answer. This needs a Sentient administrator to check the AI provider credentials.',
  RATE_LIMITED:
    'The AI service is over its request limit at the moment, so I could not generate an answer. Please try again in a minute.',
  TIMEOUT:
    'The AI service did not respond in time, so I stopped waiting rather than leave you without an answer. Please try again.',
  CONNECTION:
    'I cannot reach the AI service right now — this looks like a connection problem on my side, not something you did. Please try again in a moment.',
  PROVIDER_ERROR:
    'The AI service returned an error instead of an answer. Please try again, or rephrase your question.',
  EMPTY_RESPONSE:
    'The AI service accepted the request but produced no answer. Please try again, or rephrase your question.',
};

const NOTHING_CHANGED = 'Nothing in your Sentient records was changed or submitted.';
const PERSISTENT_HINT = 'If this keeps happening, contact your HR admin.';

/** The full user-facing message for a turn that produced nothing at all. */
export function llmUnavailableMessage(failure: LlmUnavailable): string {
  const opener = failure.partialOutputEmitted
    ? 'My answer stopped part-way through because the AI service became unavailable.'
    : USER_MESSAGES[failure.reason];
  return `${opener} ${NOTHING_CHANGED} ${PERSISTENT_HINT}`;
}

/**
 * The banner prefixed to a deterministic answer that WAS produced from Sentient
 * records while the LLM was down. The user gets the real data and an explicit
 * statement of what is missing — never a degraded answer dressed up as a full one.
 */
export function llmOutageNotice(failure: LlmUnavailable): string {
  const cause = failure.partialOutputEmitted
    ? 'the AI service became unavailable mid-answer'
    : SHORT_CAUSES[failure.reason];
  return `Heads-up: ${cause}, so this answer comes straight from your Sentient records without AI assistance. It may be less complete than usual.`;
}

const SHORT_CAUSES: Record<LlmFailureReason, string> = {
  NOT_CONFIGURED: 'no AI provider is configured in this environment',
  AUTH: 'the AI service rejected our credentials',
  RATE_LIMITED: 'the AI service is over its request limit',
  TIMEOUT: 'the AI service did not respond in time',
  CONNECTION: 'the AI service cannot be reached',
  PROVIDER_ERROR: 'the AI service returned an error',
  EMPTY_RESPONSE: 'the AI service produced no answer',
};

/** One line for AgentTaskLog and the routing trace — diagnostic, not user-facing. */
export function llmUnavailableSummary(failure: LlmUnavailable): string {
  const tried = failure.attempts.length > 0
    ? failure.attempts.map((attempt) => `${attempt.provider}=${attempt.reason}`).join(', ')
    : 'no provider configured';
  return `LLM unavailable (${failure.reason}); providers tried: ${tried}.`;
}
