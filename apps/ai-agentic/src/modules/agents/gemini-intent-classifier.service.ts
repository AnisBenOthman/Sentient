import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AgentType } from '../../generated/prisma';
import { ConversationTurnContext } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import {
  DraftIntentCategory,
  IntentClassifier,
  SupervisorIntentClassification,
} from './intent-classifier.types';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

interface OpenAiCompatibleChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface GeminiIntentPayload {
  requiredAgents?: string[];
  requiresClarification?: boolean;
  clarificationReason?: string | null;
  isDraftIntent?: boolean;
  draftCategory?: string | null;
  isHumanEscalationIntent?: boolean;
  isGreeting?: boolean;
  confidence?: number;
}

type OpenAiIntentProvider = 'openrouter' | 'groq';

interface OpenAiIntentSettings {
  apiKey: string;
  apiUrl: string;
  model: string;
  source: OpenAiIntentProvider;
  label: 'OpenRouter' | 'Groq';
}

const AGENT_TYPES = new Set<string>(Object.values(AgentType));
const DRAFT_CATEGORIES = new Set<DraftIntentCategory>([
  'OBJECTIVE',
  'SELF_REVIEW',
  'MANAGER_FEEDBACK',
  'HR_ANNOUNCEMENT',
  'POLICY_SUMMARY',
  'WORKFORCE_INSIGHT',
  'PHRASE_REWRITE',
]);

@Injectable()
export class GeminiIntentClassifierService implements IntentClassifier {
  private readonly logger = new Logger(GeminiIntentClassifierService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fallback: SupervisorIntentClassifierService,
  ) {}

  async classify(
    message: string,
    context?: ConversationTurnContext,
  ): Promise<SupervisorIntentClassification> {
    const fallbackClassification = await this.fallback.classify(message, context);
    if (fallbackClassification.isGreeting) return fallbackClassification;

    const aiConfig = this.config.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig) return fallbackClassification;

    const selectedOpenAiProvider = this.openAiIntentProvider(aiConfig.intentClassifierProvider);
    if (selectedOpenAiProvider) {
      const classification = await this.classifyWithOpenAiCompatibleProvider(
        message,
        context,
        fallbackClassification,
        aiConfig,
        selectedOpenAiProvider,
        `${selectedOpenAiProvider === 'groq' ? 'Groq' : 'OpenRouter'} intent provider selected`,
        false,
      );
      if (classification) return classification;
      const fallbackClassificationFromProvider = await this.classifyWithConfiguredOpenAiFallbackProvider(
        message,
        context,
        fallbackClassification,
        aiConfig,
        `${selectedOpenAiProvider === 'groq' ? 'Groq' : 'OpenRouter'} intent classifier unavailable`,
      );
      if (fallbackClassificationFromProvider) return fallbackClassificationFromProvider;
      this.logDebug(aiConfig, 'fallback', 'OpenAI-compatible intent classifier unavailable; using rules fallback.');
      return fallbackClassification;
    }

