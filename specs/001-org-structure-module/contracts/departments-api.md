# API Contract: Departments

**Service**: HR Core (port 3001)  
**Base path**: `/api/hr/departments`  
**Auth**: `Authorization: Bearer <JWT>` (SharedJwtGuard + RbacGuard on all endpoints)

---

## POST /api/hr/departments

**Roles**: `HR_ADMIN`  
**Description**: Create a new department.

### Request Body

```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Product engineering teams",
  "headId": "uuid-of-employee-or-null"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | 1–100 chars |
| `code` | string | Yes | 2–10 chars, alphanumeric uppercase |
| `description` | string | No | max 500 chars |
| `headId` | string (UUID) | No | Must be a valid active employee ID |

### Response — 201 Created

```json
{
  "id": "uuid",
  "name": "Engineering",
  "code": "ENG",
  "description": "Product engineering teams",
  "headId": "uuid-or-null",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z",
  "updatedAt": "2026-04-06T12:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing required fields or validation failure |
| 403 | Role is not HR_ADMIN |
| 404 | `headId` does not resolve to a valid employee |
| 409 | Duplicate `name` or `code` |

---

## GET /api/hr/departments

**Roles**: `HR_ADMIN`, `EXECUTIVE`  
**Description**: List departments. Defaults to active only.

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `isActive` | boolean | `true` | Filter by active status |
| `cursor` | string | — | Cursor for pagination |
| `limit` | number | 20 | Page size (max 100) |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Engineering",
      "code": "ENG",
      "description": "Product engineering teams",
      "headId": "uuid-or-null",
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00.000Z",
      "updatedAt": "2026-04-06T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid-or-null",
  "total": 12
}
```

---

## GET /api/hr/departments/:id

**Roles**: `HR_ADMIN`, `EXECUTIVE`, `MANAGER`  
**Description**: Get a single department by ID.

### Response — 200 OK

```json
{
  "id": "uuid",
  "name": "Engineering",
  "code": "ENG",
  "description": "Product engineering teams",
  "headId": "uuid-or-null",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z",
  "updatedAt": "2026-04-06T12:00:00.000Z",
  "teams": [
    { "id": "uuid", "name": "Backend", "isActive": true }
  ]
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 403 | Role is EMPLOYEE |
| 404 | Department not found |

---

## PATCH /api/hr/departments/:id

**Roles**: `HR_ADMIN`  
**Description**: Partially update a department (name, code, description, headId, isActive).

### Request Body (all fields optional)

```json
{
  "name": "Product Engineering",
  "code": "PE",
  "description": "Updated description",
  "headId": "new-uuid-or-null",
  "isActive": false
}
```

### Response — 200 OK

Returns the updated department object (same shape as GET by ID, without nested teams).

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation failure |
| 403 | Role is not HR_ADMIN |
| 404 | Department not found |
| 404 | New `headId` does not resolve |
| 409 | Duplicate `name` or `code` |

---

## DELETE /api/hr/departments/:id

**Roles**: `HR_ADMIN`  
**Description**: Soft-deactivate a department (`isActive → false`). Idempotent.

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
| 404 | Department not found |

**Note**: Deactivating a department does not cascade to its teams. Teams remain with their `departmentId` reference but new teams cannot be added to an inactive department.
