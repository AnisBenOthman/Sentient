# API Contract: Positions

**Service**: HR Core (port 3001)  
**Base path**: `/api/hr/positions`  
**Auth**: `Authorization: Bearer <JWT>` (SharedJwtGuard on all endpoints; RbacGuard for mutations)

---

## POST /api/hr/positions

**Roles**: `HR_ADMIN`  
**Description**: Add a new position to the organization-wide position catalog.

### Request Body

```json
{
  "title": "Software Engineer",
  "level": "Senior"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | 1–100 chars, unique |
| `level` | string | No | 1–50 chars (e.g. "Junior", "Senior", "Lead", "Principal") |

### Response — 201 Created

```json
{
  "id": "uuid",
  "title": "Software Engineer",
  "level": "Senior",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation failure (missing title, too long) |
| 403 | Role is not HR_ADMIN |
| 409 | Duplicate `title` |

---

## GET /api/hr/positions

**Roles**: All authenticated users (`EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE`)  
**Description**: List all positions. Defaults to active only.

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `isActive` | boolean | `true` | Include inactive positions (HR_ADMIN only — ignored for other roles) |
| `cursor` | string | — | Cursor for pagination |
| `limit` | number | 50 | Page size (max 200 — position catalog tends to be large) |

### Response — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Software Engineer",
      "level": "Senior",
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00.000Z"
    }
  ],
  "nextCursor": "uuid-or-null",
  "total": 42
}
```

**Note**: Non-admin roles always receive `isActive: true` results regardless of the query param — the service ignores `isActive=false` for non-admin callers.

---

## GET /api/hr/positions/:id

**Roles**: All authenticated users  
**Description**: Get a single position by ID.

### Response — 200 OK

```json
{
  "id": "uuid",
  "title": "Software Engineer",
  "level": "Senior",
  "isActive": true,
  "createdAt": "2026-04-06T12:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | No valid JWT |
| 404 | Position not found |

---

## PATCH /api/hr/positions/:id

**Roles**: `HR_ADMIN`  
**Description**: Partially update a position (title, level, isActive).

### Request Body (all fields optional)

```json
{
  "title": "Software Engineer II",
  "level": "Mid",
  "isActive": false
}
```

### Response — 200 OK

Returns the updated position object (same shape as GET by ID).

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation failure |
| 403 | Role is not HR_ADMIN |
| 404 | Position not found |
| 409 | Duplicate `title` |

---

## DELETE /api/hr/positions/:id

**Roles**: `HR_ADMIN`  
**Description**: Soft-deactivate a position (`isActive → false`). Idempotent.

### Response — 200 OK

```json
{
  "id": "uuid",
  "isActive": false
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 403 | Role is not HR_ADMIN |
| 404 | Position not found |

**Note**: Deactivating a position does not affect existing employees or job history records that reference it. Those references are preserved as historical data.
