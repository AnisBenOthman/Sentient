# Feature Specification: Documents Module

**Feature Branch**: `014-documents-module`
**Created**: 2026-05-23
**Status**: Draft
**Input**: User description: "014-documents-module — Document CRUD: POST /documents (HR_ADMIN, multipart or presigned URL strategy), GET /documents (filtered by category, isPublic), GET /:id/download, PATCH /:id (version bump + HR_ADMIN only), DELETE /:id. Visibility: employees only see isPublic: true; HR_ADMIN sees all. Domain event: document.uploaded (payload: documentId, category, mimeType) — AI Agentic consumes this to chunk+embed for RAG. Frontend: documents.tsx (searchable doc library, category filter, upload modal for HR_ADMIN). Must emit document.uploaded — AI Agentic's RAG pipeline depends on this event."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — HR Admins Upload Policy Documents to the Library (Priority: P1)

An HR_ADMIN uploads a company document (HR policy PDF, employee handbook, leave regulation, onboarding template) by selecting a local file, choosing a category, naming it, and marking it public or internal. The Social service stores the file, persists a `Document` row, and emits a `document.uploaded` domain event so the AI Agentic service's RAG pipeline can chunk and embed the content for the HR Assistant agent's `INTERNAL_POLICY` namespace.

**Why this priority**: This is the only producer of `document.uploaded`, which the AI Agentic RAG pipeline strictly depends on. Without this story, the HR Assistant agent has no internal-policy corpus and falls back to external regulations only — half-blind. It is also the smallest end-to-end slice that exercises file storage, the existing `Document` Prisma model, RBAC, and the EventBus.

