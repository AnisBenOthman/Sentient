# Leave API Contract — HR Core Service

**Service**: `apps/hr-core` (port 3001)
**Base path**: `/api`
**Auth**: Bearer JWT on every endpoint (guards commented per R-013 until IAM ships).

Conventions: request/response bodies use camelCase, dates are ISO 8601 (`YYYY-MM-DD` for date-only, full RFC 3339 for DateTime), decimals are JSON numbers with up to 2 decimals.

---

## Leave Types (HR_ADMIN only for writes)

### `GET /leave-types?businessUnitId=X`

- **Roles**: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE (everyone — needed by submit form)
- **Query params**: `businessUnitId` optional.
  - EMPLOYEE/MANAGER: always filtered to their resolved BU (param ignored or must match).
  - HR_ADMIN: defaults to all; accepts optional `businessUnitId` to narrow.
- **Response 200**:
  ```json
  [
    {
      "id": "uuid",
      "businessUnitId": "uuid",
      "name": "ANNUAL",
      "accrualFrequency": "MONTHLY",
      "defaultDaysPerYear": 24.00,
      "maxCarryoverDays": 5.00,
      "requiresApproval": true,
      "color": "#4CAF50",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
  ```

### `GET /leave-types/:id`

- **Roles**: same as list — scope-checked (caller must belong to same BU as leave type or be HR_ADMIN).
- **Response 200**: single LeaveType object, or 404.

### `POST /leave-types`

- **Roles**: HR_ADMIN
- **Body** (`CreateLeaveTypeDto`):
  ```json
  {
    "businessUnitId": "uuid",
    "name": "Study Leave",
    "accrualFrequency": "MONTHLY",
    "defaultDaysPerYear": 5.00,
    "maxCarryoverDays": 0.00,
    "requiresApproval": true,
    "color": "#FFC107"
  }
  ```
  `accrualFrequency` defaults to `MONTHLY` if omitted.
- **Response 201**: created LeaveType
- **Errors**: 409 on duplicate `(name, businessUnitId)`, 400 on validation failure.

### `PATCH /leave-types/:id`

- **Roles**: HR_ADMIN
- **Body** (`UpdateLeaveTypeDto` — all fields optional except `businessUnitId` and `accrualFrequency` which are immutable after first accrual):
  ```json
  {
    "name": "Study Leave (Updated)",
    "defaultDaysPerYear": 7.00,
    "maxCarryoverDays": 2.00,
    "requiresApproval": false,
    "color": "#FF9800"
  }
  ```
- **Response 200**: updated LeaveType
- **Errors**: 409 on name collision within same BU, 404 on missing id, 400 if `maxCarryoverDays > defaultDaysPerYear`, 400 `AccrualFrequencyLocked` if `accrualFrequency` change attempted after first accrual.

> No DELETE endpoint (per R-005).

---

## Holidays (HR_ADMIN only for writes)

### `GET /holidays?year=YYYY&businessUnitId=X`

- **Roles**: all authenticated roles (used by submit form to display calendar)
- **Query params**: `year` optional (defaults to current year), `businessUnitId` optional.
  - EMPLOYEE/MANAGER: always filtered to their resolved BU (param ignored or must match).
  - HR_ADMIN: defaults to all BUs; accepts optional `businessUnitId` to narrow.
- **Response 200**:
  ```json
  [
    {
      "id": "uuid",
      "businessUnitId": "uuid",
      "name": "New Year",
      "date": "2026-01-01",
      "isRecurring": true,
      "year": null,
      "createdAt": "..."
    }
  ]
  ```

### `POST /holidays`

- **Roles**: HR_ADMIN
- **Body** (`CreateHolidayDto`):
  ```json
  {
    "businessUnitId": "uuid",
    "name": "Independence Day",
    "date": "2026-07-05",
    "isRecurring": true
  }
  ```
  `year` is inferred: null when `isRecurring=true`, else extracted from `date`.
- **Response 201**: created Holiday
- **Errors**: 409 on duplicate `(date, businessUnitId, year)`, 400 when `isRecurring=true && year!=null` or vice versa.

