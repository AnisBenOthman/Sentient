import { ConfigService } from '@nestjs/config';
import { AgentTool, GeminiToolCallOutcome } from './agent-tool.types';
import { LlmCallResult } from './llm-failure';
import { OpenAiCompatibleToolCallerService } from './openai-compatible-tool-caller.service';

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  return {
    get: () => ({
      downstreamTimeoutMs: 8_000,
      openRouterApiKey: 'or-test-key',
      openRouterApiUrl: 'https://openrouter.ai/api/v1',
      openRouterModel: 'openrouter/auto',
      groqApiKey: 'groq-test-key',
      groqApiUrl: 'https://api.groq.com/openai/v1',
      groqModel: 'llama-3.1-8b-instant',
      xaiApiKey: null,
      xaiApiUrl: 'https://api.x.ai/v1',
      xaiModel: 'grok-2-latest',
      ...overrides,
    }),
  } as unknown as ConfigService;
}

interface CapturedRequest {
  model: string;
  messages: Array<{ role: string; content?: string | null; tool_calls?: unknown[]; tool_call_id?: string }>;
  tools: unknown[];
  tool_choice: string;
}

function textResponse(content: string): unknown {
  return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }) };
}

function toolCallResponse(calls: Array<{ id: string; name: string; args: Record<string, unknown> }>): unknown {
  return {
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
      }],
    }),
  };
}

function simpleTool(name: string, run: (args: Record<string, unknown>) => Promise<unknown>): AgentTool {
  return { declaration: { name, description: `${name} test tool.` }, run };
}

describe('OpenAiCompatibleToolCallerService', () => {
  it('reports NOT_CONFIGURED when the provider has no API key', async () => {
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'GROK');

    const result = await service.call('prompt', 'question', [simpleTool('t', async () => ({}))]);

    expect(result).toEqual({
      ok: false,
      failure: { provider: 'GROK', reason: 'NOT_CONFIGURED', detail: expect.any(String) },
    });
    expect(service.isConfigured()).toBe(false);
  });

  it('reports configured and tags the outcome with its providerName', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => textResponse('Hello from OpenRouter.')) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'OPENROUTER');

    try {
      expect(service.isConfigured()).toBe(true);
      const result = await service.call('prompt', 'question', [simpleTool('t', async () => ({}))]);
      expect(expectOk(result).providerUsed).toBe('OPENROUTER');
      expect(expectOk(result).answer).toBe('Hello from OpenRouter.');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses Groq settings when providerName is GROQ', async () => {
    const originalFetch = global.fetch;
    let capturedUrl = '';
    const capturedRequests: CapturedRequest[] = [];
    global.fetch = (async (url: string, init?: { body?: unknown }) => {
      capturedUrl = url;
      capturedRequests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      return textResponse('Hello from Groq.');
    }) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'GROQ');

    try {
      expect(service.isConfigured()).toBe(true);
      const result = await service.call('prompt', 'question', [simpleTool('t', async () => ({}))]);

      expect(capturedUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(capturedRequests[0]?.model).toBe('llama-3.1-8b-instant');
      expect(expectOk(result).providerUsed).toBe('GROQ');
      expect(expectOk(result).answer).toBe('Hello from Groq.');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('round-trips a tool call using tool_calls/tool_call_id, not Gemini-style parts', async () => {
    const requests: CapturedRequest[] = [];
    let fetchCount = 0;
    let balanceRuns = 0;
    const originalFetch = global.fetch;
    global.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      requests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      fetchCount += 1;
      if (fetchCount === 1) {
        return toolCallResponse([{ id: 'call-1', name: 'get_my_leave_balance', args: {} }]);
      }
      return textResponse('You have 12 days left.');
    }) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'OPENROUTER');

    try {
      const result = await service.call('System prompt.', 'How many days?', [
        simpleTool('get_my_leave_balance', async () => {
          balanceRuns += 1;
          return { remaining: 12 };
        }),
      ]);

      expect(expectOk(result).answer).toBe('You have 12 days left.');
      expect(expectOk(result).toolsUsed).toEqual(['get_my_leave_balance']);
      expect(balanceRuns).toBe(1);

      const second = requests[1];
      if (!second) throw new Error('Expected a second request.');
      const toolMessage = second.messages.find((m) => m.role === 'tool');
      expect(toolMessage?.tool_call_id).toBe('call-1');
      expect(toolMessage?.content).toContain('"remaining":12');
      const firstRequest = requests[0];
      expect(firstRequest?.tool_choice).toBe('required');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('flags denied and failed tool results the same way the Gemini adapter does', async () => {
    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return toolCallResponse([{ id: 'call-1', name: 'get_team_leave_calendar', args: {} }]);
      }
      return textResponse('I could not access the team calendar with your permissions.');
    }) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'OPENROUTER');

    try {
      const result = await service.call('prompt', 'question', [
        simpleTool('get_team_leave_calendar', async () => ({ denied: true, reason: 'No team scope.' })),
      ]);

      expect(expectOk(result).anyToolDenied).toBe(true);
      expect(expectOk(result).anyToolFailed).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('forces a final text answer when tool rounds run out, mirroring tool_choice: none', async () => {
    const requests: CapturedRequest[] = [];
    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      requests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      fetchCount += 1;
      if (fetchCount <= 5) {
        return toolCallResponse([{ id: `call-${fetchCount}`, name: 'get_my_leave_balance', args: {} }]);
      }
      return textResponse('Final synthesis from gathered results.');
    }) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'OPENROUTER');

    try {
      const result = await service.call('prompt', 'question', [
        simpleTool('get_my_leave_balance', async () => ({ remaining: 12 })),
      ]);

      expect(expectOk(result).answer).toBe('Final synthesis from gathered results.');
      expect(fetchCount).toBe(6);
      expect(requests[5]?.tool_choice).toBe('none');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('silently ignores enableSearch and thinkingLevel instead of throwing', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => textResponse('Answer without grounding.')) as unknown as typeof fetch;
    const service = new OpenAiCompatibleToolCallerService(buildConfig(), 'OPENROUTER');

    try {
      const result = await service.call(
        'prompt',
        'question',
        [simpleTool('t', async () => ({}))],
        [],
        { enableSearch: true, thinkingLevel: 'high' },
      );
      expect(expectOk(result).answer).toBe('Answer without grounding.');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

/** Narrows a successful call result so assertions can read the outcome fields directly. */
function expectOk(result: LlmCallResult): GeminiToolCallOutcome {
  if (!result.ok) throw new Error(`Expected a successful LLM call, got ${result.failure.reason}`);
  return result.outcome;
}