**Independent Test**: Sign in as an HR_ADMIN. `POST /documents` with a multipart form (`file = <leave-policy.pdf>`, `title = "Annual Leave Policy 2026"`, `category = "INTERNAL_POLICY"`, `isPublic = true`). The response is 201 with the new document row (uploadedById resolved to the HR_ADMIN's `employeeId`, `version = 1`, `sourceUrl` pointing at the stored file, `sizeBytes` matching the upload). A subscriber to `document.uploaded` on the in-process EventBus receives the event with `{ documentId, category, mimeType, title, uploadedById, sizeBytes, sourceUrl, version }` payload.

**Acceptance Scenarios**:

1. **Given** an authenticated HR_ADMIN, **When** they `POST /documents` with a valid multipart body (`file`, `title`, `category`, optional `description`, optional `isPublic`), **Then** the server persists the file to the configured storage backend, creates a `Document` row with `uploadedById` set from the JWT `employeeId`, `version = 1`, `mimeType` and `sizeBytes` resolved from the upload, and the response is 201 with the full document metadata (excluding the file bytes).
2. **Given** an HR_ADMIN omits `isPublic`, **When** the document is created, **Then** the service defaults `isPublic = true`. An explicit `isPublic = false` creates an HR-only document.
3. **Given** an authenticated MANAGER (no HR_ADMIN role), **When** they `POST /documents`, **Then** the request is rejected with 403 `Forbidden` — uploads are HR_ADMIN-only.
4. **Given** an authenticated EMPLOYEE, **When** they `POST /documents`, **Then** the request is rejected with 403 `Forbidden`.
5. **Given** an HR_ADMIN uploads a file whose MIME type is not on the configured RAG-compatible whitelist (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`, `text/html`), **When** the request is processed, **Then** the service rejects with 400 `UnsupportedMimeType` and no row is persisted, no file is stored.
6. **Given** an HR_ADMIN uploads a file larger than the configured maximum (default 25 MB), **When** the request is processed, **Then** the service rejects with 400 `FileTooLarge` and no row is persisted.
7. **Given** the `Document` row was successfully persisted and the file is on disk, **When** the database transaction commits, **Then** a `DomainEvent` of type `document.uploaded` is emitted on the shared `IEventBus` with `source: 'social'`, `payload: { documentId, category, mimeType, title, uploadedById, sizeBytes, sourceUrl, version, isPublic }`, and `metadata.correlationId` propagated from the request's `x-correlation-id` header.
8. **Given** the file write to storage fails (disk full, permission error), **When** the upload is attempted, **Then** the response is 503 `StorageUnavailable`, no `Document` row is persisted, and NO `document.uploaded` event is emitted.

---

### User Story 2 — Employees Browse and Filter the Document Library (Priority: P1)

An employee opens the document library to find an HR policy. They see a list of documents that are marked public, filterable by category (`INTERNAL_POLICY`, `HANDBOOK`, `REGULATION`, `TEMPLATE`, `GUIDE`, `OTHER`) and searchable by title. Internal (HR-only) documents do not appear. HR_ADMINs see every document regardless of visibility flag.

**Why this priority**: Without read access, the upload is one-way and the library is invisible to the people it is meant to serve. P1 because it is the most-used path — every employee looking up a policy hits this endpoint.

**Independent Test**: Seed three documents — two with `isPublic = true` (one in `INTERNAL_POLICY`, one in `HANDBOOK`) and one with `isPublic = false` (in `INTERNAL_POLICY`). Sign in as an EMPLOYEE: `GET /documents` returns the two public docs; `GET /documents?category=INTERNAL_POLICY` returns only the public `INTERNAL_POLICY` one. Sign in as an HR_ADMIN: `GET /documents` returns all three; `GET /documents?category=INTERNAL_POLICY` returns both `INTERNAL_POLICY` ones.

**Acceptance Scenarios**:

1. **Given** documents with mixed `isPublic` values exist, **When** an authenticated EMPLOYEE calls `GET /documents`, **Then** the response includes only rows where `isPublic = true`, ordered by `createdAt` descending.
2. **Given** the same dataset, **When** an HR_ADMIN calls `GET /documents`, **Then** the response includes every row regardless of `isPublic`.
3. **Given** documents in multiple categories exist, **When** any user calls `GET /documents?category=HANDBOOK`, **Then** the response is restricted to that category (intersected with the visibility filter for non-admins).
4. **Given** a `search` query parameter is provided, **When** any user calls `GET /documents?search=leave`, **Then** the response filters to rows whose `title` contains the substring (case-insensitive). The visibility and category filters compose with the search.
5. **Given** a single document, **When** any user calls `GET /documents/:id` for a public document or as HR_ADMIN, **Then** the response is 200 with the document metadata. **When** an EMPLOYEE calls `GET /documents/:id` for an `isPublic = false` document, **Then** the response is 404 (NOT 403 — leaks fewer existence facts).
6. **Given** pagination is supported, **When** the caller passes `?page=2&pageSize=20`, **Then** the response shape is `{ items: Document[], total: number, page: number, pageSize: number }` and `pageSize` is silently capped at 100.
7. **Given** the list response, **When** the frontend renders each document card, **Then** the `uploadedBy` field is present and shaped as `{ id, firstName, lastName, employeeCode } | null` resolved via `HrCoreClient.getEmployeeRef`. If HR Core returns 404 for the uploader, the field is `null` and the document is still returned.

---

### User Story 3 — Users Download a Document (Priority: P1)

A user clicks a document in the library and the browser receives the file with the original filename, MIME type, and content length. The same endpoint is callable by the AI Agentic RAG pipeline (via SYSTEM JWT) to fetch the file bytes for chunking and embedding. Visibility rules match the list endpoint — employees cannot download HR-only docs; HR_ADMIN can download anything.

**Why this priority**: An indexable library without download is useless. P1 because the download endpoint is what makes the metadata-only list meaningful, and because AI Agentic's RAG worker depends on it to fetch the file bytes after consuming the `document.uploaded` event.

**Independent Test**: Upload a public PDF as HR_ADMIN. Sign in as an EMPLOYEE and call `GET /documents/:id/download` — the response is 200 with `Content-Type: application/pdf`, `Content-Length` matching `sizeBytes`, `Content-Disposition: attachment; filename="<original-name>.pdf"`, and the bytes match the original file. Upload a second document with `isPublic = false`. Sign in as an EMPLOYEE and call `GET /documents/:id/download` for the private doc — the response is 404. Sign in as HR_ADMIN — the same call returns 200.

**Acceptance Scenarios**:

1. **Given** a document with `isPublic = true`, **When** any authenticated user calls `GET /documents/:id/download`, **Then** the response is 200 with the file bytes streamed, correct `Content-Type` (from `mimeType`), `Content-Length` (from `sizeBytes`), and `Content-Disposition: attachment; filename="..."`.
2. **Given** a document with `isPublic = false`, **When** a non-HR_ADMIN authenticated user calls `GET /documents/:id/download`, **Then** the response is 404.
3. **Given** the same private document, **When** an HR_ADMIN calls `GET /documents/:id/download`, **Then** the response is 200 with the file bytes.
4. **Given** the AI Agentic service calls `GET /documents/:id/download` with a SYSTEM JWT (`roles: ['SYSTEM']`, `scope: 'GLOBAL'`) emitted by `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })`, **Then** the visibility check is bypassed (SYSTEM may read any document for RAG ingestion) and the file bytes are returned.
5. **Given** the document row exists but the underlying file is missing from storage (e.g., disk corruption, manual deletion), **When** any caller hits the download endpoint, **Then** the response is 410 `DocumentFileMissing`.

---

### User Story 4 — HR Admins Edit Documents with Automatic Version Bump (Priority: P2)

An HR_ADMIN updates a document — changing its title, description, category, visibility, or replacing the file with a new version. When the file itself is replaced, `version` increments by 1, the new file is persisted, the old file is removed from storage, and `document.uploaded` is emitted again so the AI Agentic RAG pipeline re-indexes the new content. Metadata-only edits (no file replacement) do NOT bump the version and do NOT emit the event.

**Why this priority**: Documents drift — policies change, typos get fixed, regulations are amended. Without an edit path, every correction means delete + re-upload, which produces orphan events and forces RAG to re-index from scratch with a new ID. P2 because the upload + delete combo is a viable workaround during the gap.

**Independent Test**: HR_ADMIN uploads `policy.pdf` (version 1). HR_ADMIN `PATCH /documents/:id` with `{ title: 'New title' }` (no file) — response is 200, `version` stays at 1, no `document.uploaded` event is emitted. HR_ADMIN `PATCH /documents/:id` with a multipart body including a new `file` — response is 200, `version` is 2, `sourceUrl` points at the new file, `sizeBytes` and `mimeType` reflect the new file, the old file is removed from storage, and a fresh `document.uploaded` event is emitted with the same `documentId` but `version: 2`.

**Acceptance Scenarios**:

1. **Given** an existing document, **When** an HR_ADMIN sends `PATCH /documents/:id` with only metadata fields (`title`, `description`, `category`, `isPublic`), **Then** the row is updated, `version` is unchanged, `updatedAt` advances, the response is 200, and NO `document.uploaded` event is emitted.
2. **Given** an existing document, **When** an HR_ADMIN sends `PATCH /documents/:id` with a multipart body that includes a new `file`, **Then** the new file is persisted to storage, `version` increments by 1, `sourceUrl`/`mimeType`/`sizeBytes` reflect the new file, the previously stored file is best-effort deleted (failure to delete the old file is logged but does NOT roll back the update), the response is 200, and a new `document.uploaded` event is emitted with the same `documentId`, the incremented `version`, and the new metadata.
3. **Given** an existing document with `version = 1`, **When** a MANAGER calls `PATCH /documents/:id` with any body, **Then** the response is 403 — only HR_ADMIN may update.
4. **Given** an existing document, **When** an HR_ADMIN sends `PATCH /documents/:id` with a file whose MIME type is not on the whitelist, **Then** the response is 400 `UnsupportedMimeType` and the row is unchanged.
5. **Given** an existing document, **When** an HR_ADMIN sends `PATCH /documents/:id` with both `file` and metadata fields, **Then** both are updated atomically: a single 200 response, a single `version` increment, a single `document.uploaded` event.
6. **Given** an HR_ADMIN attempts to update immutable fields (`id`, `uploadedById`, `version`, `sourceUrl`, `sizeBytes`, `mimeType`, `createdAt`, `updatedAt`) directly in the body, **Then** these fields are silently ignored (or rejected with 400 if the global `ValidationPipe` is configured with `forbidNonWhitelisted`). `version`, `sourceUrl`, `sizeBytes`, and `mimeType` are derived from the file replacement, never accepted from the client.

---

### User Story 5 — HR Admins Delete Documents (Priority: P2)

An HR_ADMIN removes a document that is obsolete, wrong, or duplicated. The row is hard-deleted, the file is removed from storage, and the document disappears from every employee's library on the next read. The AI Agentic RAG pipeline's response to a deleted source document is out of scope for this feature (handled by the existing `VectorDocument` retention logic), but a defensive event `document.deleted` is emitted so subscribers may clean up downstream indexes.

**Why this priority**: Hard delete is required for incorrect uploads and compliance takedowns. P2 because PATCH provides an interim path (set `isPublic = false`) until delete ships.

**Independent Test**: HR_ADMIN uploads a document. HR_ADMIN `DELETE /documents/:id` — response is 204. `GET /documents/:id` returns 404 for everyone. `GET /documents/:id/download` returns 404. The file is no longer on storage. A subscriber to `document.deleted` receives an event with `{ documentId }`. A non-HR_ADMIN attempting `DELETE` returns 403.

**Acceptance Scenarios**:

1. **Given** an existing document, **When** an HR_ADMIN calls `DELETE /documents/:id`, **Then** the row is hard-deleted, the underlying file is removed from storage (best-effort — storage failure is logged but does NOT roll back the DB delete), the response is 204, and a `document.deleted` event is emitted with `{ documentId }`.
2. **Given** an existing document, **When** a non-HR_ADMIN authenticated user calls `DELETE /documents/:id`, **Then** the response is 403 and the row remains.
3. **Given** a deleted document, **When** any user calls `GET /documents/:id` or `GET /documents/:id/download` afterwards, **Then** the response is 404.
4. **Given** a document does not exist, **When** an HR_ADMIN calls `DELETE /documents/:id` with a non-existent id, **Then** the response is 404 `DocumentNotFound`.

---

### User Story 6 — Frontend Document Library Page (Priority: P2)

An authenticated user opens the Documents page from the sidebar. They see a searchable, category-filterable grid of document cards — each showing title, category badge, uploader name, upload date, file size, and a "Download" button. HR_ADMIN users see an "Upload document" button and per-card edit/delete controls. The upload modal accepts a file picker, title, description, category dropdown, and a public/internal toggle. Searching and category filtering update the query in-place via TanStack Query.

**Why this priority**: The page is the only path real users have to the library. P2 because the backend is fully usable by AI Agentic and tests without the UI, but P2 because nothing ships without a way to see it.

**Independent Test**: Navigate to `/documents` while signed in as an EMPLOYEE. The page renders, calls `GET /documents`, and shows the public document cards. Type "leave" in the search box — the query refetches with `?search=leave` and the list updates. Click a category chip ("INTERNAL_POLICY") — the query refetches with `?category=INTERNAL_POLICY`. Click "Download" on a card — the browser starts downloading the file. Sign in as HR_ADMIN — the "Upload document" button appears; clicking it opens the upload modal; submitting the form creates the document and the list invalidates and re-fetches; the new card appears.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they navigate to `/documents`, **Then** the Documents page renders inside the standard authenticated layout with a header, search input, category filter chips, and a list/grid of cards.
2. **Given** an HR_ADMIN signed in, **When** the page renders, **Then** an "Upload document" button is visible in the header; clicking it opens a modal with file picker, title input, description textarea, category dropdown, and an `isPublic` toggle.
3. **Given** an EMPLOYEE signed in (no HR_ADMIN role), **When** the page renders, **Then** the "Upload document" button is NOT rendered (UI gate matches backend RBAC), and no edit/delete controls appear on any card.
4. **Given** the user types in the search box, **When** the input changes, **Then** the query refetches with the new `search` value (debounced by ~300 ms), and the displayed list reflects the matching documents.
5. **Given** the user clicks a category chip, **When** the chip becomes active, **Then** the query refetches with the corresponding `category` parameter; clicking the active chip again clears the filter.
6. **Given** an HR_ADMIN signed in, **When** they click "Edit" on a card, **Then** an edit modal opens prefilled with the document's metadata. Submitting with no file change calls `PATCH /documents/:id` with metadata only; submitting with a new file calls the same endpoint with a multipart body that includes the file.
7. **Given** the backend returns an error code (`UnsupportedMimeType`, `FileTooLarge`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`), **When** the user triggers the failing action, **Then** the page shows a human-readable inline error sourced from the error code mapping in `apps/web/src/lib/api/social.ts`.

