import { Injectable } from '@nestjs/common';
import { AgentNodeType, AgentRunStatus, AgentTaskLog, AgentType, PermissionDecision } from '../../../generated/prisma';
import { AiActorContext } from '../../../common/graph';
import { AgentTaskLogService } from '../agent-task-log.service';

export interface LogProposedInput {
  conversationId: string;
  actor: AiActorContext;
  agentType: AgentType;
  /** The full computed payload — dates, business days, balance-after (spec 017 FR-049). */
  payloadSummary: string;
  /** Policy sources consulted during Reason (FR-051), or null when none were available. */
  policySourcesSummary: string | null;
}

export interface LogExecutedInput {
  conversationId: string;
  actor: AiActorContext;
  agentType: AgentType;
  /** Links this entry to its originating Propose entry (FR-049). */
  proposalLogId: string;
  /** SUCCESS or FAILED — never anything else; Execute has no other outcomes. */
  status: AgentRunStatus;
  httpStatus: number | null;
  resultSummary: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface LogVerifiedInput {
  conversationId: string;
  actor: AiActorContext;
  agentType: AgentType;
  /** Links this entry to its originating Execute entry (FR-049). */
  executionLogId: string;
  /** SUCCESS (MATCHED) or UNVERIFIED (MISMATCHED/UNAVAILABLE) — never FAILED; Verify only runs after an apparently-successful Execute. */
  status: AgentRunStatus;
  comparisonSummary: string;
}

/**
 * WHY a dedicated service rather than each phase calling AgentTaskLogService
 * directly: FR-011 requires the five-phase framework to be specialist-agnostic,
 * so the audit shape — taskType names, parentLogId linkage, which fields carry
 * which phase's evidence — is defined in exactly one place (spec 017 US6).
 * Each phase here is atomic from the caller's perspective (the work is already
 * done by the time this is called), so start() and finish() are paired in the
 * same call rather than left open across an async boundary.
 */
@Injectable()
export class ActionAuditService {
  constructor(private readonly taskLogs: AgentTaskLogService) {}

  async logProposed(input: LogProposedInput): Promise<AgentTaskLog> {
    const log = await this.taskLogs.start({
      conversationId: input.conversationId,
      agentType: input.agentType,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'action.proposed',
      actor: input.actor,
      inputSummary: input.payloadSummary,
    });
    return this.taskLogs.finish(log.id, {
      status: AgentRunStatus.SUCCESS,
      outputSummary: input.policySourcesSummary ?? 'No approved policy document was available.',
      permissionDecision: PermissionDecision.ALLOWED,
    });
  }

  async logExecuted(input: LogExecutedInput): Promise<AgentTaskLog> {
    const log = await this.taskLogs.start({
      conversationId: input.conversationId,
      parentLogId: input.proposalLogId,
      agentType: input.agentType,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'action.executed',
      actor: input.actor,
      inputSummary: `Downstream write attempted — HTTP ${input.httpStatus ?? 'no response'}`,
    });
    return this.taskLogs.finish(log.id, {
      status: input.status,
      outputSummary: input.resultSummary,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    });
  }

  async logVerified(input: LogVerifiedInput): Promise<AgentTaskLog> {
    const log = await this.taskLogs.start({
      conversationId: input.conversationId,
      parentLogId: input.executionLogId,
      agentType: input.agentType,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'action.verified',
      actor: input.actor,
      inputSummary: 'Independent read-back comparison against the frozen payload',
    });
    return this.taskLogs.finish(log.id, {
      status: input.status,
      outputSummary: input.comparisonSummary,
    });
  }
}
