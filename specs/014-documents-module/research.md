# Research: 014-Documents Module

**Phase 0 output** | Branch: `014-documents-module` | Date: 2026-05-23

---

## 1. Storage Backend Strategy

**Question**: Where do the file bytes live — local filesystem, S3-compatible object store, or PostgreSQL BYTEA / GridFS?

**Decision**: Local filesystem under `apps/social/storage/documents/{documentId}/v{version}/{sanitized-filename}` for this iteration, fronted by a `DocumentStorage` interface so an S3-compatible implementation can be plugged in later without controller/service changes.

**Rationale**:
- The FYP runs on Docker Compose against a single Postgres instance. Adding MinIO or S3 doubles the deployment surface for no immediate benefit at a 50-500 document scale.
- The `Document.sourceUrl` field already stores a string — we redefine it as an *opaque storage key* (e.g., `documents/{documentId}/v{version}/policy.pdf`), not a public URL. The download endpoint resolves the key through the storage backend abstraction. Nothing leaks the filesystem layout to the client.
- Interface segregation (`DocumentStorage`) keeps the controller/service test-friendly and migration-friendly. A future `S3DocumentStorage` (using `@aws-sdk/client-s3` or a MinIO endpoint) is a drop-in replacement.

**Alternatives considered**:
- **PostgreSQL BYTEA**: Rejected — bloats `pg_dump` backups, kills streaming (download endpoint must full-buffer), and adds toast-table pressure on the small `social` schema.
- **S3-compatible (MinIO) from day one**: Rejected for this iteration — operational overhead (one more container to run, one more secret to manage, one more failure mode) outweighs the benefit at FYP scale. The `DocumentStorage` interface makes the migration cheap when it's needed.
- **Presigned URL flow** (client uploads directly to S3 via a presigned PUT): Rejected for this iteration — assumes S3 backend, requires a second `confirm-upload` endpoint to detect completion, and complicates the event-emission ordering. Multipart server-side upload is simpler and the contract is identical from the client's perspective.

---

## 2. Multipart Upload Mechanism (NestJS Side)

**Question**: How does the Social service accept binary file uploads?

**Decision**: `@nestjs/platform-express`'s built-in `FileInterceptor` (backed by `multer` under the hood). `@nestjs/platform-express` is already an installed dependency in `apps/social/package.json`, so the runtime engine is present. `@types/multer` will be added as a `devDependency` to type `Express.Multer.File`.

**Implementation sketch**:
```typescript
@Post()
@Roles('HR_ADMIN')
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 26_214_400 },  // 25 MiB — also enforced explicitly by service
    storage: undefined,                 // memory storage; service streams to DocumentStorage
  }),
)
@ApiConsumes('multipart/form-data')
async create(
  @CurrentUser() user: JwtPayload,
  @UploadedFile() file: Express.Multer.File | undefined,
  @Body() dto: CreateDocumentDto,
): Promise<DocumentResponse> { ... }
```

**Rationale**: Zero new dependencies (multer is already pulled transitively). Memory storage is fine for ≤ 25 MiB uploads — the service then streams the buffer to disk via `DocumentStorage.put`. Disk-buffered multer storage is unnecessary at this size.

**Alternatives considered**:
- **Disk-buffered multer**: Avoid temp files entirely; the upload-then-move dance adds failure modes (orphan temps) for no real benefit.
- **busboy directly**: Lower-level, more code. NestJS's `FileInterceptor` is the idiomatic choice.

---

## 3. MIME Type Whitelist + Detection

**Question**: Which file types do we accept, and do we trust the client-provided `Content-Type`?

**Decision**: Accept only these by default (configurable via `DOCUMENT_MIME_WHITELIST` env var):
| MIME | Extension | Notes |
|------|-----------|-------|
| `application/pdf` | `.pdf` | Most common policy/regulation format |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | Word — RAG can extract via `mammoth` / `docx-parser` |
| `text/plain` | `.txt` | Trivially RAG-able |
| `text/markdown` | `.md` | Common for guides and internal docs |
| `text/html` | `.html` | Some published policies live as HTML |

The MIME used for storage and emission is the value reported by multer — multer derives it from the multipart boundary header. We do NOT independently sniff file magic bytes in this iteration; if abuse becomes a concern, `file-type` (npm) can be added later inside the service. The `mime-to-extension.ts` helper does NOT trust the client filename — extensions for `Content-Disposition` are derived purely from the validated MIME.

