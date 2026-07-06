import { ConfigService } from '@nestjs/config';
import { AgentRunStatus } from '../../../generated/prisma';
import { SpecialistInput } from '../../../common/graph';
import { LanguageAgentService } from './language-agent.service';

const baseInput: SpecialistInput = {
  conversationId: 'conversation-1',
  parentTaskLogId: 'task-1',
  userMessage: 'Please reword this professionally: I need the report today because the deadline is blocked.',
  normalizedIntent: 'Please reword this professionally',
  actorContext: {
    jwt: 'token',
    userId: 'user-1',
    employeeId: 'employee-1',
    roles: ['EMPLOYEE'],
    departmentId: null,
    teamId: null,
    businessUnitId: null,
    correlationId: 'corr-1',
  },
  conversationContext: {
    recentMessages: [],
    priorHandoffAgents: [],
  },
  sourceHints: [],
  isDraftRequest: true,
  constraints: {
    sentientOnly: true,
    readOnlyOfficialRecords: true,
    mustReturnToSupervisor: true,
  },
};

describe('LanguageAgentService', () => {
  it('professionalizes phrases while preserving user intent', async () => {
    const result = await new LanguageAgentService().execute(baseInput);

    expect(result.status).toBe(AgentRunStatus.SUCCESS);
    expect(result.userVisibleContent).toContain('deadline');
    expect(result.draftLabel).toBe('Phrase rewrite draft');
  });

  it('uses OpenRouter before direct Gemini when OpenRouter is first in provider order', async () => {
    const originalFetch = global.fetch;
    const requestedUrls: string[] = [];
    global.fetch = (async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'I need the report today because the deadline is blocked.',
              },
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const config = {
      get: () => ({
        llmProviderOrder: ['OPENROUTER', 'GEMINI'],
        openRouterApiKey: 'openrouter-key',
        openRouterApiUrl: 'https://openrouter.ai/api/v1',
        openRouterModel: 'google/gemini-2.5-flash-lite',
        geminiApiKey: 'denied-gemini-key',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiModel: 'gemini-2.5-flash-lite',
        intentClassifierTimeoutMs: 5000,
      }),
    } as unknown as ConfigService;

    try {
      const result = await new LanguageAgentService(config).execute(baseInput);

      expect(result.userVisibleContent).toContain('Professional version:');
      expect(requestedUrls).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses Groq before OpenRouter when Groq is first in provider order', async () => {
    const originalFetch = global.fetch;
    const requestedUrls: string[] = [];
    global.fetch = (async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'I need the report today because the deadline is blocked.',
              },
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const config = {
      get: () => ({
        llmProviderOrder: ['GROQ', 'OPENROUTER'],
        groqApiKey: 'groq-key',
        groqApiUrl: 'https://api.groq.com/openai/v1',
        groqModel: 'llama-3.1-8b-instant',
        openRouterApiKey: 'openrouter-key',
        openRouterApiUrl: 'https://openrouter.ai/api/v1',
        openRouterModel: 'google/gemini-2.5-flash-lite',
        intentClassifierTimeoutMs: 5000,
      }),
    } as unknown as ConfigService;

    try {
      const result = await new LanguageAgentService(config).execute(baseInput);

      expect(result.userVisibleContent).toContain('Professional version:');
      expect(requestedUrls).toEqual(['https://api.groq.com/openai/v1/chat/completions']);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
