import { ChannelType } from '../enums/channel-type.enum';
import { PermissionScope } from '../enums/permission-scope.enum';

export interface RoleAssignmentClaim {
  roleCode: string;
  scope: PermissionScope;
  scopeEntityId: string | null;
}

export interface JwtPayload {
  /** User.id */
  sub: string;
  /** Employee.id — null for SYSTEM_ADMIN users with no linked employee. */
  employeeId: string | null;
  /** Shorthand role codes from active UserRole rows (for RbacGuard). */
  roles: string[];
  departmentId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
  channel: ChannelType;
  /** Full per-assignment claims used by buildScopeFilter. */
  roleAssignments: RoleAssignmentClaim[];
  sessionId: string;
  iat: number;
  exp: number;
}