**Rationale**: At a single-tenant FYP with HR_ADMIN-only upload, MIME spoofing is a low-likelihood attack — the uploader is already a trusted insider. The whitelist + size cap + path-traversal-proof storage keys give enough defense. Adding magic-byte sniffing is easy later without a contract break.

**Alternatives considered**:
- **Magic-byte sniffing via `file-type`**: Useful, not necessary for v1. Documented as a future hardening hook.
- **Accept-anything-go**: Rejected — non-RAG-compatible binary files have no place in the library and risk polluting the AI Agentic pipeline.

---

## 4. File Size Limit

**Question**: What is the upload cap?

**Decision**: 25 MiB (`26_214_400` bytes) default, configurable via `DOCUMENT_MAX_SIZE_BYTES`. Enforced at two layers (defense in depth): multer's `limits.fileSize` (raises a `PayloadTooLargeException` automatically) AND an explicit service-level check on `file.size` before any storage I/O.

**Rationale**: HR documents in the wild — policies, handbooks, regulations — almost universally clock in under 5 MiB. 25 MiB is comfortable headroom for the occasional large PDF (illustrated handbook). Anything bigger should be either chunked outside this system (videos hosted elsewhere) or accepted via a later S3 presigned-URL flow.

---

## 5. Storage Key Format (Path Traversal Safety)

**Question**: How are filesystem paths constructed, given that the client provides an arbitrary `file.originalname`?

**Decision**: Server-derived, hierarchical:
```
{DOCUMENT_STORAGE_PATH}/{documentId}/v{version}/{sanitizedOriginalname}
```
where:
- `documentId` is a UUID generated server-side
- `version` is the integer version counter (1, 2, ...)
- `sanitizedOriginalname` is the client-provided `file.originalname` stripped to `[A-Za-z0-9._-]+`, then bounded to 100 chars, with a fallback of `document` if the sanitized form is empty

The `Document.sourceUrl` column stores the relative key (`documents/{documentId}/v{version}/{sanitized}`) NOT the absolute path. The `FilesystemDocumentStorage` resolves the key to an absolute path internally, scoped under `DOCUMENT_STORAGE_PATH`. The resolution uses `path.join` followed by a `path.resolve` check that the resulting absolute path is still within `DOCUMENT_STORAGE_PATH` — defensive belt-and-suspenders even though the key itself is server-controlled.

**Rationale**: Path traversal is structurally impossible — the client cannot influence the path component above `sanitizedOriginalname`, and that component is regex-allowlisted. The version-prefixed directory means version bumps don't overwrite the prior file (so a brief race window during PATCH doesn't corrupt the live download).

---

## 6. Visibility Filter & 404 vs 403 Semantics

**Question**: When an EMPLOYEE requests a document whose `isPublic = false`, do we return 403 or 404?

**Decision**: 404 (`DocumentNotFound`). For both `GET /documents/:id` and `GET /documents/:id/download`. The visibility check is performed AFTER the row lookup but treated as a "row does not exist for you" outcome.

**Rationale**: Returning 403 leaks the existence of HR-only documents to non-admins (they can enumerate IDs and harvest a list of secret doc count). 404 is the privacy-preserving choice and is the same pattern the announcements (013) module uses for cross-audience access. The actual cost of the leak is low in our threat model (insider, single tenant), but the convention is cheap to maintain.

---

## 7. SYSTEM JWT for AI Agentic RAG Download

**Question**: How does the AI Agentic RAG worker download bytes for chunking when no human is in the loop?

**Decision**: AI Agentic's RAG worker mints a SYSTEM JWT via `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })`. The token has `roles: ['SYSTEM']` and `scope: 'GLOBAL'`. The `GET /documents/:id/download` endpoint checks the JWT roles and, if `SYSTEM` is present, bypasses the `isPublic` visibility check entirely. Every other endpoint in the documents module rejects SYSTEM JWTs (or simply does not include `SYSTEM` in their `@Roles(...)` list).

**Rationale**: This is the same SYSTEM-JWT pattern already used by exit-survey dispatch in the 012 scaffold and is documented in `.claude/CLAUDE.md` §9. Only the download endpoint accepts SYSTEM — the controller surface is otherwise unchanged. The SYSTEM token has a 5-minute expiry and is minted on-demand by the RAG worker after consuming a `document.uploaded` event.