    try {
      const apiKey = aiConfig.geminiApiKey;
      if (!apiKey) throw new Error('Gemini intent classifier is not configured');
      const payload = await this.callGemini(message, aiConfig, apiKey, context);
      const classification = this.toClassification(message, payload, 'gemini');
      if (this.shouldForceHolidayCalendarToLeave(message, fallbackClassification, classification)) {
        return {
          ...classification,
          requiredAgents: [AgentType.LEAVE_AGENT],
          requiresClarification: false,
          clarificationReason: null,
          confidence: Math.max(classification.confidence, fallbackClassification.confidence, 0.85),
        };
      }
      return classification;
    } catch (err: unknown) {
      const geminiError = err instanceof Error ? err.message : 'unknown error';
      const fallbackClassificationFromProvider = await this.classifyWithConfiguredOpenAiFallbackProvider(
        message,
        context,
        fallbackClassification,
        aiConfig,
        `Gemini intent classifier unavailable: ${geminiError}`,
      );
      if (fallbackClassificationFromProvider) return fallbackClassificationFromProvider;
      this.logDebug(
        aiConfig,
        'fallback',
        `Gemini intent classifier unavailable; using rules fallback: ${geminiError}`,
      );
      return fallbackClassification;
    }
  }

  /**
   * WHY: Uses the official @google/genai SDK (matching GeminiToolCallerService) so
   * Gemini auth, retries, and JSON parsing are handled consistently across the
   * intent and tool-calling layers. responseMimeType + temperature:0 keep the
   * output strict JSON so JSON.parse never chokes on markdown-fenced text.
   */
  private async callGemini(
    message: string,
    config: AiAgenticConfig,
    apiKey: string,
    context?: ConversationTurnContext,
  ): Promise<GeminiIntentPayload> {
    const prompt = this.prompt(message, context);
    this.logDebug(config, 'prompt', prompt);

    const ai = new GoogleGenAI({
      apiKey,
      // WHY: Gemini SDK enforces a minimum 10s deadline; intentClassifierTimeoutMs
      // may be set lower for the rules/OpenRouter path, so we clamp here.
      httpOptions: { timeout: Math.max(config.intentClassifierTimeoutMs, 10_000) },
    });

    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini intent classifier returned no text');
    this.logDebug(config, 'response', text);
    return JSON.parse(text) as GeminiIntentPayload;
  }

  private async classifyWithConfiguredOpenAiFallbackProvider(
    message: string,
    context: ConversationTurnContext | undefined,
    fallbackClassification: SupervisorIntentClassification,
    config: AiAgenticConfig,
    reason: string,
  ): Promise<SupervisorIntentClassification | null> {
    const providerOrder = Array.isArray(config.llmProviderOrder) ? config.llmProviderOrder : [];
    for (const provider of providerOrder) {
      const normalized = provider.trim().toLowerCase();
      const openAiProvider = this.openAiIntentProvider(normalized);
      if (!openAiProvider) continue;

      const classification = await this.classifyWithOpenAiCompatibleProvider(
        message,
        context,
        fallbackClassification,
        config,
        openAiProvider,
        reason,
        true,
      );
      if (classification) return classification;
    }

    this.logDebug(config, 'fallback', `${reason}; OpenAI-compatible fallback skipped.`);
    return null;
  }

  private async classifyWithOpenAiCompatibleProvider(
    message: string,
    context: ConversationTurnContext | undefined,
    fallbackClassification: SupervisorIntentClassification,
    config: AiAgenticConfig,
    provider: OpenAiIntentProvider,
    reason: string,
    requireProviderOrder: boolean,
  ): Promise<SupervisorIntentClassification | null> {
    const settings = this.openAiIntentSettings(config, provider, requireProviderOrder);
    if (!settings) {
      this.logDebug(config, 'fallback', `${reason}; ${provider.toUpperCase()} classifier skipped.`);
      return null;
    }

    try {
      const payload = await this.callOpenAiCompatibleProvider(message, config, settings, context);
      const classification = this.toClassification(message, payload, settings.source);
      if (this.shouldForceHolidayCalendarToLeave(message, fallbackClassification, classification)) {
        return {
          ...classification,
          requiredAgents: [AgentType.LEAVE_AGENT],
          requiresClarification: false,
          clarificationReason: null,
          confidence: Math.max(classification.confidence, fallbackClassification.confidence, 0.85),
        };
      }
      this.logDebug(config, 'fallback', `${reason}; used ${settings.label} classifier.`);
      return classification;
    } catch (err: unknown) {
      this.logDebug(
        config,
        'fallback',
        `${reason}; ${provider.toUpperCase()} classifier failed; using rules fallback: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private openAiIntentProvider(value: string | undefined): OpenAiIntentProvider | null {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'openrouter' || normalized === 'groq') return normalized;
    return null;
  }

  private openAiIntentSettings(
    config: AiAgenticConfig,
    provider: OpenAiIntentProvider,
    requireProviderOrder: boolean,
  ): OpenAiIntentSettings | null {
    const settings =
      provider === 'openrouter'
        ? {
            apiKey: config.openRouterApiKey,
            apiUrl: config.openRouterApiUrl,
            model: config.openRouterModel,
            source: provider,
            label: 'OpenRouter' as const,
          }
        : {
            apiKey: config.groqApiKey,
            apiUrl: config.groqApiUrl,
            model: config.groqModel,
            source: provider,
            label: 'Groq' as const,
          };

    if (!settings.apiKey) return null;
    if (!requireProviderOrder) return settings as OpenAiIntentSettings;
    const providerOrder = Array.isArray(config.llmProviderOrder) ? config.llmProviderOrder : [];
    return providerOrder.some((configured) => configured.trim().toLowerCase() === provider) ? settings as OpenAiIntentSettings : null;
  }

  private async callOpenAiCompatibleProvider(
    message: string,
    config: AiAgenticConfig,
    settings: OpenAiIntentSettings,
    context?: ConversationTurnContext,
  ): Promise<GeminiIntentPayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.intentClassifierTimeoutMs);
    const prompt = this.prompt(message, context);
    this.logDebug(config, 'prompt', `${settings.label} intent prompt:\n${prompt}`);

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
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0,
          // WHY: response_format json_object is not supported by all free models
          // (e.g. Gemma 4 31B returns 400). The prompt already says "Return JSON only"
          // so the model complies without enforced JSON mode.
        }),
      });

      if (!response.ok) throw new Error(`${settings.label} intent classifier failed with ${response.status}`);
      const data = (await response.json()) as OpenAiCompatibleChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${settings.label} intent classifier returned no text`);
      this.logDebug(config, 'response', `${settings.label} intent response:\n${text}`);
      return extractJson(text) as GeminiIntentPayload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private prompt(message: string, context?: ConversationTurnContext): string {
    const lines = [
      'Classify this Sentient HR assistant user message.',
      'Return JSON only, no markdown.',
      'Allowed requiredAgents values: LEAVE_AGENT, OKR_AGENT, CAREER_AGENT, ANALYTICS_AGENT, ONBOARDING_AGENT, LANGUAGE_AGENT, GENERAL_HELP_AGENT, HUMAN_ESCALATION_AGENT.',
      'Allowed draftCategory values: OBJECTIVE, SELF_REVIEW, MANAGER_FEEDBACK, HR_ANNOUNCEMENT, POLICY_SUMMARY, WORKFORCE_INSIGHT, PHRASE_REWRITE, or null.',
      'Set isGreeting true for short standalone greetings or small talk such as hello, hi, hey, good morning, how are you, how are u, how is it going, what is up, bonjour, bonsoir, salut, coucou, ca va, or comment ca va.',
      'Set requiresClarification true only when the message has a real business request but not enough routing detail.',
      'Set isHumanEscalationIntent true only when the user explicitly asks to reach a human, HR person, manager, HRBP, or People team.',
      'Route bank/public/company/national/official holiday calendar questions to LEAVE_AGENT, not GENERAL_HELP_AGENT.',
      'If the message is a follow-up to the recent conversation, resolve it against that context before classifying.',
      'Set confidence between 0 and 1 reflecting how sure you are about requiredAgents.',
      'Schema: {"requiredAgents":[],"requiresClarification":false,"clarificationReason":null,"isDraftIntent":false,"draftCategory":null,"isHumanEscalationIntent":false,"isGreeting":false,"confidence":0.0}',
    ];
    const recentMessages = context?.recentMessages.slice(-4) ?? [];
    if (recentMessages.length > 0) {
      lines.push('Recent conversation (oldest first):');
      for (const recent of recentMessages) {
        lines.push(`${recent.role}: ${this.truncate(recent.content, 200)}`);
      }
    }
    if (context && context.priorHandoffAgents.length > 0) {
      lines.push(`Previously consulted specialists: ${context.priorHandoffAgents.join(', ')}`);
    }
    lines.push(`Message: ${message}`);
    return lines.join('\n');
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
  }

  private toClassification(
    message: string,
    payload: GeminiIntentPayload,
    source: 'gemini' | 'openrouter' | 'groq',
  ): SupervisorIntentClassification {
    const normalizedIntent = message.trim().replace(/\s+/g, ' ');
    const isGreeting = payload.isGreeting === true;
    const requiredAgents = this.validAgents(payload.requiredAgents ?? []);
    const requiresClarification = isGreeting ? false : payload.requiresClarification === true;
    // WHY: A missing confidence means the model did not commit to its routing.
    // Defaulting to 0 keeps it below the clarification threshold instead of
    // silently passing as "probably fine" (0.5).
    const confidence = typeof payload.confidence === 'number' ? Math.max(0, Math.min(1, payload.confidence)) : 0;

    return {
      normalizedIntent,
      requiredAgents: requiresClarification ? [] : requiredAgents,
      requiresClarification,
      clarificationReason: requiresClarification
        ? payload.clarificationReason ?? 'The request needs one more detail before it can be routed safely.'
        : null,
      isDraftIntent: payload.isDraftIntent === true,
      draftCategory: this.validDraftCategory(payload.draftCategory),
      isHumanEscalationIntent: payload.isHumanEscalationIntent === true,
      isGreeting,
      confidence,
      source,
    };
  }

  private validAgents(values: string[]): AgentType[] {
    return [...new Set(values.filter((value) => AGENT_TYPES.has(value)))].map((value) => value as AgentType);
  }

  private shouldForceHolidayCalendarToLeave(
    message: string,
    fallbackClassification: SupervisorIntentClassification,
    classification: SupervisorIntentClassification,
  ): boolean {
    if (!this.requestsHolidayCalendar(message)) return false;
    if (!fallbackClassification.requiredAgents.includes(AgentType.LEAVE_AGENT)) return false;
    return (
      classification.requiredAgents.length === 0 ||
      classification.requiredAgents.every((agentType) => agentType === AgentType.GENERAL_HELP_AGENT)
    );
  }

  private requestsHolidayCalendar(message: string): boolean {
    const text = message.toLowerCase();
    if (/\b(bank|public|company|national|official)\s+holidays?\b/.test(text)) return true;
    return (
      /\bholidays?\b/.test(text) &&
      /\b(calendar|list|dates?|when|which|upcoming|next|country|this year)\b/.test(text) &&
      !/\b(balance|remaining|left|book|request|take)\b/.test(text)
    );
  }

  private validDraftCategory(value: string | null | undefined): DraftIntentCategory | null {
    if (!value || !DRAFT_CATEGORIES.has(value as DraftIntentCategory)) return null;
    return value as DraftIntentCategory;
  }

  private logDebug(config: AiAgenticConfig, label: 'prompt' | 'response' | 'fallback', content: string): void {
    if (!config.intentClassifierDebugLogs) return;
    this.logger.log(`Intent classifier ${label}:\n${content}`);
  }
}

/**
 * WHY: Free models (e.g. Gemma) ignore "Return JSON only" and wrap output in
 * markdown fences like ```json ... ```. response_format: json_object would fix
 * it but many free models return 400 for that parameter. This extractor handles
 * both cases: raw JSON and fenced JSON, so JSON.parse never crashes.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Fast path: already valid JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence extraction
  }

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Last resort: find the first {...} block in the text
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(trimmed.slice(braceStart, braceEnd + 1));
  }

  throw new Error(`OpenRouter response is not valid JSON: ${trimmed.slice(0, 120)}`);
}
