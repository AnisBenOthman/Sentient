import nock from 'nock';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HrCoreClient } from '../../src/common/clients/hr-core.client';

const HR_CORE_URL = 'http://hr-core-contract-test';
const FAKE_JWT = 'fake-contract-jwt';
const FAKE_CORR = 'corr-contract-001';

function makeClient(): HrCoreClient {
  const configService = {
    getOrThrow: (key: string) => {
      if (key === 'HR_CORE_URL') return HR_CORE_URL;
      throw new Error(`Unexpected config key in test: ${key}`);
    },
    get: (_key: string, defaultValue?: unknown) => defaultValue,
  } as unknown as ConfigService;

  return new HrCoreClient(configService);
}

describe('HrCoreClient Contract', () => {
  let client: HrCoreClient;

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    client = makeClient();
  });

  afterEach(() => {
    nock.cleanAll();
    client.__resetCache();
  });

  // ─────────────────────────────────────────────────────────────
  // getEmployeeRef — response shape contract
  // ─────────────────────────────────────────────────────────────
  describe('getEmployeeRef', () => {
    const employeeId = 'emp-contract-001';

    const fullEmployeeBody = {
      id: employeeId,
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@sentient.dev',
      employeeCode: 'EMP-001',
      departmentId: 'dept-eng',
      teamId: 'team-alpha',
      employmentStatus: 'ACTIVE',
    };

    it('returns a fully-shaped EmployeeRef on 200', async () => {
      nock(HR_CORE_URL).get(`/employees/${employeeId}`).reply(200, fullEmployeeBody);

      const result = await client.getEmployeeRef(employeeId, { jwt: FAKE_JWT, correlationId: FAKE_CORR });

      expect(result.id).toBe(employeeId);
      expect(result.firstName).toBe('Alice');
      expect(result.lastName).toBe('Martin');
      expect(result.email).toBe('alice@sentient.dev');
      expect(result.employeeCode).toBe('EMP-001');
      expect(result.departmentId).toBe('dept-eng');
      expect(result.teamId).toBe('team-alpha');
      expect(result.employmentStatus).toBe('ACTIVE');
    });

    it('accepts teamId: null (employee not in a team)', async () => {
      nock(HR_CORE_URL)
        .get(`/employees/${employeeId}`)
        .reply(200, { ...fullEmployeeBody, teamId: null });

      const result = await client.getEmployeeRef(employeeId, { jwt: FAKE_JWT });
      expect(result.teamId).toBeNull();
    });

    it('forwards Authorization and x-correlation-id headers', async () => {
      nock(HR_CORE_URL, {
        reqheaders: {
          Authorization: `Bearer ${FAKE_JWT}`,
          'x-correlation-id': FAKE_CORR,
        },
      })
        .get(`/employees/${employeeId}`)
        .reply(200, fullEmployeeBody);

      await expect(
        client.getEmployeeRef(employeeId, { jwt: FAKE_JWT, correlationId: FAKE_CORR }),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException on 404', async () => {
      nock(HR_CORE_URL).get(`/employees/${employeeId}`).reply(404, { message: 'Not Found' });

      await expect(
        client.getEmployeeRef(employeeId, { jwt: FAKE_JWT }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on 500', async () => {
      nock(HR_CORE_URL).get(`/employees/${employeeId}`).reply(500, { message: 'Internal Server Error' });

      await expect(
        client.getEmployeeRef(employeeId, { jwt: FAKE_JWT }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('caches the result: second call for same id makes only one HTTP request', async () => {
      nock(HR_CORE_URL).get(`/employees/${employeeId}`).once().reply(200, fullEmployeeBody);

      await client.getEmployeeRef(employeeId, { jwt: FAKE_JWT });
      await client.getEmployeeRef(employeeId, { jwt: FAKE_JWT });

      // All nock interceptors consumed exactly once (only 1 HTTP call made)
      expect(nock.isDone()).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getDepartmentRef — response shape contract
  // ─────────────────────────────────────────────────────────────
  describe('getDepartmentRef', () => {
    const deptId = 'dept-contract-001';

    it('returns DepartmentRef { id, name } on 200', async () => {
      nock(HR_CORE_URL)
        .get(`/departments/${deptId}`)
        .reply(200, { id: deptId, name: 'Engineering' });

      const result = await client.getDepartmentRef(deptId, { jwt: FAKE_JWT, correlationId: FAKE_CORR });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(deptId);
      expect(result!.name).toBe('Engineering');
    });

    it('returns null on 404', async () => {
      nock(HR_CORE_URL).get(`/departments/${deptId}`).reply(404, { message: 'Not Found' });

      const result = await client.getDepartmentRef(deptId, { jwt: FAKE_JWT });
      expect(result).toBeNull();
    });

    it('throws ServiceUnavailableException on 500', async () => {
      nock(HR_CORE_URL).get(`/departments/${deptId}`).reply(500);

      await expect(
        client.getDepartmentRef(deptId, { jwt: FAKE_JWT }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('caches null: second call for same 404 id makes only one HTTP request', async () => {
      nock(HR_CORE_URL).get(`/departments/${deptId}`).once().reply(404, { message: 'Not Found' });

      const first = await client.getDepartmentRef(deptId, { jwt: FAKE_JWT });
      const second = await client.getDepartmentRef(deptId, { jwt: FAKE_JWT });

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(nock.isDone()).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getTeamRef — response shape contract (includes departmentId!)
  // ─────────────────────────────────────────────────────────────
  describe('getTeamRef', () => {
    const teamId = 'team-contract-001';

    it('returns TeamRef { id, name, departmentId } on 200', async () => {
      nock(HR_CORE_URL)
        .get(`/teams/${teamId}`)
        .reply(200, { id: teamId, name: 'Alpha Squad', departmentId: 'dept-eng' });

      const result = await client.getTeamRef(teamId, { jwt: FAKE_JWT, correlationId: FAKE_CORR });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(teamId);
      expect(result!.name).toBe('Alpha Squad');
      // Contract requirement: departmentId MUST be propagated from HR Core response
      expect(result!.departmentId).toBe('dept-eng');
    });

    it('returns null on 404', async () => {
      nock(HR_CORE_URL).get(`/teams/${teamId}`).reply(404, { message: 'Not Found' });

      const result = await client.getTeamRef(teamId, { jwt: FAKE_JWT });
      expect(result).toBeNull();
    });

    it('throws ServiceUnavailableException on 500', async () => {
      nock(HR_CORE_URL).get(`/teams/${teamId}`).reply(500);

      await expect(
        client.getTeamRef(teamId, { jwt: FAKE_JWT }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('caches null: second call for same 404 id makes only one HTTP request', async () => {
      nock(HR_CORE_URL).get(`/teams/${teamId}`).once().reply(404, { message: 'Not Found' });

      const first = await client.getTeamRef(teamId, { jwt: FAKE_JWT });
      const second = await client.getTeamRef(teamId, { jwt: FAKE_JWT });

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(nock.isDone()).toBe(true);
    });
  });
});
