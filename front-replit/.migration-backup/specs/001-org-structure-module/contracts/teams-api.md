# API Contract: Teams

**Service**: HR Core (port 3001)  
**Base path**: `/api/hr/teams`  
**Auth**: `Authorization: Bearer <JWT>` (SharedJwtGuard + RbacGuard on all endpoints)

---

## POST /api/hr/teams

**Roles**: `HR_ADMIN`  
**Description**: Create a new team within an active department.

### Request Body

```json
{
  "name": "Backend",
  "code": "BE-01",
  "description": "Core backend API team",
  "departmentId": "uuid-of-active-department",
  "leadId": "uuid-of-employee-or-null",
  "projectFocus": "Payment Gateway v2"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | 1–100 chars |
| `code` | string | No | 2–20 chars, unique if provided |
| `description` | string | No | max 500 chars |
| `departmentId` | string (UUID) | Yes | Must reference an **active** department |
| `leadId` | string (UUID) | No | Must be a valid employee ID if provided |
| `projectFocus` | string | No | max 200 chars |

### Response — 201 Created

```json
{
  "id": "uuid",
  "name": "Backend",
  "code": "BE-01",
  "description": "Core backend API team",
  "departmentId": "uuid",
  "leadId": "uuid-or-null",
  "projectFocus": "Payment Gateway v2",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z",
  "updatedAt": "2026-04-06T12:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Target department is inactive or `departmentId` not found |
| 400 | `leadId` does not resolve to a valid employee |
| 400 | Validation failure on required fields |
| 403 | Role is not HR_ADMIN |
| 409 | Duplicate `code` |

---

## GET /api/hr/teams

**Roles**: `HR_ADMIN`, `EXECUTIVE` (all teams); `MANAGER` (own team only, scope-filtered by JWT `teamId` claim)  
**Description**: List teams. Defaults to active only.

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `departmentId` | string | — | Filter by department |
| `isActive` | boolean | `true` | Filter by active status (HR_ADMIN only) |
| `cursor` | string | — | Cursor for pagination |
| `limit` | number | 20 | Page size (max 100) |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Backend",
      "code": "BE-01",
      "departmentId": "uuid",
      "leadId": "uuid-or-null",
      "leadVacant": false,
      "projectFocus": "Payment Gateway v2",
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00.000Z",
      "updatedAt": "2026-04-06T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid-or-null",
  "total": 8
}
```

**MANAGER scope**: Response is automatically filtered to only the team the Manager leads (`id = JWT.teamId`). If the Manager does not lead any team, the list is empty.

---

## GET /api/hr/teams/:id

**Roles**: `HR_ADMIN`, `EXECUTIVE`; `MANAGER` (own team only)  
**Description**: Get a single team by ID with lead vacancy resolution.

### Response — 200 OK

```json
{
  "id": "uuid",
  "name": "Backend",
  "code": "BE-01",
  "description": "Core backend API team",
  "departmentId": "uuid",
  "leadId": "uuid-or-null",
  "leadVacant": false,
  "projectFocus": "Payment Gateway v2",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z",
  "updatedAt": "2026-04-06T12:00:00.000Z"
}
```

**`leadVacant`**: `true` when `leadId` is non-null but the referenced employee has `employmentStatus: TERMINATED` or does not exist.

### Error Responses

| Status | Condition |
|--------|-----------|
| 403 | MANAGER requests a team they do not lead |
| 403 | EMPLOYEE role |
| 404 | Team not found |

---

## PATCH /api/hr/teams/:id

**Roles**: `HR_ADMIN`  
**Description**: Partially update a team.

### Request Body (all fields optional)

```json
{
  "name": "Backend Platform",
  "code": "BE-02",
  "description": "Updated description",
  "departmentId": "new-department-uuid",
  "leadId": "new-lead-uuid-or-null",
  "projectFocus": "New project",
  "isActive": false
}
```

### Response — 200 OK

Returns the updated team object (same shape as GET by ID).

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | New `departmentId` is inactive |
| 400 | `leadId` does not resolve |
| 403 | Role is not HR_ADMIN |
| 404 | Team not found |
| 409 | Duplicate `code` |

---

## DELETE /api/hr/teams/:id

**Roles**: `HR_ADMIN`  
**Description**: Soft-deactivate a team (`isActive → false`). Idempotent.

### Response — 200 OK

```json
{
  "id": "uuid",
  "isActive": false,
  "updatedAt": "2026-04-06T12:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 403 | Role is not HR_ADMIN |
| 404 | Team not found |
