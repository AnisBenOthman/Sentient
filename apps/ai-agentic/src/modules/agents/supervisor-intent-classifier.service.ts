import { Injectable } from '@nestjs/common';
import { AgentType } from '../../generated/prisma';
import { ConversationTurnContext } from '../../common/graph';
import {
  DraftIntentCategory,
  IntentClassifier,
  SupervisorIntentClassification,
} from './intent-classifier.types';

interface KeywordRoute {
  agentType: AgentType;
  keywords: string[];
}

const ROUTES: KeywordRoute[] = [
  {
    agentType: AgentType.LEAVE_AGENT,
    keywords: ['leave', 'vacation', 'absence', 'balance', 'pto', 'holiday', 'time off'],
  },
  {
    agentType: AgentType.OKR_AGENT,
    keywords: ['okr', 'objective', 'key result', 'goal', 'progress', 'risk', 'focus'],
  },
  {
    agentType: AgentType.CAREER_AGENT,
    keywords: ['career', 'growth', 'promotion', 'skill', 'review', 'performance', 'development', 'evolve'],
  },
  {
    agentType: AgentType.ANALYTICS_AGENT,
    keywords: ['dashboard', 'analytics', 'stat', 'trend', 'metric', 'workforce', 'headcount', 'team coverage'],
  },
  {
    agentType: AgentType.ONBOARDING_AGENT,
    keywords: ['onboarding', 'new hire', 'first week', 'welcome', 'starter'],
  },
  {
    agentType: AgentType.LANGUAGE_AGENT,
    keywords: ['reword', 'rewrite', 'phrase', 'tone', 'professional', 'wording', 'improve this'],
  },
  {
    agentType: AgentType.GENERAL_HELP_AGENT,
    keywords: ['policy', 'handbook', 'faq', 'document', 'rule', 'benefit', 'procedure', 'announcement', 'how do i use sentient'],
  },
];

const DRAFT_KEYWORDS = ['draft', 'write', 'prepare', 'compose', 'suggest', 'template'];
const CLARIFICATION_PATTERNS = [
  /help me with my objective/i,
  /help with my objective/i,
  /can you help me with (it|this|my request)/i,
  /^help$/i,
];

/**
 * WHY: The old single-keyword list ('manager', 'support', 'human') flagged most
 * ordinary HR questions as escalation intents. Escalation now requires an
 * explicit request to reach a person, so the supervisor can route on it safely.
 */
const ESCALATION_PATTERNS = [
  /\b(talk|speak|connect)\s+(to|with)\s+(a\s+|an\s+|the\s+)?(human|someone|person|people team|hrbp|hr\b)/i,
  /\bescalate\b/i,
  /\bhuman support\b/i,
  /\bhrbp\b/i,
  /\breach\s+(out\s+to\s+)?(hr|the\s+people team)\b/i,
  /\bcontact\s+(hr|the\s+people team|my\s+hr business partner)\b/i,
];

const FOLLOW_UP_PATTERNS = [
  /^\s*(and|also|what about|how about|what else|same|then|again)\b/i,
  /\b(what about|how about)\b/i,
];

const GREETING_PATTERNS = [
  /^\s*(hi|hello|hey|good morning|good afternoon|good evening)\s*[!.]?\s*$/i,
  /^\s*(how\s+are\s+(you|u)|how\s+r\s+u|h[oa]w'?re\s+(you|u)|h[oa]w\s+are\s+(you|u))\s*[?!.]?\s*$/i,
  /^\s*(what'?s\s+up|how'?s\s+it\s+going|how'?s\s+your\s+day)\s*[?!.]?\s*$/i,
];

const AGENT_TYPE_VALUES = new Set<string>(Object.values(AgentType));

@Injectable()
export class SupervisorIntentClassifierService implements IntentClassifier {
  async classify(
    message: string,
    context?: ConversationTurnContext,
  ): Promise<SupervisorIntentClassification> {
    const normalizedIntent = message.trim().replace(/\s+/g, ' ');
    const lower = normalizedIntent.toLowerCase();
    const isGreeting = GREETING_PATTERNS.some((pattern) => pattern.test(normalizedIntent));
    const requiredAgents = ROUTES
      .filter((route) => route.keywords.some((keyword) => lower.includes(keyword)))
      .map((route) => route.agentType);

    let uniqueAgents = [...new Set(requiredAgents)];
    let followUpRoute = false;
    /**
     * WHY: A short follow-up such as "and what about last year?" carries no
     * domain keyword. Reusing the most recent specialist handoff keeps the
     * conversation flowing (FR-013) instead of forcing a generic clarification.
     */
    if (uniqueAgents.length === 0 && !isGreeting && this.isFollowUp(normalizedIntent, context)) {
      const lastHandoffAgent = context?.priorHandoffAgents.find((agent) => AGENT_TYPE_VALUES.has(agent));
      if (lastHandoffAgent) {
        uniqueAgents = [lastHandoffAgent as AgentType];
        followUpRoute = true;
      }
    }

    const isDraftIntent = DRAFT_KEYWORDS.some((keyword) => lower.includes(keyword));
    const draftCategory = isDraftIntent ? this.classifyDraftCategory(lower) : null;
    const isHumanEscalationIntent = ESCALATION_PATTERNS.some((pattern) => pattern.test(normalizedIntent));
    const requiresClarification =
      !isGreeting &&
      !isHumanEscalationIntent &&
      (uniqueAgents.length === 0 ||
        CLARIFICATION_PATTERNS.some((pattern) => pattern.test(normalizedIntent)));

    return {
      normalizedIntent,
      requiredAgents: requiresClarification ? [] : uniqueAgents,
      requiresClarification,
      clarificationReason: requiresClarification
        ? 'The request needs one more detail before it can be routed safely.'
        : null,
      isDraftIntent,
      draftCategory,
      isHumanEscalationIntent,
      isGreeting,
      confidence: this.confidence(isGreeting, uniqueAgents.length, requiresClarification, followUpRoute),
      source: 'rules',
    };
  }

  private isFollowUp(message: string, context?: ConversationTurnContext): boolean {
    if (!context || context.priorHandoffAgents.length === 0) return false;
    if (context.recentMessages.length === 0) return false;
    return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(message)) || message.length <= 40;
  }

  private confidence(
    isGreeting: boolean,
    routeCount: number,
    requiresClarification: boolean,
    followUpRoute: boolean,
  ): number {
    if (isGreeting) return 1;
    if (followUpRoute) return 0.6;
    if (routeCount > 0 && !requiresClarification) return 0.85;
    return 0.35;
  }

  private classifyDraftCategory(lower: string): DraftIntentCategory | null {
    if (lower.includes('objective') || lower.includes('key result') || lower.includes('okr')) return 'OBJECTIVE';
    if (lower.includes('self-review') || lower.includes('self review')) return 'SELF_REVIEW';
    if (lower.includes('manager feedback') || lower.includes('review feedback')) return 'MANAGER_FEEDBACK';
    if (lower.includes('announcement')) return 'HR_ANNOUNCEMENT';
    if (lower.includes('policy') || lower.includes('handbook')) return 'POLICY_SUMMARY';
    if (lower.includes('workforce') || lower.includes('dashboard') || lower.includes('insight')) return 'WORKFORCE_INSIGHT';
    if (lower.includes('phrase') || lower.includes('reword') || lower.includes('rewrite')) return 'PHRASE_REWRITE';
    return null;
  }
}
