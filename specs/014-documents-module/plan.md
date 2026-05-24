# Implementation Plan: Documents Module

**Branch**: `014-documents-module` | **Date**: 2026-05-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-documents-module/spec.md`

---

## Summary

Add a fully-functional Documents module to the Social service (port 3002). The 012-social-scaffold already created the `Document` Prisma model (id, title, description, category, sourceUrl, mimeType, sizeBytes, uploadedById, version, createdAt, updatedAt) and the `DocumentCategory` enum. This feature extends the schema with one nullable column (`isPublic Boolean @default(true)`) plus one supporting index, implements six REST endpoints (POST/GET-list/GET-detail/GET-download/PATCH/DELETE) backed by a swappable `DocumentStorage` interface (default impl = local filesystem), emits the `document.uploaded` event after every upload and version-bumping PATCH so the AI Agentic RAG pipeline can chunk and embed the content, and adds a defensive `document.deleted` event on hard delete. The frontend delivers a `documents.tsx` page with a searchable + category-filtered list, a role-gated upload modal, and per-card edit/delete controls for HR_ADMIN.

---

## Technical Context

**Language/Version**: TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames` via repo-wide `tsconfig.base.json`)
**Primary Dependencies**: NestJS 10, `@nestjs/platform-express` (already installed — exposes `FileInterceptor` and the built-in multer engine), Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, `@sentient/shared` (SharedJwtGuard, RbacGuard, Roles, CurrentUser, Public, IEventBus, EVENT_BUS, DomainEvent, DocumentCategory enum, JwtPayload). One new transitive dependency surfaced: `@types/multer` (dev) to type the `Express.Multer.File` shape.
**Storage**: PostgreSQL 16, schema `social` — existing `documents` table gains 1 new column (`isPublic`) and 1 supporting index. File bytes are stored on the local filesystem under `apps/social/storage/documents/{documentId}/v{version}/{sanitized-filename}` (path configurable via `DOCUMENT_STORAGE_PATH`). The storage layer is fronted by a `DocumentStorage` interface so an S3-compatible implementation can drop in later without controller/service changes.
**Testing**: Jest unit (co-located `.spec.ts`), integration tests with real Prisma (test schema) + a mock `DocumentStorage`, contract tests in `test/contracts/` for the REST surface, no nock additions required (HR Core calls reuse the existing `HrCoreClient.getEmployeeRef`).
**Target Platform**: Linux server / Docker Compose (local dev). Filesystem persistence requires a writable volume; in production this should be a mounted PVC or an S3-backed `DocumentStorage` implementation.
**Project Type**: NestJS microservice (Social, port 3002) + React 18 Vite SPA frontend (port 3000).
**Performance Goals**: `POST /documents` p95 < 1500 ms for a 5 MiB upload (dominated by disk I/O); `GET /documents` p95 < 250 ms with warm `HrCoreClient` cache; `GET /documents/:id/download` streams with constant memory usage regardless of file size (no full-buffer-in-RAM).
**Constraints**: MIME type whitelist enforced at the boundary (PDF, DOCX, TXT, MD, HTML by default — configurable via `DOCUMENT_MIME_WHITELIST`). Default max upload size 25 MiB (configurable via `DOCUMENT_MAX_SIZE_BYTES`). `isPublic = false` documents are 404 for non-HR_ADMIN (never 403 — no existence leak). AI Agentic's RAG worker authenticates with a SYSTEM JWT minted by `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })` to bypass the visibility filter on `GET /documents/:id/download`. Storage keys MUST be derived server-side (UUID + version-prefixed) — original client-provided filenames are sanitized for `Content-Disposition` only, never used as path components.
**Scale/Scope**: Single organization, up to 500 employees; expected document corpus 50-500 files, mostly PDFs (10 KB - 25 MiB). Page-based pagination (default 20, max 100) is sufficient at this scale. No need for full-text indexing of file contents inside the Social service — that responsibility belongs to AI Agentic's RAG pipeline.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is a template (not yet project-specific). No gates defined. Proceeding under standard CLAUDE.md engineering rules:

- ✅ Every endpoint has `@UseGuards` (via AppModule global guards) + `@Roles(...)` (or `@Public()` for none — not used here)
- ✅ No `any` types
- ✅ DTOs validated with class-validator
- ✅ Cross-service = REST only — Social calls HR Core via the existing `HrCoreClient`; AI Agentic calls Social via REST with a SYSTEM JWT, never via shared imports
- ✅ Domain events emitted AFTER successful DB commit AND successful file write — never inside the transaction
- ✅ Additive-only Prisma migration (no DROP; one ADD COLUMN with default + one CREATE INDEX)
- ✅ Service boundaries respected (no import from `apps/hr-core/` or `apps/ai-agentic/`)
- ✅ Sensitive paths: storage keys are server-derived UUID-prefixed paths, never client-controllable — path traversal is structurally impossible

