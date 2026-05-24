import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import { EmployeeRef, HrCoreCallContext } from './employee-ref.interface';
import { DepartmentRef } from './department-ref.interface';
import { TeamRef } from './team-ref.interface';

function isEmployeeRef(raw: unknown): raw is EmployeeRef {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as Record<string, unknown>)['id'] === 'string' &&
    typeof (raw as Record<string, unknown>)['firstName'] === 'string' &&
    typeof (raw as Record<string, unknown>)['lastName'] === 'string' &&
    typeof (raw as Record<string, unknown>)['email'] === 'string' &&
    typeof (raw as Record<string, unknown>)['employeeCode'] === 'string' &&
    typeof (raw as Record<string, unknown>)['departmentId'] === 'string' &&
    ((raw as Record<string, unknown>)['teamId'] === null ||
      typeof (raw as Record<string, unknown>)['teamId'] === 'string') &&
    typeof (raw as Record<string, unknown>)['employmentStatus'] === 'string'
  );
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class HrCoreClient {
  private readonly logger = new Logger(HrCoreClient.name);
  private readonly http: AxiosInstance;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry<EmployeeRef>>();
  private readonly deptCache = new Map<string, CacheEntry<DepartmentRef | null>>();
  private readonly teamCache = new Map<string, CacheEntry<TeamRef | null>>();

  constructor(private readonly config: ConfigService) {
    const baseURL = config.getOrThrow<string>('HR_CORE_URL');
    this.cacheTtlMs = config.get<number>('HR_CORE_EMPLOYEE_CACHE_TTL_MS', 60_000);
    this.http = axios.create({ baseURL, timeout: 5_000 });
  }

  async getEmployeeRef(id: string, context: HrCoreCallContext): Promise<EmployeeRef> {
    const cached = this.cache.get(id);
    if (cached !== undefined) {
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
      this.cache.delete(id);
    }

    const url = `/employees/${encodeURIComponent(id)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${context.jwt}`,
      Accept: 'application/json',
    };
    if (context.correlationId) {
      headers['x-correlation-id'] = context.correlationId;
    }

    const start = Date.now();
    try {
      const response = await this.http.get<unknown>(url, { headers });
      const durationMs = Date.now() - start;

      if (!isEmployeeRef(response.data)) {
        this.logger.error('HrCoreClient: unexpected response shape', {
          method: 'GET',
          url,
          correlationId: context.correlationId,
          statusOrCode: response.status,
          durationMs,
        });
        throw new InternalServerErrorException(
          'HrCoreClient: unexpected /employees/:id response shape',
        );
      }

      this.cache.set(id, { value: response.data, expiresAt: Date.now() + this.cacheTtlMs });
      return response.data;
    } catch (err: unknown) {
      const durationMs = Date.now() - start;

      if (err instanceof InternalServerErrorException) throw err;

      if (isAxiosError(err)) {
        const status = err.response?.status;
        this.logger.error('HrCoreClient: request failed', {
          method: 'GET',
          url,
          correlationId: context.correlationId,
          statusOrCode: status ?? err.code,
          durationMs,
        });

        if (status === 401) throw new UnauthorizedException('HR Core rejected the caller JWT');
        if (status === 403) throw new ForbiddenException(`HR Core forbade access to employee ${id}`);
        if (status === 404) throw new NotFoundException(`Employee ${id} not found in HR Core`);
        if (status !== undefined && status >= 500) {
          throw new ServiceUnavailableException(`HR Core unreachable (status ${status})`);
        }
        throw new ServiceUnavailableException(`HR Core unreachable (${err.code ?? 'UNKNOWN'})`);
      }

      throw err;
    }
  }

  async getDepartmentRef(id: string, context: HrCoreCallContext): Promise<DepartmentRef | null> {
    const cached = this.deptCache.get(id);
    if (cached !== undefined) {
      if (cached.expiresAt > Date.now()) return cached.value;
      this.deptCache.delete(id);
    }

    const url = `/departments/${encodeURIComponent(id)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${context.jwt}`,
      Accept: 'application/json',
    };
    if (context.correlationId) headers['x-correlation-id'] = context.correlationId;

    const start = Date.now();
    try {
      const response = await this.http.get<unknown>(url, { headers });
      const raw = response.data as Record<string, unknown>;
      const dept: DepartmentRef = { id: String(raw['id'] ?? ''), name: String(raw['name'] ?? '') };
      this.deptCache.set(id, { value: dept, expiresAt: Date.now() + this.cacheTtlMs });
      return dept;
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) {
          this.deptCache.set(id, { value: null, expiresAt: Date.now() + this.cacheTtlMs });
          return null;
        }
        this.logger.error('HrCoreClient: getDepartmentRef failed', {
          url, correlationId: context.correlationId, statusOrCode: status ?? err.code, durationMs,
        });
        if (status !== undefined && status >= 500) {
          throw new ServiceUnavailableException(`HR Core unreachable (status ${status})`);
        }
        throw new ServiceUnavailableException(`HR Core unreachable (${err.code ?? 'UNKNOWN'})`);
      }
      throw err;
    }
  }

  async getTeamRef(id: string, context: HrCoreCallContext): Promise<TeamRef | null> {
    const cached = this.teamCache.get(id);
    if (cached !== undefined) {
      if (cached.expiresAt > Date.now()) return cached.value;
      this.teamCache.delete(id);
    }

    const url = `/teams/${encodeURIComponent(id)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${context.jwt}`,
      Accept: 'application/json',
    };
    if (context.correlationId) headers['x-correlation-id'] = context.correlationId;

    const start = Date.now();
    try {
      const response = await this.http.get<unknown>(url, { headers });
      const raw = response.data as Record<string, unknown>;
      const team: TeamRef = {
        id: String(raw['id'] ?? ''),
        name: String(raw['name'] ?? ''),
        departmentId: String(raw['departmentId'] ?? ''),
      };
      this.teamCache.set(id, { value: team, expiresAt: Date.now() + this.cacheTtlMs });
      return team;
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) {
          this.teamCache.set(id, { value: null, expiresAt: Date.now() + this.cacheTtlMs });
          return null;
        }
        this.logger.error('HrCoreClient: getTeamRef failed', {
          url, correlationId: context.correlationId, statusOrCode: status ?? err.code, durationMs,
        });
        if (status !== undefined && status >= 500) {
          throw new ServiceUnavailableException(`HR Core unreachable (status ${status})`);
        }
        throw new ServiceUnavailableException(`HR Core unreachable (${err.code ?? 'UNKNOWN'})`);
      }
      throw err;
    }
  }

  /** @internal Test-only hook to reset the in-process cache. */
  __resetCache(): void {
    this.cache.clear();
    this.deptCache.clear();
    this.teamCache.clear();
  }
}
