# API Contract: Skills (HR Core :3001)

**Service**: HR Core
**Base path**: `/` (three resource trees share the module)
**Guards**: `SharedJwtGuard`, `RbacGuard` on every endpoint
**Global pipes**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`

All timestamps ISO 8601 UTC. All IDs are UUIDv4.

---

## 1. Catalog (`/skills`)

### POST /skills

**Summary**: Create a new skill in the catalog
**Roles**: `HR_ADMIN`

**Request body**:

```json
{
  "name": "string (required, trimmed, 1-120 chars, case-insensitive unique)",
  "category": "string (optional, max 60 chars)",
  "description": "string (optional, max 1000 chars)"
}
```

**Responses**:

| Status | Description |
|--------|-------------|
| 201    | Skill created. Returns the created `Skill` object (id, name, category, description, isActive=true, createdAt). |
| 400    | Validation error (empty name, length violations). |
| 403    | Forbidden — caller is not `HR_ADMIN`. |
| 409    | Conflict — a skill with this name (case-insensitive) already exists. |

---

### GET /skills

**Summary**: List catalog skills with filtering and pagination
**Roles**: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE` (read-only catalog is safe for all authenticated users)

**Query parameters**:

| Param      | Type    | Default | Description |
|------------|---------|---------|-------------|
| page       | number  | 1       | 1-based page number |
| limit      | number  | 20      | Items per page, max 100 |
| search     | string  | —       | Case-insensitive partial match on `name` |
| category   | string  | —       | Exact match on `category` |
| isActive   | boolean | `true`  | `true` returns only active; `false` returns only deactivated; omit both to return all — but default is `true` |
| sortBy     | string  | `name`  | `name` \| `category` \| `createdAt` |
| sortOrder  | string  | `asc`   | `asc` \| `desc` |

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `{ data: Skill[], total: number, page: number, limit: number }` |
| 403    | Forbidden — unauthenticated or missing role. |

---

### GET /skills/:id

