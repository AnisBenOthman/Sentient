import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
import { HrCoreAiClient } from './hr-core-ai.client';
import { HttpJsonClient } from './http-json.client';

interface HttpCall {
  baseUrl: string;
  path: string;
  context: DownstreamRequestContext;
  sourceType: string;
  sourceTitle: string;
}

describe('HrCoreAiClient', () => {
  const context: DownstreamRequestContext = {
    jwt: 'jwt-token',
    correlationId: 'corr-1',
  };

  it('requests current-year leave balances and approved request history for the actor employee', async () => {
    const config = {
      get: (): string => 'http://hr-core.local',
    } as unknown as ConfigService;
    const calls: HttpCall[] = [];
    const http = {
      get: async <TData>(
        baseUrl: string,
        path: string,
        requestContext: DownstreamRequestContext,
        sourceType: string,
        sourceTitle: string,
      ): Promise<DownstreamResult<TData>> => {
        calls.push({ baseUrl, path, context: requestContext, sourceType, sourceTitle });
        const data = path.startsWith('/leave-balances')
          ? [
              {
                id: 'balance-1',
                leaveTypeName: 'Annual Leave',
                year: new Date().getUTCFullYear(),
                totalDays: 20,
                usedDays: 4,
                pendingDays: 1,
                remainingDays: 15,
              },
            ]
          : [
              {
                id: 'request-1',
                leaveType: { name: 'Annual Leave' },
                startDate: '2026-02-10T00:00:00.000Z',
                endDate: '2026-02-12T00:00:00.000Z',
                totalDays: 3,
                status: 'APPROVED',
              },
            ];
        return {
          data: data as TData,
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType: 'LEAVE',
          sourceTitle: 'Leave balance and history',
        };
      },
    } as unknown as HttpJsonClient;
    const client = new HrCoreAiClient(config, http);

    const result = await client.getLeaveContext('employee-1', context);

    const expectedYear = new Date().getUTCFullYear();
    expect(calls.length).toBe(2);
    expect(calls[0]?.baseUrl).toBe('http://hr-core.local');
    expect(calls[0]?.path).toBe(`/leave-balances?employeeId=employee-1&year=${expectedYear}`);
    expect(calls[0]?.context).toBe(context);
    expect(calls[0]?.sourceType).toBe('LEAVE');
    expect(calls[0]?.sourceTitle).toBe('Leave balance and history');
    expect(calls[1]?.path).toBe('/leave-requests?status=APPROVED');
    expect(result.data?.balances.length).toBe(1);
    expect(result.data?.recentRequests.length).toBe(1);
  });

  it('degrades leave context without a linked employee id', async () => {
    const config = {
      get: (): string => 'http://hr-core.local',
    } as unknown as ConfigService;
    const calls: HttpCall[] = [];
    const http = {
      get: async <TData>(
        baseUrl: string,
        path: string,
        requestContext: DownstreamRequestContext,
        sourceType: string,
        sourceTitle: string,
      ): Promise<DownstreamResult<TData>> => {
        calls.push({ baseUrl, path, context: requestContext, sourceType, sourceTitle });
        return {
          data: null,
          permissionDecision: PermissionDecision.UNAVAILABLE,
          degradedReason: 'unexpected call',
          sourceType,
          sourceTitle,
        };
      },
    } as unknown as HttpJsonClient;
    const client = new HrCoreAiClient(config, http);

    const result = await client.getLeaveContext(null, context);

    expect(result.permissionDecision).toBe(PermissionDecision.UNAVAILABLE);
    expect(result.degradedReason).toBe('Caller is not linked to an employee record.');
    expect(calls.length).toBe(0);
  });
});