---

### Edge Cases

- What happens when an HR_ADMIN uploads a document with a duplicate title in the same category? The service does NOT reject duplicates — titles are not unique by design. Two policies with the same name can legitimately exist (e.g., regional variants).
- What happens when the file is uploaded successfully but the EventBus subscriber throws on `document.uploaded`? The HTTP response remains 201 and the document is persisted. Event delivery failures are logged but not retried (Phase 1 in-process bus best-effort semantics). The AI Agentic RAG pipeline will be re-triggerable by future operations (re-upload via PATCH, or a manual re-index endpoint planned outside this feature).
- What happens when an HR_ADMIN PATCHes a document with a new file but the storage write succeeds and the DB update fails? The orphaned file in storage is logged with the storage key; cleanup is best-effort via a future janitor job (out of scope here). The DB remains consistent — the old version is still the active record.
- What happens when an HR_ADMIN deletes a document whose file has already been removed from storage manually? The DB delete still succeeds (204) and the storage-removal failure is logged. The `document.deleted` event is still emitted.
- What happens when an EMPLOYEE tries `GET /documents/:id` for a document whose `isPublic = false`? The response is 404, not 403 — the existence of HR-only documents is not leaked to non-admins.
- What happens when an EMPLOYEE tries `GET /documents/:id/download` for a public document whose row exists but file is missing? The response is 410 `DocumentFileMissing`. This signals "the metadata says it exists but the file is gone" — distinct from a 404 "no such document". HR_ADMIN sees the same 410.
- What happens when the AI Agentic SYSTEM-context download race-conditions with an HR_ADMIN delete? The endpoint returns 404 if the row is gone by the time the SYSTEM-context request resolves. AI Agentic's RAG worker logs the miss and skips ingestion for that documentId; the vector store eventually reaches consistency.
- What happens when a PATCH includes a new file with a different MIME type (e.g., a PDF replaced by a Word doc)? The new MIME type is accepted as long as it is on the whitelist. The `mimeType` field is updated alongside `sizeBytes`, `sourceUrl`, and `version`.
- What happens when a multipart upload omits the `file` field entirely on POST? The response is 400 `MissingFile`. On PATCH, an omitted file simply means "metadata-only update" — no error.
- What happens when the search query contains SQL-injection-shaped characters? The query is parameterized by Prisma; the search filter uses `ILIKE` on the `title` column with a parameterized argument. No raw SQL is constructed.
- What happens when a user uploads a 0-byte file? The response is 400 `EmptyFile` — empty files have no value to the RAG pipeline and are likely accidental.
- What happens when two HR_ADMINs PATCH the same document with new files concurrently? "Last write wins" — the second commit produces the live `sourceUrl`, the first commit's file is logged as orphan. Both `document.uploaded` events fire. Optimistic concurrency control is out of scope.
- What happens when `pageSize` is omitted? Default is 20. When `pageSize > 100`? Silently capped at 100, no error.
- What happens when `category` is an invalid enum value? The DTO's `@IsEnum(DocumentCategory)` rejects the request with 400 before the service runs.

