import { mapUpstreamBodyError, mapUpstreamFailure } from './upstream-error.mapper';

describe('upstream-error.mapper', () => {
  it('preserves conforming envelopes', () => {
    const mapped = mapUpstreamBodyError(
      409,
      Buffer.from(JSON.stringify({ code: 'Conflict', message: 'Already exists', correlationId: 'upstream' })),
      'application/json',
      'gateway',
    );

    expect(mapped.body).toEqual({ code: 'Conflict', message: 'Already exists', correlationId: 'upstream' });
  });

  it('wraps non-conforming JSON bodies', () => {
    const mapped = mapUpstreamBodyError(400, Buffer.from(JSON.stringify({ message: 'Bad value' })), 'application/json', 'c');

    expect(mapped.body).toMatchObject({ code: 'UpstreamHttp400', message: 'Bad value', correlationId: 'c' });
  });

  it('maps connection failures to 502', () => {
    const error = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
    const mapped = mapUpstreamFailure(error, 'c');

    expect(mapped.statusCode).toBe(502);
    expect(mapped.body).toMatchObject({ code: 'UpstreamUnavailable', correlationId: 'c' });
  });

  it('maps timeouts to 504', () => {
    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const mapped = mapUpstreamFailure(error, 'c');

    expect(mapped.statusCode).toBe(504);
    expect(mapped.body).toMatchObject({ code: 'UpstreamTimeout', correlationId: 'c' });
  });
});
