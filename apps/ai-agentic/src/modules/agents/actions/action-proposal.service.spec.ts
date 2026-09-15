import { ConfigService } from '@nestjs/config';
import { ActionProposalStatus, AgentActionKind, AgentActionProposal } from '../../../generated/prisma';
import { AiActorContext } from '../../../common/graph';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionAuditService } from './action-audit.service';
import { ActionExecutorService } from './action-executor.service';
import { ActionProposalService } from './action-proposal.service';

const actor: AiActorContext = {
  jwt: 'jwt', userId: 'user-1', employeeId: 'employee-1', roles: ['EMPLOYEE'],
  departmentId: null, teamId: null, businessUnitId: 'bu-1', roleAssignments: [], correlationId: 'corr-1',
};
const otherUser: AiActorContext = { ...actor, userId: 'user-2', employeeId: 'employee-2' };

const FROZEN = {
  leaveTypeId: 'lt-annual', leaveTypeName: 'Annual Leave',
  startDate: '2026-10-05', endDate: '2026-10-07', businessDays: 3,
  currentBalance: 10, balanceAfter: 7, employeeId: 'employee-1',
};

/**
 * An in-memory stand-in for the proposal table whose updateMany honours the
 * WHERE clause the way Postgres does — so two concurrent consumes race for real
 * against the same row, and exactly one sees count === 1.
 */
function buildPrisma(seed: Partial<AgentActionProposal> = {}) {
  const row: AgentActionProposal = {
    id: 'prop-1', conversationId: 'conv-1', messageId: 'msg-1', token: 'tok-1',
    actionKind: AgentActionKind.LEAVE_BOOKING, status: ActionProposalStatus.PENDING,
    actorUserId: 'user-1', actorEmployeeId: 'employee-1',
    payload: FROZEN, policyCitations: [],
    executedAt: null, resultRecordId: null, resultStatusCode: null, resultErrorCode: null,
    verifiedAt: null, verificationState: null, proposalLogId: 'log-proposed',
    expiresAt: new Date(Date.now() + 60_000), consumedAt: null, createdAt: new Date(),
    ...seed,
  } as AgentActionProposal;

  const prisma = {
    agentActionProposal: {
      findUnique: async ({ where }: { where: { token?: string; messageId?: string } }) =>
        where.token === row.token || where.messageId === row.messageId ? { ...row } : null,
      updateMany: async ({ where, data }: { where: { token: string; status?: ActionProposalStatus; expiresAt?: { gt: Date } }; data: Partial<AgentActionProposal> }) => {
        const matches = where.token === row.token
          && (where.status === undefined || row.status === where.status)
          && (where.expiresAt === undefined || row.expiresAt.getTime() > where.expiresAt.gt.getTime());
        if (!matches) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({ data }: { data: Partial<AgentActionProposal> }) => { Object.assign(row, data); return { ...row }; },
      create: async () => { throw new Error('not used'); },
    },
  } as unknown as PrismaService;
  return { prisma, row };
}

function buildService(prisma: PrismaService, executorOverrides: Partial<Record<'revalidate' | 'execute' | 'verify', unknown>> = {}) {
  const calls = { execute: 0, verify: 0 };
  const executor = {
    revalidate: async () => ({ ok: true }),
    execute: async () => { calls.execute += 1; return { status: 'SUCCESS', httpStatus: 201, record: { id: 'lr-1', status: 'PENDING' }, executionLogId: 'log-exec' }; },
    verify: async () => { calls.verify += 1; return { state: 'MATCHED', detail: 'ok', record: { id: 'lr-1', status: 'PENDING' } }; },
    ...executorOverrides,
  } as unknown as ActionExecutorService;
  const audit = { logProposed: async () => ({ id: 'log-proposed' }) } as unknown as ActionAuditService;
  const config = { get: () => ({ actionTokenTtlMinutes: 15 }) } as unknown as ConfigService;
  return { service: new ActionProposalService(prisma, config, audit, executor), calls };
}

describe('ActionProposalService.decide — Confirm (T041-T045)', () => {
  it('confirms: revalidates, consumes, executes exactly once, verifies, and reports SUCCESS', async () => {
    const { prisma, row } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('SUCCESS');
    expect(outcome.recordId).toBe('lr-1');
    expect(outcome.verificationState).toBe('MATCHED');
    expect(calls.execute).toBe(1);
    expect(calls.verify).toBe(1);
    expect(row.status).toBe(ActionProposalStatus.CONSUMED);
    expect(row.executedAt).not.toBeNull();
    expect(row.verificationState).toBe('MATCHED');
  });

  it('two concurrent confirms of one token produce exactly ONE execute (T037, SC-002)', async () => {
    const { prisma } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const [a, b] = await Promise.all([
      service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor }),
      service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor }),
    ]);

    expect(calls.execute).toBe(1);
    expect([a.status, b.status].sort()).toEqual(['ALREADY_SUBMITTED', 'SUCCESS']);
  });

  it('a second confirm after success says already submitted and makes no second write (T045)', async () => {
    const { prisma } = buildPrisma();
    const { service, calls } = buildService(prisma);
    await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    const again = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(again.status).toBe('ALREADY_SUBMITTED');
    expect(again.recordId).toBe('lr-1');
    expect(calls.execute).toBe(1);
  });

  it('refuses at revalidation WITHOUT consuming the token, so the user can retry (T043)', async () => {
    const { prisma, row } = buildPrisma();
    const { service, calls } = buildService(prisma, { revalidate: async () => ({ ok: false, reason: 'balance changed' }) });

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('REFUSED');
    expect(outcome.reason).toBe('balance changed');
    expect(row.status).toBe(ActionProposalStatus.PENDING);
    expect(calls.execute).toBe(0);
  });

  it('reports FAILED with the downstream reason and records it on the row; verify is skipped (T052)', async () => {
    const { prisma, row } = buildPrisma();
    const { service, calls } = buildService(prisma, {
      execute: async () => ({ status: 'FAILED', httpStatus: 409, reason: 'HR Core returned: OverlappingRequest', executionLogId: 'log-exec' }),
    });

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('FAILED');
    expect(outcome.httpStatus).toBe(409);
    expect(outcome.reason).toBe('HR Core returned: OverlappingRequest');
    expect(row.resultStatusCode).toBe(409);
    expect(row.resultErrorCode).toBe('HTTP_409');
    expect(calls.verify).toBe(0);
  });

  it('reports UNVERIFIED with a manual fallback when the read-back does not match (T055)', async () => {
    const { prisma, row } = buildPrisma();
    const { service } = buildService(prisma, {
      verify: async () => ({ state: 'UNAVAILABLE', detail: 'read-back failed', record: null }),
    });

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('UNVERIFIED');
    expect(outcome.summary).toMatch(/Leaves page|HR/);
    expect(row.verificationState).toBe('UNAVAILABLE');
  });
});

