import { ConfigService } from '@nestjs/config';
import { SqlGeneratorService } from './sql-generator.service';

const originalFetch = global.fetch;

function configFor(providerOrder: string[]): ConfigService {
  return {
    get: () => ({
      // No Gemini key: the SDK path is skipped so these tests exercise the
      // OpenAI-compatible fallback chain deterministically.
      geminiApiKey: null,
      geminiModel: 'gemini-2.5-flash',
      analyticsSqlTimeoutMs: 5000,
      llmProviderOrder: providerOrder,
      openRouterApiKey: 'or-key',
      openRouterApiUrl: 'https://openrouter.test/api/v1',
      openRouterModel: 'model-a',
      groqApiKey: 'groq-key',
      groqApiUrl: 'https://groq.test/openai/v1',
      groqModel: 'model-b',
      xaiApiKey: null,
      xaiApiUrl: 'https://xai.test/v1',
      xaiModel: 'grok',
    }),
  } as unknown as ConfigService;
}

function jsonResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, text: async () => 'upstream failure' } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('SqlGeneratorService', () => {
  it('returns the generated statement and explanation', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"Headcount."}'),
    ) as unknown as typeof fetch;

    const generated = await new SqlGeneratorService(configFor(['OPENROUTER'])).generate('headcount', ['HR_ADMIN']);

    expect(generated?.sql).toBe('SELECT 1 FROM hr_analytics.v_employees');
    expect(generated?.explanation).toBe('Headcount.');
    expect(generated?.source).toBe('openrouter');
  });

  // WHY: several free models ignore "Return JSON only" and wrap output in markdown
  // fences. response_format json_object would fix it but those models 400 on it.
  it('parses a markdown-fenced payload', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse('```json\n{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}\n```'),
    ) as unknown as typeof fetch;

    const generated = await new SqlGeneratorService(configFor(['OPENROUTER'])).generate('headcount', ['HR_ADMIN']);

    expect(generated?.sql).toBe('SELECT 1 FROM hr_analytics.v_employees');
  });

  it('falls through to the next provider when the first fails', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: unknown) => {
      calls.push(String(url));
      if (String(url).includes('openrouter')) return errorResponse(429);
      return jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}');
    }) as unknown as typeof fetch;

    const generated = await new SqlGeneratorService(configFor(['OPENROUTER', 'GROQ'])).generate('headcount', [
      'HR_ADMIN',
    ]);

    expect(calls).toHaveLength(2);
    expect(generated?.source).toBe('groq');
  });

  it('returns null when every provider fails', async () => {
    global.fetch = jest.fn(async () => errorResponse(500)) as unknown as typeof fetch;

    const generated = await new SqlGeneratorService(configFor(['OPENROUTER', 'GROQ'])).generate('headcount', [
      'HR_ADMIN',
    ]);

    expect(generated).toBeNull();
  });

  // The payload is LLM output, so every field is treated as untrusted.
  it.each([
    '{"explanation":"no sql field"}',
    '{"sql":"","explanation":"empty"}',
    '{"sql":123,"explanation":"wrong type"}',
  ])('returns null for the unusable payload %s', async (content) => {
    global.fetch = jest.fn(async () => jsonResponse(content)) as unknown as typeof fetch;

    const generated = await new SqlGeneratorService(configFor(['OPENROUTER'])).generate('headcount', ['HR_ADMIN']);

    expect(generated).toBeNull();
  });

  it('omits compensation from the prompt for a role without access', async () => {
    let body = '';
    global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
      body = String((init as { body?: unknown }).body ?? '');
      return jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}');
    }) as unknown as typeof fetch;

    const service = new SqlGeneratorService(configFor(['OPENROUTER']));

    await service.generate('headcount', ['EMPLOYEE']);
    expect(body).not.toContain('v_compensation');

    await service.generate('headcount', ['MANAGER']);
    expect(body).toContain('v_compensation');
  });

  it('includes the age-band view for a role with compensation access, omits it for one without', async () => {
    let body = '';
    global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
      body = String((init as { body?: unknown }).body ?? '');
      return jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}');
    }) as unknown as typeof fetch;

    const service = new SqlGeneratorService(configFor(['OPENROUTER']));

    await service.generate('average salary by age', ['EMPLOYEE']);
    expect(body).not.toContain('v_compensation_by_age_band');

    await service.generate('average salary by age', ['MANAGER']);
    expect(body).toContain('v_compensation_by_age_band');
  });

  it('tells the generator to use v_compensation_by_age_band instead of joining v_compensation to v_employees', async () => {
    let body = '';
    global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
      body = String((init as { body?: unknown }).body ?? '');
      return jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}');
    }) as unknown as typeof fetch;

    await new SqlGeneratorService(configFor(['OPENROUTER'])).generate('average salary by age', ['MANAGER']);

    expect(body).toContain('v_compensation_by_age_band');
    expect(body).toMatch(/share no employee identifier/i);
  });
});
