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

interface CacheEntry {
  value: EmployeeRef;
  expiresAt: number;
}

@Injectable()
export class HrCoreClient {
  private readonly logger = new Logger(HrCoreClient.name);
  private readonly http: AxiosInstance;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

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

  /** @internal Test-only hook to reset the in-process cache. */
  __resetCache(): void {
    this.cache.clear();
  }
}
