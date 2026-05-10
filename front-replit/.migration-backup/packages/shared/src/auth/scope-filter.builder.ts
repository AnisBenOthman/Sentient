import { PermissionScope } from '../enums/permission-scope.enum';
import { JwtPayload, RoleAssignmentClaim } from './jwt-payload.interface';

export type ScopeFilter = Record<string, string | null | undefined>;

const SCOPE_RANK: Record<PermissionScope, number> = {
  [PermissionScope.OWN]: 0,
  [PermissionScope.TEAM]: 1,
  [PermissionScope.DEPARTMENT]: 2,
  [PermissionScope.BUSINESS_UNIT]: 3,
  [PermissionScope.GLOBAL]: 4,
};

type ClaimsForFilter = Pick<
  JwtPayload,
  'sub' | 'employeeId' | 'teamId' | 'departmentId' | 'businessUnitId'
>;

/**
 * Returns the widest-scope Prisma where-clause fragment for the given role
 * assignments. Caller merges the result into their own where clause.
 * Returns null when no assignments are provided (caller should 403).
 */
export function buildScopeFilter(
  roleAssignments: RoleAssignmentClaim[],
  claims: ClaimsForFilter,
): ScopeFilter | null {
  const [first, ...rest] = roleAssignments;
  if (!first) return null;

  const best = rest.reduce<RoleAssignmentClaim>(
    (a, b) => (SCOPE_RANK[b.scope] > SCOPE_RANK[a.scope] ? b : a),
    first,
  );

  switch (best.scope) {
    case PermissionScope.OWN:
      return { employeeId: claims.employeeId };
    case PermissionScope.TEAM:
      return { teamId: claims.teamId };
    case PermissionScope.DEPARTMENT:
      return { departmentId: claims.departmentId };
    case PermissionScope.BUSINESS_UNIT:
      return { businessUnitId: best.scopeEntityId ?? claims.businessUnitId };
    case PermissionScope.GLOBAL:
      return {};
  }
}
