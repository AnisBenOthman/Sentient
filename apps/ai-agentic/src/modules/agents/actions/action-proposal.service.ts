import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ActionProposalStatus, AgentActionProposal, Prisma } from '../../../generated/prisma';
import { AiActorContext, PendingActionDraft } from '../../../common/graph';
import { AiAgenticConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionAuditService } from './action-audit.service';

/** The narrow projection a confirm/cancel needs before it decides anything. */
export interface ProposalRef {
  id: string;
  conversationId: string;
  messageId: string;
  actorUserId: string;
  actorEmployeeId: string;
  status: ActionProposalStatus;
  expiresAt: Date;
}

export type ConsumeOutcome =
  /** This caller owns the execution — exactly one consume wins (FR-006). */
  | { result: 'CONSUMED'; proposal: AgentActionProposal }
  /** A previous confirm already claimed it. Report it, never re-execute. */
  | { result: 'ALREADY_CONSUMED'; proposal: AgentActionProposal }
  /** Past expiresAt. Balances move, so the user must re-propose rather than resume. */
  | { result: 'EXPIRED'; proposal: AgentActionProposal }
  /** No such token, or it belongs to somebody else — deliberately indistinguishable. */
  | { result: 'NOT_FOUND' };

const PROPOSAL_REF_SELECT = {
  id: true,
  conversationId: true,
  messageId: true,
  actorUserId: true,
  actorEmployeeId: true,
  status: true,
  expiresAt: true,
} satisfies Prisma.AgentActionProposalSelect;

/**
 * Owns the single-use confirmation token: minting it at Propose, and claiming it
 * exactly once at Confirm or Cancel (spec 017 FR-003, FR-004, FR-006).
 */
@Injectable()
export class ActionProposalService {
  private readonly logger = new Logger(ActionProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: ActionAuditService,
  ) {}

  /**
   * WHY mint() takes an already-created messageId rather than creating the message
   * itself: AgentActionProposal.messageId is a non-null unique FK, and the assistant
   * message does not exist until the graph has finished and its content has been
   * through the final-answer policy review. ConversationsService is the only place
   * both facts are available at once.
   */
  async mint(
    draft: PendingActionDraft,
    context: {
      conversationId: string;
      messageId: string;
      actor: AiActorContext;
    },
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + this.tokenTtlMinutes() * 60_000);

    /**
     * action.proposed is written BEFORE the row so the row can carry its log id
     * (FR-049). It records the computed payload and the scoping facts actually
     * used — never raw profile PII (spec 017 T035).
     */
    const proposalLog = await this.audit.logProposed({
      conversationId: context.conversationId,
      actor: context.actor,
      agentType: draft.agentType,
      payloadSummary: this.payloadSummary(draft),
      policySourcesSummary: draft.policyCitations.length
        ? `Policy consulted: ${draft.policyCitations.map((citation) => citation.sourceLabel).join('; ')}`
        : null,
    });

    await this.prisma.agentActionProposal.create({
      data: {
        conversationId: context.conversationId,
        messageId: context.messageId,
        token,
        actionKind: draft.actionKind,
        status: ActionProposalStatus.PENDING,
        actorUserId: context.actor.userId,
        // A proposal with no employee identity could never execute against HR Core;
        // the specialist only reaches Propose for an employee-scoped actor.
        actorEmployeeId: context.actor.employeeId ?? '',
        payload: draft.payload as unknown as Prisma.InputJsonValue,
        policyCitations: draft.policyCitations as unknown as Prisma.InputJsonValue,
        proposalLogId: proposalLog.id,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async findByToken(token: string): Promise<ProposalRef | null> {
    return this.prisma.agentActionProposal.findUnique({
      where: { token },
      select: PROPOSAL_REF_SELECT,
    });
  }

  async findByMessageId(messageId: string): Promise<AgentActionProposal | null> {
    return this.prisma.agentActionProposal.findUnique({ where: { messageId } });
  }

  /**
   * Claim the token for exactly one caller.
   *
   * WHY a conditional updateMany and never read-then-write (spec 017 research.md R3):
   * two confirms racing on the same token must not both observe PENDING and both
   * proceed. The database decides — count === 1 means this caller owns the execution,
   * count === 0 means somebody else won or it expired. Only after losing that race do
   * we read the row, and purely to tell the user which of those happened.
   */
  async consume(token: string, actor: AiActorContext): Promise<ConsumeOutcome> {
    const existing = await this.findByToken(token);
    if (!existing) return { result: 'NOT_FOUND' };

    /**
     * FR-004: a token is bound to the user who minted it. Checked before the consume
     * so a cross-user replay cannot burn a legitimate user's proposal, and reported as
     * NOT_FOUND so the response never confirms to an attacker that the token exists.
     */
    if (existing.actorUserId !== actor.userId) {
      this.logger.warn(
        `Rejected confirmation token for proposal ${existing.id}: minted by ${existing.actorUserId}, presented by ${actor.userId}.`,
      );
      return { result: 'NOT_FOUND' };
    }

    const now = new Date();
    const { count } = await this.prisma.agentActionProposal.updateMany({
      where: { token, status: ActionProposalStatus.PENDING, expiresAt: { gt: now } },
      data: { status: ActionProposalStatus.CONSUMED, consumedAt: now },
    });

    const proposal = await this.prisma.agentActionProposal.findUnique({ where: { token } });
    if (!proposal) return { result: 'NOT_FOUND' };

    if (count === 1) return { result: 'CONSUMED', proposal };

    // Lost the race, or was never eligible. count === 0 alone cannot say which.
    if (proposal.status === ActionProposalStatus.PENDING && proposal.expiresAt <= now) {
      await this.prisma.agentActionProposal.updateMany({
        where: { token, status: ActionProposalStatus.PENDING },
        data: { status: ActionProposalStatus.EXPIRED },
      });
      return { result: 'EXPIRED', proposal };
    }
    if (proposal.status === ActionProposalStatus.EXPIRED) return { result: 'EXPIRED', proposal };
    return { result: 'ALREADY_CONSUMED', proposal };
  }

  /** Records the outcome of the downstream write attempt (FR-007, FR-010). */
  async recordExecution(
    proposalId: string,
    outcome: {
      resultRecordId?: string | null;
      resultStatusCode?: number | null;
      resultErrorCode?: string | null;
    },
  ): Promise<void> {
    await this.prisma.agentActionProposal.update({
      where: { id: proposalId },
      data: {
        executedAt: new Date(),
        resultRecordId: outcome.resultRecordId ?? null,
        resultStatusCode: outcome.resultStatusCode ?? null,
        resultErrorCode: outcome.resultErrorCode ?? null,
      },
    });
  }

  /** Records the independent read-back comparison (FR-008). */
  async recordVerification(
    proposalId: string,
    verificationState: 'MATCHED' | 'MISMATCHED' | 'UNAVAILABLE',
  ): Promise<void> {
    await this.prisma.agentActionProposal.update({
      where: { id: proposalId },
      data: { verifiedAt: new Date(), verificationState },
    });
  }

  private payloadSummary(draft: PendingActionDraft): string {
    const p = draft.payload;
    return `${draft.actionKind}: ${p.leaveTypeName} (${p.leaveTypeId}) ${p.startDate} to ${p.endDate}, ${p.businessDays} business days (advisory), balance ${p.currentBalance} -> ${p.balanceAfter}. No write performed.`;
  }

  private tokenTtlMinutes(): number {
    return this.config.get<AiAgenticConfig>('aiAgentic')?.actionTokenTtlMinutes ?? 15;
  }
}
