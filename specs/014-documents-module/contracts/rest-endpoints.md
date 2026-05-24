# REST Contracts: 014-Documents Module

**Service**: Social (port 3002) | **Prefix**: `/documents` | **Date**: 2026-05-23

All endpoints require `Authorization: Bearer <jwt>` unless otherwise noted.
Global guards: `ThrottlerGuard`, `SharedJwtGuard`, `RbacGuard` (registered in AppModule).

---

## POST /documents

**Purpose**: Upload a new document. The server persists the file to storage, creates the `Document` row, and emits `document.uploaded`.

**Auth**: `@Roles('HR_ADMIN')`

**Content-Type**: `multipart/form-data`

**Request body** (multipart fields):
| Field | Required | Notes |
|-------|----------|-------|
| `file` | yes | Binary file. Max size 25 MiB. MIME must be in whitelist. |
| `title` | yes | 1–200 chars |
| `category` | yes | One of `INTERNAL_POLICY`, `HANDBOOK`, `REGULATION`, `TEMPLATE`, `GUIDE`, `OTHER` |
| `description` | no | ≤ 2000 chars |
| `isPublic` | no | `'true'` / `'false'` (multipart strings). Default `true`. |

**Request example**:
```
POST /documents
Authorization: Bearer <hr-admin-jwt>
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="file"; filename="leave-policy.pdf"
Content-Type: application/pdf

<binary>
------X
Content-Disposition: form-data; name="title"

Annual Leave Policy 2026
------X
Content-Disposition: form-data; name="category"

INTERNAL_POLICY
------X
Content-Disposition: form-data; name="isPublic"

true
------X--
```

**Response**: `201 Created`
```json
{
  "id": "doc-uuid",
  "title": "Annual Leave Policy 2026",
  "description": null,
  "category": "INTERNAL_POLICY",
  "mimeType": "application/pdf",
  "sizeBytes": 524288,
  "uploadedBy": {
    "id": "emp-uuid",
    "firstName": "Alice",
    "lastName": "Martin",
    "employeeCode": "EMP-0001"
  },
  "version": 1,
  "isPublic": true,
  "createdAt": "2026-05-23T10:00:00.000Z",
  "updatedAt": "2026-05-23T10:00:00.000Z"
}
```

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "message": "MissingFile" }` | `file` field absent from the multipart body |
| 400 | `{ "message": "EmptyFile" }` | `file.size === 0` |
| 400 | `{ "message": "FileTooLarge" }` | `file.size > DOCUMENT_MAX_SIZE_BYTES` (25 MiB default) |
| 400 | `{ "message": "UnsupportedMimeType" }` | `file.mimetype` not in the configured whitelist |
| 403 | — | Caller is not HR_ADMIN |
| 503 | `{ "message": "StorageUnavailable" }` | `DocumentStorage.put` threw (disk full, permission, etc.) — no row persisted, no event emitted |

---

## GET /documents

**Purpose**: List documents visible to the requesting user.

**Auth**: `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`

**Query params**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | integer | 1 | 1-based |
| `pageSize` | integer | 20 | Silently capped at 100 |
| `category` | `DocumentCategory` | — | Filter to one category |
| `search` | string (≤ 200) | — | Case-insensitive substring match on `title` |
| `includePrivate` | boolean | — | HR_ADMIN-only escape hatch; silently ignored for non-admins (who never see private docs regardless) |

**Request**:
```
GET /documents?page=1&pageSize=20&category=INTERNAL_POLICY&search=leave
Authorization: Bearer <jwt>
```

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "doc-uuid",
      "title": "Annual Leave Policy 2026",
      "description": "Updated for the new fiscal year.",
      "category": "INTERNAL_POLICY",
      "mimeType": "application/pdf",
      "sizeBytes": 524288,
      "uploadedBy": {
        "id": "emp-uuid",
        "firstName": "Alice",
        "lastName": "Martin",
        "employeeCode": "EMP-0001"
      },
      "version": 1,
      "isPublic": true,
      "createdAt": "2026-05-23T10:00:00.000Z",
      "updatedAt": "2026-05-23T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

**Filtering rules** (server-enforced):
- `EMPLOYEE`, `MANAGER`, `EXECUTIVE` callers: `isPublic = true` is forced
- `HR_ADMIN` callers: all rows visible
- `?category=...` intersects with the visibility filter
- `?search=...` performs `title ILIKE '%X%'` on the (already filtered) rows
- **Sort**: `createdAt DESC, id ASC` for deterministic pagination

---

## GET /documents/:id

**Purpose**: Get a single document's metadata.

**Auth**: `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`

**Request**:
```
GET /documents/doc-uuid
Authorization: Bearer <jwt>
```

**Response**: `200 OK` — same shape as a list item

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{ "message": "DocumentNotFound" }` | ID does not exist OR `isPublic=false` and caller is not HR_ADMIN |

