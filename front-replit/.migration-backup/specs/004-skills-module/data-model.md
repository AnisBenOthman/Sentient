# Data Model: Skills Module

**Branch**: `004-skills-module` | **Date**: 2026-04-17
**Schema**: `hr_core`

## Entities

### Skill (catalog)

Global catalog of skill definitions. One entry per distinct skill across the company.

| Field       | Type      | Constraints                                      | Notes                                         |
|-------------|-----------|--------------------------------------------------|-----------------------------------------------|
| id          | UUID      | PK, auto-generated                               |                                               |
| name        | String    | Not null, unique (exact), trimmed at service     | Case-insensitive duplicate check in service (R-005) |
| category    | String    | Optional                                         | Free text, e.g. `Programming`, `DevOps`       |
| description | String    | Optional                                         | Human-readable definition                     |
| isActive    | Boolean   | Not null, default `true`                         | Deactivated skills can't be assigned to new rows |
| createdAt   | DateTime  | Auto, not null                                   |                                               |

**Indexes**:
- `@@index([category])` — catalog browsing by category
- `@@index([isActive])` — fast filter in selection lists

**Relations**:
- `employeeSkills` → `EmployeeSkill[]`
- `history` → `SkillHistory[]`

**Table**: `skills`

---

### EmployeeSkill (current snapshot)

At most one active row per (employee, skill). Holds the employee's current proficiency on that skill.

| Field         | Type              | Constraints                            | Notes                                      |
|---------------|-------------------|----------------------------------------|--------------------------------------------|
| id            | UUID              | PK, auto-generated                     |                                            |
| employeeId    | UUID              | FK → `employees.id`, not null          |                                            |
| skillId       | UUID              | FK → `skills.id`, not null             |                                            |
| proficiency   | ProficiencyLevel  | Not null                               |                                            |
| acquiredDate  | DateTime          | Optional                               | When the employee first acquired the skill (user-editable) |
| createdAt     | DateTime          | Auto, not null                         |                                            |
| updatedAt     | DateTime          | Auto, not null                         |                                            |
| deletedAt     | DateTime          | Optional                               | Non-null → soft-deleted; hidden from default reads |

**Indexes**:
- `@@index([employeeId])` — portfolio reads
- `@@index([skillId])` — reverse lookups (who has this skill?)
- `@@index([deletedAt])` — excludes soft-deleted rows efficiently
- **Partial unique** (raw SQL in migration, see R-004): `(employeeId, skillId) WHERE deletedAt IS NULL` — enforces "one active row per pair" while still permitting a stack of soft-deleted historical rows

**Relations**:
- `employee` → `Employee` (many-to-one)
- `skill` → `Skill` (many-to-one)

**Table**: `employee_skills`

---

### SkillHistory (audit trail — append-only)

Immutable journal of every proficiency change, including first assignments.

| Field          | Type              | Constraints                           | Notes                                              |
|----------------|-------------------|---------------------------------------|----------------------------------------------------|
| id             | UUID              | PK, auto-generated                    |                                                    |
| employeeId     | UUID              | FK → `employees.id`, not null         |                                                    |
| skillId        | UUID              | FK → `skills.id`, not null            |                                                    |
| previousLevel  | ProficiencyLevel  | Nullable                              | `null` on the first assessment for this (employee, skill) |
| newLevel       | ProficiencyLevel  | Not null                              | Always set                                         |
| effectiveDate  | DateTime          | Not null                              | When the change takes effect (may be backdated)    |
| source         | SourceLevel       | Not null                              | Origin of the information                          |
| note           | String            | Optional                              | Free-text justification                            |
| assessedById   | UUID              | FK → `employees.id`, nullable         | The employee who authored the assessment (manager or HR admin). Nullable to survive deletion of the author's record without losing history. |
| createdAt      | DateTime          | Auto, not null                        |                                                    |

**Indexes**:
- `@@index([employeeId, effectiveDate])` — primary audit query (single employee, date range)
- `@@index([skillId, effectiveDate])` — "how did our Python bench evolve?" queries
- `@@index([effectiveDate])` — company-wide chronology
- `@@index([source])` — filter audits by origin
- `@@index([assessedById])` — "what assessments did this manager make?"

**Relations**:
- `employee` → `Employee` (many-to-one, field `employeeId`)
- `skill` → `Skill` (many-to-one)
- `assessedBy` → `Employee?` (many-to-one, field `assessedById`, relation name `AssessedSkillHistories`)