### `PATCH /holidays/:id`

- **Roles**: HR_ADMIN
- **Body** (`UpdateHolidayDto`): partial (all fields optional; `businessUnitId` immutable).
- **Response 200**: updated Holiday.

### `DELETE /holidays/:id`

- **Roles**: HR_ADMIN
- **Response 204**.

---

## Leave Balances

### `GET /leave-balances?employeeId=X&year=YYYY`

- **Roles**:
  - EMPLOYEE: may only query their own (`employeeId=self` enforced).
  - MANAGER: may query any direct report.
  - HR_ADMIN / EXECUTIVE: may query any.
- **Query params**: `employeeId` optional (defaults to caller's own), `year` optional (defaults to current year).
- **Response 200**:
  ```json
  [
    {
      "id": "uuid",
      "employeeId": "uuid",
      "leaveTypeId": "uuid",
      "leaveTypeName": "ANNUAL",
      "year": 2026,
      "totalDays": 8.00,
      "usedDays": 1.00,
      "pendingDays": 0.50,
      "remainingDays": 6.50
    }
  ]
  ```
  `remainingDays` is server-computed (`total - used - pending`).

### `POST /leave-balances/:id/adjust`

- **Roles**: HR_ADMIN
- **Body** (`AdjustBalanceDto`):
  ```json
  {
    "newTotalDays": 18.00,
    "reason": "Manual grant — promotion bonus"
  }
  ```
- **Response 200**: updated LeaveBalance (with refreshed remainingDays).
- **Side effect**: one row inserted in `leave_balance_adjustments` with `adjustedBy = caller.userId`, previous and new totals captured.
- **Errors**: 404, 400 on missing reason.

### `GET /leave-balances/:id/adjustments`

- **Roles**: HR_ADMIN (audit endpoint)
- **Response 200**: array of LeaveBalanceAdjustment rows, ordered by `createdAt DESC`.

### `POST /leave-balances/accrual/trigger`

- **Roles**: HR_ADMIN (internal recovery endpoint)
- **Body**:
  ```json
  { "month": "2026-04" }
  ```
- **Response 202**: `{ "runId": "uuid", "status": "QUEUED" }`
- Idempotent: returns 409 if `runMonth` already exists.

---

## Leave Requests

### `POST /leave-requests`

- **Roles**: EMPLOYEE (or any role with EMPLOYEE rights)
- **Body** (`CreateLeaveRequestDto`):
  ```json
  {
    "leaveTypeId": "uuid",
    "startDate": "2026-07-01",
    "endDate": "2026-07-03",
    "startHalfDay": "AFTERNOON",
    "endHalfDay": null,
    "reason": "Family trip"
  }
  ```
- **Response 201**: the created LeaveRequest, including computed `totalDays`, `status` (PENDING or APPROVED if `requiresApproval=false`).
- **Errors**:
  - 400 on validator failure (inverted dates, inconsistent half-days, missing leaveTypeId).
  - 400 `{ "error": "InsufficientBalance", ... }` if remainingDays < totalDays.
  - 400 `{ "error": "ZeroDayRequest", ... }` if computed totalDays is 0.
  - 409 `{ "error": "OverlappingRequest", ... }` when overlap guard fires.

### `GET /leave-requests?status=&employeeId=&leaveTypeId=&year=`

- **Roles**: all — RBAC scope filter restricts rows:
  - EMPLOYEE: only own.
  - MANAGER: own + direct reports (managerId = self).
  - HR_ADMIN: all.
  - EXECUTIVE: aggregated endpoint not here (separate analytics surface).
- **Response 200**: paginated list of LeaveRequest DTOs (no `agentRiskAssessment`/`agentSuggestedDates` surfaced unless caller is HR_ADMIN).

### `GET /leave-requests/:id`

- **Roles**: scope-checked (owner, their manager, HR_ADMIN).
- **Response 200**: full LeaveRequest DTO.
- **403**: scope violation.

### `POST /leave-requests/:id/approve`

- **Roles**: MANAGER (must be employee.managerId), HR_ADMIN
- **Body** (`ReviewLeaveRequestDto`):
  ```json
  { "reviewNote": "Approved, enjoy!" }
  ```
- **Response 200**: updated LeaveRequest with status=APPROVED.
- **Errors**: 409 if not currently PENDING, 403 on scope mismatch.
- **Events**: emits `leave.approved`.

### `POST /leave-requests/:id/reject`

- **Roles**: MANAGER, HR_ADMIN
- **Body**:
  ```json
  { "reviewNote": "Project deadline conflict — please rebook for Aug." }
  ```
  `reviewNote` required on reject (400 if empty).
- **Response 200**: updated LeaveRequest with status=REJECTED.
- **Events**: emits `leave.rejected`.

### `POST /leave-requests/:id/cancel`

- **Roles**: EMPLOYEE (owner only — enforced at service layer)
- **Body**: none
- **Response 200**: updated LeaveRequest with status=CANCELLED.
- **Errors**: 409 if not PENDING, 403 if caller is not the owner.
- **Events**: emits `leave.cancelled`.

### `GET /leave-requests/team-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&departmentId=&teamId=`

- **Roles**: MANAGER, HR_ADMIN
- **Scope**:
  - MANAGER: restricted to direct reports automatically.
  - HR_ADMIN: full access, can filter by `departmentId` or `teamId`.
- **Response 200**:
  ```json
  [
    {
      "employeeId": "uuid",
      "employeeName": "Alice Martin",
      "leaveTypeColor": "#4CAF50",
      "startDate": "2026-07-01",
      "endDate": "2026-07-03",
      "startHalfDay": "AFTERNOON",
      "endHalfDay": null
    }
  ]
  ```
  `reason` is intentionally omitted — privacy.

### `PATCH /leave-requests/:id/agent-assessment`

- **Roles**: SYSTEM only (SYSTEM JWT minted by AI Agentic `AgentContextFactory.forSystemTask()`).
- **Body** (`PatchAgentAssessmentDto`):
  ```json
  {
    "agentRiskAssessment": { "riskLevel": "HIGH", "reasons": ["sprint_overlap", "team_lead_on_leave"] },
    "agentSuggestedDates": { "alternatives": [{ "start": "2026-07-08", "end": "2026-07-10" }] }
  }
  ```
  Both fields optional; unspecified fields are not overwritten.
- **Response 200**: updated LeaveRequest.
- **Errors**: 403 for any non-SYSTEM caller, 404 on missing id.
- No business-logic side effects (no balance changes, no state transitions).

---

## Domain Events (emitted, not an HTTP surface)

| Event | Payload |
|-------|---------|
| `leave.requested` | `{ leaveRequestId, employeeId, leaveTypeId, startDate, endDate, totalDays }` |
| `leave.approved` | above + `{ reviewerId, reviewedAt, reviewNote? }` |
| `leave.rejected` | above + `{ reviewerId, reviewedAt, reviewNote }` |
| `leave.cancelled` | above + `{ cancelledBy }` |

---

## Error codes used

| Code | Meaning |
|------|---------|
| `InsufficientBalance` | remainingDays < totalDays at submission |
| `ZeroDayRequest` | computed totalDays = 0 (all weekend/holiday/inconsistent halves) |
| `OverlappingRequest` | overlap with existing PENDING/APPROVED for same employee |
| `RequestAlreadyDecided` | review action attempted on non-PENDING request |
| `NotOwner` | cancel attempted by non-owner |
| `DuplicateHoliday` | POST /holidays collides on (date, businessUnitId, year) |
| `DuplicateLeaveTypeName` | POST /leave-types with existing (name, businessUnitId) |
| `AccrualAlreadyRun` | accrual/trigger for a month that already ran |
| `AccrualFrequencyLocked` | PATCH /leave-types/:id attempted to change accrualFrequency after first accrual |
| `LeaveTypeOutOfScope` | leave request references a leaveTypeId not belonging to the employee's BU |
| `UnresolvedBusinessUnit` | employee has neither a team nor a department with a BusinessUnit |

All errors conform to the project's global `HttpExceptionFilter` response shape.