**Access rule**: The 404 is intentional and identical for both "row missing" and "row exists but hidden" — non-admins MUST NOT be able to enumerate the existence of private documents.

---

## GET /documents/:id/download

**Purpose**: Stream the document's binary file to the caller. Used by humans (browser download) and by the AI Agentic RAG worker (SYSTEM JWT).

**Auth**: `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SYSTEM')`

**Request**:
```
GET /documents/doc-uuid/download
Authorization: Bearer <jwt-or-system-jwt>
```

**Response**: `200 OK`
- Headers:
  - `Content-Type: <mimeType from row>`
  - `Content-Length: <sizeBytes from row>`
  - `Content-Disposition: attachment; filename="<sanitized-title>.<ext>"` — extension derived from `mimeType` via `mime-to-extension.ts`, NOT from the original filename
- Body: raw file bytes streamed from `DocumentStorage.get`

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{ "message": "DocumentNotFound" }` | ID does not exist OR `isPublic=false` and caller is neither HR_ADMIN nor SYSTEM |
| 410 | `{ "message": "DocumentFileMissing" }` | Row exists but `DocumentStorage.exists(row.sourceUrl) === false` |

**SYSTEM JWT bypass**: When `jwt.roles` includes `'SYSTEM'`, the `isPublic` check is skipped. Every document is downloadable for RAG ingestion. The SYSTEM JWT is short-lived (5 min) and minted by `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })` inside AI Agentic.

---

## PATCH /documents/:id

**Purpose**: Update document metadata, optionally replacing the file (which bumps `version` and re-emits `document.uploaded`).

**Auth**: `@Roles('HR_ADMIN')`

**Content-Type**: `multipart/form-data`

**Request body** (multipart fields — all optional):
| Field | Notes |
|-------|-------|
| `file` | If present: new file is persisted, `version` increments, `mimeType`/`sizeBytes`/`sourceUrl` refresh, event re-emitted, old file best-effort deleted. If absent: metadata-only update. |
| `title` | 1–200 chars |
| `description` | ≤ 2000 chars |
| `category` | `DocumentCategory` |
| `isPublic` | boolean |

**Request example (metadata only)**:
```
PATCH /documents/doc-uuid
Authorization: Bearer <hr-admin-jwt>
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="title"

Annual Leave Policy 2026 (revised)
------X--
```

**Request example (file replacement)**:
```
PATCH /documents/doc-uuid
Authorization: Bearer <hr-admin-jwt>
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="file"; filename="leave-policy-v2.pdf"
Content-Type: application/pdf

<binary>
------X--
```

**Response**: `200 OK` — full `DocumentResponse` shape (with possibly-bumped `version`)

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "message": "EmptyFile" }` | `file` present but `file.size === 0` |
| 400 | `{ "message": "FileTooLarge" }` | `file.size > DOCUMENT_MAX_SIZE_BYTES` |
| 400 | `{ "message": "UnsupportedMimeType" }` | `file.mimetype` not in the whitelist |
| 403 | — | Caller is not HR_ADMIN |
| 404 | `{ "message": "DocumentNotFound" }` | ID does not exist |
| 503 | `{ "message": "StorageUnavailable" }` | New-file write to storage failed — row unchanged |

**Constraints**: Immutable fields (`id`, `uploadedById`, `version`, `sourceUrl`, `sizeBytes`, `mimeType`, `createdAt`, `updatedAt`) are silently ignored from the request body. `version`, `sourceUrl`, `sizeBytes`, `mimeType` are derived server-side from the new file when one is provided.

---

## DELETE /documents/:id

**Purpose**: Hard-delete a document — removes the row, removes the file from storage, emits `document.deleted`.

**Auth**: `@Roles('HR_ADMIN')`

**Request**:
```
DELETE /documents/doc-uuid
Authorization: Bearer <hr-admin-jwt>
```

**Response**: `204 No Content`

**Error responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 403 | — | Caller is not HR_ADMIN |
| 404 | `{ "message": "DocumentNotFound" }` | ID does not exist |

**Notes**:
- The file deletion from storage is best-effort. A storage delete failure does NOT roll back the DB delete — the orphan file is logged for later janitor cleanup.
- The `document.deleted` event is emitted after the DB commit (regardless of whether the file removal succeeded).

---

## Endpoint × Role Matrix

| Endpoint | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE | SYSTEM |
|----------|----------|---------|----------|-----------|--------|
| `POST /documents` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `GET /documents` | ✅ (public only) | ✅ (public only) | ✅ (all) | ✅ (public only) | ❌ |
| `GET /documents/:id` | ✅ (public only) | ✅ (public only) | ✅ (all) | ✅ (public only) | ❌ |
| `GET /documents/:id/download` | ✅ (public only) | ✅ (public only) | ✅ (all) | ✅ (public only) | ✅ (all — for RAG ingestion) |
| `PATCH /documents/:id` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `DELETE /documents/:id` | ❌ | ❌ | ✅ | ❌ | ❌ |
