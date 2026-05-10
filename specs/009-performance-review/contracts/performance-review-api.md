# Performance Review API Contract: HR Core Service

**Service**: `apps/hr-core` on port 3001  
**Base path**: `/api`  
**Auth**: Bearer JWT on every endpoint. Controllers declare `@UseGuards(SharedJwtGuard, RbacGuard)` and `@Roles(...)`; global guards in `AppModule` also apply.  
**Conventions**: JSON bodies use camelCase. Date-only fields use `YYYY-MM-DD`; DateTime fields use ISO 8601. Enum values are uppercase strings.

---

## Shared response shapes

### PerformanceReview

```json
{
  "id": "uuid",
  "cycleId": "uuid",
  "employeeId": "uuid",
  "employeeName": "Amina Bello",
  "reviewerId": "uuid",
  "reviewerName": "Maya Chen",
  "reviewDate": "2026-12-31",
  "dueDate": "2027-01-15T17:00:00.000Z",
  "status": "SUBMITTED",
  "businessUnitName": "US - Seattle",
  "departmentName": "Engineering",
  "teamName": "Platform",
  "positionTitle": "Senior Engineer",
  "environmentSatisfaction": "SATISFIED",
  "jobSatisfaction": "SATISFIED",
  "relationshipSatisfaction": "VERY_SATISFIED",
  "trainingOpportunitiesTaken": 3,
  "workLifeBalance": "NEUTRAL",
  "selfRating": "EXCEEDS_EXPECTATIONS",
  "managerRating": null,
  "employeeComments": "I shipped the platform migration and mentored two engineers.",
  "managerComments": null,
  "ratingGap": false,
  "submittedAt": "2027-01-05T10:00:00.000Z",
  "completedAt": null,
  "createdAt": "2026-12-01T09:00:00.000Z",
  "updatedAt": "2027-01-05T10:00:00.000Z"
}
```

### PaginatedResponse

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

---

## Review Cycles

### `POST /performance-review-cycles`

Creates a draft review cycle.

**Roles**: HR_ADMIN

**Body**:

```json
{
  "name": "2026 Annual Review",
  "reviewType": "ANNUAL",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-12-31",
  "selfReviewOpensAt": "2026-12-01T09:00:00.000Z",
  "selfReviewClosesAt": "2027-01-05T17:00:00.000Z",
  "managerReviewDueAt": "2027-01-15T17:00:00.000Z"
}
```

**Response 201**: cycle object.

**Errors**:
- 400 on invalid date ordering.
- 409 on duplicate cycle name/type/period.

### `POST /performance-review-cycles/:id/initiate`

Activates a cycle and creates review assignments for eligible employees.

**Roles**: HR_ADMIN

**Body**:

```json
{
  "businessUnitId": "uuid",
  "departmentId": "uuid",
  "teamId": null,
  "positionId": null,
  "employeeIds": [],
  "reviewerOverrides": [
    { "employeeId": "uuid", "reviewerId": "uuid" }
  ]
}
```

All filters are optional. If omitted, all active employees are eligible.

**Response 200**:

```json
{
  "cycleId": "uuid",
  "created": 498,
  "skippedDuplicates": 0,
  "unassigned": [
    {
      "employeeId": "uuid",
      "employeeName": "No Manager",
      "reason": "Missing reviewer"
    }
  ]
}
```

**Errors**:
- 404 when cycle is missing.
- 409 when cycle is already active/closed/cancelled or duplicate rows are detected outside idempotent retry.

### `GET /performance-review-cycles`

**Roles**: HR_ADMIN, MANAGER, EXECUTIVE

**Query params**: `status`, `reviewType`, `from`, `to`, `page`, `limit`

**Response 200**: paginated cycle list with assignment/completion counts.

### `GET /performance-review-cycles/:id/summary`

**Roles**: HR_ADMIN, MANAGER, EXECUTIVE

**Response 200**:

```json
{
  "cycleId": "uuid",
  "status": "ACTIVE",
  "assigned": 500,
  "pending": 220,
  "submitted": 180,
  "completed": 90,
  "overdue": 10,
  "ratingGaps": 8
}
```

Managers see only assigned reviews. HR admins see all.

### `POST /performance-review-cycles/:id/close`

**Roles**: HR_ADMIN

**Body**:

```json
{ "reason": "All manager reviews completed and calibrated." }
```