---

## Requirements *(mandatory)*

### Functional Requirements

**Schema Additions to the Document Model**

- **FR-001**: The `Document` Prisma model in `apps/social/prisma/schema.prisma` MUST gain one new column: `isPublic Boolean @default(true)`. A migration named `documents_add_is_public_flag` MUST add the column with the default value and backfill all existing rows with `true`.
- **FR-002**: One new index MUST be added: `@@index([isPublic, createdAt(sort: Desc)])` to keep the default `GET /documents` employee-visibility filter cheap. The pre-existing `@@index([category, createdAt(sort: Desc)])` from the 012 scaffold MUST be preserved unchanged.
- **FR-003**: All other fields on the `Document` model (`id`, `title`, `description`, `category`, `sourceUrl`, `mimeType`, `sizeBytes`, `uploadedById`, `version`, `createdAt`, `updatedAt`) remain as declared by 012-social-scaffold. This feature does NOT alter their types or constraints.

**REST Surface**

- **FR-004**: `POST /documents` MUST be guarded by `@Roles('HR_ADMIN')`. Body: `multipart/form-data` with required `file` (binary), required `title` (1-200 chars), required `category` (one of `DocumentCategory` enum values), optional `description` (max 2000 chars), optional `isPublic` (boolean, default `true`). On success it returns 201 with the persisted document metadata (no file bytes).
- **FR-005**: `GET /documents` MUST be guarded by `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`. Query: `{ page?: number (default 1), pageSize?: number (default 20, max 100), category?: DocumentCategory, search?: string (max 200 chars), includePrivate?: boolean (HR_ADMIN-only escape hatch — see FR-011) }`. The default response is filtered by `isPublic = true` for non-HR_ADMIN callers.
- **FR-006**: `GET /documents/:id` MUST return a single document's metadata provided the document is `isPublic = true` OR the caller is HR_ADMIN. Otherwise it returns 404 (NOT 403 — leaks fewer existence facts).
- **FR-007**: `GET /documents/:id/download` MUST stream the file bytes with `Content-Type` set from `mimeType`, `Content-Length` set from `sizeBytes`, and `Content-Disposition: attachment; filename="..."` with a filename derived from `title` + the extension inferred from `mimeType`. Visibility rules match FR-006 — non-HR_ADMIN callers may only download `isPublic = true` documents; HR_ADMIN may download any; SYSTEM JWT may download any (for AI Agentic RAG ingestion).
- **FR-008**: `PATCH /documents/:id` MUST be guarded by `@Roles('HR_ADMIN')`. Body: `multipart/form-data` with optional `file`, `title`, `description`, `category`, `isPublic`. If `file` is present, the new file is persisted, the old file is best-effort removed from storage, `version` increments by 1, and `sourceUrl`/`mimeType`/`sizeBytes` are refreshed. If `file` is absent, only metadata is updated and `version` is unchanged. Disallowed fields (`id`, `uploadedById`, `version`, `sourceUrl`, `mimeType`, `sizeBytes`, `createdAt`, `updatedAt`) are silently ignored or rejected with 400 if `forbidNonWhitelisted` is enforced.
- **FR-009**: `DELETE /documents/:id` MUST be guarded by `@Roles('HR_ADMIN')`. The row is hard-deleted (no soft-delete column), the underlying file is best-effort removed from storage, and the response is 204 No Content.

