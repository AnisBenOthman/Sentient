import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '../../generated/prisma';
import { ConversationTurnContext } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import {
  DraftIntentCategory,
  IntentClassifier,
  SupervisorIntentClassification,
} from './intent-classifier.types';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
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
    const apiKey = aiConfig?.geminiApiKey;
    if (!aiConfig || !apiKey) return fallbackClassification;

    try {
      const payload = await this.callGemini(message, aiConfig, apiKey, context);
      return this.toClassification(message, payload);
    } catch {
      return fallbackClassification;
    }
  }

  private async callGemini(
    message: string,
    config: AiAgenticConfig,
    apiKey: string,
    context?: ConversationTurnContext,
  ): Promise<GeminiIntentPayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.intentClassifierTimeoutMs);
    const prompt = this.prompt(message, context);
    this.logDebug(config, 'prompt', prompt);

    try {
      const response = await fetch(
        `${config.geminiApiUrl}/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) throw new Error(`Gemini intent classifier failed with ${response.status}`);
      const data = (await response.json()) as GeminiGenerateContentResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini intent classifier returned no text');
      this.logDebug(config, 'response', text);
      return JSON.parse(text) as GeminiIntentPayload;
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
      'Set isGreeting true for short standalone greetings or small talk such as hello, hi, hey, good morning, how are you, how are u, how is it going, or what is up.',
      'Set requiresClarification true only when the message has a real business request but not enough routing detail.',
      'Set isHumanEscalationIntent true only when the user explicitly asks to reach a human, HR person, manager, HRBP, or People team.',
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

  private toClassification(message: string, payload: GeminiIntentPayload): SupervisorIntentClassification {
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
      source: 'gemini',
    };
  }

  private validAgents(values: string[]): AgentType[] {
    return [...new Set(values.filter((value) => AGENT_TYPES.has(value)))].map((value) => value as AgentType);
  }

  private validDraftCategory(value: string | null | undefined): DraftIntentCategory | null {
    if (!value || !DRAFT_CATEGORIES.has(value as DraftIntentCategory)) return null;
    return value as DraftIntentCategory;
  }

  private logDebug(config: AiAgenticConfig, label: 'prompt' | 'response', content: string): void {
    if (!config.intentClassifierDebugLogs) return;
    this.logger.log(`Gemini intent ${label}:\n${content}`);
  }
}
