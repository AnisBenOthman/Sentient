import { JwtPayload } from '@sentient/shared';
import { ObjectiveLevel } from '@sentient/shared';

function isManagerTier(roles: string[]): boolean {
  return roles.includes('MANAGER') || roles.includes('TEAM_LEAD');
}

export function canCreateObjective(
  user: JwtPayload,
  level: ObjectiveLevel,
  departmentId?: string | null,
  ownerId?: string | null,
): boolean {
  const { roles } = user;
  if (roles.includes('HR_ADMIN')) return true;

  if (level === ObjectiveLevel.COMPANY) {
    return roles.includes('EXECUTIVE');
  }

  if (level === ObjectiveLevel.DEPARTMENT) {
    return isManagerTier(roles) && departmentId === user.departmentId;
  }

  if (level === ObjectiveLevel.EMPLOYEE) {
    if (isManagerTier(roles)) {
      return departmentId === user.departmentId;
    }
    if (roles.includes('EMPLOYEE')) {
      return ownerId === user.sub;
    }
  }

  return false;
}

export function canEditObjective(
  user: JwtPayload,
  level: ObjectiveLevel,
  departmentId?: string | null,
  ownerId?: string | null,
): boolean {
  const { roles } = user;
  if (roles.includes('HR_ADMIN')) return true;

  if (level === ObjectiveLevel.COMPANY) {
    return roles.includes('EXECUTIVE');
  }

  if (level === ObjectiveLevel.DEPARTMENT) {
    return isManagerTier(roles) && departmentId === user.departmentId;
  }

  if (level === ObjectiveLevel.EMPLOYEE) {
    if (isManagerTier(roles)) return departmentId === user.departmentId;
    if (roles.includes('EMPLOYEE')) return ownerId === user.sub;
  }

  return false;
}

export function canApproveCheckIn(
  user: JwtPayload,
  objectiveDepartmentId: string | null,
): boolean {
  const { roles } = user;
  if (roles.includes('HR_ADMIN')) return true;
  if (isManagerTier(roles)) {
    return objectiveDepartmentId === user.departmentId;
  }
  return false;
}