describe('ActionProposalService.decide — token refusal paths, no downstream call (T038, SC-005)', () => {
  it('expired token -> EXPIRED, row marked, nothing executed', async () => {
    const { prisma, row } = buildPrisma({ expiresAt: new Date(Date.now() - 1_000) });
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('EXPIRED');
    expect(row.status).toBe(ActionProposalStatus.EXPIRED);
    expect(calls.execute).toBe(0);
  });

  it('wrong user -> NOT_FOUND (never confirms the token exists), nothing executed, row untouched', async () => {
    const { prisma, row } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor: otherUser });

    expect(outcome.status).toBe('NOT_FOUND');
    expect(row.status).toBe(ActionProposalStatus.PENDING);
    expect(calls.execute).toBe(0);
  });

  it('wrong conversation -> NOT_FOUND (T042)', async () => {
    const { prisma } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-OTHER', actor });

    expect(outcome.status).toBe('NOT_FOUND');
    expect(calls.execute).toBe(0);
  });

  it('unknown token -> NOT_FOUND', async () => {
    const { prisma } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'nope', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('NOT_FOUND');
    expect(calls.execute).toBe(0);
  });
});

describe('ActionProposalService.decide — Cancel (T046, FR-013)', () => {
  it('consumes the token, makes no downstream call, and leaves executedAt null', async () => {
    const { prisma, row } = buildPrisma();
    const { service, calls } = buildService(prisma);

    const outcome = await service.decide({ token: 'tok-1', confirmed: false, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('CANCELLED');
    expect(row.status).toBe(ActionProposalStatus.CONSUMED);
    expect(row.executedAt).toBeNull();
    expect(calls.execute).toBe(0);
  });

  it('a confirm after a cancel reports the cancellation, not a submission', async () => {
    const { prisma } = buildPrisma();
    const { service, calls } = buildService(prisma);
    await service.decide({ token: 'tok-1', confirmed: false, conversationId: 'conv-1', actor });

    const outcome = await service.decide({ token: 'tok-1', confirmed: true, conversationId: 'conv-1', actor });

    expect(outcome.status).toBe('CANCELLED');
    expect(calls.execute).toBe(0);
  });
});
