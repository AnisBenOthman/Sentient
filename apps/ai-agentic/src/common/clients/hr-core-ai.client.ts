import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
import { HttpJsonClient } from './http-json.client';

@Injectable()
export class HrCoreAiClient {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpJsonClient,
  ) {}

  getEmployeeContext(employeeId: string, context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get(`/employees/${encodeURIComponent(employeeId)}`, context, 'EMPLOYEE_PROFILE', 'Employee profile');
  }

  getLeaveContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/leaves/my-balance', context, 'LEAVE', 'Leave balance and history');
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

  private get(
    path: string,
    context: DownstreamRequestContext,
    sourceType: string,
    sourceTitle: string,
  ): Promise<DownstreamResult<DownstreamSummary>> {
    const baseUrl = this.config.get<string>('aiAgentic.hrCoreUrl') ?? 'http://localhost:3001';
    return this.http.get<DownstreamSummary>(baseUrl, path, context, sourceType, sourceTitle);
  }
}