**Re-check after Phase 1 design (post-research/data-model/contracts)**:
- ✅ All endpoints documented in `contracts/rest-endpoints.md` carry explicit role gates and error codes
- ✅ `document.uploaded` and `document.deleted` events documented in `contracts/domain-events.md` with the exact emit pattern matching announcements (013) conventions
- ✅ Storage abstraction (`DocumentStorage` interface) keeps the swap to S3-compatible storage non-breaking
- ✅ SYSTEM JWT bypass on `GET /documents/:id/download` is the only auth-deviation and is explicitly scoped + documented

---

## Project Structure

### Documentation (this feature)

```text
specs/014-documents-module/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── rest-endpoints.md    # 6 endpoint contracts
│   └── domain-events.md     # document.uploaded + document.deleted events
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code

```text
apps/social/
├── prisma/
│   ├── schema.prisma                # Add `isPublic` + supporting index to Document model
│   └── migrations/
│       └── 20260523_documents_add_is_public_flag/
│           └── migration.sql
└── src/
    ├── modules/
    │   └── documents/                       # NEW
    │       ├── documents.module.ts
    │       ├── documents.controller.ts
    │       ├── documents.service.ts
    │       ├── documents.service.spec.ts
    │       ├── storage/
    │       │   ├── document-storage.interface.ts        # put/get/delete/exists
    │       │   ├── filesystem-document-storage.service.ts
    │       │   └── filesystem-document-storage.service.spec.ts
    │       ├── mime/
    │       │   └── mime-to-extension.ts                 # safe extension derivation
    │       └── dto/
    │           ├── create-document.dto.ts
    │           ├── update-document.dto.ts
    │           └── list-documents-query.dto.ts
    └── app.module.ts                # Import DocumentsModule

apps/web/
└── src/
    ├── pages/
    │   └── documents.tsx                  # NEW — list + upload modal + edit/delete (HR_ADMIN)
    ├── lib/
    │   └── api/
    │       └── social.ts                  # Extend with documents functions (already has announcements)
    └── App.tsx                            # Register /documents route + sidebar link
