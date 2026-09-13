import { AgentActionKind, AgentRunStatus, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient, LeaveTypeContext } from '../../../common/clients';
import { SpecialistInput } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge/knowledge.repository';
import { LeaveBookingReasonService } from './leave-booking-reason.service';

const ANNUAL: LeaveTypeContext = {
  id: 'lt-annual', businessUnitId: 'bu-1', name: 'Annual Leave', defaultDaysPerYear: 25,
  accrualFrequency: 'MONTHLY', maxCarryoverDays: 5, requiresApproval: true, isActive: true, color: null,
};
const SICK: LeaveTypeContext = { ...ANNUAL, id: 'lt-sick', name: 'Sick Leave' };
const MATERNITY: LeaveTypeContext = { ...ANNUAL, id: 'lt-mat', name: 'Maternity Leave' };
const PATERNITY: LeaveTypeContext = { ...ANNUAL, id: 'lt-pat', name: 'Paternity Leave' };

function allowed<T>(data: T) {
  return { data, permissionDecision: PermissionDecision.ALLOWED, degradedReason: null, sourceType: 'X', sourceTitle: 'X' };
}
function denied() {
  return { data: null, permissionDecision: PermissionDecision.DENIED, degradedReason: 'nope', sourceType: 'X', sourceTitle: 'X' };
}

interface ClientOverrides {
  leaveTypes?: LeaveTypeContext[];
  balances?: Array<{ leaveTypeName: string; year: number; remainingDays: number | string }>;
  recentRequests?: Array<{ startDate: string; endDate: string; status: string; leaveTypeName?: string }>;
  holidays?: string[];
  profile?: { firstName: string; gender: string | null } | 'denied';
  leaveContextDenied?: boolean;
}

function buildClient(overrides: ClientOverrides = {}) {
  const calls = { createLeaveRequest: 0 };
  const year = new Date().getUTCFullYear();
  const client = {
    getEmployeeProfileContext: async () =>
      overrides.profile === 'denied'
        ? denied()
        : allowed({ id: 'employee-1', lastName: 'X', country: 'FR', ...(overrides.profile ?? { firstName: 'Anis', gender: 'MALE' }) }),
    getLeaveTypes: async () => allowed({ id: 'leave:types', leaveTypes: overrides.leaveTypes ?? [ANNUAL, SICK] }),
    getHolidaysContext: async () =>
      allowed({ id: 'holidays', year, holidays: (overrides.holidays ?? []).map((date, index) => ({ id: `h${index}`, name: 'Holiday', date: `${date}T00:00:00.000Z`, isRecurring: false })) }),
    getLeaveContext: async () =>
      overrides.leaveContextDenied
        ? denied()
        : allowed({
            id: 'leave:ctx',
            balances: (overrides.balances ?? [{ leaveTypeName: 'Annual Leave', year, remainingDays: 10 }]).map((balance, index) => ({
              id: `b${index}`, totalDays: 25, usedDays: 0, pendingDays: 0, ...balance,
            })),
            recentRequests: (overrides.recentRequests ?? []).map((request, index) => ({
              id: `r${index}`, totalDays: 1, leaveType: { name: request.leaveTypeName ?? 'Annual Leave' }, ...request,
            })),
          }),
    createLeaveRequest: async () => {
      calls.createLeaveRequest += 1;
      throw new Error('createLeaveRequest must never be called during Reason/Propose (FR-002)');
    },
  } as unknown as HrCoreAiClient;
  return { client, calls };
}

function buildInput(userMessage: string, options: { readOnly?: boolean; employeeId?: string | null; businessUnitId?: string | null } = {}): SpecialistInput {
  return {
    conversationId: 'conversation-1',
    parentTaskLogId: 'task-1',
    userMessage,
    normalizedIntent: userMessage,
    actorContext: {
      jwt: 'token', userId: 'user-1',
      employeeId: options.employeeId === undefined ? 'employee-1' : options.employeeId,
      roles: ['EMPLOYEE'], departmentId: null, teamId: null,
      businessUnitId: options.businessUnitId === undefined ? 'bu-1' : options.businessUnitId,
      roleAssignments: [], correlationId: 'corr-1',
    },
    conversationContext: { recentMessages: [], priorHandoffAgents: [] },
    sourceHints: [],
    isDraftRequest: false,
    constraints: options.readOnly
      ? { sentientOnly: true, readOnlyOfficialRecords: true, mustReturnToSupervisor: true }
      : { sentientOnly: true, readOnlyOfficialRecords: false, mustReturnToSupervisor: true, permittedActions: [AgentActionKind.LEAVE_BOOKING] },
  };
}

