# REST Contracts: 013-Announcements Module

**Service**: Social (port 3002) | **Prefix**: `/announcements` | **Date**: 2026-05-21

All endpoints require `Authorization: Bearer <jwt>` unless otherwise noted.
Global guards: `ThrottlerGuard`, `SharedJwtGuard`, `RbacGuard` (registered in AppModule).

---

## POST /announcements

**Purpose**: Publish a new announcement.

**Auth**: `@Roles('MANAGER', 'HR_ADMIN')`

**Request**:
```
POST /announcements
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "title": "Q2 All-Hands Meeting",
  "body": "Please join us for the Q2 all-hands on June 15th.",
  "audience": "COMPANY",
  "expiresAt": "2026-06-15T23:59:00.000Z"    // optional
}
```

**Request (DEPARTMENT audience — MANAGER auto-fills from JWT)**:
```json
{
  "title": "Engineering Offsite",
  "body": "Engineering department offsite on June 20th.",
  "audience": "DEPARTMENT"
  // targetDepartmentId auto-filled from jwt.departmentId for MANAGER role
}
```

**Request (DEPARTMENT audience — HR_ADMIN must specify target)**:
```json
{
  "title": "Finance Deadline",
  "body": "Fiscal year close deadline is June 30th.",
  "audience": "DEPARTMENT",
  "targetDepartmentId": "dept-uuid-here"
}
```

**Response**: `201 Created`
```json
{
  "id": "ann-uuid",
  "title": "Q2 All-Hands Meeting",
  "body": "Please join us for the Q2 all-hands on June 15th.",
  "author": {
    "id": "emp-uuid",
    "firstName": "Alice",
    "lastName": "Martin",
    "email": "alice@sentient.dev"
  },
  "audience": "COMPANY",
  "targetDepartmentId": null,
  "targetTeamId": null,
  "publishedAt": "2026-05-21T10:00:00.000Z",
  "expiresAt": "2026-06-15T23:59:00.000Z",
  "isPinned": false,
  "pinnedUntil": null,
  "createdAt": "2026-05-21T10:00:00.000Z",
  "updatedAt": "2026-05-21T10:00:00.000Z"
}
```

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ message: "UnsupportedAudienceInThisRelease" }` | `audience` is ROLE or INDIVIDUAL |
| 400 | `{ message: "TargetDepartmentRequired" }` | HR_ADMIN posts with DEPARTMENT audience but no targetDepartmentId |
| 400 | `{ message: "TargetTeamRequired" }` | HR_ADMIN posts with TEAM audience but no targetTeamId |
| 403 | — | JWT missing required role |

---

## GET /announcements

**Purpose**: List announcements visible to the requesting user (audience-filtered).

**Auth**: `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`

**Query params**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | integer | 1 | 1-based |
| `limit` | integer | 20 | max 50 |

**Request**:
```
GET /announcements?page=1&limit=20
Authorization: Bearer <jwt>
```

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "ann-pinned-uuid",
      "title": "Important: Office Closure",
      "body": "The office will be closed on June 1st.",
      "author": { "id": "emp-uuid", "firstName": "Bob", "lastName": "Smith", "email": "bob@sentient.dev" },
      "audience": "COMPANY",
      "targetDepartmentId": null,
      "targetTeamId": null,
      "publishedAt": "2026-05-10T08:00:00.000Z",
      "expiresAt": null,
      "isPinned": true,
      "pinnedUntil": "2026-06-01T23:59:00.000Z",
      "createdAt": "2026-05-10T08:00:00.000Z",
      "updatedAt": "2026-05-20T09:00:00.000Z"
    },
    {
      "id": "ann-uuid",
      "title": "Q2 All-Hands Meeting",
      "body": "Please join us for the Q2 all-hands on June 15th.",
      "author": { "id": "emp-uuid-2", "firstName": "Alice", "lastName": "Martin", "email": "alice@sentient.dev" },
      "audience": "COMPANY",
      "targetDepartmentId": null,
      "targetTeamId": null,
      "publishedAt": "2026-05-21T10:00:00.000Z",
      "expiresAt": "2026-06-15T23:59:00.000Z",
      "isPinned": false,
      "pinnedUntil": null,
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

**Filtering rules** (server-enforced):
- Only published announcements (`publishedAt IS NOT NULL`)
- Not expired (`expiresAt IS NULL OR expiresAt > NOW()`)
- Audience match: COMPANY always visible; DEPARTMENT if `targetDepartmentId = jwt.departmentId`; TEAM if `targetTeamId = jwt.teamId`
- **HR_ADMIN exception**: Sees all published, non-expired announcements regardless of audience/targeting
- **Sort**: Pinned (`pinnedUntil > NOW()`) first, then `publishedAt DESC`

---

## GET /announcements/:id

**Purpose**: Get a single announcement by ID.

**Auth**: `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`

**Request**:
```
GET /announcements/ann-uuid
Authorization: Bearer <jwt>
```

**Response**: `200 OK` — same shape as a single item from `GET /announcements`

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{ message: "AnnouncementNotFound" }` | ID does not exist or is not visible to this user |

**Access rule**: Employee can only retrieve announcements they can see (audience filter applies). HR_ADMIN can retrieve any announcement.

---

## PATCH /announcements/:id

**Purpose**: Update title, body, or expiresAt of an existing announcement.

**Auth**: `@Roles('MANAGER', 'HR_ADMIN')` + ownership check in service (author or HR_ADMIN)

**Request**:
```
PATCH /announcements/ann-uuid
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "title": "Updated: Q2 All-Hands Meeting",
  "expiresAt": "2026-06-20T23:59:00.000Z"
}
```

**Response**: `200 OK` — full `AnnouncementResponse` shape

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ message: "NotAnnouncementAuthor" }` | Requester is MANAGER but not the author |
| 404 | `{ message: "AnnouncementNotFound" }` | ID does not exist |

**Constraints**: `audience`, `targetDepartmentId`, `targetTeamId` cannot be changed after publish (FR-009).

---

## DELETE /announcements/:id

**Purpose**: Hard-delete an announcement.

**Auth**: `@Roles('MANAGER', 'HR_ADMIN')` + ownership check in service (author or HR_ADMIN)

**Request**:
```
DELETE /announcements/ann-uuid
Authorization: Bearer <jwt>
```

**Response**: `204 No Content`

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ message: "NotAnnouncementAuthor" }` | Requester is MANAGER but not the author |
| 404 | `{ message: "AnnouncementNotFound" }` | ID does not exist |

---

## PATCH /announcements/:id/pin

**Purpose**: Pin an announcement until a given date, or unpin it.

**Auth**: `@Roles('HR_ADMIN')` only

**Request (pin)**:
```
PATCH /announcements/ann-uuid/pin
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "pinnedUntil": "2026-06-01T23:59:00.000Z"
}
```

**Request (unpin)**:
```json
{
  "pinnedUntil": null
}
```

**Response**: `200 OK` — full `AnnouncementResponse` shape with updated `isPinned` + `pinnedUntil`

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ message: "PinnedUntilMustBeFuture" }` | `pinnedUntil` is in the past |
| 404 | `{ message: "AnnouncementNotFound" }` | ID does not exist |
