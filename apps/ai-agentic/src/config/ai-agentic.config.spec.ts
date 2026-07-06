import { aiAgenticConfig } from './ai-agentic.config';

describe('aiAgenticConfig', () => {
  it('uses the Gemini API root by default', () => {
    const originalGeminiApiUrl = process.env.GEMINI_API_URL;
    delete process.env.GEMINI_API_URL;

    try {
      expect(aiAgenticConfig().geminiApiUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    } finally {
      if (originalGeminiApiUrl === undefined) {
        delete process.env.GEMINI_API_URL;
      } else {
        process.env.GEMINI_API_URL = originalGeminiApiUrl;
      }
    }
  });

  it('normalizes a full Gemini generateContent endpoint to the API root', () => {
    const originalGeminiApiUrl = process.env.GEMINI_API_URL;
    try {
      process.env.GEMINI_API_URL =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

      expect(aiAgenticConfig().geminiApiUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    } finally {
      if (originalGeminiApiUrl === undefined) {
        delete process.env.GEMINI_API_URL;
      } else {
        process.env.GEMINI_API_URL = originalGeminiApiUrl;
      }
    }
  });

  it('accepts OpenRouter as a primary intent classifier provider', () => {
    const originalProvider = process.env.AI_AGENT_INTENT_PROVIDER;
    try {
      process.env.AI_AGENT_INTENT_PROVIDER = 'openrouter';

      expect(aiAgenticConfig().intentClassifierProvider).toBe('openrouter');
    } finally {
      if (originalProvider === undefined) {
        delete process.env.AI_AGENT_INTENT_PROVIDER;
      } else {
        process.env.AI_AGENT_INTENT_PROVIDER = originalProvider;
      }
    }
  });

  it('accepts Groq as a primary intent classifier provider', () => {
    const originalProvider = process.env.AI_AGENT_INTENT_PROVIDER;
    try {
      process.env.AI_AGENT_INTENT_PROVIDER = 'groq';

      expect(aiAgenticConfig().intentClassifierProvider).toBe('groq');
    } finally {
      if (originalProvider === undefined) {
        delete process.env.AI_AGENT_INTENT_PROVIDER;
      } else {
        process.env.AI_AGENT_INTENT_PROVIDER = originalProvider;
      }
    }
  });

  it('uses Groq OpenAI-compatible defaults', () => {
    const originalGroqApiUrl = process.env.GROQ_API_URL;
    const originalGroqModel = process.env.GROQ_MODEL;
    delete process.env.GROQ_API_URL;
    delete process.env.GROQ_MODEL;

    try {
      const config = aiAgenticConfig();

      expect(config.groqApiUrl).toBe('https://api.groq.com/openai/v1');
      expect(config.groqModel).toBe('llama-3.1-8b-instant');
    } finally {
      if (originalGroqApiUrl === undefined) {
        delete process.env.GROQ_API_URL;
      } else {
        process.env.GROQ_API_URL = originalGroqApiUrl;
      }
      if (originalGroqModel === undefined) {
        delete process.env.GROQ_MODEL;
      } else {
        process.env.GROQ_MODEL = originalGroqModel;
      }
    }
  });
});
