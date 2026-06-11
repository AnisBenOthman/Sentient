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

  it('treats a missing Gemini confidence as zero so routing can ask for clarification', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiModel: 'gemini-2.5-flash-lite',
        intentClassifierTimeoutMs: 3000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    requiredAgents: ['LEAVE_AGENT'],
                    requiresClarification: false,
                    isDraftIntent: false,
                    isHumanEscalationIntent: false,
                    isGreeting: false,
                  }),
                },
              ],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('Check the leave thing');

      expect(result.source).toBe('gemini');
      expect(result.confidence).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('passes conversation context lines into the Gemini prompt', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiModel: 'gemini-2.5-flash-lite',
        intentClassifierTimeoutMs: 3000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    const originalFetch = global.fetch;
    let capturedBody = '';
    global.fetch = (async (_url: string, init?: { body?: string }) => {
      capturedBody = init?.body ?? '';
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      requiredAgents: ['LEAVE_AGENT'],
                      requiresClarification: false,
                      isDraftIntent: false,
                      isHumanEscalationIntent: false,
                      isGreeting: false,
                      confidence: 0.8,
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('And what about last year?', {
        recentMessages: [
          { id: 'message-1', role: 'USER', content: 'What is my leave balance?' },
          { id: 'message-2', role: 'ASSISTANT', content: 'You have 15 days remaining.' },
        ],
        priorHandoffAgents: ['LEAVE_AGENT'],
      });

      expect(result.requiredAgents).toEqual(['LEAVE_AGENT']);
      expect(capturedBody).toContain('Recent conversation');
      expect(capturedBody).toContain('What is my leave balance?');
      expect(capturedBody).toContain('Previously consulted specialists: LEAVE_AGENT');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
