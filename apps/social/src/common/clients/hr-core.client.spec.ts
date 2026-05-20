import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { HrCoreClient } from './hr-core.client';
import type { HrCoreCallContext } from './employee-ref.interface';

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, create: jest.fn() }, create: jest.fn() };
});
const mockedAxios = axios as jest.Mocked<typeof axios>;

const VALID_EMPLOYEE_REF = {
  id: 'emp-001',
  firstName: 'Alice',
  lastName: 'Martin',
  email: 'alice@sentient.dev',
  employeeCode: 'EMP-001',
  departmentId: 'dept-eng',
  teamId: null,
  employmentStatus: 'ACTIVE',
};

const CONTEXT: HrCoreCallContext = {
  jwt: 'header.payload.signature',
  correlationId: 'corr-123',
};

function buildClient(cacheTtlMs = 60_000): HrCoreClient {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3001'),
    get: jest.fn().mockReturnValue(cacheTtlMs),
  } as unknown as ConfigService;

  const mockAxiosInstance = {
    get: jest.fn(),
  };
  mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

  const client = new HrCoreClient(configService);
  (client as unknown as Record<string, unknown>)['_mockHttp'] = mockAxiosInstance;
  return client;
}

function getMockHttp(client: HrCoreClient): { get: jest.Mock } {
  const http = (client as unknown as Record<string, unknown>)['_mockHttp'];
  if (!http || typeof http !== 'object' || !('get' in http)) {
    throw new Error('_mockHttp not set on client');
  }
  return http as { get: jest.Mock };
}

describe('HrCoreClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('returns parsed EmployeeRef on 200', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockResolvedValueOnce({ status: 200, data: VALID_EMPLOYEE_REF });

      const result = await client.getEmployeeRef('emp-001', CONTEXT);

      expect(result).toEqual(VALID_EMPLOYEE_REF);
    });
  });

  describe('caching', () => {
    it('second call within TTL makes zero new HTTP requests', async () => {
      const client = buildClient(60_000);
      getMockHttp(client).get.mockResolvedValue({ status: 200, data: VALID_EMPLOYEE_REF });

      await client.getEmployeeRef('emp-001', CONTEXT);
      await client.getEmployeeRef('emp-001', CONTEXT);

      expect(getMockHttp(client).get).toHaveBeenCalledTimes(1);
    });

    it('second call after TTL elapses issues a second HTTP request', async () => {
      jest.useFakeTimers();
      const client = buildClient(1_000);
      getMockHttp(client).get.mockResolvedValue({ status: 200, data: VALID_EMPLOYEE_REF });

      await client.getEmployeeRef('emp-001', CONTEXT);
      jest.advanceTimersByTime(2_000);
      await client.getEmployeeRef('emp-001', CONTEXT);

      expect(getMockHttp(client).get).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('__resetCache() clears the cache so the next call refetches', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockResolvedValue({ status: 200, data: VALID_EMPLOYEE_REF });

      await client.getEmployeeRef('emp-001', CONTEXT);
      client.__resetCache();
      await client.getEmployeeRef('emp-001', CONTEXT);

      expect(getMockHttp(client).get).toHaveBeenCalledTimes(2);
    });
  });

  describe('error mapping', () => {
    function axiosError(status: number) {
      const err = Object.assign(new Error('axios error'), {
        isAxiosError: true,
        response: { status, data: { message: 'error' } },
        code: undefined as string | undefined,
      });
      return err;
    }

    function networkError(code: string) {
      const err = Object.assign(new Error('network error'), {
        isAxiosError: true,
        response: undefined,
        code,
      });
      return err;
    }

    it('maps 401 to UnauthorizedException', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockRejectedValueOnce(axiosError(401));
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('maps 403 to ForbiddenException', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockRejectedValueOnce(axiosError(403));
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('maps 404 to NotFoundException', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockRejectedValueOnce(axiosError(404));
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps 500 to ServiceUnavailableException', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockRejectedValueOnce(axiosError(500));
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('maps ECONNREFUSED network error to ServiceUnavailableException', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockRejectedValueOnce(networkError('ECONNREFUSED'));
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('header forwarding', () => {
    it('sends Authorization and x-correlation-id exactly once', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockResolvedValueOnce({ status: 200, data: VALID_EMPLOYEE_REF });

      await client.getEmployeeRef('emp-001', CONTEXT);

      const [url, config] = getMockHttp(client).get.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(url).toBe('/employees/emp-001');
      expect(config.headers['Authorization']).toBe(`Bearer ${CONTEXT.jwt}`);
      expect(config.headers['x-correlation-id']).toBe(CONTEXT.correlationId);
    });

    it('omits x-correlation-id when not provided', async () => {
      const client = buildClient();
      getMockHttp(client).get.mockResolvedValueOnce({ status: 200, data: VALID_EMPLOYEE_REF });

      await client.getEmployeeRef('emp-001', { jwt: CONTEXT.jwt });

      const [, config] = getMockHttp(client).get.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(config.headers['x-correlation-id']).toBeUndefined();
    });
  });

  describe('shape rejection', () => {
    it('throws InternalServerErrorException when 200 body missing email', async () => {
      const client = buildClient();
      const malformed = { ...VALID_EMPLOYEE_REF, email: undefined };
      getMockHttp(client).get.mockResolvedValueOnce({ status: 200, data: malformed });
      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('JWT redaction', () => {
    it('Logger.error never contains the JWT value', async () => {
      const client = buildClient();
      const logSpy = jest.spyOn(Logger.prototype, 'error');
      getMockHttp(client).get.mockRejectedValueOnce(
        Object.assign(new Error('fail'), { isAxiosError: true, response: { status: 500 }, code: undefined }),
      );

      await expect(client.getEmployeeRef('emp-001', CONTEXT)).rejects.toThrow();

      for (const call of logSpy.mock.calls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain(CONTEXT.jwt);
      }
    });
  });
});