**Response 200**: updated cycle.

---

## Reviews

### `GET /performance-reviews`

Lists reviews visible to the current user.

**Roles**: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE

**Query params**:
- `cycleId`
- `employeeId`
- `reviewerId`
- `departmentId`
- `positionId`
- `status`
- `rating`
- `ratingGap` (`true` or `false`)
- `overdue` (`true` or `false`)
- `from`
- `to`
- `page`
- `limit`

**Response 200**: `PaginatedResponse<PerformanceReview>`.

**Scope**:
- Employee: own reviews only.
- Manager: reviews assigned to them plus own reviews.
- HR admin: all reviews.
- Executive: read-only scope according to RBAC grant.

### `GET /performance-reviews/:id`

**Roles**: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE

**Response 200**: one review with audit summary when caller is HR_ADMIN.

**Errors**:
- 403 when caller is outside review scope.
- 404 when missing.

### `POST /performance-reviews/:id/self-review`

Submits employee self-review inputs.

**Roles**: EMPLOYEE

**Body**:

```json
{
  "environmentSatisfaction": "SATISFIED",
  "jobSatisfaction": "SATISFIED",
  "relationshipSatisfaction": "VERY_SATISFIED",
  "trainingOpportunitiesTaken": 3,
  "workLifeBalance": "NEUTRAL",
  "selfRating": "EXCEEDS_EXPECTATIONS",
  "employeeComments": "Delivered the migration and mentored two engineers."
}
```

**Response 200**: updated review with status `SUBMITTED`.

**Errors**:
- 400 when required values are missing or outside enum.
- 403 when caller is not the reviewed employee.
- 409 when cycle window is closed or review is not editable.

### `POST /performance-reviews/:id/manager-review`

Completes manager review.

**Roles**: MANAGER, HR_ADMIN

**Body**:

```json
{
  "managerRating": "MEETS_EXPECTATIONS",
  "managerComments": "Strong delivery; next cycle should focus on broader stakeholder leadership."
}
```

**Response 200**: updated review with status `COMPLETED` and computed `ratingGap`.

**Errors**:
- 400 when rating/comments are invalid.
- 403 when caller is not assigned reviewer or HR admin.
- 409 when employee self-review is not submitted.

### `POST /performance-reviews/:id/reopen`

**Roles**: HR_ADMIN

**Body**:

```json
{ "reason": "Employee requested correction before calibration." }
```

**Response 200**: updated review with status `REOPENED`.

**Errors**:
- 400 when reason is missing.
- 409 when review state cannot be reopened.

### `POST /performance-reviews/:id/reassign-reviewer`

**Roles**: HR_ADMIN

**Body**:

```json
{
  "reviewerId": "uuid",
  "reason": "Original reviewer left the organization."
}
```

**Response 200**: updated review.

**Errors**:
- 400 when reviewer is inactive or reason missing.
- 409 when review is closed.

### `POST /performance-reviews/:id/salary-follow-ups`

Records that a completed review led to compensation follow-up.

**Roles**: HR_ADMIN

**Body**:

```json
{
  "reason": "Annual review",
  "salaryHistoryId": "uuid"
}
```

`salaryHistoryId` is optional.

**Response 201**: created follow-up row.

**Errors**:
- 400 when reason is missing.
- 409 when review is not completed or closed.

### `GET /performance-reviews/:id/audit`

**Roles**: HR_ADMIN

**Response 200**: audit rows ordered by `createdAt DESC`.

---

## Error codes

| Code | Meaning |
|------|---------|
| `DuplicateReviewAssignment` | Employee already has a review for the cycle |
| `MissingReviewer` | Employee cannot enter workflow until reviewer is assigned |
| `ReviewWindowClosed` | Employee submission attempted outside open/reopened window |
| `ReviewNotEditable` | Submitted/completed/closed review cannot be edited |
| `ReviewNotSubmitted` | Manager completion attempted before self-review |
| `RatingOutOfRange` | Rating/satisfaction value is not part of accepted five-point enum |
| `ReviewOutOfScope` | Caller is not employee, assigned reviewer, or authorized HR/global reader |
| `ReopenReasonRequired` | HR reopen attempted without reason |
| `ReviewerInactive` | HR attempted to assign inactive reviewer |
| `SalaryFollowUpRequiresCompletedReview` | Follow-up attempted before completed review |

All errors use the existing global Nest exception response shape.
