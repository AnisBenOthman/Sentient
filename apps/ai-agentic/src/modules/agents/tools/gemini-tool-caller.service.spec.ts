import { ConfigService } from '@nestjs/config';
import { AgentTool } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';

const mockGenerateContent = jest.fn();

/**
 * WHY: We mock the entire @google/genai module so unit tests never make real
 * HTTP calls. Every test controls exactly what generateContent returns, and the
 * FunctionCallingConfigMode enum is stubbed with string values so mode assertions
 * stay readable without importing the real enum in the test file.
 */
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
  FunctionCallingConfigMode: { ANY: 'ANY', AUTO: 'AUTO', NONE: 'NONE' },
}));

interface CallConfig {
  systemInstruction?: string;
  toolConfig?: { functionCallingConfig: { mode: string } };
  thinkingConfig?: { thinkingBudget: number };
}

interface CallArgs {
  model: string;
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  config: CallConfig;
}

function buildConfig(): ConfigService {
  return {
    get: () => ({
      geminiApiKey: 'test-key',
      geminiModel: 'gemini-2.5-flash',
      downstreamTimeoutMs: 8_000,
      geminiThinkingLevel: 'medium',
    }),
  } as unknown as ConfigService;
}

function textResponse(text: string) {
  return {
    text,
    candidates: [{ content: { role: 'model', parts: [{ text }] } }],
  };
}

function functionCallResponse(calls: Array<{ name: string; args?: Record<string, unknown>; id?: string }>) {
  return {
    text: undefined,
    candidates: [{
      content: {
        role: 'model',
        parts: calls.map((c) => ({
          functionCall: { name: c.name, args: c.args ?? {}, id: c.id ?? `id_${c.name}` },
        })),
      },
    }],
  };
}

function simpleTool(name: string, run: (args: Record<string, unknown>) => Promise<unknown>): AgentTool {
  return { declaration: { name, description: `${name} test tool.` }, run };
}

function firstCallArgs(): CallArgs {
  return mockGenerateContent.mock.calls[0]?.[0] as CallArgs;
}

function nthCallArgs(n: number): CallArgs {
  return mockGenerateContent.mock.calls[n]?.[0] as CallArgs;
}

