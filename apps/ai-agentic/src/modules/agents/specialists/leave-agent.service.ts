import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import {
  HrCoreAiClient,
  LeaveAiContext,
  LeaveBalanceContext,
  LeaveRequestContext,
  TeamLeaveAiContext,
} from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

const TEAM_LEAVE_SCOPE_ROLES = ['MANAGER', 'HR_ADMIN'];

/** Capitalized sentence starters that must not be mistaken for a person's name. */
const NAME_STOPWORDS = new Set([
  'What', 'Whats', 'Who', 'Whos', 'Where', 'When', 'How', 'Why', 'Whose',
  'Show', 'Tell', 'Give', 'Check', 'Today', 'Tomorrow', 'Yesterday', 'It', 'My', 'The',
  'Sentient', 'Company', 'Team', 'Everyone', 'Anyone',
]);

@Injectable()
export class LeaveAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LEAVE_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const hasTeamLeaveScope = this.hasTeamLeaveScope(input);

    /**
     * WHY: FR-008 — managers and HR admins are entitled to team-level leave
     * coverage. HR Core's team-calendar endpoint enforces the real scope, so a
     * caller whose JWT lacks it degrades gracefully instead of leaking data.
     */
    if (this.requestsTeamCoverage(input)) {
      if (!hasTeamLeaveScope) {
        return this.refusal(
          'Team leave coverage refused because the caller lacks manager scope.',
          'Team leave coverage is available to managers and HR admins. I can help with your own leave balance and history instead.',
        );
      }
      const coverage = await this.hrCore.getTeamLeaveContext({
        jwt: input.actorContext.jwt,
        correlationId: input.actorContext.correlationId,
      });
      const content = input.isDraftRequest
        ? 'Draft team coverage note: list who is on approved leave in the window, name the coverage owner for each absence, and flag overlaps for review before sharing.'
        : this.describeTeamCoverage(coverage.data);
      return downstreamResult(
        input,
        this.agentType,
        coverage,
        'Team leave coverage prepared.',
        content,
        { draftLabel: 'Team coverage draft' },
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

    const context = await this.hrCore.getLeaveContext(
      input.actorContext.employeeId,
      {
        jwt: input.actorContext.jwt,
        correlationId: input.actorContext.correlationId,
      },
    );
    const content = input.isDraftRequest
      ? 'Draft leave request: dates, leave type, coverage plan, and manager note should be reviewed in the Leaves module before submission.'
      : this.describeLeaveContext(context.data);
    return downstreamResult(
      input,
      this.agentType,
      context,
      'Leave context prepared.',
      content,
      { draftLabel: 'Leave request draft' },
    );
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

  private timeValue(value: string): number {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private hasTeamLeaveScope(input: SpecialistInput): boolean {
    return input.actorContext.roles.some((role) => TEAM_LEAVE_SCOPE_ROLES.includes(role));
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
