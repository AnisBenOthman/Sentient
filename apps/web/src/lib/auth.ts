'use client';

import type { JwtPayload } from '@sentient/shared';

const ACCESS_KEY  = 'sentient_access';
const REFRESH_KEY = 'sentient_refresh';

function decodePayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export const authStore = {
  getAccess(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefresh(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },

  set(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY,  accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },

  getPayload(): JwtPayload | null {
    const token = this.getAccess();
    if (!token) return null;
    const payload = decodePayload(token);
    if (!payload) return null;
    // Treat as expired if < 30 s remain
    if (payload.exp * 1000 < Date.now() + 30_000) return null;
    return payload;
  },

  isLoggedIn(): boolean {
    return this.getPayload() !== null;
  },
};

/**
 * WHY: Returns a `common.json` key rather than a display string so this stays
 * usable outside React (no hook) while the caller resolves it with t(). Replaced
 * the former `roleLabel`, which returned hardcoded English and could not be
 * translated at the call site.
 */
export function roleLabelKey(
  roles: string[],
): 'roles.hrAdmin' | 'roles.manager' | 'roles.executive' | 'roles.systemAdmin' | 'roles.employee' {
  if (roles.includes('HR_ADMIN'))     return 'roles.hrAdmin';
  if (roles.includes('MANAGER'))      return 'roles.manager';
  if (roles.includes('EXECUTIVE'))    return 'roles.executive';
  if (roles.includes('SYSTEM_ADMIN')) return 'roles.systemAdmin';
  return 'roles.employee';
}

export function hasRole(roles: string[], check: string[]): boolean {
  return check.some(r => roles.includes(r));
}

export type RoleTier = 'hr_admin' | 'dept_manager' | 'team_lead' | 'employee';

export interface EmployeeDetailTarget {
  id: string;
  departmentId?: string | null;
  teamId?: string | null;
  department?: { id?: string | null } | null;
  team?: { id?: string | null } | null;
}

export interface EmployeeDetailScopeContext {
  departments?: Array<{ id: string; headId?: string | null }>;
  teams?: Array<{ id: string; leadId?: string | null }>;
}

export function getRoleTier(payload: JwtPayload): RoleTier {
  const roles = payload.roles ?? [];
  const roleAssignments = payload.roleAssignments ?? [];

  if (
    roles.includes('HR_ADMIN') ||
    roles.includes('GLOBAL_HR_ADMIN') ||
    roles.includes('EXECUTIVE')
  ) {
    return 'hr_admin';
  }

  if (roles.includes('TEAM_LEAD')) {
    return 'team_lead';
  }

  if (roles.includes('MANAGER')) {
    const hasDept = roleAssignments.some(
      (a) => a.roleCode === 'MANAGER' && a.scope === 'DEPARTMENT',
    );
    if (hasDept) return 'dept_manager';

    const hasTeam = roleAssignments.some(
      (a) => a.roleCode === 'MANAGER' && a.scope === 'TEAM',
    );
    if (hasTeam) return 'team_lead';

    if (payload.teamId) return 'team_lead';
    if (payload.departmentId) return 'dept_manager';
    return 'dept_manager';
  }
  return 'employee';
}

export function canViewEmployeeDetails(
  payload: JwtPayload,
  target: EmployeeDetailTarget,
  context: EmployeeDetailScopeContext = {},
): boolean {
  const roles = payload.roles ?? [];
  const roleAssignments = payload.roleAssignments ?? [];

  if (
    roles.includes('HR_ADMIN') ||
    roles.includes('GLOBAL_HR_ADMIN') ||
    roles.includes('EXECUTIVE')
  ) {
    return true;
  }

  if (!roles.includes('MANAGER') && !roles.includes('TEAM_LEAD')) return false;

  const targetDepartmentId = target.departmentId ?? target.department?.id ?? null;
  const targetTeamId = target.teamId ?? target.team?.id ?? null;

  const departmentAssignment = roleAssignments.find(
    (assignment) =>
      (assignment.roleCode === 'MANAGER' || assignment.roleCode === 'TEAM_LEAD') &&
      assignment.scope === 'DEPARTMENT',
  );
  if (departmentAssignment?.scopeEntityId) {
    return targetDepartmentId === departmentAssignment.scopeEntityId;
  }

  const teamAssignment = roleAssignments.find(
    (assignment) =>
      (assignment.roleCode === 'MANAGER' || assignment.roleCode === 'TEAM_LEAD') &&
      assignment.scope === 'TEAM',
  );
  if (teamAssignment?.scopeEntityId) {
    return targetTeamId === teamAssignment.scopeEntityId;
  }

  if (payload.employeeId) {
    const headsDepartment = context.departments?.some(
      (department) => department.id === targetDepartmentId && department.headId === payload.employeeId,
    );
    if (headsDepartment) return true;

    const leadsTeam = context.teams?.some(
      (team) => team.id === targetTeamId && team.leadId === payload.employeeId,
    );
    if (leadsTeam) return true;
  }

  return Boolean(payload.teamId && targetTeamId === payload.teamId);
}

/**
 * WHY: Returns a `common.json` key, not a display string — see roleLabelKey.
 * Callers resolve it with t(); layout.tsx maps RoleTier → label this way.
 */
export function roleTierLabelKey(
  tier: RoleTier,
): 'roles.hrAdmin' | 'roles.manager' | 'roles.teamLead' | 'roles.employee' {
  const keys = {
    hr_admin:     'roles.hrAdmin',
    dept_manager: 'roles.manager',
    team_lead:    'roles.teamLead',
    employee:     'roles.employee',
  } as const;
  return keys[tier];
}