describe('GeminiToolCallerService', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns null when Gemini is not configured', async () => {
    const config = { get: () => ({ geminiApiKey: null }) } as unknown as ConfigService;
    const service = new GeminiToolCallerService(config);

    const outcome = await service.call('prompt', 'question', [simpleTool('t', async () => ({}))]);

    expect(outcome).toBe(null);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns null when no tools are provided', async () => {
    const service = new GeminiToolCallerService(buildConfig());

    const outcome = await service.call('prompt', 'question', []);

    expect(outcome).toBe(null);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('sends the system instruction, prior turns, and the raw user message', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('You have 12 days left.'));
    const service = new GeminiToolCallerService(buildConfig());

    const outcome = await service.call(
      'System prompt here.',
      'How many days do I have left?',
      [simpleTool('get_my_leave_balance', async () => ({ remaining: 12 }))],
      [
        { role: 'USER', content: 'What is my leave balance?' },
        { role: 'ASSISTANT', content: 'You have 12 days of annual leave.' },
        // WHY: the current message is persisted before the turn runs, so it
        // arrives duplicated as the trailing history entry and must be dropped.
        { role: 'USER', content: 'How many days do I have left?' },
      ],
    );

    expect(outcome?.answer).toBe('You have 12 days left.');

    const args = firstCallArgs();
    expect(args.config.systemInstruction).toBe('System prompt here.');
    // 2 history turns (duplicate trailing user turn removed) + current user message
    expect(args.contents).toHaveLength(3);
    expect(args.contents[0]?.role).toBe('user');
    expect(args.contents[1]?.role).toBe('model');
    expect(args.contents[2]?.parts[0]?.['text']).toBe('How many days do I have left?');
    // thinkingBudget should be injected for 'medium' level
    expect(args.config.thinkingConfig).toEqual({ thinkingBudget: 4096 });
  });

  it('forces ANY tool-call mode on round 0 to prevent hallucinated answers', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(textResponse('You have 12 days.'));

    const service = new GeminiToolCallerService(buildConfig());
    await service.call('prompt', 'question', [
      simpleTool('get_my_leave_balance', async () => ({ remaining: 12 })),
    ]);

    expect(firstCallArgs().config.toolConfig?.functionCallingConfig.mode).toBe('ANY');
    expect(nthCallArgs(1).config.toolConfig?.functionCallingConfig.mode).toBe('AUTO');
  });

  it('answers every parallel function call in a single user turn', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(functionCallResponse([
        { name: 'get_my_leave_balance', id: 'id1' },
        { name: 'get_holidays', id: 'id2' },
      ]))
      .mockResolvedValueOnce(textResponse('Balance plus holidays answer.'));

    let balanceRuns = 0;
    let holidayRuns = 0;
    const service = new GeminiToolCallerService(buildConfig());

    const outcome = await service.call('prompt', 'question', [
      simpleTool('get_my_leave_balance', async () => { balanceRuns++; return { remaining: 12 }; }),
      simpleTool('get_holidays', async () => { holidayRuns++; return { holidays: [] }; }),
    ]);

    expect(outcome?.answer).toBe('Balance plus holidays answer.');
    expect(balanceRuns).toBe(1);
    expect(holidayRuns).toBe(1);
    expect(outcome?.toolsUsed).toEqual(['get_my_leave_balance', 'get_holidays']);

    const secondArgs = nthCallArgs(1);
    const lastTurn = secondArgs.contents[secondArgs.contents.length - 1];
    expect(lastTurn?.role).toBe('user');
    expect(lastTurn?.parts.filter((p) => p['functionResponse'] != null)).toHaveLength(2);

    const modelTurn = secondArgs.contents[secondArgs.contents.length - 2];
    expect(modelTurn?.role).toBe('model');
    expect(modelTurn?.parts.filter((p) => p['functionCall'] != null)).toHaveLength(2);
  });

  it('flags denied tool results without dropping the generated answer', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_team_leave_calendar' }]))
      .mockResolvedValueOnce(textResponse('I could not access the team calendar with your permissions.'));

    const service = new GeminiToolCallerService(buildConfig());
    const outcome = await service.call('prompt', 'question', [
      simpleTool('get_team_leave_calendar', async () => ({ denied: true, reason: 'No team scope.' })),
    ]);

    expect(outcome?.anyToolDenied).toBe(true);
    expect(outcome?.anyToolFailed).toBe(false);
    expect(outcome?.answer).toContain('team calendar');
  });

  it('flags throwing tools as failed, not denied', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(textResponse('The balance service is unavailable right now.'));

    const service = new GeminiToolCallerService(buildConfig());
    const outcome = await service.call('prompt', 'question', [
      simpleTool('get_my_leave_balance', async () => { throw new Error('HR Core timeout'); }),
    ]);

    expect(outcome?.anyToolFailed).toBe(true);
    expect(outcome?.anyToolDenied).toBe(false);
    expect(outcome?.answer).toContain('unavailable');
  });

  it('forces a final text answer when tool rounds run out', async () => {
    // 5 rounds of stubborn function calls, then final synthesis
    mockGenerateContent
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_my_leave_balance' }]))
      .mockResolvedValueOnce(textResponse('Final synthesis from gathered results.'));

    const service = new GeminiToolCallerService(buildConfig());
    const outcome = await service.call('prompt', 'question', [
      simpleTool('get_my_leave_balance', async () => ({ remaining: 12 })),
    ]);

    expect(outcome?.answer).toBe('Final synthesis from gathered results.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(6);
    // Final forced-synthesis call must use NONE mode
    expect(nthCallArgs(5).config.toolConfig?.functionCallingConfig.mode).toBe('NONE');
  });

  it('returns null and warns when the SDK throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Network error'));
    const service = new GeminiToolCallerService(buildConfig());

    const outcome = await service.call('prompt', 'question', [
      simpleTool('get_my_leave_balance', async () => ({ remaining: 12 })),
    ]);

    expect(outcome).toBe(null);
  });
});