**Token signing**: SYSTEM JWTs are signed with `SYSTEM_JWT_SECRET` (distinct from `JWT_SECRET`). The Social service's `SharedJwtGuard` already validates both secrets per 012-social-scaffold FR for SYSTEM-context exit-survey dispatch — no new validator logic is required.

---

## 8. Event Payload Extension Beyond the User Prompt

**Question**: The user prompt specifies the `document.uploaded` payload as `{ documentId, category, mimeType }`. Is that enough?

**Decision**: Extend the payload to `{ documentId, category, mimeType, title, uploadedById, sizeBytes, sourceUrl, version, isPublic }`.

**Rationale**: AI Agentic's RAG worker consuming the event needs to (a) decide whether to skip ingestion (`isPublic` may matter for namespace routing later), (b) fetch the bytes via `GET /documents/:id/download` (it knows the `documentId`), and (c) emit observability without a second REST round-trip to look up `title`. Adding fields to a domain event is forward-compatible — subscribers ignore unknown fields. Stripping them later would be a breaking change. The cost of including them now is one JSON-serialization line.

**Alternatives considered**:
- **Stick to the prompt verbatim** (`{ documentId, category, mimeType }`): Rejected — every consumer would need to follow up with `GET /documents/:id` to get `title`/`sizeBytes`. Wasteful and racy (if the doc is deleted between the event and the follow-up GET).
- **Embed the full `DocumentResponse`**: Rejected — domain events should be data envelopes, not full DTOs. Including derived fields like `uploadedBy: { firstName, lastName }` makes them stale and couples event consumers to HR Core.

---

## 9. Version Bump on PATCH — Event Emission Rule

**Question**: When an HR_ADMIN PATCHes a document with a new file, do we emit `document.uploaded` again, a new `document.updated`, or nothing?

**Decision**: Emit `document.uploaded` again with the same `documentId` and the incremented `version`. Metadata-only PATCHes (no new file) emit nothing.

**Rationale**: From the RAG pipeline's perspective, a new file is logically a new ingestion task — chunks must be re-extracted, re-embedded, and the old `VectorDocument` rows pruned. The event consumer can match on the `(documentId, version)` tuple to detect "this is a re-index". Adding a separate `document.updated` event would mean every consumer must handle both events identically — pure noise. Metadata-only edits don't change the file bytes, so the RAG pipeline doesn't need to know about them.

**Consumer guidance for AI Agentic** (informational, out of scope for this spec): On receiving `document.uploaded` for a `documentId` that already has `VectorDocument` rows, the worker should delete the old rows before chunking the new file. The `version` field is the discriminator.

---

## 10. `document.deleted` Event

**Question**: The user prompt does not require a delete event. Should we emit one anyway?

**Decision**: Yes. Emit `document.deleted` with payload `{ documentId, category, uploadedById }` after a successful hard delete.

**Rationale**: The cost is near-zero (one `eventBus.emit` call). The benefit is AI Agentic's RAG pipeline gets the signal it needs to prune `VectorDocument` rows back-referencing the deleted document — without it, the vector store drifts and the HR Assistant may cite a non-existent source. If AI Agentic isn't ready to consume the event yet, the in-process bus drops it silently (Phase 1 best-effort semantics) and we pay nothing. Adding the event later would require a coordinated deployment; adding it now is free.

**Alternatives considered**:
- **No delete event**: Rejected for the reason above.
- **Soft delete with `deletedAt DateTime?`**: Rejected — the spec explicitly chose hard delete (FR-009, SC-010). Soft delete adds query complexity (filter all reads) and storage cost (orphan files linger) for an audit-trail benefit we don't need at FYP scale.

---

## 11. Uploader Enrichment — Strategy Match with Announcements

**Question**: How do we attach `uploadedBy: { id, firstName, lastName, employeeCode }` to list/detail responses?

**Decision**: Call `HrCoreClient.getEmployeeRef(uploadedById, context)` per unique `uploadedById` in the page. Reuse the existing in-process TTL cache in `HrCoreClient` (5 min default).

**Rationale**: Same pattern as announcements (013). The 013 implementation already de-duplicates author IDs per page; we reuse the same code path. A page of 20 documents with 5 distinct uploaders triggers at most 5 HR Core calls cold, 0 calls warm.

