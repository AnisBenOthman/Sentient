import { ConfigService } from '@nestjs/config';
import { AgentTool, ConversationHistoryMessage, GeminiCallOptions, GeminiToolCallOutcome } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';
import { LlmToolCallerAdapter } from './llm-tool-caller.interface';
import { LlmFallbackOrchestratorService } from './llm-fallback-orchestrator.service';

jest.mock('@google/genai', () => ({
  FunctionCallingConfigMode: { ANY: 'ANY', AUTO: 'AUTO', NONE: 'NONE' },
  GoogleGenAI: jest.fn(),
}));

function buildConfig(order: string[] = ['GEMINI', 'OPENROUTER', 'GROQ', 'GROK']): ConfigService {
  return { get: () => ({ llmProviderOrder: order }) } as unknown as ConfigService;
}

interface FakeAdapterOptions {
  isConfigured?: boolean;
  call: (
    systemPrompt: string,
    userMessage: string,
    tools: AgentTool[],
    history?: ConversationHistoryMessage[],
    options?: GeminiCallOptions,
  ) => Promise<GeminiToolCallOutcome | null>;
}

function fakeAdapter(providerName: string, opts: FakeAdapterOptions): LlmToolCallerAdapter & { calls: number } {
  const adapter = {
    providerName,
    calls: 0,
    isConfigured: () => opts.isConfigured ?? true,
    call: async (
      systemPrompt: string,
      userMessage: string,
      tools: AgentTool[],
      history?: ConversationHistoryMessage[],
      options?: GeminiCallOptions,
    ) => {
      adapter.calls += 1;
      return opts.call(systemPrompt, userMessage, tools, history, options);
    },
  };
  return adapter;
}

function outcome(overrides: Partial<GeminiToolCallOutcome> = {}): GeminiToolCallOutcome {
  return {
    answer: 'answer',
    anyToolDenied: false,
    anyToolFailed: false,
    toolsUsed: [],
    providerUsed: 'GEMINI',
    ...overrides,
  };
}

const tools: AgentTool[] = [{ declaration: { name: 't', description: 'test tool.' }, run: async () => ({}) }];

describe('LlmFallbackOrchestratorService', () => {
  it('never calls the second provider when the primary answers, even with a refusal-shaped answer', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => outcome({ answer: 'I cannot help with that.' }) });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => outcome({ providerUsed: 'OPENROUTER' }) });
    const groq = fakeAdapter('GROQ', { call: async () => outcome({ providerUsed: 'GROQ' }) });
    const grok = fakeAdapter('GROK', { call: async () => outcome({ providerUsed: 'GROK' }) });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result?.answer).toBe('I cannot help with that.');
    expect(result?.usedFallbackProvider).toBe(false);
    expect(openRouter.calls).toBe(0);
    expect(groq.calls).toBe(0);
    expect(grok.calls).toBe(0);
  });

  it('tries the next provider with the same original args when the primary returns null (infra failure)', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => null });
    const received: unknown[][] = [];
    const openRouter = fakeAdapter('OPENROUTER', {
      call: async (...args) => {
        received.push(args);
        return outcome({ providerUsed: 'OPENROUTER' });
      },
    });
    const groq = fakeAdapter('GROQ', { call: async () => outcome({ providerUsed: 'GROQ' }) });
    const grok = fakeAdapter('GROK', { call: async () => outcome({ providerUsed: 'GROK' }) });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system prompt', 'user message', tools, [], { thinkingLevel: 'high' });

    expect(result?.providerUsed).toBe('OPENROUTER');
    expect(result?.usedFallbackProvider).toBe(true);
    expect(received.length).toBe(1);
    expect(received[0]?.[0]).toBe('system prompt');
    expect(received[0]?.[1]).toBe('user message');
    expect(groq.calls).toBe(0);
    expect(grok.calls).toBe(0);
  });

  it('skips an unconfigured provider entirely and tries the next one first', async () => {
    const gemini = fakeAdapter('GEMINI', { isConfigured: false, call: async () => outcome() });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => outcome({ providerUsed: 'OPENROUTER' }) });
    const groq = fakeAdapter('GROQ', { call: async () => outcome({ providerUsed: 'GROQ' }) });
    const grok = fakeAdapter('GROK', { call: async () => outcome({ providerUsed: 'GROK' }) });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(gemini.calls).toBe(0);
    expect(result?.providerUsed).toBe('OPENROUTER');
  });

  it('returns null when every provider fails for an infrastructure reason', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => null });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => null });
    const groq = fakeAdapter('GROQ', { call: async () => null });
    const grok = fakeAdapter('GROK', { call: async () => null });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result).toBe(null);
  });

  it('only tries providers present in AI_AGENT_LLM_PROVIDER_ORDER', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => null });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => outcome({ providerUsed: 'OPENROUTER' }) });
    const groq = fakeAdapter('GROQ', { call: async () => outcome({ providerUsed: 'GROQ' }) });
    const grok = fakeAdapter('GROK', { call: async () => outcome({ providerUsed: 'GROK' }) });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(['GEMINI']),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result).toBe(null);
    expect(openRouter.calls).toBe(0);
    expect(groq.calls).toBe(0);
    expect(grok.calls).toBe(0);
  });

  it('can route directly to Groq when GROQ is first in provider order', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => outcome() });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => outcome({ providerUsed: 'OPENROUTER' }) });
    const groq = fakeAdapter('GROQ', { call: async () => outcome({ providerUsed: 'GROQ' }) });
    const grok = fakeAdapter('GROK', { call: async () => outcome({ providerUsed: 'GROK' }) });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(['GROQ', 'OPENROUTER']),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result?.providerUsed).toBe('GROQ');
    expect(groq.calls).toBe(1);
    expect(openRouter.calls).toBe(0);
    expect(gemini.calls).toBe(0);
  });
});
