import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { extractJson } from '../../common/util';
import { AiAgenticConfig } from '../../config';
import { ANALYTICS_SCHEMA, hasCompensationAccess, schemaPrompt } from './analytics-schema-context';

export interface GeneratedSql {
  sql: string;
  explanation: string;
  source: 'gemini' | 'openrouter' | 'groq' | 'xai';
}

interface SqlGenerationPayload {
  sql?: unknown;
  explanation?: unknown;
}

interface OpenAiCompatibleChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

type OpenAiSqlProvider = 'openrouter' | 'groq' | 'xai';

interface OpenAiSqlSettings {
  apiKey: string;
  apiUrl: string;
  model: string;
  source: OpenAiSqlProvider;
  label: string;
}

/**
 * WHY this does NOT go through LlmFallbackOrchestratorService: both
 * GeminiToolCallerService.call and OpenAiCompatibleToolCallerService.call return
 * null when tools.length === 0, so a tools-free structured-output call is dead on
 * arrival there. This mirrors GeminiIntentClassifierService instead, which is the
 * established structured-output path in this service.
 */
@Injectable()
export class SqlGeneratorService {
  private readonly logger = new Logger(SqlGeneratorService.name);

  constructor(private readonly config: ConfigService) {}

  async generate(question: string, roles: readonly string[]): Promise<GeneratedSql | null> {
    const aiConfig = this.config.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig) return null;

    const prompt = this.prompt(question, roles);

    if (aiConfig.geminiApiKey) {
      try {
        const payload = await this.callGemini(prompt, aiConfig, aiConfig.geminiApiKey);
        const generated = this.toGeneratedSql(payload, 'gemini');
        if (generated) return generated;
      } catch (err: unknown) {
        this.logger.warn(`Gemini SQL generation failed: ${this.errorText(err)}`);
      }
    }

    for (const provider of aiConfig.llmProviderOrder) {
      const normalized = this.openAiProvider(provider);
      if (!normalized) continue;
      const settings = this.openAiSettings(aiConfig, normalized);
      if (!settings) continue;

      try {
        const payload = await this.callOpenAiCompatible(prompt, aiConfig, settings);
        const generated = this.toGeneratedSql(payload, settings.source);
        if (generated) return generated;
      } catch (err: unknown) {
        this.logger.warn(`${settings.label} SQL generation failed: ${this.errorText(err)}`);
      }
    }

