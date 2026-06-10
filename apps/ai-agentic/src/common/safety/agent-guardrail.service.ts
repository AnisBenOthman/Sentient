import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType } from '../../generated/prisma';
import { SafetyPolicyResult } from './safety.types';

const SENTIENT_TERMS = [
  'sentient',
  'hr',
  'people',
  'employee',
  'manager',
  'team',
  'leave',
  'okr',
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
];

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
  /(?:another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member).*(?:leave balance|leave history|last leave|leave request)/i,
  /(?:leave balance|leave history|last leave|leave request).*?(?:another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member)/i,
  /private profile/i,
  /show me .* salary/i,
];

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

const CONFLICT_PATTERNS = [
  /harass/i,
  /discriminat/i,
  /conflict/i,
  /incident/i,
  /unsafe/i,
  /threat/i,
  /bully/i,
  /discomfort/i,
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

@Injectable()
export class AgentGuardrailService {
  evaluate(message: string): SafetyPolicyResult {
    const lower = message.toLowerCase();
    const hasSentientTopic = SENTIENT_TERMS.some((term) => lower.includes(term));
    const offTopicTerms = OFF_TOPIC_TERMS.filter((term) => lower.includes(term));

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

    if (UNAUTHORIZED_PATTERNS.some((pattern) => pattern.test(message))) {
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
