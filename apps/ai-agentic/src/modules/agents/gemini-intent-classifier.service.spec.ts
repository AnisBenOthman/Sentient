import { ConfigService } from '@nestjs/config';
import { AgentType } from '../../generated/prisma';
import { GeminiIntentClassifierService } from './gemini-intent-classifier.service';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

const mockGenerateContent = jest.fn();

// Gemini uses the @google/genai SDK — mock it so no real HTTP calls are made.
// OpenRouter still uses raw fetch and is mocked per-test via global.fetch.
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('GeminiIntentClassifierService', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

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

  it('handles known French greetings deterministically before calling Gemini', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiModel: 'gemini-2.5-flash',
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
      const result = await service.classify('bonjour');

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
        geminiModel: 'gemini-2.5-flash',
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        requiredAgents: ['LEAVE_AGENT'],
        requiresClarification: false,
        isDraftIntent: false,
        isHumanEscalationIntent: false,
        isGreeting: false,
        // confidence intentionally omitted — should default to 0
      }),
    });
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    const result = await service.classify('Check the leave thing');

    expect(result.source).toBe('gemini');
    expect(result.confidence).toBe(0);
  });

  it('passes conversation context lines into the Gemini prompt', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiModel: 'gemini-2.5-flash',
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        requiredAgents: ['LEAVE_AGENT'],
        requiresClarification: false,
        isDraftIntent: false,
        isHumanEscalationIntent: false,
        isGreeting: false,
        confidence: 0.8,
      }),
    });
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    const result = await service.classify('And what about last year?', {
      recentMessages: [
        { id: 'message-1', role: 'USER', content: 'What is my leave balance?' },
        { id: 'message-2', role: 'ASSISTANT', content: 'You have 15 days remaining.' },
      ],
      priorHandoffAgents: ['LEAVE_AGENT'],
    });

    expect(result.requiredAgents).toEqual(['LEAVE_AGENT']);
    // Prompt rides in the SDK call's contents arg
    const capturedContents: string = mockGenerateContent.mock.calls[0]?.[0]?.contents ?? '';
    expect(capturedContents).toContain('Recent conversation');
    expect(capturedContents).toContain('What is my leave balance?');
    expect(capturedContents).toContain('Previously consulted specialists: LEAVE_AGENT');
  });

  it('falls back to OpenRouter for intent classification when Gemini fails', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'bad-gemini-key',
        geminiModel: 'gemini-2.5-flash',
        openRouterApiKey: 'openrouter-key',
        openRouterApiUrl: 'https://openrouter.ai/api/v1',
        openRouterModel: 'google/gemma-4-31b:free',
        llmProviderOrder: ['GEMINI', 'OPENROUTER'],
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    // Gemini (SDK) throws — simulates 403
    mockGenerateContent.mockRejectedValueOnce(new Error('Gemini intent classifier failed with 403'));

    const originalFetch = global.fetch;
    const urls: string[] = [];
    global.fetch = (async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                requiredAgents: ['LEAVE_AGENT'],
                requiresClarification: false,
                isDraftIntent: false,
                isHumanEscalationIntent: false,
                isGreeting: false,
                confidence: 0.82,
              }),
            },
          }],
        }),
      };
    }) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('How much leave do I have left?');

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(urls.some((url) => url.includes('openrouter.ai/api/v1/chat/completions'))).toBe(true);
      expect(result.source).toBe('openrouter');
      expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
      expect(result.confidence).toBe(0.82);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses OpenRouter directly when selected as the intent provider', async () => {
    const config = {
      get: () => ({
        intentClassifierProvider: 'openrouter',
        geminiApiKey: 'gemini-key-that-should-not-be-used',
        geminiModel: 'gemini-2.5-flash',
        openRouterApiKey: 'openrouter-key',
        openRouterApiUrl: 'https://openrouter.ai/api/v1',
        openRouterModel: 'cohere/north-mini-code:free',
        llmProviderOrder: ['GEMINI'],
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;

    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              requiredAgents: ['LEAVE_AGENT'],
              requiresClarification: false,
              isDraftIntent: false,
              isHumanEscalationIntent: false,
              isGreeting: false,
              confidence: 0.76,
            }),
          },
        }],
      }),
    })) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('How much leave do I have left?');

      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(result.source).toBe('openrouter');
      expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
      expect(result.confidence).toBe(0.76);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses Groq directly when selected as the intent provider', async () => {
    const config = {
      get: () => ({
        intentClassifierProvider: 'groq',
        geminiApiKey: 'gemini-key-that-should-not-be-used',
        geminiModel: 'gemini-2.5-flash',
        groqApiKey: 'groq-key',
        groqApiUrl: 'https://api.groq.com/openai/v1',
        groqModel: 'llama-3.1-8b-instant',
        llmProviderOrder: ['OPENROUTER'],
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;

    const originalFetch = global.fetch;
    const urls: string[] = [];
    global.fetch = (async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                requiredAgents: ['GENERAL_HELP_AGENT'],
                requiresClarification: false,
                isDraftIntent: false,
                isHumanEscalationIntent: false,
                isGreeting: false,
                confidence: 0.79,
              }),
            },
          }],
        }),
      };
    }) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('Where can I find the handbook?');

      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(urls).toEqual(['https://api.groq.com/openai/v1/chat/completions']);
      expect(result.source).toBe('groq');
      expect(result.requiredAgents).toEqual([AgentType.GENERAL_HELP_AGENT]);
      expect(result.confidence).toBe(0.79);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back to OpenRouter when Groq is selected but not configured', async () => {
    const config = {
      get: () => ({
        intentClassifierProvider: 'groq',
        geminiApiKey: 'gemini-key-that-should-not-be-used',
        geminiModel: 'gemini-2.5-flash',
        groqApiKey: null,
        groqApiUrl: 'https://api.groq.com/openai/v1',
        groqModel: 'llama-3.1-8b-instant',
        openRouterApiKey: 'openrouter-key',
        openRouterApiUrl: 'https://openrouter.ai/api/v1',
        openRouterModel: 'google/gemini-2.5-flash-lite',
        llmProviderOrder: ['GROQ', 'OPENROUTER'],
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;

    const originalFetch = global.fetch;
    const urls: string[] = [];
    global.fetch = (async (url: string) => {
      urls.push(url);
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                requiredAgents: ['GENERAL_HELP_AGENT'],
                requiresClarification: false,
                isDraftIntent: false,
                isHumanEscalationIntent: false,
                isGreeting: false,
                confidence: 0.77,
              }),
            },
          }],
        }),
      };
    }) as unknown as typeof fetch;
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    try {
      const result = await service.classify('Where can I find the handbook?');

      expect(urls).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
      expect(result.source).toBe('openrouter');
      expect(result.confidence).toBe(0.77);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('keeps holiday calendar prompts on the Leave Agent when Gemini returns general help', async () => {
    const config = {
      get: () => ({
        geminiApiKey: 'test-key',
        geminiModel: 'gemini-2.5-flash',
        intentClassifierTimeoutMs: 5000,
        intentClassifierDebugLogs: false,
      }),
    } as unknown as ConfigService;
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        requiredAgents: ['GENERAL_HELP_AGENT'],
        requiresClarification: false,
        isDraftIntent: false,
        isHumanEscalationIntent: false,
        isGreeting: false,
        confidence: 0.9,
      }),
    });
    const service = new GeminiIntentClassifierService(config, new SupervisorIntentClassifierService());

    const result = await service.classify('bank holidays in my country');

    expect(result.source).toBe('gemini');
    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
    expect(result.confidence).toBe(0.9);
  });
});