/** A future weekday range far enough out to never be "in the past" for the test run. */
function futureRange(): { text: string; startDate: string; endDate: string } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 14);
  while (start.getUTCDay() === 0 || start.getUTCDay() === 6) start.setUTCDate(start.getUTCDate() + 1);
  // start is a weekday; if it is Thu/Fri a +2 span crosses a weekend, so pin to Mon-Wed.
  while (start.getUTCDay() > 3) start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  return { text: `from ${startDate} to ${endDate}`, startDate, endDate };
}

describe('LeaveBookingReasonService — Reason and Propose (T023, T025)', () => {
  it('returns null for a non-booking message so the read-only paths run', async () => {
    const { client } = buildClient();
    const service = new LeaveBookingReasonService(client);
    expect(await service.tryPropose(buildInput('What is my leave balance?'))).toBeNull();
  });

  it('returns null when the specialist was given read-only constraints, even for a booking request', async () => {
    const { client } = buildClient();
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();
    expect(await service.tryPropose(buildInput(`book annual leave ${text}`, { readOnly: true }))).toBeNull();
  });

  it('proposes with a frozen payload when balance is sufficient — and never writes (FR-002)', async () => {
    const { client, calls } = buildClient({ balances: [{ leaveTypeName: 'Annual Leave', year: new Date().getUTCFullYear() + 1, remainingDays: 10 }, { leaveTypeName: 'Annual Leave', year: new Date().getUTCFullYear(), remainingDays: 10 }] });
    const service = new LeaveBookingReasonService(client);
    const { text, startDate, endDate } = futureRange();

    const result = await service.tryPropose(buildInput(`I want to book annual leave ${text}`));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
    expect(result!.pendingActionKind).toBe(AgentActionKind.LEAVE_BOOKING);
    expect(result!.confirmationPayload).toEqual(expect.objectContaining({
      leaveTypeId: 'lt-annual',
      leaveTypeName: 'Annual Leave',
      startDate,
      endDate,
      businessDays: 3,
      currentBalance: 10,
      balanceAfter: 7,
      employeeId: 'employee-1',
    }));
    expect(result!.confirmationToken).toBeUndefined(); // minted later, once the message exists
    expect(result!.userVisibleContent).not.toContain(startDate); // card fields live in the payload, not the prose
    expect(calls.createLeaveRequest).toBe(0);
  });

  it('declines with concrete numbers when balance is insufficient, and mints nothing', async () => {
    const { client, calls } = buildClient({ balances: [{ leaveTypeName: 'Annual Leave', year: new Date().getUTCFullYear(), remainingDays: 2 }] });
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.status).toBe(AgentRunStatus.REFUSED);
    expect(result!.confirmationPayload).toBeUndefined();
    expect(result!.userVisibleContent).toContain('2 days');
    expect(result!.userVisibleContent).toContain('3 days');
    expect(calls.createLeaveRequest).toBe(0);
  });

  it('surfaces an overlapping active request and does not propose', async () => {
    const { text, startDate, endDate } = futureRange();
    const { client } = buildClient({ recentRequests: [{ startDate, endDate, status: 'PENDING' }] });
    const service = new LeaveBookingReasonService(client);

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.status).toBe(AgentRunStatus.REFUSED);
    expect(result!.userVisibleContent).toContain('overlaps');
    expect(result!.confirmationPayload).toBeUndefined();
  });

  it('ignores cancelled or rejected requests when checking overlap', async () => {
    const { text, startDate, endDate } = futureRange();
    const { client } = buildClient({ recentRequests: [{ startDate, endDate, status: 'REJECTED' }] });
    const service = new LeaveBookingReasonService(client);

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));
    expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
  });

  it('asks one question when the dates are missing instead of guessing', async () => {
    const { client } = buildClient();
    const service = new LeaveBookingReasonService(client);

    const result = await service.tryPropose(buildInput('I want to book some annual leave'));

    expect(result!.status).toBe(AgentRunStatus.SUCCESS);
    expect(result!.userVisibleContent).toMatch(/which dates/i);
    expect(result!.confirmationPayload).toBeUndefined();
  });

  it('asks which leave type when the phrasing is ambiguous across several types', async () => {
    const { client } = buildClient({ leaveTypes: [ANNUAL, SICK, { ...ANNUAL, id: 'lt-unpaid', name: 'Unpaid Leave' }, { ...ANNUAL, id: 'lt-study', name: 'Study Leave' }] });
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();

    // "leave" with no type hint and more than one non-annual option -> annual is the single default.
    const result = await service.tryPropose(buildInput(`book leave ${text}`));
    expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
    expect(result!.confirmationPayload?.leaveTypeId).toBe('lt-annual');
  });

  it('filters gender-conditional types by the resolved gender, and offers both when gender is unknown', async () => {
    const { text } = futureRange();

    const year = new Date().getUTCFullYear();
    const parentalBalances = [
      { leaveTypeName: 'Maternity Leave', year, remainingDays: 20 },
      { leaveTypeName: 'Paternity Leave', year, remainingDays: 10 },
    ];
    const male = new LeaveBookingReasonService(buildClient({ leaveTypes: [ANNUAL, MATERNITY, PATERNITY], balances: parentalBalances, profile: { firstName: 'A', gender: 'MALE' } }).client);
    const maleResult = await male.tryPropose(buildInput(`request parental leave ${text}`));
    expect(maleResult!.confirmationPayload?.leaveTypeId).toBe('lt-pat');

    const unknown = new LeaveBookingReasonService(buildClient({ leaveTypes: [ANNUAL, MATERNITY, PATERNITY], balances: parentalBalances, profile: { firstName: 'A', gender: null } }).client);
    const unknownResult = await unknown.tryPropose(buildInput(`request parental leave ${text}`));
    expect(unknownResult!.status).toBe(AgentRunStatus.SUCCESS);
    expect(unknownResult!.userVisibleContent).toContain('Maternity Leave');
    expect(unknownResult!.userVisibleContent).toContain('Paternity Leave');
  });

  it('defaults illness with no date to today as sick leave (FR-029)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const isWeekend = [0, 6].includes(new Date().getUTCDay());
    const { client } = buildClient({ balances: [{ leaveTypeName: 'Sick Leave', year: new Date().getUTCFullYear(), remainingDays: 5 }] });
    const service = new LeaveBookingReasonService(client);

    const result = await service.tryPropose(buildInput("I'm sick and can't come in"));

    if (isWeekend) {
      expect(result!.status).toBe(AgentRunStatus.REFUSED); // no working days today
    } else {
      expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
      expect(result!.confirmationPayload).toEqual(expect.objectContaining({ leaveTypeId: 'lt-sick', startDate: today, endDate: today }));
    }
  });

  it('degrades honestly when the balance cannot be read, rather than proposing blind', async () => {
    const { client } = buildClient({ leaveContextDenied: true });
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.status).toBe(AgentRunStatus.DEGRADED);
    expect(result!.confirmationPayload).toBeUndefined();
  });

  it('degrades independently when the profile read fails — still proposes, with a note (T026)', async () => {
    const { client } = buildClient({ profile: 'denied' });
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
    expect(result!.userVisibleContent).toContain('profile could not be read');
  });

  it('refuses without an employee record or business unit', async () => {
    const { client } = buildClient();
    const service = new LeaveBookingReasonService(client);
    const { text } = futureRange();

    const noEmployee = await service.tryPropose(buildInput(`book annual leave ${text}`, { employeeId: null }));
    expect(noEmployee!.status).toBe(AgentRunStatus.DEGRADED);
    expect(noEmployee!.permissionDecision).toBe(PermissionDecision.UNAVAILABLE);

    const noBu = await service.tryPropose(buildInput(`book annual leave ${text}`, { businessUnitId: null }));
    expect(noBu!.status).toBe(AgentRunStatus.DEGRADED);
  });
});