**Visibility Enforcement**

- **FR-010**: The service MUST construct a Prisma `where` filter for the default `GET /documents` such that non-HR_ADMIN callers see only rows where `isPublic = true`. HR_ADMIN callers see all rows. The filter is applied at the query layer, not by post-fetch filtering.
- **FR-011**: When the caller is HR_ADMIN, `?includePrivate=true` is implicitly default (HR_ADMIN sees private docs without needing the flag); `?includePrivate=false` is a no-op for HR_ADMIN; for non-admins, the parameter is silently ignored (HR-only docs are never returned to non-admins under any query parameter).
- **FR-012**: For `GET /documents/:id` and `GET /documents/:id/download`, the visibility check is performed AFTER the row lookup. If the row exists but the caller has no visibility, the response is 404 (never 403, never reveal existence).

**File Storage & MIME Type Whitelist**

- **FR-013**: Files MUST be persisted to a configurable storage backend. For this iteration, the default backend is the local filesystem under `apps/social/storage/documents/` (configurable via `DOCUMENT_STORAGE_PATH` env var). The storage path is structured as `{documentId}/v{version}/{sanitized-original-filename}` so that distinct versions of the same document do not collide on disk.
- **FR-014**: The `sourceUrl` field on the `Document` row MUST store an opaque storage key (e.g., `documents/{documentId}/v{version}/{filename}`) — NOT a public URL. The download endpoint resolves the key to a byte stream through the storage backend abstraction. No file is ever served via a public static-asset path.
- **FR-015**: The MIME type whitelist enforced at upload time is: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX), `text/plain`, `text/markdown`, `text/html`. The whitelist is configurable via the `DOCUMENT_MIME_WHITELIST` env var (comma-separated). Uploads outside the whitelist are rejected with 400 `UnsupportedMimeType`.
- **FR-016**: The maximum upload size is configurable via `DOCUMENT_MAX_SIZE_BYTES` (default 26214400 bytes = 25 MiB). Uploads above the limit are rejected with 400 `FileTooLarge`. The limit is enforced both by the NestJS `FileInterceptor` configuration and by an explicit service-level check (defense in depth).
- **FR-017**: A 0-byte file is rejected with 400 `EmptyFile`. The MIME type and size checks run before the file is written to storage so that no orphan files are produced on rejection.

**Uploader Enrichment**

