import {
  AgentNodeType,
  AgentRunStatus,
  AgentType,
  HumanEscalationTargetType,
  PermissionDecision,
} from '../../generated/prisma';
import { SourceContext } from '../dto/source-context.dto';

export interface AiActorContext {
  jwt: string;
  userId: string;
  employeeId: string | null;
  roles: string[];
  departmentId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
  correlationId: string;
}

export interface PermissionDecisionSummary {
  agentType: AgentType;
  decision: PermissionDecision;
  resourceType: string;
  resourceId?: string | null;
  reason: string;
}

export interface ConversationTurnContext {
  recentMessages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
  priorHandoffAgents: string[];
}

export interface SpecialistInput {
  conversationId: string;
  parentTaskLogId: string;
  userMessage: string;
  normalizedIntent: string;
  actorContext: AiActorContext;
  conversationContext: ConversationTurnContext;
  sourceHints: string[];
  isDraftRequest: boolean;
  constraints: {
    sentientOnly: true;
    readOnlyOfficialRecords: true;
    mustReturnToSupervisor: true;
  };
}

export interface SpecialistResult {
  agentType: AgentType;
  status: AgentRunStatus;
  summary: string;
  userVisibleContent: string;
  sourceContext: SourceContext[];
  permissionDecision: PermissionDecision;
  recommendedNextStep?: string;
  draftLabel?: string;
  /** LLM prompt tokens consumed by this specialist's call, when the provider reported usage. */
  tokensIn?: number;
  /** LLM completion/thinking tokens produced by this specialist's call. */
  tokensOut?: number;
}

export interface HumanEscalationResult {
  targetType: HumanEscalationTargetType;
  targetLabel: string;
  reason: string;
  summaryForHuman: string;
  nextStep: string;
}

export interface FinalAnswerResult {
  status: AgentRunStatus;
  content: string;
  sourceContext: SourceContext[];
  routingSummary: string;
}

export interface AgentGraphState {
  conversationId: string;
  userMessageId: string;
  actor: AiActorContext;
  normalizedIntent: string;
  sentientScoped: boolean;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredAgents: AgentType[];
  permissionDecisions: PermissionDecisionSummary[];
  specialistResults: SpecialistResult[];
  escalation: HumanEscalationResult | null;
  finalAnswer: FinalAnswerResult | null;
  correlationId: string;
}

export interface AgentNodeExecution {
  nodeType: AgentNodeType;
  agentType: AgentType;
  status: AgentRunStatus;
  summary: string;
}

export interface SpecialistAgent {
  readonly agentType: AgentType;
  execute(input: SpecialistInput): Promise<SpecialistResult>;
}