describe('LeaveBookingReasonService — policy citations (T024)', () => {
  it('attaches citations when policy is retrieved (FR-017)', async () => {
    const knowledge = {
      searchApproved: async () => [
        { document: { content: 'Annual leave must be requested 5 working days in advance.', metadata: {} }, item: { title: 'Leave Policy 2026' } },
      ],
    } as unknown as KnowledgeRepository;
    const service = new LeaveBookingReasonService(buildClient().client, knowledge);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.policyCitations).toEqual([
      { sourceLabel: 'Leave Policy 2026', excerpt: 'Annual leave must be requested 5 working days in advance.' },
    ]);
    expect(result!.userVisibleContent).not.toContain('did not find one');
  });

  it('states explicitly that no policy document was found when retrieval is empty (FR-019)', async () => {
    const knowledge = { searchApproved: async () => [] } as unknown as KnowledgeRepository;
    const service = new LeaveBookingReasonService(buildClient().client, knowledge);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));

    expect(result!.policyCitations).toEqual([]);
    expect(result!.userVisibleContent).toContain('did not find one');
  });

  it('still proposes when policy retrieval throws', async () => {
    const knowledge = { searchApproved: async () => { throw new Error('pgvector down'); } } as unknown as KnowledgeRepository;
    const service = new LeaveBookingReasonService(buildClient().client, knowledge);
    const { text } = futureRange();

    const result = await service.tryPropose(buildInput(`book annual leave ${text}`));
    expect(result!.status).toBe(AgentRunStatus.PENDING_CONFIRMATION);
    expect(result!.policyCitations).toEqual([]);
  });
});