**No new HR Core method required** — `getEmployeeRef` already exists, already returns the exact `EmployeeRef` shape (`{ id, firstName, lastName, email, employeeCode, departmentId, teamId, employmentStatus }`). The documents endpoint projects out the four fields it cares about (`id, firstName, lastName, employeeCode`).

---

## 12. Search Implementation

**Question**: How is the `?search=...` query parameter implemented?

**Decision**: Case-insensitive Prisma `contains` on `title`:
```typescript
where: {
  ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
  // ... visibility + category filters
}
```

**Rationale**: At 50-500 documents, a sequential `ILIKE` scan on `title` is sub-millisecond — adding a GIN/trigram index is over-engineered. Full-text search across file contents is explicitly out of scope (that's the RAG pipeline's job).

**Alternatives considered**:
- **`pg_trgm` GIN index**: Premature optimization at this scale.
- **Search across `description` too**: Out of scope for v1; can be added by extending the `where` to an `OR` clause without a contract break.

---

## 13. Pagination Contract — Match Announcements

**Question**: Pagination shape — match announcements (`{ data, total, page, limit }`) or use `{ items, total, page, pageSize }`?

**Decision**: Use the same shape the spec already commits to: `{ items, total, page, pageSize }`.

**Rationale**: The announcements (013) module shipped with `{ data, total, page, limit }`. The documents spec FR-025 prescribes `{ items, total, page, pageSize }`. The two are inconsistent in the codebase — that inconsistency already exists and is not in this feature's blast radius to resolve. We follow the documents spec verbatim. If we later want to unify, a future refactor can do so across both modules in one PR.

**Note for tasks.md**: Frontend's `social.ts` will export `DocumentListResponse` with `items/pageSize` keys distinct from `AnnouncementListResponse`'s `data/limit`. Each typed-function exposes its own shape.

---

## 14. Frontend Download Trigger

**Question**: How does the browser receive the file — `window.location = url`, `<a download>`, or `fetch + blob URL`?

**Decision**: Fetch via the existing authenticated Axios client, build an object URL from the blob, trigger a hidden `<a href={url} download={filename} />` click.

**Rationale**: The download endpoint requires `Authorization: Bearer <jwt>`. Setting `window.location` would send a no-header GET that the backend would reject with 401. `<a download>` with a non-blob URL has the same problem. The blob-URL pattern works with the existing token interceptor, costs one extra round-trip for `URL.createObjectURL` allocation, and gracefully cleans up via `URL.revokeObjectURL` after the click.

**Trade-off**: For very large files (>100 MiB), buffering as a blob in browser memory is wasteful. At 25 MiB max, it's fine. When/if uploads grow, the right move is to switch the download endpoint to a short-lived signed URL (issued by Social, redirecting to S3 with embedded expiring credentials) — also a clean future swap, no contract break.

---

## 15. Module Registration & Provider Token

**Question**: How is `DocumentStorage` injected so it's swappable in tests?

**Decision**: Use a Nest provider token `DOCUMENT_STORAGE` (Symbol or string token, kept in `storage/document-storage.interface.ts`):
```typescript
export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

// documents.module.ts
providers: [
  DocumentsService,
  { provide: DOCUMENT_STORAGE, useClass: FilesystemDocumentStorage },
],

// documents.service.ts
constructor(
  @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  // ...
) {}
```

**Rationale**: Token-based DI is the cleanest way to keep the interface abstract while letting tests inject a mock. Same pattern as `EVENT_BUS` in `@sentient/shared`.

---

## 16. Prisma Migration Safety

**Question**: Does the migration require DROP operations on the existing `documents` table?

**Decision**: No DROP operations. The migration only adds one nullable-with-default column and one index to the existing `documents` table.

**Schema diff**:
```sql
ALTER TABLE social.documents
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX "documents_isPublic_createdAt_idx"
  ON social.documents("isPublic", "createdAt" DESC);
```

**Safety**: `isPublic` is NOT NULL but has a default of TRUE, so all existing rows backfill to TRUE automatically — zero-downtime additive migration, no application coordination required. The pre-existing `@@index([category, createdAt(sort: Desc)])` is preserved unchanged.

---

## 17. Open Items Carried Into Tasks

None. Every research item resolves to a concrete decision with no `NEEDS CLARIFICATION` carry-over.
