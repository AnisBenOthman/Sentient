import { AgentType } from '../../generated/prisma';

export const INTENT_CLASSIFIER = Symbol('INTENT_CLASSIFIER');

export type IntentClassifierProvider = 'rules' | 'gemini';
export type IntentClassificationSource = IntentClassifierProvider;

export type DraftIntentCategory =
  | 'OBJECTIVE'
  | 'SELF_REVIEW'
  | 'MANAGER_FEEDBACK'
  | 'HR_ANNOUNCEMENT'
  | 'POLICY_SUMMARY'
  | 'WORKFORCE_INSIGHT'
  | 'PHRASE_REWRITE';

export interface SupervisorIntentClassification {
  normalizedIntent: string;
  requiredAgents: AgentType[];
  requiresClarification: boolean;
  clarificationReason: string | null;
  isDraftIntent: boolean;
  draftCategory: DraftIntentCategory | null;
  isHumanEscalationIntent: boolean;
  isGreeting: boolean;
  confidence: number;
  source: IntentClassificationSource;
}

export interface IntentClassifier {
  classify(message: string): Promise<SupervisorIntentClassification>;
}
