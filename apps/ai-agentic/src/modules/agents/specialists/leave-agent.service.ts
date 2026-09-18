import { Injectable, Optional } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import {
  DownstreamRequestContext,
  HolidayAiContext,
  HolidayContext,
  HrCoreAiClient,
  LeaveAiContext,
  LeaveBalanceContext,
  LeaveRequestContext,
  TeamLeaveAiContext,
} from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import {
  CONVERSATIONAL_STYLE,
  DRAFT_MODE_DIRECTIVE,
  FEW_SHOT_LEAVE_EXAMPLES,
  GeminiCallOptions,
  LlmFallbackOrchestratorService,
  LlmUnavailable,
  SENTIENT_IDENTITY,
  ToolRegistryService,
} from '../tools';
import { LeaveBookingReasonService } from '../actions/leave-booking-reason.service';
import { downstreamResult, toolCallerResult, withLlmOutageNotice } from './specialist-response.helpers';

const TEAM_LEAVE_SCOPE_ROLES = ['MANAGER', 'HR_ADMIN'];

const LEAVE_SYSTEM_PROMPT = `${SENTIENT_IDENTITY}

You are the Sentient HR leave assistant. Use the provided tools to answer leave questions accurately:
- Call get_my_leave_balance for balance, remaining days, or recent leave history questions (including pending or rejected requests).
- Call get_holidays for public/bank/company holiday calendar questions.
- Call get_team_leave_calendar (when available) for team coverage and who is on leave.
- Call get_team_absence_summary (when available) for who takes the most leave or absence frequency.
- Call get_employees_without_leave (when available) for who has NOT taken any leave, or has zero leave records — note this only means no approved leave request was found, not that the employee was present every day.
Call only the tools relevant to the question.
You cannot book, change, or cancel leave yourself, and you must never claim to have done so. If the user wants to book leave, ask them to state the leave type and the exact dates (for example: "book 2 days of annual leave from 12 June") — a separate confirmation step prepares the booking for them to approve.
${FEW_SHOT_LEAVE_EXAMPLES}
${CONVERSATIONAL_STYLE}`;

/**
 * First-person claims of having performed a write. The leave toolset is
 * read-only and LEAVE_SYSTEM_PROMPT says so, yet the 2026-09-15 Slack
 * transcript has the fallback model answering "I have booked 1 day of Annual
 * Leave for you" and "I have canceled your pending leave requests" with
 * nothing written to HR Core. A prompt line is not a guarantee; this check is.
 * Negations ("I haven't booked", "I have not booked") do not match.
 */
