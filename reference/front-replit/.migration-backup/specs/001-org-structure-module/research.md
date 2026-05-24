# Research: Organization Structure Module

**Feature**: `001-org-structure-module`  
**Date**: 2026-04-06  
**Status**: Complete — no NEEDS CLARIFICATION items remained in spec

---

## Decision 1: Org-Chart Query Strategy

**Decision**: Use Prisma `findMany` with `include` and `_count` aggregation for the org-chart endpoint, not raw SQL.

**Rationale**: The org-chart is a read-only aggregation: departments → teams → employee count. Prisma's `_count` on related records (`employees`) is supported within the `hr_core` schema, keeping the query typed and auditable. Raw SQL would bypass Prisma's type safety and is prohibited for anything other than migrations per CLAUDE.md code-style rules.

**Alternatives considered**:
- Raw SQL with `GROUP BY` — rejected because it bypasses Prisma typing and is harder to scope-filter dynamically.
- Separate REST calls from frontend for each level — rejected because the Analytics Agent needs a single snapshot, not multiple round-trips.
- Materialized view in PostgreSQL — rejected as premature optimization for a 20-department org; revisit if query exceeds 1s SLA in load testing.

**Query shape**:
```
prisma.department.findMany({
  where: { isActive: true },
  include: {
    teams: {
      where: { isActive: true },
      include: { _count: { select: { employees: true } } }
    }
  }
})
```

---

## Decision 2: Soft-Delete Pattern

**Decision**: Use an `isActive: Boolean @default(true)` field on Department, Team, and Position. No `deletedAt` timestamp.

**Rationale**: The CLAUDE.md class diagram shows `isActive: Boolean = true` on all three entities (not `deletedAt`). This is consistent with the Prisma schema conventions defined in the project. An `isActive` flag is simpler to filter and query than a nullable timestamp.

**Alternatives considered**:
- `deletedAt: DateTime?` (soft-delete timestamp) — rejected because the class diagram and CLAUDE.md spec explicitly use `isActive`; changing this would diverge from the canonical data model.
- Hard delete — rejected; all org-structure entities are referenced by Employee, JobHistory, ContractAmendment with logical FKs. Deleting would orphan those references.

**Filter pattern**: All list endpoints default to `{ where: { isActive: true } }`. An optional `includeInactive: boolean` query param (HR Admin only) allows querying deactivated records.

---

## Decision 3: Team-Lead Vacancy Detection

**Decision**: When `leadId` is set on a Team but the referenced employee has `employmentStatus: TERMINATED`, the org-chart and team detail response includes a `leadVacant: true` flag resolved at the service layer.

**Rationale**: FR-021 requires surfacing a vacancy indicator without failing the query. Since `leadId` is a logical FK within `hr_core` (no DB-level constraint), the service can join `Employee` on `leadId` within the same schema and check `employmentStatus`.

**Implementation**: `TeamsService.findById()` performs a Prisma query that includes the lead employee record. If `lead.employmentStatus === 'TERMINATED'` or the employee is not found, the response maps `leadVacant: true` and `lead: null`.

**Alternatives considered**:
- Trigger-based nulling of `leadId` on employee termination — rejected because termination is handled by the Employees module; the Organization module should not hold cascading logic from another domain.
- Return the raw `leadId` and let the frontend resolve — rejected because it pushes business logic to the client, and the Analytics Agent needs a clean response.

---

## Decision 4: RBAC Scope for Teams List Endpoint

**Decision**: `GET /api/hr/teams` uses scope-based filtering: MANAGER sees only their own team (by `teamId` from JWT claim), HR_ADMIN and EXECUTIVE see all teams.

**Rationale**: Managers have TEAM scope for the `team:read` permission per the RBAC matrix in `security.md`. The JWT payload includes `teamId` (the team the manager leads). The service builds a Prisma `where` clause from this.

**Implementation**: The `TeamsService.findAll()` method accepts a scope argument derived from `buildScopeFilter()` — for MANAGER, it adds `{ id: user.teamId }` to the Prisma where clause.

**Alternatives considered**:
- Separate endpoints for manager vs admin — rejected as unnecessary duplication; scope filtering on a single endpoint is the project pattern.

---

## Decision 5: Position Catalog Read Access

**Decision**: All authenticated users (any role) may read positions (list and detail). Positions are not sensitive data.

**Rationale**: FR-018 explicitly allows all authenticated users to read positions. Positions are displayed in employee profile dropdowns, org-chart labels, and leave request forms. Restricting them would break the frontend for employees viewing their own profile.

**Alternatives considered**:
- EMPLOYEE scope limited to own position only — rejected as unnecessarily restrictive for a non-sensitive catalog.

---

## Decision 6: Department → Team Creation Guard

**Decision**: `TeamsService.create()` verifies the target `departmentId` maps to an active department before persisting. If the department is inactive or not found, a `BadRequestException` is thrown.

**Rationale**: FR-007 requires this guard. Since both Department and Team live in the same `hr_core` schema and same Prisma client, the check is a simple `prisma.department.findFirst({ where: { id, isActive: true } })` before the team insert — no cross-service call needed.

---

## Decision 7: No Domain Events for This Module

**Decision**: The Organization module does not emit domain events for department/team/position mutations.

**Rationale**: The CLAUDE.md Domain Events Catalog has no events defined for org-structure mutations. Contract Amendment approval cascades to Employee + SalaryHistory via its own event flow — the organization module simply provides the lookup data for those amendments. If the project evolves to need org-change notifications (e.g., Slack alert when a department is restructured), that would be added as a new event in a future feature.

**Alternatives considered**:
- `org.department_created`, `org.team_deactivated` events — deferred; not in the current event catalog and no known consumer.