- **FR-018**: The list and single-fetch endpoints MUST enrich each document with `uploadedBy: { id, firstName, lastName, employeeCode } | null` resolved via `HrCoreClient.getEmployeeRef`. The resolution MUST use the request's JWT-forwarding pattern, MUST go through the in-process cache, and MUST batch/de-duplicate so that listing a page of 20 documents with 5 distinct uploaders triggers at most 5 HR Core calls on a cold cache.
- **FR-019**: If HR Core returns 404 for an `uploadedById` (the employee record was deleted entirely), `uploadedBy` is `null` and the document is still returned. The list endpoint MUST NOT fail because of a single missing uploader.

**Domain Event Emission**

- **FR-020**: After a successful `POST /documents` transaction commits AND the file is confirmed on storage, the `DocumentsService` MUST emit a `DomainEvent` of type `document.uploaded` on the shared `IEventBus`. The event MUST conform to `DomainEvent<{ documentId: string; category: DocumentCategory; mimeType: string; title: string; uploadedById: string; sizeBytes: number; sourceUrl: string; version: number; isPublic: boolean }>` with `source: 'social'`, `metadata.userId = jwt.sub`, and `metadata.correlationId` propagated from the request's `x-correlation-id` header.
- **FR-021**: After a successful `PATCH /documents/:id` that included a new `file` (version bump), the `DocumentsService` MUST emit a fresh `document.uploaded` event with the same `documentId`, the new `version`, and the refreshed `mimeType`/`sizeBytes`/`sourceUrl`. Metadata-only PATCHes (no file replacement) MUST NOT emit any event.
- **FR-022**: After a successful `DELETE /documents/:id`, the service MUST emit a `DomainEvent` of type `document.deleted` with `payload: { documentId, category, uploadedById }` so subscribers (AI Agentic vector store) may clean up downstream indexes.
- **FR-023**: Event emission MUST be performed AFTER the database commit AND the file-system write (or delete) — never inside the same transaction. If event emission throws, the HTTP response remains successful (2xx). Failed deliveries are logged but not retried in Phase 1.

**Sort Order & Pagination**

- **FR-024**: The default `GET /documents` MUST sort results by `createdAt DESC`, with ties broken by `id` ascending for deterministic pagination.
- **FR-025**: Pagination MUST be page-based with `page` (1-indexed) and `pageSize` (default 20, max 100). The response shape MUST be `{ items: Document[], total: number, page: number, pageSize: number }`. The `total` count reflects the applied filters (visibility, category, search) so the frontend can render accurate pagination controls.

**Frontend (apps/web/src/pages/documents.tsx)**

- **FR-026**: A new page MUST be added at `apps/web/src/pages/documents.tsx`, registered as the route `/documents` in `App.tsx` inside the authenticated `<Layout>` wrapper. The sidebar MUST gain a "Documents" link visible to every authenticated user.
- **FR-027**: The page MUST fetch documents via `useQuery({ queryKey: ['documents', { page, pageSize, category, search }], queryFn: () => listDocuments({ page, pageSize, category, search }) })` where `listDocuments` is added to `apps/web/src/lib/api/social.ts` with the full TypeScript interface mirroring the backend DTO.
- **FR-028**: The "Upload document" button and per-card edit/delete controls MUST be rendered only when the current user's roles include `HR_ADMIN` (checked via `useAuth()`'s `user.roles`). Hiding these controls is the UI half of the backend's RBAC gate.
- **FR-029**: The upload modal MUST submit via `multipart/form-data` using a typed Axios call from `social.ts`. The download action MUST issue `GET /documents/:id/download` and trigger a browser file save (e.g., via a hidden `<a download>` element or `URL.createObjectURL`).
- **FR-030**: The `social.ts` API client MUST export at minimum: `listDocuments`, `getDocument`, `createDocument`, `updateDocument`, `deleteDocument`, `downloadDocument`. Every function MUST be typed end-to-end (no `any`) and the response interface MUST exactly mirror what the backend returns, per the frontend/backend coherence rule.
- **FR-031**: The page's `onError` handler MUST map every backend error code to a user-facing message. At minimum: `UnsupportedMimeType`, `FileTooLarge`, `EmptyFile`, `MissingFile`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`. Unmapped codes fall through to a generic "Failed to complete the action" message.
- **FR-032**: The search input MUST be debounced (~300 ms) before triggering a refetch. The category filter MUST be a row of category chips (one per `DocumentCategory` value) where exactly zero or one chip is active. Clicking the active chip clears the filter.
- **FR-033**: Each document card MUST display: title, category badge, uploader name (or "Unknown" when `uploadedBy = null`), upload date, file size (human-readable, e.g., "2.3 MB"), and a "Download" button. HR_ADMIN cards additionally show "Edit" and "Delete" buttons.

**Module Registration**

- **FR-034**: A new NestJS module `DocumentsModule` MUST live at `apps/social/src/modules/documents/`. It MUST contain `documents.module.ts`, `documents.controller.ts`, `documents.service.ts`, a `storage/` folder with `document-storage.service.ts` (filesystem backend) abstracted behind a `DocumentStorage` interface, and a `dto/` folder with `create-document.dto.ts`, `update-document.dto.ts`, and `list-documents-query.dto.ts`. The module MUST be imported into `AppModule.imports`.
- **FR-035**: The module MUST NOT register its own `PrismaModule` instance — it MUST inject the global `PrismaService` from `apps/social/src/prisma/`. It MUST also inject `HrCoreClient` from the existing `ClientsModule` and the `IEventBus` token from the shared event-bus module.

