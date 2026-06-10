import { ConfigService } from '@nestjs/config';
import { GeminiIntentClassifierService } from './gemini-intent-classifier.service';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

describe('GeminiIntentClassifierService', () => {
  it('falls back to the rule-based classifier when Gemini is not configured', async () => {
    const config = {
      get: () => ({
        geminiApiKey: null,
      }),
    } as unknown as ConfigService;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    const result = await service.classify('hello');

    expect(result.source).toBe('rules');
    expect(result.isGreeting).toBe(true);
    expect(result.requiresClarification).toBe(false);
  });

  it('handles known greetings deterministically before calling Gemini', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiModel: 'gemini-2.5-flash-lite',
        intentClassifierTimeoutMs: 3000,
      }),
    } as unknown as ConfigService;
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = (() => {
      fetchCalled = true;
      throw new Error('Greeting test should not call Gemini.');
    }) as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify("haw're you ?");

      expect(result.source).toBe('rules');
      expect(result.isGreeting).toBe(true);
      expect(result.requiresClarification).toBe(false);
      expect(fetchCalled).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
