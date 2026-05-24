# Research: 013-Announcements Module

**Phase 0 output** | Branch: `013-announcements-module` | Date: 2026-05-21

---

## 1. HR Core Dependency Routes

**Question**: Do `GET /departments/:id` and `GET /teams/:id` exist in HR Core? What shape do they return?

**Decision**: Both routes exist and are confirmed production-ready.

**Evidence**:
- `apps/hr-core/src/modules/organization/departments/departments.controller.ts` line 41: `@Get(':id')` → `findById(id)` → `DepartmentsService.findById(id): Promise<DepartmentDetail>`
- `apps/hr-core/src/modules/organization/teams/teams.controller.ts` line 42: `@Get(':id')` → `findById(id, user)` → `TeamsService.findById(id, user): Promise<TeamWithVacancy>`

**Relevant shape excerpts**:
```typescript
// departments.service.ts
interface DepartmentDetail extends Department {
  teams: TeamSummary[];           // { id, name, vacancyCount }
  businessUnit: BusinessUnitRef | null;  // { id, name, address }
}

// teams.service.ts
interface TeamWithVacancy extends Team {
  vacancyCount: number;
}
// Team fields include: id, name, departmentId, managerId?, isActive, ...
```

**Social only needs a minimal subset**:
```typescript
// DepartmentRef for Social use
{ id: string; name: string; }

// TeamRef for Social use
{ id: string; name: string; departmentId: string; }
```

**Rationale**: The full DepartmentDetail/TeamWithVacancy shapes will be parsed and only the fields above cached. This keeps Social's HrCoreClient surface minimal.

**Alternatives considered**: Adding a dedicated `/departments/:id/ref` endpoint to HR Core — rejected; the existing `GET /:id` returns a superset and Social can project what it needs.

---

## 2. Domain Event `source` Field Convention

**Question**: Should the `announcement.published` event use `source: 'social'` (lowercase) or `source: 'SOCIAL'` (uppercase)?

**Decision**: `source: 'SOCIAL'` (UPPERCASE)

**Evidence**: Grepped `eventBus.emit` calls across `apps/hr-core/src`:
```
source: 'HR_CORE'  // e.g. leave.requested, employee.created
```
The `ServiceName` enum in `packages/shared/src/enums/` has `SOCIAL = 'SOCIAL'`. All existing emitters use the UPPER_SNAKE enum value as the literal string.

**Rationale**: Consistency with established convention; matches `ServiceName` enum value.

**Alternatives considered**: Lowercase string `'social'` — rejected; breaks pattern and would fail any subscriber that checks `event.source === ServiceName.SOCIAL`.

---

## 3. Author Enrichment Strategy

**Question**: How should the GET /announcements response embed `author: { id, firstName, lastName }` given that Social doesn't store employee names?

**Decision**: Call `HrCoreClient.getEmployeeRef(authorId, context)` per unique `authorId` in the page. Use the existing in-process Map cache (TTL-based, 5 min) already in `HrCoreClient`.

**Rationale**: The cache means repeat authors within a page are free. Cold-cache: at most N unique authors = N HR Core calls per page (N ≤ page size = 20 by default). Per spec FR-014, this is acceptable. The alternative (JOIN-style sub-query) is impossible across schema boundaries.

**Alternatives considered**:
- Storing `authorFirstName`/`authorLastName` denormalized in the `announcements` table — rejected; HR employee name changes would silently stale the data.
- Batch endpoint `GET /employees?ids=...` — not implemented in HR Core; adding it is out of scope for this feature.

---

## 4. Frontend Role-Gating Pattern

**Question**: Use `user.roles.includes('HR_ADMIN')` or `getRoleTier(user) === 'hr_admin'` for conditional rendering in `announcements.tsx`?

**Decision**: Use `getRoleTier(user) === 'hr_admin'` for checking write privileges in the `announcements.tsx` page, consistent with how other pages and the nav system gate features.

**Evidence**: `apps/web/src/components/layout.tsx` defines `getRoleTier(user)` returning lowercase strings (`'hr_admin'`, `'dept_manager'`, `'team_lead'`, `'employee'`). All existing nav/page role gates use this helper.

**Rationale**: Centralizing role mapping in `getRoleTier` means role hierarchy changes need only one update. Using raw `roles.includes()` would scatter role-string literals across pages.

**Note**: For non-layout code inside components that needs to distinguish MANAGER vs HR_ADMIN (e.g., whether to show the "specify department" target selector), direct `user.roles.includes('MANAGER')` checks are acceptable since `getRoleTier` collapses MANAGER + HR_ADMIN into different tiers.

---

## 5. Audience Targeting: Auto-fill vs. Explicit for MANAGER

**Question**: When a MANAGER posts with `audience: DEPARTMENT`, should `targetDepartmentId` be auto-filled from JWT claims or explicitly provided?

**Decision**: Auto-fill from JWT `departmentId` for MANAGER role. For HR_ADMIN, accept optional explicit `targetDepartmentId`/`targetTeamId` in the DTO; default to `null` for COMPANY audience.

**Rationale**: A MANAGER posting to their department is the 99% case. Requiring them to re-enter their department ID is friction. HR_ADMIN can post to any department/team, so explicit targeting is required for them.

**Edge case handled**: If HR_ADMIN provides neither `targetDepartmentId` for a DEPARTMENT audience, the service throws `BadRequestException('TargetDepartmentRequired')`.

---

## 6. `isPinned` Semantics

**Question**: Is there a new `isPinned Boolean` column needed, or is pin state derived?

**Decision**: Derived. The existing `pinnedUntil DateTime?` column (added in 012-social-scaffold) encodes pin state: `isPinned = pinnedUntil != null && pinnedUntil > now()`. No new column.

**Rationale**: Avoids dual-write inconsistency between a boolean flag and a datetime. A single source of truth.

---

## 7. ROLE / INDIVIDUAL Audience Values

**Question**: The `Audience` enum has ROLE and INDIVIDUAL values. Are they in scope?

**Decision**: Out of scope for this release. The service validates and rejects these values at the controller/service layer with `BadRequestException('UnsupportedAudienceInThisRelease')`.

**Rationale**: Spec FR-030 explicitly calls these out as in-enum but deferred. Validation at the service boundary prevents confusion.

---

## 8. Prisma Migration Safety

**Question**: Does the migration require DROP operations on the existing `announcements` table?

**Decision**: No DROP operations. The migration only adds three nullable columns and two indexes to the existing `announcements` table.

**Schema diff**:
```sql
ALTER TABLE social.announcements ADD COLUMN "targetDepartmentId" TEXT;
ALTER TABLE social.announcements ADD COLUMN "targetTeamId" TEXT;
ALTER TABLE social.announcements ADD COLUMN "expiresAt" TIMESTAMPTZ;
CREATE INDEX "announcements_targetDepartmentId_idx" ON social.announcements("targetDepartmentId");
CREATE INDEX "announcements_targetTeamId_idx" ON social.announcements("targetTeamId");
```

**Safety**: All new columns are nullable — zero-downtime additive migration. No existing rows or indexes are dropped.
