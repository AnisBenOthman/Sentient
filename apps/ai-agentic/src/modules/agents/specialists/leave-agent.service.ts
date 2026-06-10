import { Injectable } from '@nestjs/common';
import { AgentRunStatus, AgentType, PermissionDecision } from '../../../generated/prisma';
import { HrCoreAiClient, LeaveAiContext, LeaveBalanceContext, LeaveRequestContext } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class LeaveAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LEAVE_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    if (this.requestsIndividualThirdPartyLeave(input)) {
      return {
        agentType: this.agentType,
        status: AgentRunStatus.REFUSED,
        summary: 'Leave context refused because the request targets another individual.',
        userVisibleContent: "I cannot access or disclose another individual employee's leave balance or leave history. I can help with your own leave records, or with approved team-level leave coverage summaries when your Sentient role permits them.",
        sourceContext: [],
        permissionDecision: PermissionDecision.DENIED,
      };
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

  private requestsIndividualThirdPartyLeave(input: SpecialistInput): boolean {
    const text = `${input.normalizedIntent} ${input.userMessage}`.toLowerCase();
    const privateLeaveTopic = /\b(leave balance|leave history|last leave|leave request|leave records?)\b/.test(text);
    const thirdPartyTarget = /\b(another employee|someone else|colleague|coworker|my manager|manager's|my direct report|team member)\b/.test(text);
    return privateLeaveTopic && thirdPartyTarget;
  }
}
