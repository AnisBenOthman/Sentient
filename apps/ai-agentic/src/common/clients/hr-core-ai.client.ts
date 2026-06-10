import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
import { HttpJsonClient } from './http-json.client';

export interface LeaveBalanceContext {
  id: string;
  leaveTypeName: string;
  year: number;
  totalDays: number | string;
  usedDays: number | string;
  pendingDays: number | string;
  remainingDays: number | string;
}

export interface LeaveRequestContext {
  id: string;
  leaveType?: {
    name?: string | null;
  } | null;
  startDate: string;
  endDate: string;
  totalDays: number | string;
  status: string;
}

export interface LeaveAiContext extends DownstreamSummary {
  balances: LeaveBalanceContext[];
  recentRequests: LeaveRequestContext[];
  requestHistoryUnavailable?: boolean;
}

@Injectable()
export class HrCoreAiClient {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpJsonClient,
  ) {}

  getEmployeeContext(employeeId: string, context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get(`/employees/${encodeURIComponent(employeeId)}`, context, 'EMPLOYEE_PROFILE', 'Employee profile');
  }

  getLeaveContext(
    employeeId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveAiContext>> {
    if (!employeeId) {
      return Promise.resolve({
        data: null,
        permissionDecision: PermissionDecision.UNAVAILABLE,
        degradedReason: 'Caller is not linked to an employee record.',
        sourceType: 'LEAVE',
        sourceTitle: 'Leave balance and history',
      });
    }

    const query = new URLSearchParams({
      employeeId,
      year: String(new Date().getUTCFullYear()),
    });
    return this.getLeaveBalanceAndHistory(`/leave-balances?${query.toString()}`, context);
  }

  getOkrContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/okrs/my-okrs', context, 'OKR', 'OKR context');
  }

  getPerformanceContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/performance-reviews/my-reviews', context, 'PERFORMANCE', 'Performance review context');
  }

  getSkillsContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/skills/my-skills', context, 'SKILLS', 'Skills context');
  }

  getNotificationsContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/notifications', context, 'NOTIFICATIONS', 'Notifications');
  }

  getDashboardContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/dashboard/analytics', context, 'DASHBOARD', 'Dashboard analytics');
  }

  private async getLeaveBalanceAndHistory(
    balancePath: string,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveAiContext>> {
    const historyQuery = new URLSearchParams({ status: 'APPROVED' });
    const [balancesResult, requestsResult] = await Promise.all([
      this.get<LeaveBalanceContext[]>(balancePath, context, 'LEAVE', 'Leave balance and history'),
      this.get<LeaveRequestContext[]>(
        `/leave-requests?${historyQuery.toString()}`,
        context,
        'LEAVE',
        'Leave balance and history',
      ),
    ]);

    if (balancesResult.permissionDecision !== PermissionDecision.ALLOWED) {
      return {
        ...balancesResult,
        data: null,
      };
    }

    return {
      data: {
        id: 'leave:current-year',
        balances: balancesResult.data ?? [],
        recentRequests: requestsResult.permissionDecision === PermissionDecision.ALLOWED
          ? requestsResult.data ?? []
          : [],
        requestHistoryUnavailable: requestsResult.permissionDecision !== PermissionDecision.ALLOWED,
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: requestsResult.permissionDecision === PermissionDecision.ALLOWED
        ? null
        : requestsResult.degradedReason,
      sourceType: 'LEAVE',
      sourceTitle: 'Leave balance and history',
    };
  }

  private get<TData = DownstreamSummary>(
    path: string,
    context: DownstreamRequestContext,
    sourceType: string,
    sourceTitle: string,
  ): Promise<DownstreamResult<TData>> {
    const baseUrl = this.config.get<string>('aiAgentic.hrCoreUrl') ?? 'http://localhost:3001';
    return this.http.get<TData>(baseUrl, path, context, sourceType, sourceTitle);
  }
}
