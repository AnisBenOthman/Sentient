import { Injectable, Logger, Optional } from '@nestjs/common';
import { AgentActionKind, AgentRunStatus, AgentType, MessageRole, PermissionDecision } from '../../../generated/prisma';
import {
  DownstreamRequestContext,
  DownstreamResult,
  HrCoreAiClient,
  LeaveBalanceContext,
  LeaveRequestContext,
  LeaveTypeContext,
} from '../../../common/clients';
import {
  LeaveBookingConfirmationPayload,
  PolicyCitation,
  SpecialistInput,
  SpecialistResult,
} from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge/knowledge.repository';
import {
  countAdvisoryBusinessDays,
  DateRange,
  iso,
  parseBookingRequest,
  parseDateRange,
  removeExplicitDates,
} from './leave-booking-request.parser';

const ACTIVE_REQUEST_STATUSES = new Set(['PENDING', 'APPROVED']);

/**
 * The clarifying questions this service asks, by their fixed openers. A reply
 * to one of them is merged with the request that prompted it (see
 * continuationText). Fixed text is what makes the match exact rather than
 * fuzzy: `question()` content is persisted verbatim by FinalAnswerNodeService,
 * so the previous assistant message either starts with one of these or the
 * chain ends. Declines (REFUSED) are deliberately not here — the final-answer
 * policy may rewrite those.
 */
const CLARIFICATION_OPENERS = [
  'Which type of leave should I book?',
  'Which dates should I book for ',
  'Those dates (',
];

/** How many question→answer pairs a booking may span (type, then dates, then a past-date correction). */
const MAX_CLARIFICATION_HOPS = 3;

export function isBookingClarification(content: string): boolean {
  const trimmed = content.trim();
  return CLARIFICATION_OPENERS.some((opener) => trimmed.startsWith(opener));
}

/** Everything Reason resolved about who is asking, before any leave logic runs (spec 017 T026). */
interface ResolvedIdentity {
  employeeId: string;
  businessUnitId: string;
  firstName: string | null;
  gender: string | null;
  country: string | null;
  degradations: string[];
}

type LeaveTypeResolution =
  | { kind: 'RESOLVED'; leaveType: LeaveTypeContext }
  | { kind: 'AMBIGUOUS'; options: LeaveTypeContext[] }
  | { kind: 'NONE' };

/**
 * The Reason and Propose phases of the leave-booking action (spec 017 US1).
 *
 * Reads everything, writes nothing. The only outputs are a frozen payload for the
 * user to confirm, a decline with concrete numbers, or one clarifying question.
 * `HrCoreAiClient.createLeaveRequest` is never referenced from this file — that
 * is the FR-002 guarantee, and the integration test asserts it.
 */
@Injectable()
export class LeaveBookingReasonService {
  private readonly logger = new Logger(LeaveBookingReasonService.name);

  constructor(
    private readonly hrCore: HrCoreAiClient,
    @Optional() private readonly knowledge?: KnowledgeRepository,
  ) {}

