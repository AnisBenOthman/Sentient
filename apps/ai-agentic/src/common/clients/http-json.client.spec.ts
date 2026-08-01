import { ConfigService } from '@nestjs/config';
import { DownstreamRequestContext } from './downstream-client.types';
import { HttpJsonClient } from './http-json.client';

/**
 * WHY these tests live here rather than under test/contracts/: this app's
 * `test/contracts/*.contract-spec.ts` convention verifies AI Agentic's OWN
 * inbound API shape (see conversations.contract-spec.ts), not outbound calls
 * to HR Core. FR-007's non-2xx/timeout/network-failure classification is
 * HttpJsonClient's own behavior, so it belongs in a co-located spec —
 * matching every other client file in this directory.
 */
describe('HttpJsonClient.post', () => {
  const context: DownstreamRequestContext = { jwt: 'jwt-token', correlationId: 'corr-1' };
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function buildClient(timeoutMs = 8_000): HttpJsonClient {
    const config = { get: () => timeoutMs } as unknown as ConfigService;
    return new HttpJsonClient(config);
  }

  it('classifies a 201 as SUCCESS and returns the parsed body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'lr-1', status: 'PENDING' }),
    }) as unknown as typeof fetch;

    const result = await buildClient().post<{ id: string; status: string }>(
      'http://hr-core.local',
      '/leave-requests',
      { leaveTypeId: 'lt-1', startDate: '2026-08-01', endDate: '2026-08-03' },
      context,
      'Leave request submission',
    );

    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.httpStatus).toBe(201);
      expect(result.data).toEqual({ id: 'lr-1', status: 'PENDING' });
    }
  });

  it('sends the JWT, correlation id, and JSON body on the request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'lr-1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await buildClient().post(
      'http://hr-core.local',
      '/leave-requests',
      { leaveTypeId: 'lt-1' },
      context,
      'Leave request submission',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://hr-core.local/leave-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ leaveTypeId: 'lt-1' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token',
          'Content-Type': 'application/json',
          'x-correlation-id': 'corr-1',
        }),
      }),
    );
  });

  it('classifies a 400 with a machine-readable message as FAILED with that exact reason (FR-010)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ statusCode: 400, message: 'InsufficientBalance', error: 'Bad Request' }),
    }) as unknown as typeof fetch;

    const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.httpStatus).toBe(400);
      expect(result.reason).toBe('InsufficientBalance');
    }
  });

  it('joins a class-validator array message into one readable reason', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ statusCode: 400, message: ['leaveTypeId must be a UUID', 'startDate must be a date'] }),
    }) as unknown as typeof fetch;

    const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.reason).toBe('leaveTypeId must be a UUID; startDate must be a date');
    }
  });

  it('classifies a 403 as FAILED with a generic reason when the body carries no message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '',
    }) as unknown as typeof fetch;

    const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.httpStatus).toBe(403);
      expect(result.reason).toBe('Leave request submission returned HTTP 403.');
    }
  });

  it('classifies a 500 as FAILED, never as SUCCESS', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
    }) as unknown as typeof fetch;

    const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.httpStatus).toBe(500);
      expect(result.reason).toBe('Internal server error');
    }
  });

  it('classifies a timeout as FAILED with a null httpStatus (FR-007)', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    }) as unknown as typeof fetch;

    const result = await buildClient(50).post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.httpStatus).toBeNull();
      expect(result.reason).toBe('Leave request submission timed out.');
    }
  });

  it('classifies a connection failure as FAILED with a null httpStatus, distinct from a timeout', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;

    const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.httpStatus).toBeNull();
      expect(result.reason).toBe('Leave request submission could not be reached.');
    }
  });

  it('never reports SUCCESS unless the downstream response was ok (FR-007)', async () => {
    for (const status of [400, 401, 403, 404, 409, 422, 500, 502, 503]) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => '',
      }) as unknown as typeof fetch;

      const result = await buildClient().post('http://hr-core.local', '/leave-requests', {}, context, 'Leave request submission');
      expect(result.status).toBe('FAILED');
    }
  });
});
