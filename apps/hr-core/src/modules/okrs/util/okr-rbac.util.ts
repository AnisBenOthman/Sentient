import { JwtPayload } from '@sentient/shared';
import { ObjectiveLevel } from '@sentient/shared';

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
    return roles.includes('MANAGER') && departmentId === user.departmentId;
  }

  if (level === ObjectiveLevel.EMPLOYEE) {
    if (roles.includes('MANAGER')) {
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
    return roles.includes('MANAGER') && departmentId === user.departmentId;
  }

  if (level === ObjectiveLevel.EMPLOYEE) {
    if (roles.includes('MANAGER')) return departmentId === user.departmentId;
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
  if (roles.includes('MANAGER')) {
    return objectiveDepartmentId === user.departmentId;
  }
  return false;
}