  /**
   * Returns null when this turn is not a booking request at all, so the Leave
   * Agent falls through to its ordinary read-only paths untouched.
   */
  async tryPropose(input: SpecialistInput): Promise<SpecialistResult | null> {
    /**
     * WHY the runtime check on top of the compile-time union: SpecialistInput is
     * built by the runner, and only LEAVE_AGENT receives action-capable
     * constraints (T010). If that wiring ever regresses, a read-only input must
     * silently take the read-only path rather than propose anything.
     */
    if (input.constraints.readOnlyOfficialRecords !== false) return null;
    if (!input.constraints.permittedActions.includes(AgentActionKind.LEAVE_BOOKING)) return null;

    let parsed = parseBookingRequest(input.userMessage);
    if (!parsed.isBookingRequest) {
      const continuation = this.continuationText(input);
      if (!continuation) return null;
      parsed = parseBookingRequest(continuation);
      if (!parsed.isBookingRequest) return null;
    }

    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    // ---- Identity resolution comes first; everything below is scoped by it (T026).
    const identity = await this.resolveIdentity(input, reqContext);
    if ('failure' in identity) return identity.failure;

    // ---- Leave type, scoped to the resolved business unit (T027).
    const typesResult = await this.hrCore.getLeaveTypes(identity.businessUnitId, reqContext);
    if (typesResult.permissionDecision !== PermissionDecision.ALLOWED || !typesResult.data) {
      return this.degraded(
        'Leave types unavailable; booking not proposed.',
        `I couldn't load the leave types for your business unit right now, so I can't prepare a booking. ${this.retryHint(typesResult)}`,
        typesResult.permissionDecision,
      );
    }
    const activeTypes = typesResult.data.leaveTypes.filter((type) => type.isActive);
    const resolution = this.resolveLeaveType(activeTypes, parsed.leaveTypeHint, parsed.mentionsIllness, identity.gender);
    if (resolution.kind === 'NONE') {
      return this.decline(
        'No active leave types configured for the business unit.',
        "There are no active leave types set up for your business unit, so I can't prepare a booking. Please contact HR.",
      );
    }
    if (resolution.kind === 'AMBIGUOUS') {
      const names = resolution.options.map((type) => type.name).join(', ');
      return this.question(
        'Leave type needs clarification.',
        `Which type of leave should I book? Your options are: ${names}.`,
      );
    }
    const leaveType = resolution.leaveType;

    // ---- Dates. Illness with no date defaults to today (spec 017 FR-029); anything else asks.
    const range = parsed.range ?? (parsed.mentionsIllness ? this.todayRange() : null);
    if (!range) {
      return this.question(
        'Dates need clarification.',
        `Which dates should I book for ${leaveType.name}? You can say something like "next Monday to Wednesday" or "12 June to 14 June".`,
      );
    }
    if (range.startDate < iso(new Date())) {
      return this.question(
        'Requested dates are in the past.',
        `Those dates (${range.startDate} to ${range.endDate}) are in the past. Which upcoming dates should I book?`,
      );
    }

    // ---- Advisory business-day count with the business unit's holiday calendar (T028).
    const holidays = await this.hrCore.getHolidaysContext(identity.businessUnitId, reqContext);
    const holidayDates = new Set(
      (holidays.data?.holidays ?? []).map((holiday) => holiday.date.slice(0, 10)),
    );
    if (holidays.permissionDecision !== PermissionDecision.ALLOWED) {
      identity.degradations.push('holiday calendar unavailable — the day count may include public holidays');
    }
    const businessDays = countAdvisoryBusinessDays(range, holidayDates);
    if (businessDays === 0) {
      return this.decline(
        'Requested range contains no working days.',
        `${range.startDate} to ${range.endDate} contains no working days (weekends or public holidays only), so there's nothing to book. Which dates did you mean?`,
      );
    }

    // ---- Balance and overlap from the same read (T029).
    const leaveContext = await this.hrCore.getLeaveContext(identity.employeeId, reqContext);
    if (leaveContext.permissionDecision !== PermissionDecision.ALLOWED || !leaveContext.data) {
      return this.degraded(
        'Leave balance unavailable; booking not proposed.',
        `I couldn't check your leave balance right now, so I won't propose a booking I can't verify. ${this.retryHint(leaveContext)}`,
        leaveContext.permissionDecision,
      );
    }

    const overlap = this.findOverlap(leaveContext.data.recentRequests, range);
    if (overlap) {
      return this.decline(
        'Requested range overlaps an existing request.',
        `You already have a ${overlap.status.toLowerCase()} ${overlap.leaveType?.name ?? 'leave'} request from ${overlap.startDate.slice(0, 10)} to ${overlap.endDate.slice(0, 10)}, which overlaps ${range.startDate} to ${range.endDate}. I haven't booked anything. Cancel that request first, or pick different dates.`,
      );
    }

    const year = Number(range.startDate.slice(0, 4));
    const balance = this.findBalance(leaveContext.data.balances, leaveType.name, year);
    const currentBalance = balance ? this.toNumber(balance.remainingDays) : 0;
    if (currentBalance < businessDays) {
      const balanceNote = balance
        ? `You have ${this.formatDays(currentBalance)} of ${leaveType.name} remaining for ${year}, but this request needs ${this.formatDays(businessDays)}.`
        : `You have no ${leaveType.name} balance recorded for ${year}, and this request needs ${this.formatDays(businessDays)}.`;
      return this.decline(
        'Insufficient balance; booking not proposed.',
        `${balanceNote} I haven't booked anything. You could shorten the request, choose a different leave type, or ask HR about your balance.`,
      );
    }

    // ---- Policy consulted before the user confirms (FR-017, FR-019).
    const policyCitations = await this.retrievePolicy(leaveType.name);

    // ---- Propose: freeze the payload. No token yet — that is minted once the message exists.
    const payload: LeaveBookingConfirmationPayload = {
      leaveTypeId: leaveType.id,
      leaveTypeName: leaveType.name,
      startDate: range.startDate,
      endDate: range.endDate,
      businessDays,
      currentBalance,
      balanceAfter: this.round(currentBalance - businessDays),
      employeeId: identity.employeeId,
    };

    const greeting = identity.firstName ? `${identity.firstName}, here's` : "Here's";
    const degradedNote = identity.degradations.length
      ? ` (Note: ${identity.degradations.join('; ')}.)`
      : '';
    const policyNote = policyCitations.length === 0
      ? ' I checked for a relevant policy document and did not find one, so there are no policy notes to show.'
      : '';

    return {
      agentType: AgentType.LEAVE_AGENT,
      status: AgentRunStatus.PENDING_CONFIRMATION,
      summary: `Leave booking proposed: ${leaveType.name} ${range.startDate} to ${range.endDate} (${businessDays} business days). Awaiting confirmation.`,
      userVisibleContent:
        `${greeting} what I'll book — please review the details and confirm when you're ready. Nothing is submitted until you confirm.${policyNote}${degradedNote}`,
      sourceContext: [{ sourceType: 'LEAVE', title: 'Leave balance and history', referenceId: leaveContext.data.id ?? 'leave:context' }],
      permissionDecision: PermissionDecision.ALLOWED,
      recommendedNextStep: 'Confirm or cancel the proposed booking.',
      confirmationPayload: payload,
      pendingActionKind: AgentActionKind.LEAVE_BOOKING,
      policyCitations,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * WHY: a user answering "Which dates should I book for Annual Leave?" with
   * "20 September" has not restated the booking, and parseBookingRequest on
   * that reply alone finds no intent — the live Slack transcript of 2026-09-15
   * fell through to the LLM at exactly this point. Walk back through the
   * recent messages: for as long as the previous assistant turn was one of
   * this service's own clarifying questions, prepend the user message that
   * prompted it. Anything else — an LLM-phrased question, a turn that moved on
   * — ends the chain, so stale context can never mint a proposal (spec 017
   * FR-001: one clarifying question, never a guess).
   */
  private continuationText(input: SpecialistInput): string | null {
    const history = input.conversationContext.recentMessages;
    // The current user message is persisted before the context window is built, so it rides at the end.
    let index = history.length - 1;
    const last = history[index];
    if (last && last.role === MessageRole.USER && last.content === input.userMessage) index -= 1;

    const parts: string[] = [];
    for (let hops = 0; hops < MAX_CLARIFICATION_HOPS && index >= 1; hops += 1) {
      const assistant = history[index]!;
      const user = history[index - 1]!;
      if (assistant.role !== MessageRole.ASSISTANT || !isBookingClarification(assistant.content)) break;
      if (user.role !== MessageRole.USER) break;
      parts.unshift(user.content);
      index -= 2;
    }
    if (parts.length === 0) return null;

    /**
     * WHY blank the earlier dates only when the reply brings its own: after
     * "Those dates are in the past — which upcoming dates?" the old dates
     * must not compete with the new ones, but the earlier turn's duration
     * ("2 days") still applies, so "next week" in the reply books two days
     * from Monday, not the whole week. A reply with no dates at all ("annual",
     * answering the type question) keeps whatever dates were said before.
     */
    const earlier = parseDateRange(input.userMessage) ? parts.map(removeExplicitDates) : parts;
    return `${earlier.join(' ')} ${input.userMessage}`;
  }

  private async resolveIdentity(
    input: SpecialistInput,
    reqContext: DownstreamRequestContext,
  ): Promise<ResolvedIdentity | { failure: SpecialistResult }> {
    const { employeeId, businessUnitId } = input.actorContext;
    if (!employeeId) {
      return {
        failure: this.degraded(
          'Caller has no employee record; booking not proposed.',
          "Your Sentient account isn't linked to an employee record, so I can't book leave for you. Please contact HR to get that linked.",
          PermissionDecision.UNAVAILABLE,
        ),
      };
    }
    if (!businessUnitId) {
      return {
        failure: this.degraded(
          'Caller has no business unit; booking not proposed.',
          "I couldn't determine which business unit you belong to, and leave types are set per business unit. Please ask HR to check your team or department assignment.",
          PermissionDecision.UNAVAILABLE,
        ),
      };
    }

    const degradations: string[] = [];
    let firstName: string | null = null;
    let gender: string | null = null;
    let country: string | null = null;

    // One profile read for the three display/eligibility facts. Each degrades on its own (T026).
    const profile = await this.hrCore.getEmployeeProfileContext(employeeId, reqContext);
    if (profile.permissionDecision === PermissionDecision.ALLOWED && profile.data) {
      firstName = profile.data.firstName ?? null;
      gender = profile.data.gender ?? null;
      country = profile.data.country ?? null;
    } else {
      degradations.push('your profile could not be read, so gender-specific leave types are not filtered');
    }

    return { employeeId, businessUnitId, firstName, gender, country, degradations };
  }

  /**
   * The user's phrasing maps to a leave-type NAME; the resolved ID is what enters
   * the payload (T027). Gender-conditional types are filtered when gender is
   * known, and presented as options rather than guessed when it is not.
   */
  private resolveLeaveType(
    types: LeaveTypeContext[],
    hint: string | null,
    mentionsIllness: boolean,
    gender: string | null,
  ): LeaveTypeResolution {
    if (types.length === 0) return { kind: 'NONE' };

    const matchers: Record<string, RegExp> = {
      sick: /sick|medical|illness|maladie/i,
      parental: /parental|maternity|paternity|maternit|paternit/i,
      bereavement: /bereavement|compassionate|funeral/i,
      unpaid: /unpaid/i,
      study: /study|exam|training/i,
      annual: /annual|vacation|paid|holiday|cong[ée] pay/i,
    };

    const effectiveHint = hint ?? (mentionsIllness ? 'sick' : null);
    if (effectiveHint) {
      let candidates = types.filter((type) => matchers[effectiveHint]!.test(type.name));
      if (effectiveHint === 'parental' && gender) {
        const gendered = candidates.filter((type) => this.genderMatches(type.name, gender));
        if (gendered.length > 0) candidates = gendered;
      }
      if (candidates.length === 1) return { kind: 'RESOLVED', leaveType: candidates[0]! };
      if (candidates.length > 1) return { kind: 'AMBIGUOUS', options: candidates };
      // Fall through: the hint matched nothing configured; offer everything.
    }

    if (types.length === 1) return { kind: 'RESOLVED', leaveType: types[0]! };

    // No hint at all: an unambiguous "annual"-style default is acceptable; otherwise ask.
    if (!effectiveHint) {
      const annual = types.filter((type) => matchers.annual!.test(type.name));
      if (annual.length === 1) return { kind: 'RESOLVED', leaveType: annual[0]! };
    }
    return { kind: 'AMBIGUOUS', options: types };
  }

  private genderMatches(typeName: string, gender: string): boolean {
    const name = typeName.toLowerCase();
    const isMaternity = /maternity|maternit/.test(name);
    const isPaternity = /paternity|paternit/.test(name);
    if (!isMaternity && !isPaternity) return true;
    const g = gender.toUpperCase();
    if (isMaternity) return g === 'FEMALE';
    return g === 'MALE';
  }

  private findOverlap(requests: LeaveRequestContext[], range: DateRange): LeaveRequestContext | null {
    for (const request of requests) {
      if (!ACTIVE_REQUEST_STATUSES.has(request.status.toUpperCase())) continue;
      const start = request.startDate.slice(0, 10);
      const end = request.endDate.slice(0, 10);
      if (start <= range.endDate && end >= range.startDate) return request;
    }
    return null;
  }

  private findBalance(balances: LeaveBalanceContext[], leaveTypeName: string, year: number): LeaveBalanceContext | null {
    const wanted = leaveTypeName.toLowerCase();
    return balances.find((balance) => balance.leaveTypeName.toLowerCase() === wanted && Number(balance.year) === year)
      ?? balances.find((balance) => balance.leaveTypeName.toLowerCase() === wanted)
      ?? null;
  }

  /**
   * Policy retrieval is best-effort (T031-lite): a failure here must never block a
   * booking the balance and calendar already justified. An empty result is
   * meaningful — the card says so explicitly rather than staying silent (FR-019).
   */
  private async retrievePolicy(leaveTypeName: string): Promise<PolicyCitation[]> {
    if (!this.knowledge) return [];
    try {
      const results = await this.knowledge.searchApproved(`${leaveTypeName} leave policy`, 3);
      return results.map((result) => ({
        sourceLabel: result.item?.title ?? this.metadataTitle(result.document.metadata) ?? 'Policy document',
        excerpt: this.excerpt(result.document.content),
      }));
    } catch (error: unknown) {
      this.logger.warn(`Policy retrieval failed; proposing without citations: ${error instanceof Error ? error.message : 'unknown error'}`);
      return [];
    }
  }

  private metadataTitle(metadata: unknown): string | null {
    if (typeof metadata !== 'object' || metadata === null) return null;
    const title = (metadata as Record<string, unknown>)['title'];
    return typeof title === 'string' && title.trim() ? title : null;
  }

  private excerpt(content: string): string {
    const trimmed = content.replace(/\s+/g, ' ').trim();
    return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
  }

  private todayRange(): DateRange {
    const today = iso(new Date());
    return { startDate: today, endDate: today };
  }

  // ---- Result builders -------------------------------------------------------

  private decline(summary: string, userVisibleContent: string): SpecialistResult {
    return {
      agentType: AgentType.LEAVE_AGENT,
      status: AgentRunStatus.REFUSED,
      summary,
      userVisibleContent,
      sourceContext: [],
      permissionDecision: PermissionDecision.ALLOWED,
    };
  }

  private question(summary: string, userVisibleContent: string): SpecialistResult {
    return {
      agentType: AgentType.LEAVE_AGENT,
      status: AgentRunStatus.SUCCESS,
      summary,
      userVisibleContent,
      sourceContext: [],
      permissionDecision: PermissionDecision.ALLOWED,
      recommendedNextStep: 'Answer the clarifying question to continue the booking.',
    };
  }

  private degraded(summary: string, userVisibleContent: string, decision: PermissionDecision): SpecialistResult {
    return {
      agentType: AgentType.LEAVE_AGENT,
      status: AgentRunStatus.DEGRADED,
      summary,
      userVisibleContent,
      sourceContext: [],
      permissionDecision: decision,
    };
  }

  private retryHint(result: DownstreamResult<unknown>): string {
    return result.permissionDecision === PermissionDecision.DENIED
      ? 'Your current permissions do not allow this.'
      : 'Please try again in a moment, or use the Leaves page in the web app.';
  }

  private toNumber(value: number | string): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatDays(value: number): string {
    return `${value} ${value === 1 ? 'day' : 'days'}`;
  }
}
