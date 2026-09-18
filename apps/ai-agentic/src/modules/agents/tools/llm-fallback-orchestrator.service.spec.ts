import { ConfigService } from '@nestjs/config';
import { AgentTool, ConversationHistoryMessage, GeminiCallOptions, GeminiToolCallOutcome } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';
import { LlmCallResult, LlmFailureReason } from './llm-failure';
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
  ) => Promise<LlmCallResult>;
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

function outcome(overrides: Partial<GeminiToolCallOutcome> = {}): LlmCallResult {
  return {
    ok: true,
    outcome: {
      answer: 'answer',
      anyToolDenied: false,
      anyToolFailed: false,
      toolsUsed: [],
      providerUsed: 'GEMINI',
      ...overrides,
    },
  };
}

/** An infrastructure failure for one provider, carrying the classified cause. */
function failed(provider: string, reason: LlmFailureReason = 'CONNECTION'): LlmCallResult {
  return { ok: false, failure: { provider, reason, detail: `${provider} ${reason}` } };
}

/** Narrows a successful orchestrator result so assertions can read the outcome fields. */
function expectOk(result: Awaited<ReturnType<LlmFallbackOrchestratorService['call']>>): GeminiToolCallOutcome {
  if (!result.ok) throw new Error(`Expected a successful LLM call, got ${result.failure.reason}`);
  return result.outcome;
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

    expect(expectOk(result).answer).toBe('I cannot help with that.');
    expect(expectOk(result).usedFallbackProvider).toBe(false);
    expect(openRouter.calls).toBe(0);
    expect(groq.calls).toBe(0);
    expect(grok.calls).toBe(0);
  });

  it('tries the next provider with the same original args when the primary fails (infra failure)', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => failed('GEMINI') });
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

    expect(expectOk(result).providerUsed).toBe('OPENROUTER');
    expect(expectOk(result).usedFallbackProvider).toBe(true);
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
    expect(expectOk(result).providerUsed).toBe('OPENROUTER');
  });

  it('reports a classified failure, not a silent null, when every provider is down', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => failed('GEMINI') });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => failed('OPENROUTER') });
    const groq = fakeAdapter('GROQ', { call: async () => failed('GROQ') });
    const grok = fakeAdapter('GROK', { call: async () => failed('GROK') });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.reason).toBe('CONNECTION');
    expect(result.ok === false && result.failure.attempts.map((attempt) => attempt.provider)).toEqual([
      'GEMINI', 'OPENROUTER', 'GROQ', 'GROK',
    ]);
    expect(result.ok === false && result.failure.partialOutputEmitted).toBe(false);
  });

  /**
   * WHY the rate limit outranks the connection errors: it is the one cause that
   * makes "try again in a minute" the honest advice to give the user.
   */
  it('surfaces the most actionable reason across providers', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => failed('GEMINI', 'CONNECTION') });
    const openRouter = fakeAdapter('OPENROUTER', { call: async () => failed('OPENROUTER', 'RATE_LIMITED') });
    const groq = fakeAdapter('GROQ', { call: async () => failed('GROQ', 'CONNECTION') });
    const grok = fakeAdapter('GROK', { call: async () => failed('GROK', 'PROVIDER_ERROR') });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result.ok === false && result.failure.reason).toBe('RATE_LIMITED');
  });

  it('records an unconfigured provider as a NOT_CONFIGURED attempt instead of dropping it', async () => {
    const gemini = fakeAdapter('GEMINI', { isConfigured: false, call: async () => outcome() });
    const openRouter = fakeAdapter('OPENROUTER', { isConfigured: false, call: async () => outcome() });
    const groq = fakeAdapter('GROQ', { isConfigured: false, call: async () => outcome() });
    const grok = fakeAdapter('GROK', { isConfigured: false, call: async () => outcome() });
    const orchestrator = new LlmFallbackOrchestratorService(
      buildConfig(),
      gemini as unknown as GeminiToolCallerService,
      openRouter,
      groq,
      grok,
    );

    const result = await orchestrator.call('system', 'message', tools);

    expect(result.ok === false && result.failure.reason).toBe('NOT_CONFIGURED');
    expect(orchestrator.hasConfiguredProvider()).toBe(false);
    expect(orchestrator.describeProviders().every((status) => status.configured === false)).toBe(true);
  });

  it('exposes the last real outcome per provider for /health without probing', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => failed('GEMINI', 'RATE_LIMITED') });
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

    await orchestrator.call('system', 'message', tools);
    const statuses = orchestrator.describeProviders();

    expect(statuses[0]).toMatchObject({ provider: 'GEMINI', order: 1, lastOutcome: 'FAILED', lastFailureReason: 'RATE_LIMITED' });
    expect(statuses[1]).toMatchObject({ provider: 'OPENROUTER', order: 2, lastOutcome: 'OK', lastFailureReason: null });
    /** Never called this turn, so it must not claim a health verdict it has no evidence for. */
    expect(statuses[3]).toMatchObject({ provider: 'GROK', lastOutcome: 'UNKNOWN' });
  });

  it('only tries providers present in AI_AGENT_LLM_PROVIDER_ORDER', async () => {
    const gemini = fakeAdapter('GEMINI', { call: async () => failed('GEMINI') });
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

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.attempts.map((attempt) => attempt.provider)).toEqual(['GEMINI']);
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

    expect(expectOk(result).providerUsed).toBe('GROQ');
    expect(groq.calls).toBe(1);
    expect(openRouter.calls).toBe(0);
    expect(gemini.calls).toBe(0);
  });
});
