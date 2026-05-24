# Data Model: Organization Structure Module

**Feature**: `001-org-structure-module`  
**Service**: HR Core (`apps/hr-core`)  
**Schema**: `hr_core`  
**Date**: 2026-04-06

---

## Entities

### Department

Represents a top-level organizational unit. Root of the org hierarchy.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK, `@default(uuid())` | |
| `name` | String | Unique | e.g. "Engineering" |
| `code` | String | Unique | Short code e.g. "ENG", "HR" |
| `description` | String? | Optional | |
| `headId` | String? | Logical FK → Employee.id | Nullable; no DB-level FK |
| `isActive` | Boolean | `@default(true)` | Soft-delete flag |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Relations**:
- `teams` → `Team[]` (one-to-many via `Team.departmentId`)

**Indexes**:
- `@@unique([name])`, `@@unique([code])`
- `@@index([isActive])` — for active-only queries

---

### Team

Represents a sub-unit within a Department. Direct unit of staffing and leave scheduling.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK, `@default(uuid())` | |
| `name` | String | | e.g. "Backend" |
| `code` | String? | Unique (when present) | e.g. "BE-01" |
| `description` | String? | Optional | |
| `departmentId` | String | FK → Department.id | DB-level relation within `hr_core` |
| `leadId` | String? | Logical FK → Employee.id | Nullable; no DB-level FK |
| `projectFocus` | String? | Optional | e.g. "Payment Gateway v2" |
| `isActive` | Boolean | `@default(true)` | Soft-delete flag |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Relations**:
- `department` → `Department` (many-to-one)

**Indexes**:
- `@@unique([code])` (partial — only enforced when code is non-null, handled at application layer)
- `@@index([departmentId])` — for department → teams queries
- `@@index([isActive])`

---

### Position

Organization-wide catalog of job title + seniority combinations. Not scoped to a department.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK, `@default(uuid())` | |
| `title` | String | Unique | e.g. "Software Engineer" |
| `level` | String? | Optional | e.g. "Junior", "Senior", "Lead" |
| `isActive` | Boolean | `@default(true)` | Soft-delete flag |
| `createdAt` | DateTime | `@default(now())` | |

**Note**: `updatedAt` is omitted from the class diagram for Position. Following the class diagram exactly — no `@updatedAt` on Position.

**Relations**:
- Referenced by `Employee.positionId` (logical FK)
- Referenced by `JobHistory.positionId` (logical FK)
- Referenced by `ContractAmendment.newPositionId` (logical FK, optional)

**Indexes**:
- `@@unique([title])`
- `@@index([isActive])`

---

## Prisma Schema (hr_core)

```prisma
// ============================================================
// DOMAIN: Organization Structure
// WHY: Department, Team, Position are the foundational org
//      entities that every other HR module references.
//      Extracted as a separate module so Analytics Agent and
//      Org Scenario Analyzer can query them independently.
// ============================================================

model Department {
  id          String   @id @default(uuid())
  name        String   @unique
  code        String   @unique
  description String?
  headId      String?  // Logical FK → Employee.id (no DB constraint — cross-entity within hr_core, validated at app layer)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  teams Team[]

  @@schema("hr_core")
  @@map("departments")
  @@index([isActive])
}

model Team {
  id           String   @id @default(uuid())
  name         String
  code         String?  @unique
  description  String?
  departmentId String
  leadId       String?  // Logical FK → Employee.id (no DB constraint)
  projectFocus String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  department Department @relation(fields: [departmentId], references: [id])

  @@schema("hr_core")
  @@map("teams")
  @@index([departmentId])
  @@index([isActive])
}

model Position {
  id        String   @id @default(uuid())
  title     String   @unique
  level     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@schema("hr_core")
  @@map("positions")
  @@index([isActive])
}
```

---

## State Transitions

### Department / Team / Position — Active Status

```
ACTIVE (isActive: true)
   │
   │  HR Admin deactivates
   ▼
INACTIVE (isActive: false)
   │
   │  HR Admin re-activates (PATCH isActive: true)
   ▼
ACTIVE
```

There is no permanent deletion state — records are never hard-deleted.

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| Department | `name` | Required, 1–100 chars, unique |
| Department | `code` | Required, 2–10 chars, uppercase letters/numbers only (e.g. `ENG`), unique |
| Department | `headId` | Optional UUID; if provided, must resolve to an active Employee in `hr_core` |
| Team | `name` | Required, 1–100 chars |
| Team | `code` | Optional, 2–20 chars; if provided, must be unique |
| Team | `departmentId` | Required UUID; target department must be active |
| Team | `leadId` | Optional UUID; if provided, existence validated at service layer |
| Position | `title` | Required, 1–100 chars, unique |
| Position | `level` | Optional string, 1–50 chars |

---

## Cross-Entity References (Logical FKs — No DB Constraints)

| Source Field | Targets | How Validated |
|-------------|---------|---------------|
| `Department.headId` | `Employee.id` (hr_core) | `prisma.employee.findUnique()` in DepartmentsService on write |
| `Team.leadId` | `Employee.id` (hr_core) | `prisma.employee.findUnique()` in TeamsService on write; vacancy check on read |
| `Employee.departmentId` | `Department.id` | Managed by EmployeesModule — not owned by this module |
| `Employee.teamId` | `Team.id` | Managed by EmployeesModule — not owned by this module |
| `Employee.positionId` | `Position.id` | Managed by EmployeesModule — not owned by this module |

---

## Org-Chart Response Shape

The org-chart endpoint returns a denormalized snapshot for direct consumption by the Analytics Agent and frontend:

```typescript
interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  teams: OrgChartTeam[];
}

interface OrgChartTeam {
  id: string;
  name: string;
  code: string | null;
  leadId: string | null;
  leadVacant: boolean;     // true when leadId is set but Employee is TERMINATED
  projectFocus: string | null;
  employeeCount: number;   // resolved via prisma._count
}

type OrgChartResponse = OrgChartDepartment[];
```
