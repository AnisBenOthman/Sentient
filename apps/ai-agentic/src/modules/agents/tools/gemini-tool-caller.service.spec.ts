import { ConfigService } from '@nestjs/config';
import { AgentTool } from './agent-tool.types';
import { GeminiToolCallerService } from './gemini-tool-caller.service';

interface CapturedPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface CapturedRequest {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: CapturedPart[] }>;
  toolConfig?: { functionCallingConfig: { mode: string } };
  generationConfig?: { temperature: number };
}

function buildConfig(): ConfigService {
  return {
    get: () => ({
      geminiApiKey: 'test-key',
      geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      geminiModel: 'gemini-2.5-flash-lite',
      downstreamTimeoutMs: 8_000,
    }),
  } as unknown as ConfigService;
}

function textResponse(text: string): unknown {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

function functionCallResponse(calls: Array<{ name: string; args: Record<string, unknown> }>): unknown {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: calls.map((call) => ({ functionCall: call })) } }],
    }),
  };
}

function simpleTool(name: string, run: (args: Record<string, unknown>) => Promise<unknown>): AgentTool {
  return { declaration: { name, description: `${name} test tool.` }, run };
}

describe('GeminiToolCallerService', () => {
  it('returns null when Gemini is not configured', async () => {
    const config = { get: () => ({ geminiApiKey: null }) } as unknown as ConfigService;
    const service = new GeminiToolCallerService(config);

    const outcome = await service.call('prompt', 'question', [simpleTool('t', async () => ({}))]);

    expect(outcome).toBe(null);
  });

  it('returns null when no tools are provided', async () => {
    const service = new GeminiToolCallerService(buildConfig());

    const outcome = await service.call('prompt', 'question', []);

    expect(outcome).toBe(null);
  });

  it('sends the system instruction, prior turns, and the raw user message', async () => {
    const requests: CapturedRequest[] = [];
    const originalFetch = global.fetch;
    global.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      requests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      return textResponse('You have 12 days left.');
    }) as unknown as typeof fetch;
    const service = new GeminiToolCallerService(buildConfig());

    try {
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
      const request = requests[0];
      if (!request) throw new Error('Expected a Gemini request.');
      expect(request.systemInstruction?.parts[0]?.text).toBe('System prompt here.');
      expect(request.contents.length).toBe(3);
      expect(request.contents[0]?.role).toBe('user');
      expect(request.contents[1]?.role).toBe('model');
      expect(request.contents[2]?.parts[0]?.text).toBe('How many days do I have left?');
      expect(request.generationConfig?.temperature).toBe(0.4);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('answers every parallel function call in a single user turn', async () => {
    const requests: CapturedRequest[] = [];
    let fetchCount = 0;
    let balanceRuns = 0;
    let holidayRuns = 0;
    const originalFetch = global.fetch;
    global.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      requests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      fetchCount += 1;
      if (fetchCount === 1) {
        return functionCallResponse([
          { name: 'get_my_leave_balance', args: {} },
          { name: 'get_holidays', args: {} },
        ]);
      }
      return textResponse('Balance plus holidays answer.');
    }) as unknown as typeof fetch;
    const service = new GeminiToolCallerService(buildConfig());

    try {
      const outcome = await service.call('prompt', 'question', [
        simpleTool('get_my_leave_balance', async () => {
          balanceRuns += 1;
          return { remaining: 12 };
        }),
        simpleTool('get_holidays', async () => {
          holidayRuns += 1;
          return { holidays: [] };
        }),
      ]);

      expect(outcome?.answer).toBe('Balance plus holidays answer.');
      expect(balanceRuns).toBe(1);
      expect(holidayRuns).toBe(1);
      expect(outcome?.toolsUsed).toEqual(['get_my_leave_balance', 'get_holidays']);

      const second = requests[1];
      if (!second) throw new Error('Expected a second Gemini request.');
      const lastTurn = second.contents[second.contents.length - 1];
      if (!lastTurn) throw new Error('Expected contents in the second request.');
      expect(lastTurn.role).toBe('user');
      expect(lastTurn.parts.filter((part) => part.functionResponse != null).length).toBe(2);
      const modelTurn = second.contents[second.contents.length - 2];
      expect(modelTurn?.role).toBe('model');
      expect((modelTurn?.parts ?? []).filter((part) => part.functionCall != null).length).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('flags denied tool results without dropping the generated answer', async () => {
    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return functionCallResponse([{ name: 'get_team_leave_calendar', args: {} }]);
      }
      return textResponse('I could not access the team calendar with your permissions.');
    }) as unknown as typeof fetch;
    const service = new GeminiToolCallerService(buildConfig());

    try {
      const outcome = await service.call('prompt', 'question', [
        simpleTool('get_team_leave_calendar', async () => ({ denied: true, reason: 'No team scope.' })),
      ]);

      expect(outcome?.anyToolDenied).toBe(true);
      expect(outcome?.anyToolFailed).toBe(false);
      expect(outcome?.answer).toContain('team calendar');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('flags throwing tools as failed, not denied', async () => {
    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return functionCallResponse([{ name: 'get_my_leave_balance', args: {} }]);
      }
      return textResponse('The balance service is unavailable right now.');
    }) as unknown as typeof fetch;
    const service = new GeminiToolCallerService(buildConfig());

    try {
      const outcome = await service.call('prompt', 'question', [
        simpleTool('get_my_leave_balance', async () => {
          throw new Error('HR Core timeout');
        }),
      ]);

      expect(outcome?.anyToolFailed).toBe(true);
      expect(outcome?.anyToolDenied).toBe(false);
      expect(outcome?.answer).toContain('unavailable');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('forces a final text answer when tool rounds run out', async () => {
    const requests: CapturedRequest[] = [];
    let fetchCount = 0;
    const originalFetch = global.fetch;
    global.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
      requests.push(JSON.parse(String(init?.body)) as CapturedRequest);
      fetchCount += 1;
      if (fetchCount <= 5) {
        return functionCallResponse([{ name: 'get_my_leave_balance', args: {} }]);
      }
      return textResponse('Final synthesis from gathered results.');
    }) as unknown as typeof fetch;
    const service = new GeminiToolCallerService(buildConfig());

    try {
      const outcome = await service.call('prompt', 'question', [
        simpleTool('get_my_leave_balance', async () => ({ remaining: 12 })),
      ]);

      expect(outcome?.answer).toBe('Final synthesis from gathered results.');
      expect(fetchCount).toBe(6);
      const forced = requests[5];
      expect(forced?.toolConfig?.functionCallingConfig.mode).toBe('NONE');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
