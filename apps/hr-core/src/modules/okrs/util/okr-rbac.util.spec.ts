import { ChannelType, ObjectiveLevel, PermissionScope } from '@sentient/shared';
import { JwtPayload } from '@sentient/shared';

import { canApproveCheckIn, canCreateObjective, canEditObjective } from './okr-rbac.util';

function makeUser(overrides: Partial<JwtPayload> & { roles: string[] }): JwtPayload {
  return {
    sub: 'user-1',
    employeeId: 'emp-1',
    roles: overrides.roles,
    departmentId: overrides.departmentId ?? 'dept-1',
    teamId: null,
    businessUnitId: 'bu-1',
    channel: ChannelType.WEB,
    roleAssignments: overrides.roles.map((r) => ({
      roleCode: r,
      scope: PermissionScope.GLOBAL,
      scopeEntityId: null,
    })),
    sessionId: 'sess-1',
    iat: 0,
    exp: 9999999999,
    ...overrides,
  };
}

describe('canCreateObjective', () => {
  describe('HR_ADMIN', () => {
    const admin = makeUser({ roles: ['HR_ADMIN'] });
    it('can create COMPANY', () => expect(canCreateObjective(admin, ObjectiveLevel.COMPANY)).toBe(true));
    it('can create DEPARTMENT for any dept', () =>
      expect(canCreateObjective(admin, ObjectiveLevel.DEPARTMENT, 'dept-other')).toBe(true));
    it('can create EMPLOYEE for any user', () =>
      expect(canCreateObjective(admin, ObjectiveLevel.EMPLOYEE, 'dept-2', 'user-other')).toBe(true));
  });

  describe('EXECUTIVE', () => {
    const exec = makeUser({ roles: ['EXECUTIVE'] });
    it('can create COMPANY', () => expect(canCreateObjective(exec, ObjectiveLevel.COMPANY)).toBe(true));
    it('cannot create DEPARTMENT', () =>
      expect(canCreateObjective(exec, ObjectiveLevel.DEPARTMENT, 'dept-1')).toBe(false));
    it('cannot create EMPLOYEE', () =>
      expect(canCreateObjective(exec, ObjectiveLevel.EMPLOYEE, 'dept-1', 'user-1')).toBe(false));
  });

  describe('MANAGER', () => {
    const manager = makeUser({ roles: ['MANAGER'], departmentId: 'dept-1' });
    it('cannot create COMPANY', () => expect(canCreateObjective(manager, ObjectiveLevel.COMPANY)).toBe(false));
    it('can create DEPARTMENT for own dept', () =>
      expect(canCreateObjective(manager, ObjectiveLevel.DEPARTMENT, 'dept-1')).toBe(true));
    it('cannot create DEPARTMENT for other dept', () =>
      expect(canCreateObjective(manager, ObjectiveLevel.DEPARTMENT, 'dept-other')).toBe(false));
    it('can create EMPLOYEE within own dept', () =>
      expect(canCreateObjective(manager, ObjectiveLevel.EMPLOYEE, 'dept-1', 'user-other')).toBe(true));
    it('cannot create EMPLOYEE in other dept', () =>
      expect(canCreateObjective(manager, ObjectiveLevel.EMPLOYEE, 'dept-other', 'user-other')).toBe(false));
  });

  describe('EMPLOYEE', () => {
    const employee = makeUser({ roles: ['EMPLOYEE'], sub: 'user-emp', departmentId: 'dept-1' });
    it('cannot create COMPANY', () => expect(canCreateObjective(employee, ObjectiveLevel.COMPANY)).toBe(false));
    it('cannot create DEPARTMENT', () =>
      expect(canCreateObjective(employee, ObjectiveLevel.DEPARTMENT, 'dept-1')).toBe(false));
    it('can create EMPLOYEE only for self', () =>
      expect(canCreateObjective(employee, ObjectiveLevel.EMPLOYEE, 'dept-1', 'user-emp')).toBe(true));
    it('cannot create EMPLOYEE for another user', () =>
      expect(canCreateObjective(employee, ObjectiveLevel.EMPLOYEE, 'dept-1', 'user-other')).toBe(false));
  });
});

describe('canEditObjective', () => {
  it('mirrors canCreateObjective for all roles', () => {
    const admin = makeUser({ roles: ['HR_ADMIN'] });
    const exec = makeUser({ roles: ['EXECUTIVE'] });
    const mgr = makeUser({ roles: ['MANAGER'], departmentId: 'dept-1' });
    const emp = makeUser({ roles: ['EMPLOYEE'], sub: 'user-emp' });

    expect(canEditObjective(admin, ObjectiveLevel.DEPARTMENT, 'dept-other')).toBe(true);
    expect(canEditObjective(exec, ObjectiveLevel.COMPANY)).toBe(true);
    expect(canEditObjective(mgr, ObjectiveLevel.DEPARTMENT, 'dept-1')).toBe(true);
    expect(canEditObjective(mgr, ObjectiveLevel.DEPARTMENT, 'dept-other')).toBe(false);
    expect(canEditObjective(emp, ObjectiveLevel.EMPLOYEE, 'dept-1', 'user-emp')).toBe(true);
  });
});

describe('canApproveCheckIn', () => {
  it('HR_ADMIN can approve any check-in', () => {
    const admin = makeUser({ roles: ['HR_ADMIN'] });
    expect(canApproveCheckIn(admin, 'dept-other')).toBe(true);
    expect(canApproveCheckIn(admin, null)).toBe(true);
  });

  it('MANAGER can approve check-ins in own dept only', () => {
    const mgr = makeUser({ roles: ['MANAGER'], departmentId: 'dept-1' });
    expect(canApproveCheckIn(mgr, 'dept-1')).toBe(true);
    expect(canApproveCheckIn(mgr, 'dept-other')).toBe(false);
    expect(canApproveCheckIn(mgr, null)).toBe(false);
  });

  it('EMPLOYEE cannot approve check-ins', () => {
    const emp = makeUser({ roles: ['EMPLOYEE'], departmentId: 'dept-1' });
    expect(canApproveCheckIn(emp, 'dept-1')).toBe(false);
  });
});
