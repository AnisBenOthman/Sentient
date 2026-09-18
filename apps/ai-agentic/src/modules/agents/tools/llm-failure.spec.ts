import {
  LlmFailureSink,
  aggregateFailures,
  classifyHttpStatus,
  classifyThrownError,
  llmOutageNotice,
  llmUnavailableMessage,
  llmUnavailableSummary,
  redactProviderDetail,
} from './llm-failure';

describe('classifyHttpStatus', () => {
  it.each([
    [401, 'AUTH'],
    [403, 'AUTH'],
    [429, 'RATE_LIMITED'],
    [408, 'TIMEOUT'],
    [504, 'TIMEOUT'],
    [502, 'CONNECTION'],
    [503, 'CONNECTION'],
    [500, 'PROVIDER_ERROR'],
    [400, 'PROVIDER_ERROR'],
  ])('maps HTTP %s to %s', (status, expected) => {
    expect(classifyHttpStatus(status)).toBe(expected);
  });
});

describe('classifyThrownError', () => {
  it('reads an AbortController abort as a timeout, not a generic error', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    expect(classifyThrownError(abort).reason).toBe('TIMEOUT');
  });

  it.each([
    'fetch failed',
    'connect ECONNREFUSED 127.0.0.1:443',
    'getaddrinfo ENOTFOUND api.example.com',
    'socket hang up',
  ])('reads "%s" as a connection failure', (message) => {
    expect(classifyThrownError(new Error(message)).reason).toBe('CONNECTION');
  });

  it('prefers a status carried on the error object over message sniffing', () => {
    expect(classifyThrownError({ status: 429, message: 'fetch failed' }).reason).toBe('RATE_LIMITED');
  });

  it('reads a nested response status the way provider SDKs report it', () => {
    expect(classifyThrownError({ response: { status: 401 } }).reason).toBe('AUTH');
  });

  it('falls back to a provider error for anything it cannot place', () => {
    expect(classifyThrownError(new Error('something odd happened')).reason).toBe('PROVIDER_ERROR');
  });
});

describe('redactProviderDetail', () => {
  /**
   * WHY this matters: provider error bodies land in the logs AND in AgentTaskLog.
   * An upstream that echoes the Authorization header back would otherwise persist
   * a live API key in the audit trail.
   */
  it('strips bearer tokens and provider API keys', () => {
    const scrubbed = redactProviderDetail('401 Unauthorized: Bearer sk-abcd1234efgh5678 rejected');
    expect(scrubbed).not.toContain('sk-abcd1234efgh5678');
    expect(scrubbed).toContain('[redacted]');
  });

  it('strips api_key fields from JSON-ish bodies', () => {
    expect(redactProviderDetail('{"api_key":"gsk-supersecretvalue","error":"bad"}')).not.toContain('supersecretvalue');
  });

  it('truncates long bodies so one error cannot flood a log line', () => {
    expect(redactProviderDetail('x'.repeat(5_000)).length).toBeLessThanOrEqual(203);
  });
});

describe('LlmFailureSink', () => {
  it('keeps the first recorded cause — it is the one that ended the attempt', () => {
    const sink = new LlmFailureSink('GROQ');
    sink.record('RATE_LIMITED', 'first');
    sink.record('CONNECTION', 'second');
    expect(sink.result()).toEqual({ provider: 'GROQ', reason: 'RATE_LIMITED', detail: 'first' });
  });

  it('never returns an unclassified failure, even when nothing was recorded', () => {
    expect(new LlmFailureSink('GEMINI').result()).toEqual({
      provider: 'GEMINI',
      reason: 'PROVIDER_ERROR',
      detail: null,
    });
  });

  it('redacts credentials in whatever detail it is handed', () => {
    const sink = new LlmFailureSink('OPENROUTER');
    sink.recordHttp(401, 'Bearer sk-livekey12345678 is invalid');
    expect(sink.result().detail).not.toContain('sk-livekey12345678');
  });
});

describe('aggregateFailures', () => {
  it('reports NOT_CONFIGURED when no provider was even attempted', () => {
    expect(aggregateFailures([]).reason).toBe('NOT_CONFIGURED');
  });

  /**
   * WHY: with two providers unconfigured and one throttled, "try again in a
   * minute" is the useful advice — not "nothing is configured".
   */
  it('ranks an actionable rate limit above unconfigured providers', () => {
    const failure = aggregateFailures([
      { provider: 'GEMINI', reason: 'NOT_CONFIGURED', detail: null },
      { provider: 'OPENROUTER', reason: 'RATE_LIMITED', detail: null },
      { provider: 'GROQ', reason: 'NOT_CONFIGURED', detail: null },
    ]);
    expect(failure.reason).toBe('RATE_LIMITED');
  });

  it('keeps every attempt for the audit trail, not just the winning reason', () => {
    const failure = aggregateFailures([
      { provider: 'GEMINI', reason: 'TIMEOUT', detail: null },
      { provider: 'GROK', reason: 'AUTH', detail: null },
    ]);
    expect(failure.attempts).toHaveLength(2);
    expect(llmUnavailableSummary(failure)).toContain('GEMINI=TIMEOUT');
    expect(llmUnavailableSummary(failure)).toContain('GROK=AUTH');
  });
});

describe('llmUnavailableMessage', () => {
  /**
   * WHY every variant is asserted to mention that nothing changed: this
   * assistant can propose leave bookings, so a user who hits a failure must
   * never be left wondering whether a request went through anyway.
   */
  it.each(['NOT_CONFIGURED', 'AUTH', 'RATE_LIMITED', 'TIMEOUT', 'CONNECTION', 'PROVIDER_ERROR', 'EMPTY_RESPONSE'] as const)(
    'states that nothing was submitted for a %s failure',
    (reason) => {
      const message = llmUnavailableMessage({ reason, attempts: [], partialOutputEmitted: false });
      expect(message).toContain('Nothing in your Sentient records was changed or submitted.');
      expect(message).toContain('contact your HR admin');
    },
  );

  it('tells a retryable failure apart from one that needs an administrator', () => {
    const rateLimited = llmUnavailableMessage({ reason: 'RATE_LIMITED', attempts: [], partialOutputEmitted: false });
    const auth = llmUnavailableMessage({ reason: 'AUTH', attempts: [], partialOutputEmitted: false });
    expect(rateLimited).toContain('try again in a minute');
    expect(auth).toContain('administrator');
    expect(auth).not.toContain('try again in a minute');
  });

  it('says the answer was cut off when tokens had already reached the user', () => {
    const message = llmUnavailableMessage({ reason: 'CONNECTION', attempts: [], partialOutputEmitted: true });
    expect(message).toContain('stopped part-way');
  });

  it('never leaks provider names or internal diagnostics to the user', () => {
    const message = llmUnavailableMessage({
      reason: 'PROVIDER_ERROR',
      attempts: [{ provider: 'GROQ', reason: 'PROVIDER_ERROR', detail: 'HTTP 500: model xyz exploded' }],
      partialOutputEmitted: false,
    });
    expect(message).not.toContain('GROQ');
    expect(message).not.toContain('HTTP 500');
  });
});

describe('llmOutageNotice', () => {
  it('names the cause and warns the answer is reduced', () => {
    const notice = llmOutageNotice({ reason: 'RATE_LIMITED', attempts: [], partialOutputEmitted: false });
    expect(notice).toContain('over its request limit');
    expect(notice).toContain('straight from your Sentient records');
    expect(notice).toContain('less complete than usual');
  });
});