    return null;
  }

  /**
   * WHY the prompt is not a security control: the question it embeds is
   * attacker-influenceable. Everything here is a correctness aid so the model
   * produces usable SQL on the first try. Enforcement lives in SqlValidatorService
   * and in the database grants.
   */
  private prompt(question: string, roles: readonly string[]): string {
    const rules = [
      `- Always schema-qualify: ${ANALYTICS_SCHEMA}.v_employees, never v_employees.`,
      '- One statement only. No semicolons. SELECT or WITH only.',
      '- Use explicit JOIN ... ON syntax. Never comma joins.',
      '- Rows are already filtered to what the caller may see. Do not add permission filters.',
      '- Prefer aggregates (COUNT, AVG, SUM) with GROUP BY over listing raw rows.',
      '- Give every computed column a readable snake_case alias.',
      '- For "leave taken", filter status = \'APPROVED\' on v_leave_requests.',
      '- Use date arithmetic like start_date >= CURRENT_DATE - INTERVAL \'3 years\' for time windows.',
      '- Do not reference current_setting, set_config, pg_catalog, or information_schema.',
    ];
    // WHY conditional: these view names must never appear in the prompt for a role
    // without compensation access — schemaPrompt() already omits the views
    // themselves for that role, and this rule would otherwise leak their existence
    // (and unusable names) into a prompt that is supposed to list ONLY relations
    // the caller may reference.
    if (hasCompensationAccess(roles)) {
      rules.push(
        '- For "average/median salary by age" questions, use hr_analytics.v_compensation_by_age_band ' +
          'directly — it is already grouped by age_band with avg_gross_salary/avg_net_salary/employee_count. ' +
          'Do not attempt to join v_compensation to v_employees to combine salary with age — they ' +
          'intentionally share no employee identifier.',
      );
    }
    return [
      'You write a single PostgreSQL SELECT query answering an HR analytics question.',
      'Return JSON only, no markdown.',
      '',
      `Readable views (schema ${ANALYTICS_SCHEMA}) — these are the ONLY readable relations:`,
      schemaPrompt(roles),
      '',
      'Rules:',
      ...rules,
      '',
      'explanation: one plain sentence describing what the query measures, for the end user.',
      'Schema: {"sql":"SELECT ...","explanation":"..."}',
      '',
      `Question: ${question}`,
    ].join('\n');
  }

  private async callGemini(
    prompt: string,
    config: AiAgenticConfig,
    apiKey: string,
  ): Promise<SqlGenerationPayload> {
    const ai = new GoogleGenAI({
      apiKey,
      // The Gemini SDK enforces a minimum 10s deadline.
      httpOptions: { timeout: Math.max(config.analyticsSqlTimeoutMs, 10_000) },
    });

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: { temperature: 0, responseMimeType: 'application/json' },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini returned no text');
    return extractJson(text) as SqlGenerationPayload;
  }

  private async callOpenAiCompatible(
    prompt: string,
    config: AiAgenticConfig,
    settings: OpenAiSqlSettings,
  ): Promise<SqlGenerationPayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(config.analyticsSqlTimeoutMs, 10_000));

    try {
      const response = await fetch(`${settings.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Sentient AI Agentic',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          // WHY no response_format json_object: several free models return 400 for
          // that parameter. The prompt asks for JSON and extractJson handles fences.
        }),
      });

      if (!response.ok) {
        const body = await response
          .text()
          .then((text) => text.replace(/\s+/g, ' ').trim().slice(0, 300))
          .catch(() => '');
        throw new Error(`${settings.label} returned ${response.status}: ${body || '<empty body>'}`);
      }

      const data = (await response.json()) as OpenAiCompatibleChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${settings.label} returned no text`);
      return extractJson(text) as SqlGenerationPayload;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** The payload comes from an LLM, so every field is treated as untrusted. */
  private toGeneratedSql(payload: SqlGenerationPayload, source: GeneratedSql['source']): GeneratedSql | null {
    const sql = typeof payload.sql === 'string' ? payload.sql.trim() : '';
    if (sql.length === 0) return null;
    const explanation = typeof payload.explanation === 'string' ? payload.explanation.trim() : '';
    return { sql, explanation, source };
  }

  private openAiProvider(value: string): OpenAiSqlProvider | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'openrouter' || normalized === 'groq' || normalized === 'xai') return normalized;
    return null;
  }

  private openAiSettings(config: AiAgenticConfig, provider: OpenAiSqlProvider): OpenAiSqlSettings | null {
    const byProvider: Record<OpenAiSqlProvider, { apiKey: string | null; apiUrl: string; model: string; label: string }> = {
      openrouter: {
        apiKey: config.openRouterApiKey,
        apiUrl: config.openRouterApiUrl,
        model: config.openRouterModel,
        label: 'OpenRouter',
      },
      groq: { apiKey: config.groqApiKey, apiUrl: config.groqApiUrl, model: config.groqModel, label: 'Groq' },
      xai: { apiKey: config.xaiApiKey, apiUrl: config.xaiApiUrl, model: config.xaiModel, label: 'xAI' },
    };

    const settings = byProvider[provider];
    if (!settings.apiKey) return null;
    return {
      apiKey: settings.apiKey,
      apiUrl: settings.apiUrl,
      model: settings.model,
      source: provider,
      label: settings.label,
    };
  }

  private errorText(err: unknown): string {
    return err instanceof Error ? err.message : 'unknown error';
  }
}
