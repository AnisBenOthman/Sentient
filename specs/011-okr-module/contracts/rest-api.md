# REST API Contract: OKR Module

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **Data model**: [data-model.md](../data-model.md)
**Base paths**: all under `/api/hr/` on HR Core (port 3001) — matches the existing Vite dev proxy + frontend client convention.
**Auth**: `SharedJwtGuard` + `RbacGuard` + per-route `@Roles(...)` on every endpoint. Scope filtering enforced in the service layer per [data-model.md §6](../data-model.md).

---

## Resource groups

1. **OKR Cycles** — `/api/hr/okr-cycles`
2. **Objectives** — `/api/hr/objectives`
3. **Key Results** — `/api/hr/key-results`
4. **Check-ins** — `/api/hr/okr-check-ins`
5. **Analytics** — `/api/hr/okr-analytics`

---

## 1. OKR Cycles

### `POST /api/hr/okr-cycles` — Create a cycle

**RBAC**: `HR_ADMIN`.

**Body** (`CreateOkrCycleDto`):

```ts
{
  name: string;                 // unique, 1..64 chars
  type: 'ANNUAL' | 'QUARTERLY';
  year: number;                 // integer
  quarter?: 1 | 2 | 3 | 4;      // required iff type='QUARTERLY'
  startDate: string;            // ISO date (YYYY-MM-DD)
  endDate: string;              // ISO date (YYYY-MM-DD)
  parentCycleId?: string;       // UUID; only allowed when type='QUARTERLY'; parent.type MUST be 'ANNUAL'
}
```

**Validation errors** (frontend mapping):

| Error code | Cause | Frontend message |
|---|---|---|
| `CycleNameTaken` | Another cycle has the same `name` | "A cycle with this name already exists." |
| `InvalidQuarter` | `quarter` not in 1..4, or set for ANNUAL, or missing for QUARTERLY | "Quarter must be 1–4 for quarterly cycles." |
| `ParentMustBeAnnual` | `parentCycleId` references a cycle whose `type` is not `ANNUAL` | "Parent cycle must be an annual cycle." |
| `EndBeforeStart` | `endDate <= startDate` | "End date must be after start date." |

**Responses**:

- `201 Created` — `OkrCycleResponseDto` (created in `DRAFT` status).
- `400 Bad Request` — validation error (codes above).
- `403 Forbidden` — caller is not `HR_ADMIN`.

---

### `GET /api/hr/okr-cycles` — List cycles

**RBAC**: any authenticated user. Returns cycles filtered by query.

**Query** (`OkrCycleQueryDto`, all optional):

| Name | Type | Notes |
|---|---|---|
| `type` | `ANNUAL` \| `QUARTERLY` | Filter by type |
| `year` | integer | Filter by year |
| `status` | `DRAFT` \| `ACTIVE` \| `CLOSED` | Filter by status |
| `parentCycleId` | UUID | Filter children of a given annual cycle |
| `limit` | 1..100, default 50 | Page size |
| `cursor` | opaque | Cursor pagination per the same scheme as notifications |

**Response** `200 OK`:

```json
{
  "items": [
    {
      "id": "…",
      "name": "Q1 2026",
      "type": "QUARTERLY",
      "year": 2026,
      "quarter": 1,
      "status": "ACTIVE",
      "startDate": "2026-01-01",
      "endDate": "2026-03-31",
      "parentCycleId": "…",
      "createdAt": "2026-05-17T10:00:00.000Z",
      "updatedAt": "2026-05-17T10:05:00.000Z"
    }
  ],
  "nextCursor": null
}
```

---

### `PATCH /api/hr/okr-cycles/:id/activate` — Transition DRAFT → ACTIVE

**RBAC**: `HR_ADMIN`.

**Side effect**: emits `okr.cycle_activated` after commit. The notifications bridge fans out a broadcast `OKR / INFO` notification to every active employee (see [event-subscriptions.md](./event-subscriptions.md)).

**Errors**:

| Code | Cause |
|---|---|
| `CycleNotDraft` | Cycle status is not `DRAFT` |
| `EndDateInPast` | `endDate` is already in the past |

**Response** `200 OK` — `OkrCycleResponseDto` (status now `ACTIVE`).

---

### `PATCH /api/hr/okr-cycles/:id/close` — Transition ACTIVE → CLOSED (or DRAFT → CLOSED)

**RBAC**: `HR_ADMIN`.