**Mutation policy**: no UPDATE and no DELETE from application code. Rows are INSERT-only.

**Table**: `skill_history`

---

## Enum Additions

### ProficiencyLevel (new)

```
BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
```

- Prisma enum `ProficiencyLevel` with `@@schema("hr_core")`.
- Shared TS enum at `packages/shared/src/enums/proficiency-level.enum.ts`.
- Re-exported in `packages/shared/src/enums/index.ts`.

### SourceLevel (new)

```
RECRUITMENT | TRAINING | CERTIFICATION | MANAGER | PEER_REVIEW
```

- Prisma enum `SourceLevel` with `@@schema("hr_core")`.
- Shared TS enum at `packages/shared/src/enums/source-level.enum.ts`.
- Re-exported in `packages/shared/src/enums/index.ts`.
- Typo `RECRUITEMENT` from the drawio diagram is corrected to `RECRUITMENT`.

---

## Employee Model Additions (relations only, no column change)

The existing `Employee` model gains back-references. These are Prisma-level relations only; they do not emit DDL beyond what the FK columns on the new tables already provide.

| Relation             | Type               | Reverse of                                       |
|----------------------|--------------------|--------------------------------------------------|
| `skills`             | `EmployeeSkill[]`  | `EmployeeSkill.employeeId`                       |
| `skillHistory`       | `SkillHistory[]`   | `SkillHistory.employeeId`                        |
| `assessedSkillHistory` | `SkillHistory[]` | `SkillHistory.assessedById` (named `AssessedSkillHistories`) |

---

## Transitions & Invariants

### Assessment write path

Given caller `U`, target employee `E`, skill `S`, incoming level `L`, source `src`, optional note `n`, optional effectiveDate `d` (default = now):

1. Verify `U` has write scope over `E` (MANAGER of `E`, or HR_ADMIN, or `source = PEER_REVIEW` *still* requires the author to be MANAGER/HR_ADMIN — R-006).
2. Verify `E.employmentStatus ∉ { TERMINATED, RESIGNED }` (R-010).
3. Verify `S.isActive = true` OR an existing non-deleted `EmployeeSkill(E, S)` row exists (deactivated skills can be updated on rows that already reference them, but no new assignment).
4. Look up current row `R = EmployeeSkill(E, S, deletedAt IS NULL)`.
5. **Case A — no current row exists**: insert new `EmployeeSkill(E, S, L)` AND insert `SkillHistory(previousLevel = null, newLevel = L, ...)` in one transaction. Emit `skill.assessed` with `isFirstAssessment = true`.
6. **Case B — current row exists, `R.proficiency = L`**: no-op. Return `{ changed: false, current: R }`. No history row, no event.
7. **Case C — current row exists, `R.proficiency ≠ L`**: update `R.proficiency = L` AND insert `SkillHistory(previousLevel = R.proficiency, newLevel = L, ...)` in one transaction. Emit `skill.assessed` with `isFirstAssessment = false`.

### Removal path

1. Verify scope + employment status (as above).
2. Find active row `R`. If none, return `404`.
3. Set `R.deletedAt = now()`. No history row is written (per spec FR-014). Emit `skill.removed` with `lastLevel = R.proficiency`.

### Re-assignment after removal

A new assessment for a previously removed `(E, S)` pair starts fresh: a new `EmployeeSkill` row is inserted (the partial unique index permits this because the old row has `deletedAt` set), and a new `SkillHistory` row with `previousLevel = null` is written. The prior history rows remain intact and queryable.

---

## Domain Events

| Event            | Trigger                                         | Payload                                                                 |
|------------------|-------------------------------------------------|-------------------------------------------------------------------------|
| `skill.assessed` | After a successful write that produced a history row | `{ employeeId, skillId, previousLevel \| null, newLevel, source, assessedById, isFirstAssessment }` |
| `skill.removed`  | After a successful soft-delete                  | `{ employeeId, skillId, lastLevel }`                                    |

No events are emitted on catalog mutations or on no-op assessments.

---

## Data Volume & Growth Assumptions

- Catalog: low thousands of rows at steady state (~100–500 skills typical).
- `EmployeeSkill`: ~10 active rows per employee on average → ~100k rows at 10k employees.
- `SkillHistory`: ~2–5 changes per active skill per employee across a career → bounded ~500k rows over the project lifetime.
- Indexes above are sized for the p95 latency targets in `plan.md` Technical Context.