const COMPLETION_CLAIM =
  /\bi(?:'ve| have)?\s+(?:just\s+|now\s+|successfully\s+|already\s+)?(?:booked|submitted|cancel+ed|created|scheduled|logged|registered|filed|put in)\b|\b(?:booked|submitted|cancel+ed|scheduled)\s+(?:it|that|this|them|the request)?\s*for you\b/i;

const COMPLETION_CLAIM_REPLACEMENT =
  "I can't book, change, or cancel leave from a chat answer, and I haven't done so. To book leave, tell me the leave type and exact dates — for example \"book 2 days of annual leave from 12 June\" — and I'll prepare a booking for you to confirm. To cancel an existing request, use the Leaves page in the web app.";

/** Capitalized sentence starters that must not be mistaken for a person's name. */
const NAME_STOPWORDS = new Set([
  'What', 'Whats', 'Who', 'Whos', 'Where', 'When', 'How', 'Why', 'Whose',
  'Show', 'Tell', 'Give', 'Check', 'Today', 'Tomorrow', 'Yesterday', 'It', 'My', 'The',
  'Sentient', 'Company', 'Team', 'Everyone', 'Anyone',
]);

@Injectable()
export class LeaveAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LEAVE_AGENT;

  constructor(
    private readonly hrCore: HrCoreAiClient,
    @Optional() private readonly llmCaller?: LlmFallbackOrchestratorService,
    @Optional() private readonly toolRegistry?: ToolRegistryService,
    @Optional() private readonly booking?: LeaveBookingReasonService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    return this.run(input);
  }

  /** WHY registered as a streaming specialist (AI_AGENT_STREAMING_AGENT_TYPES): its ordinary Q&A path is a single LLM call producing prose — the common case worth streaming. */
  async executeStream(input: SpecialistInput, onToken: (delta: string) => void): Promise<SpecialistResult> {
    return this.run(input, onToken);
  }

  private async run(input: SpecialistInput, onToken?: (delta: string) => void): Promise<SpecialistResult> {
    const hasTeamLeaveScope = this.hasTeamLeaveScope(input);
    const reqContext: DownstreamRequestContext = {
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    };

    /**
     * WHY: FR-008 team scope guard runs before tool calling so we never attempt
     * a team tool call for callers without manager privileges.
     */
    if (this.requestsTeamCoverage(input) && !hasTeamLeaveScope) {
      return this.refusal(
        'Team leave coverage refused because the caller lacks manager scope.',
        'Team leave coverage is available to managers and HR admins. I can help with your own leave balance and history instead.',
      );
    }

    if (this.requestsIndividualThirdPartyLeave(input, hasTeamLeaveScope)) {
      const managerHint = hasTeamLeaveScope
        ? ' As a manager you can ask me for team leave coverage, or open the Leaves module for individual records you are authorized to view.'
        : '';
      return this.refusal(
        'Leave context refused because the request targets another individual.',
        `I cannot access or disclose another individual employee's leave balance or leave history. I can help with your own leave records, or with approved team-level leave coverage summaries when your Sentient role permits them.${managerHint}`,
      );
    }

    /**
     * WHY before the LLM tool-caller: a booking request must reach the
     * deterministic Reason/Propose path (spec 017 US1), never a model that could
     * answer "done" without doing anything. tryPropose returns null for every
     * non-booking message, so the read-only paths below are untouched. It also
     * runs after the two refusal guards above, so "book leave for Alice" is
     * still refused as a third-party request rather than proposed.
     */
    if (this.booking) {
      const proposal = await this.booking.tryPropose(input);
      if (proposal) return proposal;
    }

    /**
     * Holds the classified cause when every configured LLM provider is down, so
     * the deterministic answers below can say so instead of passing themselves
     * off as normal, complete answers. Booking proposals never reach here — they
     * return above from the deterministic Reason/Propose path.
     */
    let llmFailure: LlmUnavailable | null = null;

    if (this.llmCaller && this.toolRegistry) {
      const tools = this.toolRegistry.getLeaveTools(
        reqContext,
        input.actorContext.employeeId,
        input.actorContext.businessUnitId,
        hasTeamLeaveScope,
      );
      const systemPrompt = input.isDraftRequest
        ? `${LEAVE_SYSTEM_PROMPT}\n\n${DRAFT_MODE_DIRECTIVE}`
        : LEAVE_SYSTEM_PROMPT;
      const callOptions: GeminiCallOptions = { thinkingLevel: 'medium' };
      const result = onToken
        ? await this.llmCaller.callStream(
            systemPrompt,
            input.userMessage,
            tools,
            input.conversationContext.recentMessages,
            callOptions,
            onToken,
          )
        : await this.llmCaller.call(
            systemPrompt,
            input.userMessage,
            tools,
            input.conversationContext.recentMessages,
            callOptions,
          );
      if (result.ok) {
        const answered = toolCallerResult(input, this.agentType, result.outcome, {
          sourceType: 'LEAVE',
          title: 'Leave context',
          referencePrefix: 'leave',
          referenceFallback: 'tool-caller',
          successSummary: 'Leave context prepared.',
          limitedSummary: 'Leave guidance prepared with limited data access.',
          draftLabel: 'Leave request draft',
        });
        return this.withoutCompletionClaims(answered);
      }
      llmFailure = result.failure;
    }

    /**
     * WHY: Fallback deterministic path preserves existing routing for holiday
     * calendar, team coverage, and own-balance questions when Gemini is unavailable.
     */
    const deterministic = await this.runDeterministicQuery(input, reqContext);
    return llmFailure ? withLlmOutageNotice(deterministic, llmFailure) : deterministic;
  }

  /**
   * WHY split out: each branch is a real HR Core read that stays useful with no
   * model in front of it, so when the LLM is down the caller wraps whichever
   * branch ran in a single outage notice instead of every branch having to know
   * about LLM failures. Nothing here can write to HR Core.
   */
  private async runDeterministicQuery(
    input: SpecialistInput,
    reqContext: DownstreamRequestContext,
  ): Promise<SpecialistResult> {
    if (this.requestsHolidayCalendar(input)) {
      const holidays = await this.hrCore.getHolidaysContext(input.actorContext.businessUnitId, reqContext);
      return downstreamResult(
        input,
        this.agentType,
        holidays,
        'Company holiday calendar prepared.',
        this.describeHolidays(holidays.data, input),
        { suppressContinuityPrefix: this.wantsHolidayDateOnly(input) },
      );
    }

    if (this.requestsTeamCoverage(input)) {
      const coverage = await this.hrCore.getTeamLeaveContext(reqContext);
      const content = input.isDraftRequest
        ? 'Draft team coverage note: list who is on approved leave in the window, name the coverage owner for each absence, and flag overlaps for review before sharing.'
        : this.describeTeamCoverage(coverage.data);
      return downstreamResult(input, this.agentType, coverage, 'Team leave coverage prepared.', content, {
        draftLabel: 'Team coverage draft',
      });
    }

    const context = await this.hrCore.getLeaveContext(input.actorContext.employeeId, reqContext);
    const content = input.isDraftRequest
      ? 'Draft leave request: dates, leave type, coverage plan, and manager note should be reviewed in the Leaves module before submission.'
      : this.describeLeaveContext(context.data);
    return downstreamResult(input, this.agentType, context, 'Leave context prepared.', content, {
      draftLabel: 'Leave request draft',
    });
  }

  /**
   * Replaces an LLM answer that claims a write happened. Only the Reason/Propose
   * path above can lead to a write, and it never returns through here, so any
   * such claim in this branch is false by construction.
   */
  private withoutCompletionClaims(result: SpecialistResult): SpecialistResult {
    if (!COMPLETION_CLAIM.test(result.userVisibleContent)) return result;
    return {
      ...result,
      status: AgentRunStatus.DEGRADED,
      summary: 'Leave answer replaced: the model claimed to have booked or cancelled leave, which this path cannot do.',
      userVisibleContent: COMPLETION_CLAIM_REPLACEMENT,
    };
  }

  private refusal(summary: string, userVisibleContent: string): SpecialistResult {
    return {
      agentType: this.agentType,
      status: AgentRunStatus.REFUSED,
      summary,
      userVisibleContent,
      sourceContext: [],
      permissionDecision: PermissionDecision.DENIED,
    };
  }

  private describeLeaveContext(context: LeaveAiContext | null): string {
    if (!context) {
      return 'I could not read your current leave balance details, but I can still help with leave policy context and booking preparation.';
    }

    const lines = ['Here is your leave context:'];
    lines.push(this.balanceSummary(Array.isArray(context.balances) ? context.balances : []));
    lines.push(this.lastLeaveSummary(
      Array.isArray(context.recentRequests) ? context.recentRequests : [],
      context.requestHistoryUnavailable === true,
    ));
    lines.push('Official leave records stay read-only here; use the Leaves module to submit or change requests.');
    return lines.join('\n');
  }

  private describeHolidays(context: HolidayAiContext | null, input: SpecialistInput): string {
    if (!context) {
      return 'I could not read the company holiday calendar right now; you can check it in the Leaves module.';
    }
    const holidays = Array.isArray(context.holidays) ? context.holidays : [];
    if (holidays.length === 0) {
      return `No company holidays are configured for ${context.year} yet. HR admins maintain the holiday calendar in the Leaves module.`;
    }

    if (this.wantsNextHoliday(input)) {
      const nextHoliday = this.nextHoliday(holidays);
      if (!nextHoliday) {
        return `No upcoming company holidays are configured for the rest of ${context.year}.`;
      }
      const date = this.formatDate(nextHoliday.date);
      if (this.wantsHolidayDateOnly(input)) return date;
      return `Next company holiday: ${nextHoliday.name} on ${date}.`;
    }

    const shown = holidays.slice(0, 15);
    const lines = [`Company holidays for ${context.year} (${holidays.length}):`];
    for (const holiday of shown) {
      lines.push(`- ${holiday.name}: ${this.formatDate(holiday.date)}${holiday.isRecurring ? ' (recurring annually)' : ''}`);
    }
    if (holidays.length > shown.length) {
      lines.push(`...and ${holidays.length - shown.length} more in the Leaves module calendar.`);
    }
    return lines.join('\n');
  }

  private describeTeamCoverage(context: TeamLeaveAiContext | null): string {
    if (!context) {
      return 'I could not read team leave coverage right now, but you can check the team calendar in the Leaves module.';
    }
    const entries = Array.isArray(context.entries) ? context.entries : [];
    if (entries.length === 0) {
      return `Team coverage: no approved leave overlaps your scope between ${context.windowStart} and ${context.windowEnd}.`;
    }

    const shown = entries.slice(0, 8);
    const lines = [
      `Team coverage between ${context.windowStart} and ${context.windowEnd} (${entries.length} approved absence${entries.length === 1 ? '' : 's'}):`,
    ];
    for (const entry of shown) {
      lines.push(`- ${entry.employeeName}: ${this.formatDate(entry.startDate)} to ${this.formatDate(entry.endDate)}`);
    }
    if (entries.length > shown.length) {
      lines.push(`...and ${entries.length - shown.length} more in the Leaves module team calendar.`);
    }
    return lines.join('\n');
  }

  private balanceSummary(balances: LeaveBalanceContext[]): string {
    if (balances.length === 0) return 'No leave balances are configured for this year.';

    const totalRemaining = balances.reduce((sum, balance) => sum + this.toNumber(balance.remainingDays), 0);
    const details = balances
      .slice()
      .sort((left, right) => left.leaveTypeName.localeCompare(right.leaveTypeName))
      .map((balance) => {
        const remaining = this.formatDays(balance.remainingDays);
        const used = this.formatDays(balance.usedDays);
        const pending = this.formatDays(balance.pendingDays);
        const total = this.formatDays(balance.totalDays);
        return `${balance.leaveTypeName}: ${remaining} remaining (${used} used, ${pending} pending, ${total} total)`;
      })
      .join('; ');

    return `Balance: ${this.formatDays(totalRemaining)} remaining across all leave types. ${details}.`;
  }

  private lastLeaveSummary(requests: LeaveRequestContext[], historyUnavailable: boolean): string {
    if (historyUnavailable) {
      return 'Recent leave history could not be loaded right now.';
    }

    const approved = requests
      .filter((request) => request.status === 'APPROVED')
      .sort((left, right) => this.timeValue(right.endDate) - this.timeValue(left.endDate));
    const lastLeave = approved[0];
    if (!lastLeave) return 'Last leave: I did not find an approved leave request in your history.';

    const typeName = lastLeave.leaveType?.name ?? 'Leave';
    return `Last leave: ${typeName}, ${this.formatDate(lastLeave.startDate)} to ${this.formatDate(lastLeave.endDate)} (${this.formatDays(lastLeave.totalDays)}).`;
  }

  private formatDays(value: number | string): string {
    const days = this.toNumber(value);
    const formatted = Number.isInteger(days) ? String(days) : days.toFixed(1);
    return `${formatted} ${days === 1 ? 'day' : 'days'}`;
  }

  private toNumber(value: number | string): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  }

  private nextHoliday(holidays: HolidayContext[]): HolidayContext | null {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const upcoming = holidays
      .filter((holiday) => this.dayValue(holiday.date) >= today)
      .sort((left, right) => this.dayValue(left.date) - this.dayValue(right.date));
    return upcoming[0] ?? null;
  }

  private dayValue(value: string): number {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  private timeValue(value: string): number {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private hasTeamLeaveScope(input: SpecialistInput): boolean {
    return input.actorContext.roles.some((role) => TEAM_LEAVE_SCOPE_ROLES.includes(role));
  }

  /**
   * WHY: "holiday" alone is ambiguous — British English uses it for personal
   * leave ("how much holiday do I have left?"), which must stay on the balance
   * path. Qualified forms (bank/public/company holidays) or calendar phrasing
   * without balance words mark a holiday-calendar question.
   */
  private requestsHolidayCalendar(input: SpecialistInput): boolean {
    const text = this.currentRequestText(input);
    if (this.textRequestsHolidayCalendar(text)) return true;
    return this.isHolidayCalendarFollowUp(input, text);
  }

  private textRequestsHolidayCalendar(text: string): boolean {
    if (/\b(bank|public|company|national|official)\s+holidays?\b/.test(text)) return true;
    return (
      /\bholidays?\b/.test(text) &&
      /\b(calendar|list|dates?|when|which|upcoming|next|country|this year)\b/.test(text) &&
      !/\b(balance|remaining|left|book|request|take)\b/.test(text)
    );
  }

  private isHolidayCalendarFollowUp(input: SpecialistInput, text: string): boolean {
    if (/\b(balance|remaining|left|book|request|take)\b/.test(text)) return false;
    if (!/\b(next|date|when|which|only|just|one)\b/.test(text)) return false;

    const currentMessage = input.userMessage.trim().toLowerCase();
    return input.conversationContext.recentMessages.some((message) => {
      const content = message.content.trim().toLowerCase();
      if (content === currentMessage) return false;
      return this.textRequestsHolidayCalendar(content) || /^company holidays for\b/.test(content);
    });
  }

  private wantsNextHoliday(input: SpecialistInput): boolean {
    const text = this.currentRequestText(input);
    if (/\bnext\b/.test(text)) return true;
    return this.isHolidayCalendarFollowUp(input, text) && /\b(date|when|one)\b/.test(text);
  }

  private wantsHolidayDateOnly(input: SpecialistInput): boolean {
    const text = this.currentRequestText(input);
    return (
      /\b(only|just)\b/.test(text) &&
      /\b(date|day)\b/.test(text) &&
      this.wantsNextHoliday(input)
    );
  }

  private currentRequestText(input: SpecialistInput): string {
    return `${input.normalizedIntent} ${input.userMessage}`.toLowerCase();
  }

  private requestsTeamCoverage(input: SpecialistInput): boolean {
    const text = `${input.normalizedIntent} ${input.userMessage}`.toLowerCase();
    const teamTarget = /\b(my team(?:'s)?|my direct reports?|team members?|the team|department|team coverage)\b/.test(text);
    const leaveTopic = /\b(leave|coverage|absence|vacation|time off|who is (out|off|away))\b/.test(text);
    return teamTarget && leaveTopic;
  }

  private requestsIndividualThirdPartyLeave(input: SpecialistInput, hasTeamLeaveScope: boolean): boolean {
    const text = `${input.normalizedIntent} ${input.userMessage}`;
    const lower = text.toLowerCase();
    const privateLeaveTopic = /\b(leave balance|leave history|last leave|leave request|leave records?)\b/.test(lower);
    if (!privateLeaveTopic) return false;

    /**
     * WHY: Generic third-party wording is refused for callers without team
     * scope; managers reach the team-coverage path above for team phrasing and
     * are only refused for individual private records (balances/history), which
     * stay in the Leaves module where HR Core scope rules apply per record.
     */
    const thirdPartyTarget = /\b(another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member)\b/.test(lower);
    if (thirdPartyTarget && !hasTeamLeaveScope) return true;

    return this.targetsNamedIndividual(text);
  }

  /**
   * WHY: "What is John's leave balance?" previously slipped past keyword checks
   * and was answered with the requester's own records labeled as the answer.
   * A possessive or "of <Name>" pattern marks the request as individual-targeted.
   */
  private targetsNamedIndividual(text: string): boolean {
    const possessive = /\b([A-Z][a-z]+)'s\s+(?:last\s+)?(?:leave|balance|vacation|absence)/g;
    for (const match of text.matchAll(possessive)) {
      const name = match[1];
      if (name && !NAME_STOPWORDS.has(name)) return true;
    }
    const ofName = /\b(?:leave balance|leave history|last leave|leave records?)\s+(?:of|for)\s+([A-Z][a-z]+)\b/g;
    for (const match of text.matchAll(ofName)) {
      const name = match[1];
      if (name && !NAME_STOPWORDS.has(name)) return true;
    }
    return false;
  }
}
