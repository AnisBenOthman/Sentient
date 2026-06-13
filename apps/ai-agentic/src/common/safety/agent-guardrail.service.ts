import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType } from '../../generated/prisma';
import { SafetyPolicyResult } from './safety.types';

const SENTIENT_TERMS = [
  'sentient',
  'hr',
  'people team',
  'employee',
  'manager',
  'team',
  'leave',
  'okr',
  'okrs',
  'objective',
  'career',
  'skill',
  'review',
  'dashboard',
  'analytics',
  'onboarding',
  'policy',
  'handbook',
  'document',
  'announcement',
  'workforce',
  'profile',
  'notification',
  'rewrite',
  'reword',
  'phrase',
  'tone',
  'grammar',
  'email draft',
  'self-review',
  'self review',
  'feedback',
  'holiday',
  'vacation',
  'time off',
  'day off',
  'days off',
  'pto',
  'sick',
  'absence',
  'salary',
  'payslip',
  'payroll',
  'compensation',
  'bonus',
  'benefit',
  'probation',
  'contract',
  'promotion',
  'overtime',
  'remote work',
  'work from home',
  'resignation',
  'termination',
  'notice period',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * WHY: Substring matching previously classified almost any English sentence as
 * Sentient-scoped ('hr' matched inside "three"/"chrome", 'team' inside "steam"),
 * which made the polite out-of-scope branch unreachable (SC-011). Whole-word
 * matching keeps the scope gate meaningful. Terms longer than three characters
 * accept an optional plural so "bank holidays"/"objectives" still match, while
 * short acronyms ('hr', 'okr', 'pto') stay exact to avoid collisions like "hrs".
 */
const SENTIENT_TERM_PATTERNS = SENTIENT_TERMS.map(
  (term) =>
    new RegExp(term.length > 3 ? `\\b${escapeRegExp(term)}s?\\b` : `\\b${escapeRegExp(term)}\\b`, 'i'),
);

const OFF_TOPIC_TERMS = [
  'world cup',
  'movie',
  'joke',
  'cryptocurrency',
  'crypto',
  'bitcoin',
  'recipe',
  'weather',
  'laptop repair',
  'celebrity',
];

const UNAUTHORIZED_PATTERNS = [
  /another employee.*salary/i,
  /someone else.*salary/i,
  /colleague.*salary/i,
  /other employee.*performance/i,
  /private profile/i,
  /show me .* salary/i,
];

/**
 * WHY: Individual third-party leave records stay private for regular employees,
 * but managers and HR admins are entitled to team-scoped leave coverage (FR-008).
 * These patterns are only enforced for callers without that scope; privileged
 * callers are routed to the team-coverage path where HR Core RBAC still applies.
 */
const THIRD_PARTY_LEAVE_PATTERNS = [
  /(?:another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member).*(?:leave balance|leave history|last leave|leave request)/i,
  /(?:leave balance|leave history|last leave|leave request).*?(?:another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member)/i,
];

const TEAM_LEAVE_SCOPE_ROLES = ['MANAGER', 'HR_ADMIN'];

const INTERPERSONAL_PATTERNS = [
  /what do you think about .*person/i,
  /what do you think about that person/i,
  /what do you think about .*colleague/i,
  /what do you think about .*coworker/i,
  /judge .* behavior/i,
  /judge .* behaviour/i,
  /was .* rude/i,
  /was .* wrong/i,
  /didn'?t appreciate .* behaviour/i,
  /didn'?t appreciate .* behavior/i,
  /is .* toxic/i,
  /is .* unprofessional/i,
];

/**
 * WHY: Bare /conflict/ and /incident/ escalated harmless operational wording
 * ("scheduling conflict with my leave dates") as workplace incidents. Each
 * pattern now requires interpersonal or safety context within the same clause.
 */
const CONFLICT_PATTERNS = [
  /harass/i,
  /discriminat/i,
  /bully/i,
  /\b(workplace|interpersonal)\s+(conflict|incident)\b/i,
  /\b(conflict|incident|argument|altercation)\b[^.!?]*\b(coworker|colleague|manager|teammate|team member)\b/i,
  /\b(coworker|colleague|manager|teammate|team member)\b[^.!?]*\b(conflict|incident|threat|threaten)\b/i,
  /\b(feel|felt|feeling)\s+(unsafe|uncomfortable|threatened)\b/i,
  /\bunsafe\s+(at work|work(place| environment)?)\b/i,
  /\bdiscomfort\b/i,
];

const UNSAFE_ADVICE_PATTERNS = [
  /legal advice/i,
  /medical advice/i,
  /immigration advice/i,
  /financial advice/i,
  /disciplinary decision/i,
  /payroll decision/i,
];

const UNSAFE_SYSTEM_ACTION_PATTERNS = [
  /\b(drop|truncate|alter)\s+(table|database|schema)\b/i,
  /\bdelete\s+from\b/i,
  /\bunion\s+select\b/i,
  /;\s*(drop|delete|truncate|alter)\b/i,
  /\b(run|execute)\s+(sql|shell|cmd|powershell|bash|terminal|command)\b/i,
  /\b(ignore|bypass|override)\s+.*\binstructions?\b/i,
  /\b(show|print|dump|exfiltrate)\s+(all\s+)?(?:\w+\s+){0,3}(secrets?|api keys?|tokens?|jwt tokens?|passwords?|env|environment variables?)\b/i,
  /\b(rm\s+-rf|sudo|chmod\s+777)\b/i,
];

const IMMEDIATE_SAFETY_PATTERNS = [/immediate danger/i, /urgent safety/i, /emergency/i, /physical threat/i];
const GREETING_PATTERNS = [
  /^\s*(hi|hello|hey|good morning|good afternoon|good evening)\s*[!.]?\s*$/i,
  /^\s*(how\s+are\s+(you|u)|how\s+r\s+u|h[oa]w'?re\s+(you|u)|h[oa]w\s+are\s+(you|u))\s*[?!.]?\s*$/i,
  /^\s*(what'?s\s+up|how'?s\s+it\s+going|how'?s\s+your\s+day)\s*[?!.]?\s*$/i,
];

export interface GuardrailActor {
  roles?: readonly string[];
}

@Injectable()
export class AgentGuardrailService {
  evaluate(message: string, actor?: GuardrailActor): SafetyPolicyResult {
    const lower = message.toLowerCase();
    const hasSentientTopic = SENTIENT_TERM_PATTERNS.some((pattern) => pattern.test(message));
    const offTopicTerms = OFF_TOPIC_TERMS.filter((term) => lower.includes(term));
    const hasTeamLeaveScope = this.hasTeamLeaveScope(actor?.roles);

    if (IMMEDIATE_SAFETY_PATTERNS.some((pattern) => pattern.test(message))) {
      return this.escalationResult(
        'IMMEDIATE_SAFETY_RISK',
        'I am sorry you are dealing with this. If there is immediate risk, please seek urgent local help or use the company emergency process now. I can also help you prepare a neutral summary for your manager or People team.',
        'HIGH',
      );
    }

    if (UNSAFE_SYSTEM_ACTION_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        classification: 'UNSAFE_SYSTEM_ACTION',
        allowed: false,
        status: AgentRunStatus.REFUSED,
        message: 'I cannot run, generate, or help execute destructive database commands, system commands, prompt-injection instructions, or attempts to expose secrets. I can help with safe Sentient workflow questions and approved read-only summaries.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: ['Unsafe system or data operation'],
        sensitivity: 'HIGH',
      };
    }

    if (INTERPERSONAL_PATTERNS.some((pattern) => pattern.test(message))) {
      return this.escalationResult(
        'INTERPERSONAL_JUDGMENT',
        'I cannot judge another person or assign blame. If the behavior affected you, please contact your manager, HR business partner, or People team for support. I can help you write a neutral summary of what happened.',
        'HIGH',
      );
    }

    if (CONFLICT_PATTERNS.some((pattern) => pattern.test(message))) {
      return this.escalationResult(
        'WORKPLACE_CONFLICT',
        'I hear that this may be a sensitive workplace concern. I will not decide fault, but I can help you document the facts and I recommend contacting your manager, HR business partner, or People team.',
        'HIGH',
      );
    }

    const unauthorizedPatterns = hasTeamLeaveScope
      ? UNAUTHORIZED_PATTERNS
      : [...UNAUTHORIZED_PATTERNS, ...THIRD_PARTY_LEAVE_PATTERNS];
    if (unauthorizedPatterns.some((pattern) => pattern.test(message))) {
      return {
        classification: 'UNAUTHORIZED_DATA',
        allowed: false,
        status: AgentRunStatus.REFUSED,
        message: 'I cannot help access private employee information that is outside your Sentient permissions. I can help with your own records or with manager/HR-scoped summaries you are authorized to view.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: ['Unauthorized private employee data'],
        sensitivity: 'HIGH',
      };
    }

    if (UNSAFE_ADVICE_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        classification: 'UNSAFE_ADVICE',
        allowed: false,
        status: AgentRunStatus.REFUSED,
        message: 'I can explain approved Sentient policy context when available, but I cannot provide legal, medical, immigration, payroll, or disciplinary advice. Please contact the appropriate qualified owner or People team.',
        shouldEscalate: true,
        requiresClarification: false,
        allowedAgents: [AgentType.HUMAN_ESCALATION_AGENT],
        declinedTopics: ['Unsafe advice'],
        sensitivity: 'HIGH',
      };
    }

    if (GREETING_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        classification: 'SENTIENT',
        allowed: true,
        status: AgentRunStatus.SUCCESS,
        message: 'Greeting is allowed in the Sentient assistant context.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: [],
        sensitivity: 'LOW',
      };
    }

    if (!hasSentientTopic) {
      return {
        classification: 'OUT_OF_SCOPE',
        allowed: false,
        status: AgentRunStatus.OUT_OF_SCOPE,
        message: 'That question is outside my Sentient scope. I can help with Sentient HR workflows such as leave, OKRs, career growth, onboarding, policy documents, workforce dashboards, and workplace phrase review.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: offTopicTerms.length > 0 ? offTopicTerms : ['Unrelated topic'],
        sensitivity: 'LOW',
      };
    }

    if (hasSentientTopic && offTopicTerms.length > 0) {
      return {
        classification: 'MIXED',
        allowed: true,
        status: AgentRunStatus.PARTIAL,
        message: 'I will answer only the Sentient-related part and leave the unrelated topic aside.',
        shouldEscalate: false,
        requiresClarification: false,
        allowedAgents: [],
        declinedTopics: offTopicTerms,
        sensitivity: 'MEDIUM',
      };
    }

    return {
      classification: 'SENTIENT',
      allowed: true,
      status: AgentRunStatus.SUCCESS,
      message: 'Request is within Sentient scope.',
      shouldEscalate: false,
      requiresClarification: false,
      allowedAgents: [],
      declinedTopics: [],
      sensitivity: 'LOW',
    };
  }

  /**
   * WHY: The final-answer node re-checks composed output (FR-034). Exposing the
   * same pattern sets keeps the input guardrail and the output backstop in sync
   * instead of maintaining two diverging regex libraries.
   *
   * Third-party leave patterns are skippable because managers and HR admins are
   * entitled to team leave answers: a generated sentence like "team member X has
   * a leave request next week" is a correct answer for them, not a leak. The
   * input gate already applies the same role-based distinction.
   */
  matchesUnauthorizedData(text: string, options?: { includeThirdPartyLeavePatterns?: boolean }): boolean {
    if (UNAUTHORIZED_PATTERNS.some((pattern) => pattern.test(text))) return true;
    if (options?.includeThirdPartyLeavePatterns === false) return false;
    return THIRD_PARTY_LEAVE_PATTERNS.some((pattern) => pattern.test(text));
  }

  /** WHY: Single source of truth for the manager/HR-admin team-leave entitlement check. */
  hasTeamLeaveScope(roles: readonly string[] | undefined): boolean {
    return roles?.some((role) => TEAM_LEAVE_SCOPE_ROLES.includes(role)) ?? false;
  }

  matchesInterpersonalJudgment(text: string): boolean {
    return INTERPERSONAL_PATTERNS.some((pattern) => pattern.test(text));
  }

  private escalationResult(
    classification: SafetyPolicyResult['classification'],
    message: string,
    sensitivity: SafetyPolicyResult['sensitivity'],
  ): SafetyPolicyResult {
    return {
      classification,
      allowed: false,
      status: AgentRunStatus.ESCALATED,
      message,
      shouldEscalate: true,
      requiresClarification: false,
      allowedAgents: [AgentType.HUMAN_ESCALATION_AGENT],
      declinedTopics: ['Personal judgment or workplace incident'],
      sensitivity,
    };
  }
}
