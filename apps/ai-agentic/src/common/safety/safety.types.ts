import { AgentRunStatus, AgentType } from '../../generated/prisma';

export type ScopeClassification =
  | 'SENTIENT'
  | 'MIXED'
  | 'OUT_OF_SCOPE'
  | 'UNAUTHORIZED_DATA'
  | 'UNSAFE_ADVICE'
  | 'INTERPERSONAL_JUDGMENT'
  | 'WORKPLACE_CONFLICT'
  | 'IMMEDIATE_SAFETY_RISK';

export interface SafetyPolicyResult {
  classification: ScopeClassification;
  allowed: boolean;
  status: AgentRunStatus;
  message: string;
  shouldEscalate: boolean;
  requiresClarification: boolean;
  allowedAgents: AgentType[];
  declinedTopics: string[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FinalAnswerPolicyResult {
  content: string;
  status: AgentRunStatus;
  warnings: string[];
}