```

**Structure Decision**: Web application. Backend = Social microservice (one new module + one Prisma migration). Frontend = React + Vite SPA (one new page + extension of `social.ts`). All new backend code lives in `apps/social/src/modules/documents/`; all new frontend code is one page + additive exports from the existing `social.ts`.

---

## Implementation Tasks (Phase 2 input)

### Backend

**T-01** — Prisma migration: add `isPublic Boolean @default(true)` column + `@@index([isPublic, createdAt(sort: Desc)])` to the existing `Document` model. Run `npx prisma migrate dev --name documents_add_is_public_flag` from `apps/social/`.

**T-02** — Define the `DocumentStorage` interface (`storage/document-storage.interface.ts`) with `put`, `get`, `delete`, `exists` methods. Inject via a Nest token `DOCUMENT_STORAGE` so test code can swap in a mock.

**T-03** — Implement `FilesystemDocumentStorage` (`storage/filesystem-document-storage.service.ts`). Reads `DOCUMENT_STORAGE_PATH` from `ConfigService`; ensures the directory exists at startup (`mkdirSync({ recursive: true })`); writes via `fs.createWriteStream`; reads via `fs.createReadStream`; deletes via `fs.unlink`. Sanitize filenames with a strict allowlist regex before joining paths.

**T-04** — Implement `mime-to-extension.ts` helper: maps the configured whitelist MIME types to safe filename extensions (`.pdf`, `.docx`, `.txt`, `.md`, `.html`). Used only when constructing `Content-Disposition`, never when constructing storage keys.

**T-05** — Implement DTOs: `CreateDocumentDto` (title, category, optional description, optional isPublic), `UpdateDocumentDto` (all fields optional), `ListDocumentsQueryDto` (page, pageSize, category, search). Multipart `file` is bound via `@UploadedFile()` — not part of the DTO class.

**T-06** — Implement `DocumentsService`:
  - `create(user, dto, file, correlationId)` — validates MIME + size + non-empty; computes storage key; writes file via `DocumentStorage.put`; persists row; emits `document.uploaded`. Rolls back the file on DB-write failure.
  - `findAll(user, query)` — builds Prisma `where` (visibility + category + search ILIKE); paginates; enriches `uploadedBy` via batched `HrCoreClient.getEmployeeRef`.
  - `findOne(user, id)` — fetches row; returns 404 if `isPublic = false` and caller is not HR_ADMIN.
  - `download(user, id)` — visibility check (SYSTEM JWT bypasses); returns the file stream + headers; 410 if storage key is missing.
  - `update(user, id, dto, file?, correlationId)` — HR_ADMIN guard; if `file` present, writes new file, best-effort deletes old file, increments `version`, refreshes mimeType/sizeBytes/sourceUrl, emits `document.uploaded` with new `version`. Metadata-only PATCH does not emit.
  - `remove(user, id, correlationId)` — HR_ADMIN guard; hard-delete row; best-effort delete file; emits `document.deleted`.
  - `enrichWithUploader(docs)` — batched de-dup of `uploadedById` then a single `HrCoreClient.getEmployeeRef` per unique id.

**T-07** — Implement `DocumentsController`: 6 endpoints with `@Roles`, `@CurrentUser`, `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: ... } }))` on POST and PATCH, `@ApiConsumes('multipart/form-data')` + `@ApiBody({ schema })` for Swagger, full `@ApiResponse` annotations including 410.

**T-08** — Wire `DocumentsModule` into `AppModule.imports`. Register `DOCUMENT_STORAGE` provider that resolves to `FilesystemDocumentStorage` for the default config (room for `S3DocumentStorage` later).

**T-09** — Unit tests for `DocumentsService` (mock Prisma + mock `DocumentStorage` + mock `HrCoreClient` + mock `IEventBus`):
  - Upload happy path emits `document.uploaded` once with the full payload
  - Empty file → 400 `EmptyFile`; oversize → 400 `FileTooLarge`; bad MIME → 400 `UnsupportedMimeType`
  - Storage write failure → 503 `StorageUnavailable` + no row + no event
  - List visibility: EMPLOYEE never sees `isPublic = false` rows; HR_ADMIN sees all
  - Detail visibility: 404 (not 403) for HR-only doc accessed by EMPLOYEE
  - Download: SYSTEM JWT bypasses visibility; 410 when storage key missing
  - Version bump emits event with `version: 2`; metadata-only PATCH emits nothing
  - Delete emits `document.deleted` exactly once

**T-10** — Integration test against the real `social_test` schema + a tempdir-backed `FilesystemDocumentStorage`:
  - POST a PDF, assert row + storage file + event
  - GET list as EMPLOYEE vs HR_ADMIN shows correct subsets
  - GET download returns byte-identical bytes (SHA-256 comparison)
  - PATCH with new file bumps version, replaces file, emits new event
  - DELETE removes row + file + emits `document.deleted`

### Frontend

**T-11** — Extend `apps/web/src/lib/api/social.ts` with typed Axios functions:
  - `listDocuments(params)` → `DocumentListResponse`
  - `getDocument(id)` → `DocumentResponse`
  - `createDocument(formData)` → `DocumentResponse` (multipart)
  - `updateDocument(id, formData)` → `DocumentResponse` (multipart, file optional)
  - `deleteDocument(id)` → `void`
  - `downloadDocument(id)` → triggers browser download (uses `<a href download>` pattern after fetching the blob OR a hidden link that hits the URL directly with the JWT via the configured `socialClient`)

**T-12** — Implement `apps/web/src/pages/documents.tsx`:
  - List/grid view: cards with title, category badge, uploader name, upload date, size
  - Search input (debounced ~300 ms) and category chip filter
  - "Upload document" button visible only when `getRoleTier(user) === 'hr_admin'`
  - Upload modal: file picker, title, description, category dropdown, public/internal toggle
  - HR_ADMIN per-card edit (modal with optional new file) and delete (confirm dialog)
  - `useQuery(['documents', page, pageSize, category, search])` with the search debounced before key changes
  - `useMutation` for create/update/delete with cache invalidation
  - Error mapping to user-facing strings: `UnsupportedMimeType`, `FileTooLarge`, `EmptyFile`, `MissingFile`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`

**T-13** — Register `/documents` route in `apps/web/src/App.tsx` inside the authenticated `<Layout>` wrapper.

**T-14** — Add a "Documents" nav item to `ALL_MAIN_NAV` in `apps/web/src/components/layout.tsx` (visible to all role tiers).

---

## Complexity Tracking

No violations. The feature is additive:
- One nullable Prisma column with a default → zero-downtime migration
- One new NestJS module that follows the announcements (013) template exactly
- One new frontend page that follows the announcements page pattern
- A swappable storage interface that adds no new runtime dependency beyond what `@nestjs/platform-express` already pulls in (multer)
- AI Agentic integration is event-driven and read-through-REST — no shared imports, no schema coupling

The only new cross-cutting concern is the SYSTEM JWT bypass on `GET /documents/:id/download`. This is documented in the security contract and is the same pattern already used by exit-survey dispatch (012-social-scaffold). No new precedent is set.