**Side effects** (inside the same transaction):
1. Set all `ACTIVE` Objectives in this cycle to `CLOSED` (final scores frozen).
2. Auto-reject all `PENDING` check-ins in this cycle with system reason "Cycle closed before review".
3. After commit, emit one `okr.objective_closed` per Objective that transitioned.

**Response** `200 OK` — `OkrCycleResponseDto`.

---

## 2. Objectives

### `POST /api/hr/objectives` — Create an Objective

**RBAC**: level-dependent.

| Level requested | Caller roles allowed | Extra constraint |
|---|---|---|
| `COMPANY` | `HR_ADMIN` or `EXECUTIVE` | `parentObjectiveId` MUST be omitted; `departmentId` and `ownerId` MUST be omitted |
| `DEPARTMENT` | `HR_ADMIN`; `MANAGER` only if `body.departmentId == caller.departmentId` | `parentObjectiveId` MUST point at a `COMPANY` Objective in the same cycle (or its annual parent cycle); `departmentId` required |
| `EMPLOYEE` | `HR_ADMIN`; `MANAGER` only if owner is a direct report; `EMPLOYEE` only if `body.ownerId == caller.sub` | `parentObjectiveId` MUST point at a `DEPARTMENT` Objective whose `departmentId == owner.departmentId`; `ownerId` required |

**Body** (`CreateObjectiveDto`):

```ts
{
  title: string;                // 1..200
  description?: string;          // 0..2000
  level: 'COMPANY' | 'DEPARTMENT' | 'EMPLOYEE';
  cycleId: string;               // UUID
  parentObjectiveId?: string;    // UUID; required for DEPARTMENT and EMPLOYEE
  ownerId?: string;              // UUID (User.id); required for EMPLOYEE
  departmentId?: string;         // UUID; required for DEPARTMENT
}
```

**Errors**:

| Code | Cause | Frontend message |
|---|---|---|
| `CycleNotActive` | Target cycle is not `ACTIVE` | "Cannot create an OKR in a closed or draft cycle." |
| `ParentNotFound` | `parentObjectiveId` does not resolve | "Parent OKR no longer exists." |
| `ParentWrongLevel` | Parent's `level` is not exactly one rung up | "Parent OKR is not at the expected level." |
| `ParentNotActive` | Parent's `status` is not `ACTIVE` | "Cannot align to a closed or cancelled parent OKR." |
| `CrossDepartmentAlignment` | Employee's department does not match parent department | "Employee OKRs must align to your own department's OKRs." |
| `LevelMismatch` | Body fields inconsistent with `level` (CHECK constraint) | "Invalid OKR level configuration." |

**Response** `201 Created` — `ObjectiveResponseDto` (status `DRAFT`). If `level == 'EMPLOYEE'`, the service also emits `okr.objective_created` after commit (consumed by Career Agent).

---

### `GET /api/hr/objectives` — List Objectives

**RBAC**: any authenticated user. Service applies scope filter per [data-model.md §6](../data-model.md).

**Query** (`ObjectiveQueryDto`, all optional):

| Name | Type | Notes |
|---|---|---|
| `cycleId` | UUID | Required-in-practice; if omitted, defaults to "all active cycles" |
| `level` | `COMPANY` \| `DEPARTMENT` \| `EMPLOYEE` | Filter by level |
| `departmentId` | UUID | Filter by department |
| `ownerId` | UUID | Filter by owner |
| `status` | enum | Filter by status (default: excludes `CANCELLED`) |
| `limit` | 1..100, default 50 | Page size |
| `cursor` | opaque | Cursor pagination |

**Response** `200 OK`:

```json
{
  "items": [/* ObjectiveResponseDto[] */],
  "nextCursor": "…"
}
```

---

### `GET /api/hr/objectives/:id` — Get one Objective with KRs and alignment context

**RBAC**: any authenticated user with read access to the Objective.

**Response** `200 OK` (`ObjectiveDetailResponseDto`):

```json
{
  "objective": { /* ObjectiveResponseDto */ },
  "keyResults": [ /* KeyResultResponseDto[] */ ],
  "alignment": {
    "parent": { "id": "…", "title": "…", "level": "DEPARTMENT" } | null,
    "children": [{ "id": "…", "title": "…", "level": "EMPLOYEE", "ownerId": "…" }]
  }
}
```

`404 Not Found` — if the Objective doesn't exist OR is outside the caller's scope (intentionally ambiguous to avoid leaking existence).

---

### `PATCH /api/hr/objectives/:id` — Update title/description/status

**RBAC**: creator OR `HR_ADMIN` OR (for DEPARTMENT-level) Manager of the same department OR (for EMPLOYEE-level) the owner.

