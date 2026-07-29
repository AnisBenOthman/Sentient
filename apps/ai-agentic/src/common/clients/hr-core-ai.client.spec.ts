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

  it('requests current-year leave balances and full request history for the actor employee', async () => {
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
    expect(calls[1]?.path).toBe('/leave-requests');
    expect(result.data?.balances.length).toBe(1);
    expect(result.data?.recentRequests.length).toBe(1);
  });

  it('requests current-year holidays scoped to the actor business unit', async () => {
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
          data: [
            { id: 'h-1', name: 'Independence Day', date: '2026-07-05T00:00:00.000Z', isRecurring: true },
          ] as TData,
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType,
          sourceTitle,
        };
      },
    } as unknown as HttpJsonClient;
    const client = new HrCoreAiClient(config, http);

    const result = await client.getHolidaysContext('bu-1', context);

    const expectedYear = new Date().getUTCFullYear();
    expect(calls.length).toBe(1);
    expect(calls[0]?.path).toBe(`/holidays?year=${expectedYear}&businessUnitId=bu-1`);
    expect(calls[0]?.sourceType).toBe('HOLIDAYS');
    expect(result.data?.year).toBe(expectedYear);
    expect(result.data?.holidays.length).toBe(1);
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

  it('requests the employees-without-leave analytics endpoint and passes the payload through', async () => {
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
          data: {
            entries: [{ employeeId: 'emp-1', employeeName: 'Alice Martin' }],
            totalConsidered: 5,
            windowStart: '2025-07-29',
            windowEnd: '2026-07-29',
          } as TData,
          permissionDecision: PermissionDecision.ALLOWED,
          degradedReason: null,
          sourceType,
          sourceTitle,
        };
      },
    } as unknown as HttpJsonClient;
    const client = new HrCoreAiClient(config, http);

    const result = await client.getEmployeesWithoutLeaveContext(context);

    expect(calls.length).toBe(1);
    expect(calls[0]?.path).toBe('/analytics/employees-without-leave');
    expect(calls[0]?.sourceType).toBe('LEAVE_ZERO_SUMMARY');
    expect(result.data?.entries).toEqual([{ employeeId: 'emp-1', employeeName: 'Alice Martin' }]);
    expect(result.data?.totalConsidered).toBe(5);
    expect(result.data?.windowStart).toBe('2025-07-29');
    expect(result.data?.windowEnd).toBe('2026-07-29');
  });

  it('returns null data for employees-without-leave when the caller is denied', async () => {
    const config = {
      get: (): string => 'http://hr-core.local',
    } as unknown as ConfigService;
    const http = {
      get: async <TData>(): Promise<DownstreamResult<TData>> => ({
        data: null,
        permissionDecision: PermissionDecision.DENIED,
        degradedReason: 'Forbidden',
        sourceType: 'LEAVE_ZERO_SUMMARY',
        sourceTitle: 'Employees without leave',
      }),
    } as unknown as HttpJsonClient;
    const client = new HrCoreAiClient(config, http);

    const result = await client.getEmployeesWithoutLeaveContext(context);

    expect(result.permissionDecision).toBe(PermissionDecision.DENIED);
    expect(result.data).toBeNull();
  });
});
