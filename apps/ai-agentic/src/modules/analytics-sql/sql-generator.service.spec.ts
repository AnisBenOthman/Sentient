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

  // WHY assert the band labels and not just the column name: salary-by-age is
  // answerable only because v_compensation carries age_band, and the model can
  // only filter on it if the prompt states the exact literals ('45+', not '46+'
  // or 'over_45') and their boundaries. A column renamed or re-banded in the
  // view without updating ANALYTICS_VIEWS silently produces queries that match
  // no rows and read as "nobody is over 45".
  it('describes the age_band dimension and its literals to a compensation role', async () => {
    let body = '';
    global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
      body = String((init as { body?: unknown }).body ?? '');
      return jsonResponse('{"sql":"SELECT 1 FROM hr_analytics.v_employees","explanation":"x"}');
    }) as unknown as typeof fetch;

    const service = new SqlGeneratorService(configFor(['OPENROUTER']));

    await service.generate('average salary for people aged more than 45', ['EMPLOYEE']);
    expect(body).not.toContain('age_band');

    await service.generate('average salary for people aged more than 45', ['MANAGER']);
    expect(body).toContain('age_band');
    expect(body).toContain('45+');
    expect(body).toMatch(/45 and over/i);
  });
});