**Body** (`UpdateObjectiveDto`, all optional):

```ts
{
  title?: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
}
```

**Transition rules**: per the state machine in [data-model.md §4](../data-model.md). Transitioning to `ACTIVE` requires the parent cycle to be `ACTIVE`. Transitioning to `CLOSED` emits `okr.objective_closed` after commit.

**Response** `200 OK` — `ObjectiveResponseDto`.

---

### `DELETE /api/hr/objectives/:id` — Soft-delete (status = CANCELLED)

**RBAC**: creator OR `HR_ADMIN`.

**Side effects** (inside transaction): cascade cancel all child KRs (status = `CANCELLED`); auto-reject all `PENDING` check-ins on those KRs.

**Response** `204 No Content`.

---

## 3. Key Results

### `POST /api/hr/key-results` — Create a KR under an Objective

**RBAC**: same as the parent Objective's edit permission (creator / HR_ADMIN / Manager-of-dept / owner-of-employee-Objective).

**Body** (`CreateKeyResultDto`):

```ts
{
  objectiveId: string;
  title: string;                                  // 1..200
  metricType: 'PERCENTAGE' | 'NUMBER' | 'CURRENCY' | 'BOOLEAN';
  targetValue: string;                            // Decimal as string for precision
  unit: string;                                   // 1..32
  assigneeIds?: string[];                         // UUID[]; default []
  dueDate?: string;                               // ISO date
}
```

**Errors**:

| Code | Cause |
|---|---|
| `ObjectiveNotActive` | Parent Objective is not `ACTIVE` |
| `BooleanTargetMustBeOne` | `metricType='BOOLEAN'` AND `targetValue != 1` |
| `TargetMustBePositive` | `metricType != 'BOOLEAN'` AND `targetValue <= 0` |
| `AssigneeNotFound` | An id in `assigneeIds` does not match an active Employee |

**Response** `201 Created` — `KeyResultResponseDto` with `currentValue=0`, `score=0`, `status='ON_TRACK'`.

---

### `PATCH /api/hr/key-results/:id` — Update target/assignees/status

**RBAC**: parent Objective's edit permission.

**Body** (`UpdateKeyResultDto`, all optional):

```ts
{
  title?: string;
  targetValue?: string;
  assigneeIds?: string[];
  dueDate?: string;
  status?: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'ACHIEVED' | 'CANCELLED';
}
```

**Side effects**:
- If `targetValue` changes, `score` is recomputed for the existing `currentValue`.
- If `status` is set to `ACHIEVED`, no event is emitted (status is descriptive, not a domain event).

**Response** `200 OK` — `KeyResultResponseDto`.

---

### `GET /api/hr/key-results/objective/:objectiveId` — List KRs for an Objective

**RBAC**: read access to the parent Objective.

**Response** `200 OK`:

```json
{ "items": [/* KeyResultResponseDto[] */] }
```

---

## 4. Check-ins

### `POST /api/hr/okr-check-ins` — Submit a check-in

**RBAC**: any authenticated user who is in the KR's `assigneeIds`.

**Body** (`SubmitCheckInDto`):

```ts
{
  keyResultId: string;
  value: string;                  // Decimal as string
  comment?: string;                // 0..2000
}
```

Note: `score` is computed server-side; the DTO does NOT accept a client score (per research R7 + FR-012).

**Auto-approval rule** (FR-016): if the parent Objective's `level == 'EMPLOYEE'` AND its `ownerId == submitter.sub`, the check-in is created with `status='APPROVED'`, `reviewedAt=now()`, `reviewedById=null`, and the KR's `currentValue` + `score` are updated immediately. No `okr.checkin_submitted` event is emitted in this path; no `okr.checkin_approved` event is emitted either (auto-approval is a system action, not a reviewer decision — surfacing it as `approved` would create noise notifications).

**Otherwise** (`PENDING` flow): the check-in is created with `status='PENDING'`, and `okr.checkin_submitted` is emitted after commit. The notifications bridge routes to a Manager (see event-subscriptions.md).

**Errors**:

| Code | Cause | Frontend message |
|---|---|---|
| `KrNotFound` | `keyResultId` doesn't resolve | "Key Result not found." |
| `NotAssigned` | Submitter is not in `assigneeIds` | "You are not assigned to this Key Result." |
| `KrNotActive` | KR or parent Objective or parent cycle is not `ACTIVE` | "This Key Result is no longer active." |
| `BooleanValueInvalid` | `metricType='BOOLEAN'` AND `value` not in {0, 1} | "Boolean Key Results accept only 0 or 1." |