**Documentation & OpenAPI**

- **FR-036**: Every controller method MUST be annotated with `@ApiOperation`, `@ApiResponse` (for 200/201/204, 400, 403, 404, 410, 503), and `@ApiTags('Documents')`. The Swagger doc served at `/api/docs` MUST expose the Documents tag with all six endpoints. Multipart endpoints MUST declare `@ApiConsumes('multipart/form-data')` and `@ApiBody({ schema: ... })` so the Swagger UI can drive uploads.
- **FR-037**: DTO classes MUST use `class-validator` decorators (`@IsString`, `@IsUUID`, `@IsEnum(DocumentCategory)`, `@IsBoolean`, `@IsOptional`, `@MaxLength`, `@IsInt`, `@Min`, `@Max`) so that the global `ValidationPipe` rejects malformed bodies at the boundary before the service runs.

### Key Entities

- **Document** (existing in 012 scaffold, extended here): A file uploaded by HR_ADMIN representing a company policy, handbook, regulation, template, or guide. Carries title, description, category, MIME type, size, storage key (`sourceUrl`), uploader id, monotonic version counter, and (added in this feature) an `isPublic` visibility flag. Source of truth for the document library and the `INTERNAL_POLICY` corpus of the HR Assistant agent's RAG.
- **DocumentUploader** (read-only projection): The uploader identity returned alongside each document in API responses. Resolved at read time from HR Core via `HrCoreClient.getEmployeeRef` — never stored on the row beyond the opaque `uploadedById` UUID. Shape: `{ id, firstName, lastName, employeeCode }`. `null` when the uploader no longer exists in HR Core.
- **DocumentListResponse**: The pagination envelope returned by `GET /documents`. Shape: `{ items: Document[], total: number, page: number, pageSize: number }`. Used by the frontend's TanStack Query hook.
- **DocumentUploadedEvent**: The `DomainEvent<DocumentUploadedPayload>` emitted on the EventBus after a successful publish or version-bump PATCH. AI Agentic's RAG worker subscribes to this event to fetch the file via `GET /documents/:id/download` (with a SYSTEM JWT), chunk it, embed each chunk, and store rows in `VectorDocument` with `sourceType = 'INTERNAL_POLICY'` and a back-reference to `documentId`.
- **DocumentDeletedEvent**: The `DomainEvent<{ documentId, category, uploadedById }>` emitted on the EventBus after a successful delete. Lets AI Agentic prune the corresponding `VectorDocument` rows.
- **DocumentStorage** (interface, internal): The storage backend abstraction with methods `put(key, stream, mimeType, sizeBytes): Promise<void>`, `get(key): Promise<NodeJS.ReadableStream>`, `delete(key): Promise<void>`, `exists(key): Promise<boolean>`. The filesystem implementation lives in `apps/social/src/modules/documents/storage/filesystem-document-storage.service.ts`. An S3-compatible implementation is out of scope for this iteration but the interface is designed to accommodate one.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An HR_ADMIN can upload a 5 MB PDF and see it appear in the public library list within 2 seconds — verified by a manual signed-in test on the documents page.
- **SC-002**: A document marked `isPublic = false` is invisible to every EMPLOYEE/MANAGER and visible to every HR_ADMIN — verified by an integration test running against a real `social_test` schema with one document of each visibility and three seeded users (EMPLOYEE, MANAGER, HR_ADMIN).
- **SC-003**: An EMPLOYEE downloading a 5 MB PDF receives the complete, byte-identical file with the correct Content-Type header — verified by an integration test that computes SHA-256 of the response body and compares against the original upload.
- **SC-004**: Uploading 50 documents and listing them returns the first page in under 250 ms on a developer laptop (warm cache) — measured via a Jest perf assertion or `curl -w` timing. Uploader enrichment for 20 documents on one page results in at most 20 HR Core calls on a cold cache and 0 calls on a warm cache within the TTL.
- **SC-005**: A subscriber registered to `document.uploaded` receives the event payload within 100 ms of the `POST /documents` HTTP response — verified by an integration test that subscribes a Jest spy to the in-process bus and asserts call count + payload shape after an upload. The same is asserted for the version-bump PATCH path.
- **SC-006**: A version-bump PATCH increments `version` from 1 to 2, replaces the file on storage, and emits exactly one `document.uploaded` event with `version: 2` — verified by an integration test that uploads, PATCHes with a new file, then asserts the DB row state and the event spy.
- **SC-007**: Every error code documented in FR-031 (`UnsupportedMimeType`, `FileTooLarge`, `EmptyFile`, `MissingFile`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`) is reachable via at least one Jest test case that asserts the exact code string in the response body.
- **SC-008**: A non-HR_ADMIN user attempting `POST`, `PATCH`, or `DELETE` always receives 403 — verified by Jest tests that sign in as EMPLOYEE and MANAGER and confirm each mutation endpoint rejects them.
- **SC-009**: The frontend Documents page renders an empty state (zero list items) without any console errors on a fresh database — verified by running `turbo dev` against a clean schema and loading `/documents` as a logged-in EMPLOYEE.
- **SC-010**: The migration `documents_add_is_public_flag` is re-runnable on a fresh DB: running `npx prisma migrate dev` on a freshly migrated database reports "no pending migrations" — verified by a manual round-trip on a developer laptop.
- **SC-011**: When the AI Agentic RAG worker (running with a SYSTEM JWT) downloads a 5 MB PDF via `GET /documents/:id/download`, the byte stream completes successfully and the resulting chunks land in `VectorDocument` rows with `sourceType = 'INTERNAL_POLICY'` — verified by an end-to-end test that publishes a document and asserts the vector store contains chunks back-referencing the documentId. (Vector ingestion itself is owned by AI Agentic; this test asserts the download contract works under SYSTEM auth.)

---

## Assumptions

- The 012-social-scaffold feature is fully delivered and merged: the `Document` Prisma model, the `DocumentCategory` enum, the `HrCoreClient`, `SharedJwtGuard`, `RbacGuard`, and `EventBusModule` registration are all in place. This feature extends the scaffold — it does NOT bootstrap any of these.
- `HrCoreClient.getEmployeeRef` is already implemented with caching and error-mapping per the announcements module (013) and 012 scaffold. No new HR Core methods are required for this feature.
- The chosen storage backend is the local filesystem on the Social service host (`apps/social/storage/documents/`), accessed through a `DocumentStorage` interface so an S3-compatible backend can be substituted later without changing the controller, service, or DTOs. Configurable via `DOCUMENT_STORAGE_PATH`.
- The MIME type whitelist defaults to PDF, DOCX, TXT, MD, HTML — the formats most readily chunkable by the AI Agentic RAG pipeline. Image and binary formats are out of scope; if needed they can be added by updating the `DOCUMENT_MIME_WHITELIST` env var without code changes.
- The maximum upload size defaults to 25 MiB. This is intentionally moderate for an HR document library; very large files (multi-hundred-MB videos, full annual reports) are out of scope for the RAG-targeted corpus and can be hosted elsewhere.
- Multipart upload is the chosen request shape (single endpoint, server receives the file, persists, and creates the row in one HTTP request). Presigned-URL flows (client uploads directly to S3, server is notified) are an explicit non-goal for this iteration. The `DocumentStorage` interface is designed so a presigned-URL flow can be introduced later by adding `presignedPutUrl()` and `presignedGetUrl()` methods without breaking the existing controller surface.
- AI Agentic's RAG worker calls `GET /documents/:id/download` with a SYSTEM JWT minted by `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })`. The download endpoint's authorization check explicitly allows the `SYSTEM` role to bypass the `isPublic` visibility filter — every document, public or private, is RAG-indexable.
- Version history (keeping old versions of a document downloadable) is OUT of scope. `version` is a monotonic counter for the current row only; the file at each older version is best-effort deleted from storage when PATCH replaces it. If version history is later required, it would be modelled as a separate `DocumentVersion` table — not in this feature.
- Soft delete is OUT of scope. `DELETE /documents/:id` is a hard delete. Compliance-driven take-down requirements are satisfied by hard delete + the `document.deleted` event.
- The `document.deleted` event is a defensive addition not strictly required by the user prompt, but it costs almost nothing to emit and gives AI Agentic the signal it needs to prune `VectorDocument` rows for the deleted source. If the AI Agentic side is not ready to consume it, the event simply has zero subscribers and is silently dropped (Phase 1 in-process bus semantics).
- The frontend uses TanStack Query (already a dependency) and wouter routing (already configured). No new dependencies are added to `apps/web/`. The file-download trigger uses the browser's native download via the `Content-Disposition: attachment` header — no client-side blob handling is required for the happy path.
- Inter-service authentication continues to forward the caller's JWT (Phase 1, REST). The only exception is the SYSTEM JWT path for AI Agentic's RAG download.
- Rate limiting on `POST /documents` reuses the existing `@nestjs/throttler` global config from 012-social-scaffold — no per-endpoint throttle override is added. (A tighter per-IP limit on uploads could be considered if abuse becomes a concern, but is not in scope here.)
- Integration tests against a real Postgres `social_test` schema are the testing standard, with unit tests covering visibility-filter construction, DTO validation, and the file-storage abstraction (using a mock `DocumentStorage` implementation). Contract tests against `HrCoreClient.getEmployeeRef` already exist per 012/013 — no new contract tests required.
- The `apps/web/src/lib/api/social.ts` file already contains the announcements functions added by 013. This feature extends it with the documents functions listed in FR-030 — it does NOT replace the existing exports.
- The chosen MIME-type-derived filename extension mapping (`.pdf` for `application/pdf`, `.docx` for the Word MIME, `.txt`, `.md`, `.html`) lives in a small `mime-to-extension.ts` helper inside the documents module. This is preferred over trusting the client-provided original filename to avoid path-traversal attacks via crafted filenames.
