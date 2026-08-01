import { RoleAssignmentClaim } from '@sentient/shared';
import {
  AgentActionKind,
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
  /**
   * WHY: the analytics SQL branch resolves row scope by mirroring HR Core's
   * EmployeesService.buildProfileAccessFilter, whose precedence chain keys on
   * roleAssignments[].scopeEntityId — NOT on the flat departmentId/teamId claims.
   * Using the flat claims instead would grant a manager assigned to a department
   * they are not a member of the wrong rows.
   */
  roleAssignments: RoleAssignmentClaim[];
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

/**
 * WHY a discriminated union and not `readOnlyOfficialRecords: boolean`: a boolean
 * would compile everywhere and silently delete the read-only guarantee for all
 * eight specialists at once. `readOnlyOfficialRecords: false` is paired with an
 * explicit `permittedActions` list, so a specialist can only ever propose the
 * action kinds it was granted — and a read-only specialist constructing a
 * confirmation payload is a compile error, not a runtime hope (spec 017 D1).
 */
export interface ReadOnlySpecialistConstraints {
  sentientOnly: true;
  readOnlyOfficialRecords: true;
  mustReturnToSupervisor: true;
}

export interface ActionCapableSpecialistConstraints {
  sentientOnly: true;
  readOnlyOfficialRecords: false;
  mustReturnToSupervisor: true;
  /** The exact action kinds this specialist may propose — nothing else. */
  permittedActions: AgentActionKind[];
}

export type SpecialistConstraints = ReadOnlySpecialistConstraints | ActionCapableSpecialistConstraints;

export interface SpecialistInput {
  conversationId: string;
  parentTaskLogId: string;
  userMessage: string;
  normalizedIntent: string;
  actorContext: AiActorContext;
  conversationContext: ConversationTurnContext;
  sourceHints: string[];
  isDraftRequest: boolean;
  constraints: SpecialistConstraints;
  /**
   * Set by the supervisor when a life-event intent is detected (spec 017 FR-027).
   * Read by FinalAnswerNodeService to choose the response's opening tone.
   */
  emotionalContext?: 'NEUTRAL' | 'COMPASSIONATE_SICK' | 'CELEBRATORY_PARENTAL' | 'EMPATHETIC_BEREAVEMENT';
}

/**
 * The frozen payload a specialist returns from Propose (spec 017 FR-003).
 * Persisted as `AgentActionProposal.payload` (Json), so at rest it is
 * schemaless — the framework is specialist-agnostic (FR-011) and each action
 * kind defines its own shape. `ActionConfirmationPayload` is the union of
 * those shapes; today it has exactly one member because LEAVE_BOOKING is the
 * only action kind. A second action kind widens the union here.
 */
export interface LeaveBookingConfirmationPayload {
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  businessDays: number;
  currentBalance: number;
  balanceAfter: number;
  employeeId: string;
}

export type ActionConfirmationPayload = LeaveBookingConfirmationPayload;

export interface SpecialistResult {
  agentType: AgentType;
  /**
   * WHY reused rather than a separate `SpecialistStatus` type: this already IS
   * the specialist-status vocabulary — `FAILED` predates this feature and
   * `PENDING_CONFIRMATION`/`UNVERIFIED` were added to this same Prisma enum
   * (spec 017 FR-012), so no parallel status type is needed.
   */
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
  /** Present only when status is PENDING_CONFIRMATION (spec 017 FR-012). */
  confirmationPayload?: ActionConfirmationPayload;
  /** Single-use token bound server-side to confirmationPayload (spec 017 FR-003). */
  confirmationToken?: string;
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