**Response** `201 Created` — `OkrCheckInResponseDto`.

---

### `GET /api/hr/okr-check-ins/key-result/:keyResultId` — List check-ins on a KR

**RBAC**:
- Submitter of any check-in returned (sees own check-ins on this KR).
- Manager of the parent Objective's department (sees all check-ins on KRs in their dept).
- `HR_ADMIN` (global).

**Response** `200 OK`:

```json
{ "items": [/* OkrCheckInResponseDto[] */] }
```

---

### `PATCH /api/hr/okr-check-ins/:id/approve` — Approve a PENDING check-in

**RBAC**: Manager of the parent Objective's `departmentId`, or `HR_ADMIN`.

**Side effects** (inside transaction):
1. Transition check-in status `PENDING → APPROVED`; set `reviewedById = caller.sub`, `reviewedAt = now()`.
2. Update parent KR: `currentValue = checkIn.value`; `score = computeScore(KR.metricType, value, KR.targetValue)`.
3. If new score `>= 1.0` AND KR status is not `CANCELLED`, set KR status to `ACHIEVED`.

After commit: emit `okr.checkin_approved`.

**Errors**:

| Code | Cause |
|---|---|
| `CheckInNotPending` | Check-in is already `APPROVED` or `REJECTED` (returns 409 Conflict) |
| `WrongDepartment` | Caller is a Manager but not of this Objective's department |

**Response** `200 OK` — updated `OkrCheckInResponseDto`.

---

### `PATCH /api/hr/okr-check-ins/:id/reject` — Reject a PENDING check-in

**RBAC**: same as approve.

**Body** (`RejectCheckInDto`):

```ts
{
  reason: string;                // 1..2000, required
}
```

**Side effects**: transition `PENDING → REJECTED`; persist `rejectionReason`; set `reviewedById`, `reviewedAt`. After commit, emit `okr.checkin_rejected` with the reason verbatim. KR `currentValue` and `score` are NOT updated.

**Errors**: same as approve, plus `ReasonRequired` if body validation fails.

**Response** `200 OK` — updated `OkrCheckInResponseDto`.

---

## 5. Analytics

### `GET /api/hr/okr-analytics/cycle/:cycleId/summary` — Per-department cycle progress

**RBAC**: `MANAGER` (own dept only), `HR_ADMIN`, `EXECUTIVE`.

**Response** `200 OK` (`OkrCycleSummaryDto`):

```json
{
  "cycleId": "…",
  "cycleName": "Q1 2026",
  "type": "QUARTERLY",
  "departments": [
    {
      "departmentId": "…",
      "departmentName": "Engineering",
      "objectiveCount": 4,
      "krCount": 12,
      "averageScore": 0.62,
      "atRiskCount": 2
    }
  ],
  "atRiskKrs": [
    { "keyResultId": "…", "title": "…", "score": 0.18, "employeeIds": ["…"], "objectiveId": "…" }
  ],
  "topLevelObjectives": [
    {
      "id": "…",
      "title": "Grow ARR to 5M DZD",
      "level": "COMPANY",
      "childCount": 3,
      "averageScore": 0.55
    }
  ]
}
```

`MANAGER` sees only their own department in `departments` and `atRiskKrs`. `HR_ADMIN`/`EXECUTIVE` see all.

---

### `GET /api/hr/okr-analytics/employee/:employeeId/cycle/:cycleId` — Employee portfolio

**RBAC**:
- The employee themselves (`employeeId == caller.employeeId`).
- The employee's Manager (`employee.departmentId == caller.departmentId` AND caller has `MANAGER` role).
- `HR_ADMIN`.

**Response** `200 OK` (`EmployeeOkrPortfolioDto`):

```json
{
  "employeeId": "…",
  "cycleId": "…",
  "objectivesOwned": [
    {
      "objective": { /* ObjectiveResponseDto */ },
      "keyResults": [ /* KeyResultResponseDto[] */ ],
      "averageScore": 0.42
    }
  ],
  "keyResultsAssigned": [
    {
      "keyResult": { /* KeyResultResponseDto */ },
      "parentObjective": { "id": "…", "title": "…", "level": "DEPARTMENT" },
      "latestApprovedCheckIn": { /* OkrCheckInResponseDto | null */ }
    }
  ]
}
```

---

## DTOs (response shapes)

### `OkrCycleResponseDto`

```ts
{
  id: string;
  name: string;
  type: 'ANNUAL' | 'QUARTERLY';
  year: number;
  quarter: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  parentCycleId: string | null;
  createdAt: string;        // ISO datetime
  updatedAt: string;
}
```