**Summary**: Fetch a single catalog skill
**Roles**: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE`

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `Skill` object. |
| 404    | Skill not found. |

---

### PATCH /skills/:id

**Summary**: Edit skill catalog entry (cannot rename to a name already taken)
**Roles**: `HR_ADMIN`

**Request body** (all fields optional):

```json
{
  "name": "string (trimmed, 1-120 chars)",
  "category": "string (max 60 chars, nullable)",
  "description": "string (max 1000 chars, nullable)"
}
```

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | Updated `Skill` object. |
| 400    | Validation error. |
| 403    | Forbidden. |
| 404    | Skill not found. |
| 409    | Conflict — name collision (case-insensitive). |

---

### PATCH /skills/:id/deactivate

**Summary**: Mark a skill inactive — it disappears from selection lists but remains readable on every existing `EmployeeSkill` and history entry
**Roles**: `HR_ADMIN`

**Request body**: none

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `Skill` object with `isActive: false`. |
| 403    | Forbidden. |
| 404    | Skill not found. |
| 409    | Skill is already inactive. |

---

### PATCH /skills/:id/reactivate

**Summary**: Re-enable a previously deactivated skill
**Roles**: `HR_ADMIN`

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `Skill` object with `isActive: true`. |
| 403    | Forbidden. |
| 404    | Skill not found. |
| 409    | Skill is already active. |

---

## 2. Employee skills (`/employees/:employeeId/skills`)

Nested under employees because the resource is conceptually an attribute of the target employee and the route reflects the scoping.

### GET /employees/:employeeId/skills

**Summary**: Read an employee's current skill portfolio (non-deleted entries only)
**Roles**: `EMPLOYEE` (only for their own ID), `MANAGER` (only for direct reports), `HR_ADMIN`, `EXECUTIVE`

**Query parameters**:

| Param             | Type    | Default | Description |
|-------------------|---------|---------|-------------|
| minLevel          | enum    | —       | Filter at or above a given `ProficiencyLevel` |
| includeDeactivated| boolean | `true`  | Include entries referencing a deactivated `Skill` — default yes (portfolio preservation) |

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | Array of `EmployeeSkill` objects with `skill` relation populated (id, name, category, isActive). |
| 403    | Forbidden — scope violation. |
| 404    | Employee not found. |

---

### POST /employees/:employeeId/skills

**Summary**: Record a proficiency — creates or updates the current row, appends history if the level changed (idempotent no-op if the incoming level matches current)
**Roles**: `MANAGER` (only for direct reports), `HR_ADMIN`

**Request body**:

```json
{
  "skillId": "UUID (required, must reference an active Skill for a first assignment)",
  "proficiency": "BEGINNER | INTERMEDIATE | ADVANCED | EXPERT (required)",
  "source": "RECRUITMENT | TRAINING | CERTIFICATION | MANAGER | PEER_REVIEW (required)",
  "note": "string (optional, max 1000 chars)",
  "acquiredDate": "ISO date (optional)",
  "effectiveDate": "ISO date (optional, defaults to now; may be backdated)"
}
```

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `{ changed: boolean, current: EmployeeSkill, history: SkillHistory \| null }`. `changed=false` when the incoming level equals the current level (no history row written). |
| 400    | Validation error (unknown enum value, effectiveDate in the future beyond a reasonable bound, skill inactive on first assignment). |
| 403    | Forbidden — caller lacks scope over the target employee, or tried to assign as `EMPLOYEE`. |
| 404    | Employee or skill not found. |
| 409    | Conflict — employee is `TERMINATED` or `RESIGNED`; writes are blocked. |

**Side effects**:
- On first assignment or level change: emits `skill.assessed` with `isFirstAssessment` flag.
- Operates inside a single Prisma transaction (current + history write are atomic).

---

### DELETE /employees/:employeeId/skills/:skillId

**Summary**: Remove a skill from the employee's portfolio (soft-delete). History is preserved.
**Roles**: `MANAGER` (direct reports), `HR_ADMIN`

**Responses**:

| Status | Description |
|--------|-------------|
| 204    | Removed. |
| 403    | Forbidden — scope violation. |
| 404    | Employee, skill, or active `EmployeeSkill` row not found. |
| 409    | Conflict — employee is `TERMINATED` or `RESIGNED`. |

**Side effects**:
- Sets `deletedAt = now()` on the current row. Emits `skill.removed` with `lastLevel`.

---

### GET /skills/:skillId/employees

**Summary**: HR-level reverse lookup — "who holds this skill and at what level?"
**Roles**: `HR_ADMIN`, `EXECUTIVE`

**Query parameters**:

| Param        | Type   | Default | Description |
|--------------|--------|---------|-------------|
| minLevel     | enum   | —       | Filter at or above a proficiency |
| departmentId | UUID   | —       | Restrict to a department |
| teamId       | UUID   | —       | Restrict to a team |
| page         | number | 1       |             |
| limit        | number | 20      | Max 100     |

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `{ data: EmployeeSkillWithEmployee[], total, page, limit }`. Employee object trimmed to `{ id, firstName, lastName, departmentId, teamId }`; no salary/DOB leakage. |
| 403    | Forbidden. |
| 404    | Skill not found. |

---

## 3. History (`/skills/history`)

### GET /skills/history

**Summary**: Audit the evolution of skill levels between two dates
**Roles**:
- `EMPLOYEE` — only with `employeeId = self`.
- `MANAGER` — must provide at least one of `employeeId`, `teamId` within their scope.
- `HR_ADMIN`, `EXECUTIVE` — any scope.

**Query parameters**:

| Param        | Type    | Default    | Description |
|--------------|---------|------------|-------------|
| employeeId   | UUID    | —          | Single-employee audit |
| teamId       | UUID    | —          | Team-wide audit (manager must manage the team) |
| departmentId | UUID    | —          | Department-wide audit |
| skillId      | UUID    | —          | Restrict to one skill |
| source       | enum    | —          | Filter by `SourceLevel` |
| fromDate     | ISO date| —          | Inclusive lower bound on `effectiveDate` |
| toDate       | ISO date| —          | Inclusive upper bound on `effectiveDate` |
| page         | number  | 1          |             |
| limit        | number  | 50         | Max 200     |
| order        | string  | `desc`     | `asc` \| `desc` on `effectiveDate`, tie-broken by `createdAt` |

At least one of `employeeId`, `teamId`, `departmentId`, `skillId` MUST be provided (no unscoped dumps). The controller returns `400` if none is present.

**Responses**:

| Status | Description |
|--------|-------------|
| 200    | `{ data: SkillHistory[], total, page, limit }`. Entries include `skill` and `assessedBy` relation summaries. |
| 400    | No scope filter provided, or invalid date range (`fromDate > toDate`). |
| 403    | Forbidden — scope violation (e.g. manager requested a team they don't manage). |

---

## Response Shape Reference

**Skill**:

```json
{
  "id": "UUID",
  "name": "string",
  "category": "string | null",
  "description": "string | null",
  "isActive": true,
  "createdAt": "ISO 8601"
}
```

**EmployeeSkill** (with optional `skill` relation):

```json
{
  "id": "UUID",
  "employeeId": "UUID",
  "skillId": "UUID",
  "proficiency": "BEGINNER | INTERMEDIATE | ADVANCED | EXPERT",
  "acquiredDate": "ISO 8601 | null",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "skill": { "id": "...", "name": "...", "category": "...", "isActive": true }
}
```

**SkillHistory** (with optional `skill` and `assessedBy` relation summaries):

```json
{
  "id": "UUID",
  "employeeId": "UUID",
  "skillId": "UUID",
  "previousLevel": "BEGINNER | INTERMEDIATE | ADVANCED | EXPERT | null",
  "newLevel": "BEGINNER | INTERMEDIATE | ADVANCED | EXPERT",
  "effectiveDate": "ISO 8601",
  "source": "RECRUITMENT | TRAINING | CERTIFICATION | MANAGER | PEER_REVIEW",
  "note": "string | null",
  "assessedById": "UUID | null",
  "createdAt": "ISO 8601",
  "skill": { "id": "...", "name": "..." },
  "assessedBy": { "id": "...", "firstName": "...", "lastName": "..." } | null
}
```

---

## RBAC Matrix (summary)

| Endpoint                                      | EMPLOYEE  | MANAGER               | HR_ADMIN | EXECUTIVE |
|-----------------------------------------------|-----------|-----------------------|----------|-----------|
| POST /skills                                  | ❌        | ❌                    | ✅       | ❌        |
| GET /skills                                   | ✅        | ✅                    | ✅       | ✅        |
| GET /skills/:id                               | ✅        | ✅                    | ✅       | ✅        |
| PATCH /skills/:id                             | ❌        | ❌                    | ✅       | ❌        |
| PATCH /skills/:id/deactivate                  | ❌        | ❌                    | ✅       | ❌        |
| PATCH /skills/:id/reactivate                  | ❌        | ❌                    | ✅       | ❌        |
| GET /employees/:id/skills                     | OWN only  | TEAM only             | ✅       | ✅        |
| POST /employees/:id/skills                    | ❌        | TEAM only             | ✅       | ❌        |
| DELETE /employees/:id/skills/:skillId         | ❌        | TEAM only             | ✅       | ❌        |
| GET /skills/:skillId/employees                | ❌        | ❌                    | ✅       | ✅        |
| GET /skills/history                           | OWN only  | TEAM only (own scope) | ✅       | ✅        |
