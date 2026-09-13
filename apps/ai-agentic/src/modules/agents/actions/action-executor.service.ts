import { Injectable, Logger } from '@nestjs/common';
import { AgentActionProposal, AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { DownstreamRequestContext, HrCoreAiClient, LeaveRequestRecordContext } from '../../../common/clients';
import { AiActorContext, LeaveBookingConfirmationPayload } from '../../../common/graph';
import { ActionAuditService } from './action-audit.service';
import { readLeavePayload } from './confirmation-card.presenter';

export type VerificationState = 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE';

export type RevalidationResult =
  | { ok: true }
  /** A precondition that held at Propose no longer does. Nothing was consumed or written. */
  | { ok: false; reason: string };

export type ExecutionResult =
  | { status: 'SUCCESS'; httpStatus: number; record: LeaveRequestRecordContext; executionLogId: string }
  | { status: 'FAILED'; httpStatus: number | null; reason: string; executionLogId: string };

export interface VerificationResult {
  state: VerificationState;
  detail: string;
  record: LeaveRequestRecordContext | null;
}

/**
 * The Confirm-time re-validation, Execute and Verify phases of a leave booking
 * (spec 017 US2, US3). This service holds no persistence — the proposal row is
 * owned by ActionProposalService, which sequences these calls around the
 * single-use token consume.
 */
@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  constructor(
    private readonly hrCore: HrCoreAiClient,
    private readonly audit: ActionAuditService,
  ) {}

  /**
   * Re-check balance and overlap under the caller's CURRENT context, with the
   * FROZEN dates (FR-005, FR-014). Runs before the token is consumed, so a
   * precondition that stopped holding costs the user a fresh proposal — never a
   * burnt token on a request that wrote nothing.
   */
  async revalidate(proposal: AgentActionProposal, actor: AiActorContext): Promise<RevalidationResult> {
    const payload = readLeavePayload(proposal.payload);
    if (!payload) return { ok: false, reason: 'The stored proposal could not be read.' };

    const context = await this.hrCore.getLeaveContext(actor.employeeId, this.requestContext(actor));
    if (context.permissionDecision !== PermissionDecision.ALLOWED || !context.data) {
      return { ok: false, reason: "I couldn't re-check your leave balance just now, so I haven't submitted anything. Please try again in a moment." };
    }

    const overlap = context.data.recentRequests.find((request) => {
      if (!['PENDING', 'APPROVED'].includes(request.status.toUpperCase())) return false;
      return request.startDate.slice(0, 10) <= payload.endDate && request.endDate.slice(0, 10) >= payload.startDate;
    });
    if (overlap) {
      return {
        ok: false,
        reason: `Since I proposed this, a ${overlap.status.toLowerCase()} request from ${overlap.startDate.slice(0, 10)} to ${overlap.endDate.slice(0, 10)} now overlaps these dates. I haven't submitted anything — ask me again and I'll re-check.`,
      };
    }

    const year = Number(payload.startDate.slice(0, 4));
    const wanted = payload.leaveTypeName.toLowerCase();
    const balance =
      context.data.balances.find((b) => b.leaveTypeName.toLowerCase() === wanted && Number(b.year) === year) ??
      context.data.balances.find((b) => b.leaveTypeName.toLowerCase() === wanted) ??
      null;
    const remaining = balance ? this.toNumber(balance.remainingDays) : 0;
    if (remaining < payload.businessDays) {
      return {
        ok: false,
        reason: `Your ${payload.leaveTypeName} balance is now ${remaining} ${remaining === 1 ? 'day' : 'days'}, which no longer covers the ${payload.businessDays} needed. I haven't submitted anything — ask me again and I'll re-check.`,
      };
    }

    return { ok: true };
  }

  /**
   * Exactly one downstream write, using the payload frozen at Propose — never
   * one re-derived from the confirm message (FR-001, FR-006). Failure is
   * classified and surfaced verbatim (FR-007, FR-010); it is never reported as
   * success, and it is never retried here.
   */
  async execute(proposal: AgentActionProposal, actor: AiActorContext): Promise<ExecutionResult> {
    const payload = readLeavePayload(proposal.payload);
    const agentType = this.agentTypeFor(proposal);
    if (!payload) {
      const log = await this.audit.logExecuted({
        conversationId: proposal.conversationId, actor, agentType,
        proposalLogId: proposal.proposalLogId,
        status: AgentRunStatus.FAILED, httpStatus: null,
        resultSummary: 'Frozen payload unreadable; no downstream call made.',
        errorCode: 'PAYLOAD_UNREADABLE',
      });
      return { status: 'FAILED', httpStatus: null, reason: 'The stored proposal could not be read.', executionLogId: log.id };
    }

    const outcome = await this.hrCore.createLeaveRequest(
      { leaveTypeId: payload.leaveTypeId, startDate: payload.startDate, endDate: payload.endDate },
      this.requestContext(actor),
    );

    if (outcome.status === 'SUCCESS') {
      const log = await this.audit.logExecuted({
        conversationId: proposal.conversationId, actor, agentType,
        proposalLogId: proposal.proposalLogId,
        status: AgentRunStatus.SUCCESS, httpStatus: outcome.httpStatus,
        resultSummary: `Leave request ${outcome.data.id} created with status ${outcome.data.status}.`,
      });
      return { status: 'SUCCESS', httpStatus: outcome.httpStatus, record: outcome.data, executionLogId: log.id };
    }

    this.logger.warn(`Execute failed for proposal ${proposal.id}: HTTP ${outcome.httpStatus ?? 'none'} — ${outcome.reason}`);
    const log = await this.audit.logExecuted({
      conversationId: proposal.conversationId, actor, agentType,
      proposalLogId: proposal.proposalLogId,
      status: AgentRunStatus.FAILED, httpStatus: outcome.httpStatus,
      resultSummary: `Downstream write failed: ${outcome.reason}`,
      errorCode: outcome.httpStatus === null ? 'NO_RESPONSE' : `HTTP_${outcome.httpStatus}`,
      errorMessage: outcome.reason,
    });
    return { status: 'FAILED', httpStatus: outcome.httpStatus, reason: outcome.reason, executionLogId: log.id };
  }

  /**
   * Independent read-back of the created record, compared against the frozen
   * payload on dates, leave type, employee and status (FR-008). totalDays is
   * deliberately excluded: HR Core recomputes it authoritatively and the
   * card's figure was only ever advisory (research.md R4) — comparing them
   * would flag correct bookings as MISMATCHED.
   */
  async verify(
    proposal: AgentActionProposal,
    recordId: string,
    executionLogId: string,
    actor: AiActorContext,
  ): Promise<VerificationResult> {
    const payload = readLeavePayload(proposal.payload);
    const readBack = await this.hrCore.getLeaveRequestById(recordId, this.requestContext(actor));

    let result: VerificationResult;
    if (readBack.permissionDecision !== PermissionDecision.ALLOWED || !readBack.data || !payload) {
      result = {
        state: 'UNAVAILABLE',
        detail: `Read-back of leave request ${recordId} was unavailable (${readBack.degradedReason ?? 'no data'}).`,
        record: null,
      };
    } else {
      const mismatches = this.compare(payload, readBack.data);
      result = mismatches.length === 0
        ? { state: 'MATCHED', detail: `Leave request ${recordId} matches the frozen payload on leave type, dates, employee and status.`, record: readBack.data }
        : { state: 'MISMATCHED', detail: `Leave request ${recordId} differs from the frozen payload: ${mismatches.join('; ')}.`, record: readBack.data };
    }

    await this.audit.logVerified({
      conversationId: proposal.conversationId,
      actor,
      agentType: this.agentTypeFor(proposal),
      executionLogId,
      status: result.state === 'MATCHED' ? AgentRunStatus.SUCCESS : AgentRunStatus.UNVERIFIED,
      comparisonSummary: result.detail,
    });
    return result;
  }

  private compare(payload: LeaveBookingConfirmationPayload, record: LeaveRequestRecordContext): string[] {
    const mismatches: string[] = [];
    if (record.leaveTypeId !== payload.leaveTypeId) mismatches.push(`leaveTypeId ${record.leaveTypeId} != ${payload.leaveTypeId}`);
    if (record.employeeId !== payload.employeeId) mismatches.push(`employeeId ${record.employeeId} != ${payload.employeeId}`);
    if (record.startDate.slice(0, 10) !== payload.startDate) mismatches.push(`startDate ${record.startDate.slice(0, 10)} != ${payload.startDate}`);
    if (record.endDate.slice(0, 10) !== payload.endDate) mismatches.push(`endDate ${record.endDate.slice(0, 10)} != ${payload.endDate}`);
    if (!['PENDING', 'APPROVED'].includes(record.status.toUpperCase())) mismatches.push(`status ${record.status} is not an active booking state`);
    // totalDays intentionally not compared — see method comment.
    return mismatches;
  }

  private agentTypeFor(proposal: AgentActionProposal): AgentType {
    // The only action kind today. A second kind extends this switch alongside the capability registry.
    switch (proposal.actionKind) {
      case 'LEAVE_BOOKING':
      default:
        return AgentType.LEAVE_AGENT;
    }
  }

  private requestContext(actor: AiActorContext): DownstreamRequestContext {
    return { jwt: actor.jwt, correlationId: actor.correlationId };
  }

  private toNumber(value: number | string): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