### `ObjectiveResponseDto`

```ts
{
  id: string;
  title: string;
  description: string | null;
  level: 'COMPANY' | 'DEPARTMENT' | 'EMPLOYEE';
  cycleId: string;
  parentObjectiveId: string | null;
  ownerId: string | null;
  departmentId: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  createdById: string;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### `KeyResultResponseDto`

```ts
{
  id: string;
  objectiveId: string;
  title: string;
  metricType: 'PERCENTAGE' | 'NUMBER' | 'CURRENCY' | 'BOOLEAN';
  targetValue: string;            // Decimal as string
  currentValue: string;
  unit: string;
  score: string;                  // Decimal in [0.00, 1.00]
  assigneeIds: string[];
  dueDate: string | null;
  status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'ACHIEVED' | 'CANCELLED';
  isAtRisk: boolean;              // computed: score < 0.3 AND status NOT IN (ACHIEVED, CANCELLED) AND has approved check-in
  createdAt: string;
  updatedAt: string;
}
```

### `OkrCheckInResponseDto`

```ts
{
  id: string;
  keyResultId: string;
  employeeId: string;
  value: string;
  score: string;
  comment: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
```

All DTOs live in `apps/hr-core/src/modules/okrs/dto/response/`. Mirror types live in `apps/web/src/lib/api/hr-core.ts` (or a small `apps/web/src/lib/types/okrs.ts` if the file becomes unwieldy).

---

## Cursor format

Same scheme as feature 010 notifications: `cursor = base64url(JSON({ createdAt, id }))`. Server decodes and applies `WHERE (created_at, id) < ($cursorCreatedAt, $cursorId) ORDER BY created_at DESC, id DESC`.

---

## RBAC matrix (this module)

| Endpoint | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE |
|---|---|---|---|---|
| `POST /api/hr/okr-cycles` | ❌ | ❌ | ✅ | ❌ |
| `GET /api/hr/okr-cycles` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /:id/activate` `/close` | ❌ | ❌ | ✅ | ❌ |
| `POST /api/hr/objectives` (COMPANY) | ❌ | ❌ | ✅ | ✅ |
| `POST /api/hr/objectives` (DEPARTMENT) | ❌ | ✅ (own dept) | ✅ | ❌ |
| `POST /api/hr/objectives` (EMPLOYEE) | ✅ (self only) | ✅ (direct reports) | ✅ | ❌ |
| `GET /api/hr/objectives` | scope-filtered | scope-filtered | ✅ | ✅ |
| `GET /api/hr/objectives/:id` | scope-filtered | scope-filtered | ✅ | ✅ |
| `PATCH /api/hr/objectives/:id` | own | own dept / direct reports | ✅ | ❌ |
| `DELETE /api/hr/objectives/:id` | own (creator) | own dept (creator) | ✅ | ❌ |
| `POST /api/hr/key-results` | follows Objective edit | follows Objective edit | ✅ | ❌ |
| `PATCH /api/hr/key-results/:id` | follows Objective edit | follows Objective edit | ✅ | ❌ |
| `GET /api/hr/key-results/objective/:id` | read-access to parent | read-access to parent | ✅ | ✅ |
| `POST /api/hr/okr-check-ins` | ✅ if in `assigneeIds` | ✅ if in `assigneeIds` | ✅ | ❌ |
| `GET /api/hr/okr-check-ins/key-result/:id` | submitter or assignee | own dept | ✅ | ❌ |
| `PATCH /:id/approve` `/reject` | ❌ | ✅ (own dept) | ✅ | ❌ |
| `GET /api/hr/okr-analytics/cycle/:id/summary` | ❌ | ✅ (own dept only) | ✅ | ✅ |
| `GET /api/hr/okr-analytics/employee/:eid/cycle/:cid` | self only | direct reports | ✅ | ❌ |

---

## Frontend coherence (per `.claude/rules/frontend-backend-coherence.md`)

This contract is the source of truth for:
1. **Type shapes** — every field in `apps/web/src/lib/api/hr-core.ts`'s OKR interfaces mirrors the response DTOs above exactly.
2. **Query params** — frontend Axios calls must pass param keys that match the backend `Query()` DTOs above (no `cycle` instead of `cycleId`, etc.).
3. **Error code mapping** — every error code in this document MUST be mirrored in the frontend `onError` handlers with a user-facing message (matrix above).
4. **RBAC reflection** — UI hides/disables actions for non-permitted roles per the matrix.

A frontend page must not ship if any of these four contracts is broken.
