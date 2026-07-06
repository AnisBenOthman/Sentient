import { AgentType } from '../../generated/prisma';
import { ConversationTurnContext } from '../../common/graph';

export const INTENT_CLASSIFIER = Symbol('INTENT_CLASSIFIER');

export type IntentClassifierProvider = 'rules' | 'gemini' | 'openrouter' | 'groq';
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
  /**
   * WHY: Follow-up questions ("what about last year?") only make sense with the
   * prior messages and prior specialist handoffs (FR-013), so classifiers accept
   * the conversation context in addition to the current message.
   */
  classify(message: string, context?: ConversationTurnContext): Promise<SupervisorIntentClassification>;
}
