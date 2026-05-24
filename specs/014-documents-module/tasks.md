# Tasks: 014-Documents Module

**Input**: Design documents from `/specs/014-documents-module/`
**Branch**: `014-documents-module`
**Date**: 2026-05-23
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Prerequisites confirmed**:
- `plan.md` ✅ — 14 implementation tasks T-01 through T-14
- `spec.md` ✅ — 6 user stories (US1–US3: P1, US4–US6: P2), 37 FRs
- `research.md` ✅ — 17 decisions resolved
- `data-model.md` ✅ — Prisma diff, response shapes, DTO shapes, `DocumentStorage` interface, error code catalog
- `contracts/rest-endpoints.md` ✅ — 6 endpoint contracts + role matrix
- `contracts/domain-events.md` ✅ — `document.uploaded` + `document.deleted` event schemas

**Tests**: Included — SC-002, SC-005, SC-006, SC-007, SC-008 explicitly require Jest tests; plan T-09 + T-10 mandate unit + integration tests.

**Organization**: Grouped by user story. Each story is independently testable.

**Spec note**: Visibility filter rule — non-HR_ADMIN callers (EMPLOYEE, MANAGER, EXECUTIVE) NEVER see rows where `isPublic = false`. The `?includePrivate=true` query param is HR_ADMIN-only and is silently ignored for everyone else (per FR-011). The download endpoint additionally accepts a SYSTEM JWT (for AI Agentic RAG ingestion), which bypasses the visibility filter.

## Format: `[ID] [P?] [US#?] Description with file path`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[US#]**: Which user story (US1–US6, maps to spec.md)
- Exact file paths in every description

---

## Phase 1: Setup

**Purpose**: Create the new module directory skeleton in the Social service and add the file-upload dev dependency.

- [X] T001 Create `apps/social/src/modules/documents/` directory with empty barrel stubs: `documents.module.ts`, `documents.service.ts`, `documents.controller.ts`, `storage/` subfolder, `mime/` subfolder, and empty `dto/` folder — all files must export an empty class so the TypeScript project compiles without error
- [X] T002 [P] Add `@types/multer` as a `devDependency` to `apps/social/package.json` (`pnpm --filter @sentient/social add -D @types/multer`); confirm `multer` itself is already provided transitively by `@nestjs/platform-express`

**Checkpoint**: `turbo build --filter=social` passes with the new empty files in place; `Express.Multer.File` resolves without type errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration, storage backend abstraction, MIME helper, and module wiring that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Add `isPublic Boolean @default(true)` column and `@@index([isPublic, createdAt(sort: Desc)])` to the `Document` model in `apps/social/prisma/schema.prisma`; run `npx prisma migrate dev --name documents_add_is_public_flag` from `apps/social/` to generate `apps/social/prisma/migrations/20260523_documents_add_is_public_flag/migration.sql`; verify the resulting SQL is one `ALTER TABLE ... ADD COLUMN` plus one `CREATE INDEX` with no DROP statements
- [X] T004 [P] Define `DocumentStorage` interface (`put`, `get`, `delete`, `exists`) and `DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE')` injection token in `apps/social/src/modules/documents/storage/document-storage.interface.ts`; export both from the file
- [X] T005 [P] Implement `FilesystemDocumentStorage` in `apps/social/src/modules/documents/storage/filesystem-document-storage.service.ts`: `@Injectable()`; constructor reads `DOCUMENT_STORAGE_PATH` (default `./storage/documents` relative to `apps/social/`), `DOCUMENT_MAX_SIZE_BYTES` (default 26_214_400), and `DOCUMENT_MIME_WHITELIST` (default the five MIME types from research §3) via `ConfigService`; calls `mkdirSync(rootPath, { recursive: true })` in `onModuleInit`; `put(key, buffer, mimeType)` resolves key under root via `path.resolve` + allowlist check (throws if escape), then writes via `fs.promises.writeFile`; `get(key)` returns `fs.createReadStream(absolutePath)`; `delete(key)` calls `fs.promises.unlink` and swallows `ENOENT`; `exists(key)` calls `fs.promises.access` returning a boolean; throws `StorageWriteError` and `StorageKeyNotFound` for non-recoverable conditions
- [X] T006 [P] Implement `mime-to-extension.ts` helper in `apps/social/src/modules/documents/mime/mime-to-extension.ts`: exports `mimeToExtension(mime: string): string` with a hard-coded map for the 5 whitelisted MIMEs (returns `.pdf`, `.docx`, `.txt`, `.md`, `.html` respectively); also exports `sanitizeFilename(name: string): string` that strips to `[A-Za-z0-9._-]+`, truncates to 100 chars, returns `'document'` when result is empty
- [X] T007 [P] Complete `apps/social/src/modules/documents/documents.module.ts` (imports `PrismaModule`, `ClientsModule`, `EventBusModule`; providers include `DocumentsService` + `{ provide: DOCUMENT_STORAGE, useClass: FilesystemDocumentStorage }`; exports `DocumentsService`); add `DocumentsModule` to `imports[]` in `apps/social/src/app.module.ts`

**Checkpoint**: `turbo build --filter=social` passes. `\d social.documents` shows the new `isPublic` column and the `documents_isPublic_createdAt_idx` index. `AppModule` imports `DocumentsModule`. `FilesystemDocumentStorage` is instantiable and creates its root directory on bootstrap.

---

## Phase 3: User Story 1 — HR Admin Uploads Documents (Priority: P1) 🎯 MVP

**Goal**: HR_ADMIN can POST a multipart `file + title + category` and the service persists the bytes via `DocumentStorage.put`, creates the `Document` row with `version = 1`, and emits `document.uploaded` so AI Agentic's RAG pipeline can begin ingestion. MIME whitelist, size cap, empty-file, and storage-write failures all return the correct error codes and never leave orphan rows.

**Independent Test**: `POST /documents` as HR_ADMIN with a 1 KB PDF → 201 with new row metadata; storage shows the file at `<root>/<id>/v1/<sanitized>`; a Jest spy on the in-process EventBus receives `document.uploaded` with `source: 'SOCIAL'`, full payload (documentId, category, mimeType, title, uploadedById, sizeBytes, sourceUrl, version=1, isPublic), and propagated `correlationId`. As EMPLOYEE/MANAGER → 403. Empty file → 400 `EmptyFile`. Oversize → 400 `FileTooLarge`. Bad MIME → 400 `UnsupportedMimeType`. Storage write failure (simulated by injecting a failing `DocumentStorage`) → 503 `StorageUnavailable` with NO row and NO event.

### Tests for User Story 1

> **Write FIRST — ensure they FAIL before implementation begins**

- [X] T008 [P] [US1] Write failing unit tests for `DocumentsService.create`: happy path persists row with `version = 1`, calls `DocumentStorage.put` exactly once with a server-derived key, emits `document.uploaded` once with the full FR-020 payload (documentId, category, mimeType, title, uploadedById, sizeBytes, sourceUrl, version, isPublic) and `metadata.correlationId`; storage write failure short-circuits before the Prisma write and re-throws as `ServiceUnavailableException` (`StorageUnavailable`); EventBus throw does NOT roll back the persisted row — in `apps/social/src/modules/documents/documents.service.spec.ts`
- [X] T009 [P] [US1] Write failing unit tests for input validation paths: `file === undefined` → 400 `MissingFile`; `file.size === 0` → 400 `EmptyFile`; `file.size > DOCUMENT_MAX_SIZE_BYTES` → 400 `FileTooLarge`; `file.mimetype` not in the whitelist → 400 `UnsupportedMimeType`; whitelist values from config (override default with one extra MIME, verify accepted) — in `apps/social/src/modules/documents/documents.service.spec.ts`
- [X] T010 [P] [US1] Write failing unit tests for `FilesystemDocumentStorage`: `put` writes to the resolved absolute path inside the root; `put` with a key that resolves outside the root throws `StorageWriteError`; `get` returns a readable stream; `exists` returns false after `delete`; `delete` of a missing key resolves silently — in `apps/social/src/modules/documents/storage/filesystem-document-storage.service.spec.ts`

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement `CreateDocumentDto` in `apps/social/src/modules/documents/dto/create-document.dto.ts`: `title` `@IsString @MinLength(1) @MaxLength(200)`, `category` `@IsEnum(DocumentCategory)`, `description` `@IsOptional @IsString @MaxLength(2000)`, `isPublic` `@IsOptional @Transform(({ value }) => value === 'true' || value === true) @IsBoolean` (multipart strings); add `@ApiProperty` decorators so the Swagger UI renders the form fields
- [X] T012 [US1] Implement `DocumentsService.create(user, dto, file, correlationId)` in `apps/social/src/modules/documents/documents.service.ts`: validate `file !== undefined` (else `BadRequestException('MissingFile')`); validate `file.size > 0` (else `EmptyFile`); validate `file.size <= DOCUMENT_MAX_SIZE_BYTES` (else `FileTooLarge`); validate `file.mimetype ∈ whitelist` (else `UnsupportedMimeType`); generate `documentId = randomUUID()`; build `sourceUrl = documents/${documentId}/v1/${sanitizeFilename(file.originalname)}`; call `DocumentStorage.put(sourceUrl, file.buffer, file.mimetype)` — on throw rethrow as `ServiceUnavailableException('StorageUnavailable')`; `prisma.document.create({ data: { id: documentId, title, description, category, sourceUrl, mimeType: file.mimetype, sizeBytes: BigInt(file.size), uploadedById: user.employeeId, version: 1, isPublic: dto.isPublic ?? true } })`; emit `document.uploaded` event via `eventBus.emit({ id: randomUUID(), type: 'document.uploaded', source: 'SOCIAL', timestamp: new Date(), payload: { documentId, category, mimeType, title, uploadedById, sizeBytes: Number(persisted.sizeBytes), sourceUrl, version: 1, isPublic }, metadata: { userId: user.sub, correlationId: correlationId ?? randomUUID() } })` — wrap in try/catch and log if it throws; return the enriched `DocumentResponse` (use `enrichWithUploader` from T016)
- [X] T013 [US1] Implement `DocumentsController.create` in `apps/social/src/modules/documents/documents.controller.ts`: `@Post()`, `@Roles('HR_ADMIN')`, `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: <DOCUMENT_MAX_SIZE_BYTES from ConfigService> } }))`, `@ApiConsumes('multipart/form-data')`, `@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string' }, category: { type: 'string', enum: [...DocumentCategory] }, description: { type: 'string' }, isPublic: { type: 'boolean' } }, required: ['file', 'title', 'category'] } })`, `@ApiResponse(201/400/403/503)`; signature: `create(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: CreateDocumentDto, @Req() request: Request)` — pull `correlationId = request['correlationId']`; add `@ApiTags('Documents')` on the class

**Checkpoint**: US1 independently testable. `curl -X POST` from quickstart §6.1 returns 201 with metadata; the file appears at `apps/social/storage/documents/<id>/v1/<sanitized>`; an EventBus subscriber receives `document.uploaded`. All T008–T010 tests pass.

---

## Phase 4: User Story 2 — Employees Browse the Document Library (Priority: P1)

**Goal**: Any authenticated user can `GET /documents` and `GET /documents/:id` to discover the library. EMPLOYEE/MANAGER/EXECUTIVE see only `isPublic = true` rows; HR_ADMIN sees all. Category filter, case-insensitive title search, and page-based pagination work. Uploader names are batched-enriched via `HrCoreClient.getEmployeeRef` with the existing TTL cache.

**Independent Test**: Seed 3 documents — 2 public (different categories) and 1 private. EMPLOYEE `GET /documents` returns 2 (both public). HR_ADMIN `GET /documents` returns 3. `GET /documents?category=INTERNAL_POLICY` filters correctly. `GET /documents?search=leave` returns case-insensitively matching titles only. EMPLOYEE `GET /documents/<private-id>` → 404 (not 403). HR_ADMIN `GET /documents/<private-id>` → 200.

### Tests for User Story 2

> **Write FIRST — ensure they FAIL before implementation begins**

- [X] T014 [P] [US2] Write failing unit tests for `DocumentsService.findAll`: EMPLOYEE caller — Prisma `where` includes `isPublic: true`; HR_ADMIN caller — `isPublic` filter absent; `?category=...` adds `category: X` to the where; `?search=foo` adds `title: { contains: 'foo', mode: 'insensitive' }`; pagination: `pageSize > 100` is capped to 100 silently; sort is `createdAt: 'desc', id: 'asc'`; uploader enrichment de-duplication — a page with 20 rows from 5 distinct uploaders calls `HrCoreClient.getEmployeeRef` exactly 5 times — in `apps/social/src/modules/documents/documents.service.spec.ts`
- [X] T015 [P] [US2] Write failing unit tests for `DocumentsService.findOne`: row exists + `isPublic=true` + any role → 200 with uploader enrichment; row exists + `isPublic=false` + EMPLOYEE → throws `NotFoundException('DocumentNotFound')` (NOT `ForbiddenException`); row exists + `isPublic=false` + HR_ADMIN → 200; row missing → `NotFoundException('DocumentNotFound')` — in `apps/social/src/modules/documents/documents.service.spec.ts`

### Implementation for User Story 2

- [X] T016 [P] [US2] Implement `ListDocumentsQueryDto` in `apps/social/src/modules/documents/dto/list-documents-query.dto.ts`: `page` `@IsOptional @Type(() => Number) @IsInt @Min(1)` default 1; `pageSize` `@IsOptional @Type(() => Number) @IsInt @Min(1) @Max(100)` default 20; `category` `@IsOptional @IsEnum(DocumentCategory)`; `search` `@IsOptional @IsString @MaxLength(200)`; `includePrivate` `@IsOptional @Transform(({ value }) => value === 'true') @IsBoolean` (HR_ADMIN-only — silently ignored for non-admins by the service)
- [X] T017 [US2] Implement `DocumentsService.findAll(user, query)` and `enrichWithUploader(rows, context)` in `apps/social/src/modules/documents/documents.service.ts`: build `where = { ...(isAdmin ? {} : { isPublic: true }), ...(query.category ? { category: query.category } : {}), ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}) }`; `[items, total] = await prisma.$transaction([prisma.document.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page-1)*pageSize, take: pageSize }), prisma.document.count({ where })])`; pass `items` through `enrichWithUploader` which de-duplicates `uploadedById` values, calls `HrCoreClient.getEmployeeRef(id, { jwt: user.jwt, correlationId })` once per unique id, swallows 404 to `uploadedBy: null`; build `{ items: items.map(serialize), total, page, pageSize }`; serializer projects `{ id, firstName, lastName, employeeCode }` from `EmployeeRef` and converts `sizeBytes: BigInt → number`
- [X] T018 [US2] Implement `DocumentsService.findOne(user, id)` in the same service file: `row = await prisma.document.findUnique({ where: { id } })`; if `!row` → `NotFoundException('DocumentNotFound')`; if `!row.isPublic && !isAdmin` → `NotFoundException('DocumentNotFound')` (same code — no existence leak); enrich uploader; return `DocumentResponse`
- [X] T019 [US2] Add `@Get()` (`@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE')`) and `@Get(':id')` (same roles) to `apps/social/src/modules/documents/documents.controller.ts`: `findAll(@CurrentUser() user, @Query() query: ListDocumentsQueryDto)`, `findOne(@CurrentUser() user, @Param('id', new ParseUUIDPipe()) id)`; `@ApiResponse(200/404)` on `:id`; `@ApiResponse(200)` on the list

**Checkpoint**: US1 + US2 independently testable. Quickstart §6.3, §6.4, §6.5 curl scenarios pass. Visibility tests T014–T015 pass.

---

## Phase 5: User Story 3 — Users Download a Document (Priority: P1)

**Goal**: `GET /documents/:id/download` streams the file with `Content-Type`, `Content-Length`, and `Content-Disposition: attachment` headers. The endpoint accepts a SYSTEM JWT (`@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE','SYSTEM')`) which bypasses the `isPublic` visibility filter — used by AI Agentic's RAG worker. A missing file behind a present row returns 410 `DocumentFileMissing`.

**Independent Test**: Public PDF → any role downloads → byte-identical content (SHA-256 match). Private PDF → EMPLOYEE → 404. Private PDF → HR_ADMIN → 200. Private PDF → SYSTEM JWT → 200. Public PDF whose storage file is manually deleted → 410. SYSTEM JWT signed by `SYSTEM_JWT_SECRET` (distinct from `JWT_SECRET`) is accepted by the shared JWT guard.

### Tests for User Story 3

> **Write FIRST — ensure they FAIL before implementation begins**

- [X] T020 [P] [US3] Write failing unit tests for `DocumentsService.download`: public doc + EMPLOYEE → returns `{ stream, mimeType, sizeBytes, filename }`; private doc + EMPLOYEE → throws `NotFoundException('DocumentNotFound')`; private doc + HR_ADMIN → returns the bundle; private doc + SYSTEM JWT (`user.roles.includes('SYSTEM')`) → returns the bundle (visibility bypassed); row exists but `DocumentStorage.exists(sourceUrl)` returns false → throws `GoneException('DocumentFileMissing')`; filename uses `sanitizeFilename(title) + mimeToExtension(mimeType)` — in `apps/social/src/modules/documents/documents.service.spec.ts`

### Implementation for User Story 3

- [X] T021 [US3] Implement `DocumentsService.download(user, id)` in `apps/social/src/modules/documents/documents.service.ts`: row lookup; visibility check `!row.isPublic && !isAdmin && !isSystem` → `NotFoundException('DocumentNotFound')` where `isSystem = user.roles?.includes('SYSTEM')`; if `!(await storage.exists(row.sourceUrl))` → `GoneException('DocumentFileMissing')`; return `{ stream: await storage.get(row.sourceUrl), mimeType: row.mimeType, sizeBytes: Number(row.sizeBytes), filename: sanitizeFilename(row.title) + mimeToExtension(row.mimeType) }`
- [X] T022 [US3] Implement `DocumentsController.download` in `apps/social/src/modules/documents/documents.controller.ts`: `@Get(':id/download')`, `@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE','SYSTEM')`, `@ApiResponse(200/404/410)`; signature: `download(@CurrentUser() user, @Param('id', new ParseUUIDPipe()) id, @Res({ passthrough: false }) res: Response)` — call service, set `res.setHeader('Content-Type', mimeType)`, `res.setHeader('Content-Length', sizeBytes)`, `res.setHeader('Content-Disposition', \`attachment; filename="${filename}"\`)`, then `stream.pipe(res)`

**Checkpoint**: US1+US2+US3 testable. Quickstart §6.6 SHA-256 match passes. Private-doc 404 (not 403) confirmed for EMPLOYEE.

---

## Phase 6: User Story 4 — HR Admin Edits Documents with Automatic Version Bump (Priority: P2)

**Goal**: `PATCH /documents/:id` with metadata only → 200, `version` unchanged, NO event. `PATCH` with a new `file` → 200, `version` increments by 1, new file persisted at the new versioned key, old file best-effort deleted, fresh `document.uploaded` event emitted with the new `version`.

**Independent Test**: Upload doc (version 1). PATCH with `{ title: 'new' }` only → version stays 1, no event emitted (EventBus spy stays empty). PATCH with new file → version becomes 2, new file at `v2/...`, old file gone, EventBus receives a fresh `document.uploaded` with `version: 2`. PATCH with empty file → 400 `EmptyFile`. PATCH with bad MIME → 400 `UnsupportedMimeType`. PATCH as MANAGER → 403.

### Tests for User Story 4

> **Write FIRST — ensure they FAIL before implementation begins**

- [X] T023 [P] [US4] Write failing unit tests for `DocumentsService.update`: metadata-only PATCH (file undefined) — Prisma update on title/description/category/isPublic, `version` unchanged, EventBus emit NOT called; file-replacement PATCH — new `sourceUrl` with `v{N+1}` prefix, `version` increments, `mimeType`/`sizeBytes` refreshed, `DocumentStorage.put` called with new key, old `sourceUrl` deleted via `storage.delete` (failure is logged but does NOT throw), exactly one `document.uploaded` event emitted with `version: N+1` and the new metadata; bad MIME on PATCH → 400, row unchanged; immutable fields in body (`id`, `uploadedById`, `version`, `sourceUrl`, `mimeType`, `sizeBytes`) are silently ignored by `whitelist: true` ValidationPipe — in `apps/social/src/modules/documents/documents.service.spec.ts`

### Implementation for User Story 4

- [X] T024 [P] [US4] Implement `UpdateDocumentDto` in `apps/social/src/modules/documents/dto/update-document.dto.ts`: all fields optional — `title` `@IsOptional @IsString @MinLength(1) @MaxLength(200)`, `description` `@IsOptional @IsString @MaxLength(2000)`, `category` `@IsOptional @IsEnum(DocumentCategory)`, `isPublic` `@IsOptional @Transform(({ value }) => value === 'true' || value === true) @IsBoolean`; rely on the global `ValidationPipe({ whitelist: true })` to drop immutable fields
- [X] T025 [US4] Implement `DocumentsService.update(user, id, dto, file, correlationId)` in `apps/social/src/modules/documents/documents.service.ts`: row lookup (404 `DocumentNotFound`); if `file` present: validate `EmptyFile` / `FileTooLarge` / `UnsupportedMimeType` (reuse the helper from create); `newVersion = row.version + 1`; `newSourceUrl = documents/${id}/v${newVersion}/${sanitizeFilename(file.originalname)}`; `DocumentStorage.put(newSourceUrl, file.buffer, file.mimetype)` — wrap throw as `StorageUnavailable`; `prisma.document.update({ where: { id }, data: { ...dto, version: newVersion, sourceUrl: newSourceUrl, mimeType: file.mimetype, sizeBytes: BigInt(file.size) } })`; best-effort `storage.delete(row.sourceUrl).catch(err => logger.warn('orphan file', err))`; emit `document.uploaded` with new `version` (same payload shape as create); if `file` absent: `prisma.document.update({ where: { id }, data: dto })` — no event; return enriched response
- [X] T026 [US4] Add `@Patch(':id')` to `apps/social/src/modules/documents/documents.controller.ts`: `@Roles('HR_ADMIN')`, `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: <max> } }))`, `@ApiConsumes('multipart/form-data')`, `@ApiResponse(200/400/403/404/503)`; signature mirrors `create`, with `file` optional

**Checkpoint**: US1–US4 testable. Quickstart §6.7 (metadata only, no version bump) and §6.8 (file replacement, version bump + new event) both pass. T023 tests pass.

---

## Phase 7: User Story 5 — HR Admin Deletes Documents (Priority: P2)

**Goal**: `DELETE /documents/:id` hard-deletes the row, best-effort removes the storage file, and emits `document.deleted` so AI Agentic can prune its `VectorDocument` rows.

**Independent Test**: HR_ADMIN `DELETE` → 204; subsequent `GET /documents/:id` → 404; the storage file is gone; EventBus spy receives `document.deleted` with payload `{ documentId, category, uploadedById }`. MANAGER `DELETE` → 403. Storage delete failure (mock throw) does NOT roll back the DB delete — the event still fires.

### Tests for User Story 5

> **Write FIRST — ensure they FAIL before implementation begins**

- [X] T027 [P] [US5] Write failing unit tests for `DocumentsService.remove`: happy path — `prisma.document.delete` called, `DocumentStorage.delete(sourceUrl)` called, `document.deleted` event emitted exactly once with `{ documentId, category, uploadedById }`; storage delete throw is logged but does NOT propagate and the event STILL fires; row missing → 404 `DocumentNotFound`; non-HR_ADMIN reaching the service (defense in depth if guard fails) returns 403 — in `apps/social/src/modules/documents/documents.service.spec.ts`

### Implementation for User Story 5

- [X] T028 [US5] Implement `DocumentsService.remove(user, id, correlationId)` in `apps/social/src/modules/documents/documents.service.ts`: row lookup (404); `prisma.document.delete({ where: { id } })`; best-effort `storage.delete(row.sourceUrl).catch(err => logger.warn('orphan file on delete', err))`; emit `document.deleted` with `payload: { documentId: row.id, category: row.category, uploadedById: row.uploadedById }`, `source: 'SOCIAL'`, `metadata: { userId: user.sub, correlationId: correlationId ?? randomUUID() }`; return void
- [X] T029 [US5] Add `@Delete(':id')` to `apps/social/src/modules/documents/documents.controller.ts`: `@Roles('HR_ADMIN')`, `@HttpCode(204)`, `@ApiResponse(204/403/404)`

**Checkpoint**: US1–US5 testable. Quickstart §6.9 returns 204; row + file are gone; `document.deleted` event observed.

---

## Phase 8: User Story 6 — Frontend Document Library Page (Priority: P2)

**Goal**: `/documents` route shows a searchable, category-filterable card grid. HR_ADMIN sees the upload button and per-card edit/delete controls. EMPLOYEE/MANAGER/EXECUTIVE see only the public library. Search is debounced. Downloads trigger a browser file save.

**Independent Test**: Navigate to `/documents` as EMPLOYEE → page renders with public docs only, no upload button. As HR_ADMIN → upload button visible; clicking opens modal; submitting POSTs and the list invalidates; the new card appears. Search "leave" → query refetches with the param and the list updates. Click a category chip → query refetches with `category=...`. Click "Download" → browser saves the file. Click "Edit" as HR_ADMIN → modal opens prefilled; submitting without a file PATCHes metadata only; submitting with a file bumps version.

*No Jest unit tests required — correctness verified by running the page as each role and exercising quickstart §10.*

### Implementation for User Story 6

- [X] T030 [P] [US6] Extend `apps/web/src/lib/api/social.ts` with the documents surface: `DocumentCategory` enum (mirrors backend), `DocumentUploader`, `DocumentResponse`, `DocumentListResponse` interfaces (no `any`); `listDocuments(params: { page?: number; pageSize?: number; category?: DocumentCategory; search?: string }): Promise<DocumentListResponse>`; `getDocument(id: string): Promise<DocumentResponse>`; `createDocument(formData: FormData): Promise<DocumentResponse>` (Axios POST with `Content-Type: multipart/form-data` header omitted so the browser sets the boundary); `updateDocument(id: string, formData: FormData): Promise<DocumentResponse>`; `deleteDocument(id: string): Promise<void>`; `downloadDocument(id: string, filename: string): Promise<void>` — fetches the blob via the existing authenticated `socialClient`, creates an object URL, programmatically clicks a hidden anchor with `download={filename}`, revokes the URL; extend the existing `extractApiError` map (or add a documents-scoped map) with the codes from FR-031: `UnsupportedMimeType`, `FileTooLarge`, `EmptyFile`, `MissingFile`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`
- [X] T031 [US6] Implement `apps/web/src/pages/documents.tsx`: `useQuery(['documents', { page, pageSize, category, search }], () => listDocuments({ page, pageSize, category, search }))`; search input with `useDebouncedValue(input, 300)` before it enters the query key; category chip row (one per `DocumentCategory` value plus an "All" reset chip — exactly zero or one chip active at a time); card grid with `title`, category `Badge`, uploader name (or "Unknown" when `uploadedBy === null`), upload date (`toLocaleDateString`), human-readable size (e.g., `1.2 MB`), and a "Download" button calling `downloadDocument(doc.id, \`${doc.title}${extFromMime(doc.mimeType)}\`)`; "Upload document" button gated on `getRoleTier(user) === 'hr_admin'` opens a `Dialog` with `<input type="file">`, title `Input`, description `Textarea`, category `Select`, isPublic `Switch` (default true); submit builds `FormData` and calls `useMutation(createDocument, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }) })`; HR_ADMIN per-card "Edit" opens an edit modal prefilled with the doc's metadata (file input optional); HR_ADMIN per-card "Delete" opens a confirm `AlertDialog` and calls `useMutation(deleteDocument)`; `onError` mapping for every FR-031 code with a generic "Failed to complete the action. Please try again." fallback; empty state shows "No documents yet" centered with the upload button highlighted for HR_ADMIN
- [X] T032 [US6] Register `<Route path="/documents" component={DocumentsPage} />` inside the authenticated `<Layout>` wrapper in `apps/web/src/App.tsx`
- [X] T033 [US6] Add `{ label: 'Documents', href: '/documents', icon: FileText }` to `ALL_MAIN_NAV` array in `apps/web/src/components/layout.tsx` (no `minTier` gate — visible to all authenticated users)

**Checkpoint**: SC-001, SC-009 pass manual browser test. Role-gate scenarios verified at `/documents` for EMPLOYEE, MANAGER, HR_ADMIN. Download triggers a file save.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, integration test, and smoke-test sign-off.

- [X] T034 [P] Write integration test in `apps/social/test/integration/documents.integration.spec.ts` against the real `social_test` schema with a tempdir-backed `FilesystemDocumentStorage`: POST a known PDF → 201 + row + file on disk + `document.uploaded` event; GET list as EMPLOYEE vs HR_ADMIN with a mix of public/private docs; GET download SHA-256 matches the original (SC-003); PATCH with a new file → version 2 + new file path + fresh event (SC-006); DELETE → row + file gone + `document.deleted` event
- [X] T035 [P] Audit Swagger doc — start Social service (`turbo dev --filter=social`), open `http://localhost:3002/api/docs`, confirm the `Documents` tag contains exactly 6 endpoints with correct `@ApiConsumes('multipart/form-data')` declarations on POST and PATCH, and all response codes (200/201/204/400/403/404/410/503 where applicable); fix any missing `@ApiResponse` decorators in `apps/social/src/modules/documents/documents.controller.ts`
- [X] T036 [P] Audit `apps/web/src/lib/api/social.ts` frontend↔backend coherence: confirm every FR-031 error code has a string-match case in `extractApiError` (or the documents-scoped equivalent) and that the `DocumentResponse` TypeScript interface exactly mirrors the backend serializer (no extra fields, no missing fields, `sizeBytes: number`, `uploadedBy: DocumentUploader | null`)
- [ ] T037 Run quickstart.md curl smoke tests §6.1–§6.9 and §7.1–§7.6 end-to-end; verify SC-004 (page of 20 docs with 5 unique uploaders cold-cache → ≤ 5 HR Core calls; warm-cache → 0), SC-010 (re-running `npx prisma migrate dev` from `apps/social/` reports "no pending migrations"), SC-011 (AI Agentic side: if the RAG worker is wired, verify a `VectorDocument` row appears with `metadata.documentId` matching the uploaded doc — otherwise just confirm the SYSTEM-JWT download succeeds in isolation)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) — immediate start
    ↓
Phase 2 (Foundational) — blocks ALL stories
    T003 (migration) → T004, T005, T006, T007 [parallel]
    ↓
Phase 3 (US1) — POST upload + event emission
    ↓
Phase 4 (US2) — GET list + GET /:id   ─┐
Phase 5 (US3) — GET /:id/download      ├── can run in parallel after Phase 3
                                       ─┘
    ↓
Phase 6 (US4) — PATCH with version bump
    ↓
Phase 7 (US5) — DELETE
    ↓ (US6 depends on US1 at minimum; benefits from US2–US5 for full UX)
Phase 8 (US6) — Frontend page
    ↓
Phase 9 (Polish)
```

### User Story Dependencies

| Story | Depends on | Can parallel with |
|-------|-----------|-------------------|
| US1 (P1) | Phase 2 complete | — |
| US2 (P1) | US1 (service skeleton) | US3 |
| US3 (P1) | US1 (service skeleton) | US2 |
| US4 (P2) | US1, US2 (uses same service + visibility check pattern) | US5 |
| US5 (P2) | US1 (service skeleton + event-bus pattern) | US4 |
| US6 (P2) | US1 at minimum (upload UX); full page wants US2–US5 | — |

### Within Each User Story

- Test tasks (`T008–T010`, `T014–T015`, `T020`, `T023`, `T027`) **MUST** be written and FAIL before their corresponding implementation tasks.
- DTOs marked `[P]` touch different files — run in parallel.
- Service methods extend the same `documents.service.ts` — sequential within / across stories.
- Controller methods extend the same `documents.controller.ts` — sequential within / across stories.

### Parallel Opportunities

- T004, T005, T006, T007 in Phase 2 (different files — can run together after T003)
- T008, T009, T010 in US1 tests (different test concerns / files — can write simultaneously)
- T011 (DTO) in US1 is parallelizable with T008–T010
- T014, T015 in US2 tests (different test concerns) and T016 (DTO) in US2 impl can run in parallel
- US2 + US3 can run in parallel after US1's service skeleton lands (they touch different service methods)
- US4 + US5 can run in parallel after US2's findOne pattern is established
- T030, T032, T033 in US6 are parallelizable with T031 (separate files); T031 depends on T030 (uses the new API functions)
- T034, T035, T036 in Phase 9 are independent files / concerns

---

## Parallel Example: User Story 1

```bash
# Step 1 — Write all US1 tests together (let them fail):
T008: DocumentsService.create unit tests (happy path, event emission, rollback)
T009: Input validation unit tests (MissingFile/EmptyFile/FileTooLarge/UnsupportedMimeType)
T010: FilesystemDocumentStorage unit tests (put/get/delete/exists, traversal guard)

# Step 2 — Once tests are failing, implement the DTO in parallel with the storage:
T011: CreateDocumentDto

# Step 3 — Service (T012) must complete before controller (T013):
T012: DocumentsService.create → T013: DocumentsController.create
```

---

## Implementation Strategy

### MVP First (P1 stories — US1 + US2 + US3)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — CRITICAL
3. Complete Phase 3 (US1) — upload + event emission
4. Complete Phase 4 (US2) — list + detail with visibility
5. Complete Phase 5 (US3) — download (browser + SYSTEM JWT)
6. **STOP and VALIDATE**: Run quickstart §6.1–§6.6 + §8.1–§8.4 + §7.1–§7.6
7. Deployable MVP — full RAG-feeding upload path + complete read-side library

### Incremental Delivery

| Step | Phases | Deliverable |
|------|--------|-------------|
| 1 | 1–2 | Foundation + schema + storage abstraction |
| 2 | 3 | Upload works → **AI Agentic RAG can start ingesting** |
| 3 | 4–5 | List + detail + download → **library is browsable + downloadable** (MVP) |
| 4 | 6–7 | Edit with version bump + delete → **full lifecycle** |
| 5 | 8 | Frontend page → **users can self-serve** |
| 6 | 9 | Polish → **feature sign-off** |

### Parallel Team Strategy

After Phase 2 (Foundational) completes:
- **Dev A**: US1 (upload + event), then US4 (edit + version bump — extends same service)
- **Dev B**: After US1's service skeleton is mergeable, US2 (list + detail) in parallel with Dev A's US4
- **Dev C**: US3 (download with SYSTEM JWT) in parallel with Dev B's US2 (different service methods)
- **Dev D**: Frontend (US6) starts once Dev A finishes US1 — the upload modal can be built against the live POST while US2/US3/US4/US5 are still in flight; full read/edit/delete UX completes when those land

---

## Task Count Summary

| Phase | Tasks | Tests | Impl |
|-------|-------|-------|------|
| 1: Setup | 2 | 0 | 2 |
| 2: Foundational | 5 | 0 | 5 |
| 3: US1 (P1) | 6 | 3 | 3 |
| 4: US2 (P1) | 6 | 2 | 4 |
| 5: US3 (P1) | 3 | 1 | 2 |
| 6: US4 (P2) | 4 | 1 | 3 |
| 7: US5 (P2) | 3 | 1 | 2 |
| 8: US6 (P2) | 4 | 0 | 4 |
| 9: Polish | 4 | 1 | 3 |
| **Total** | **37** | **9** | **28** |

---

## Notes

- `[P]` tasks touch different files — no write conflicts when run in parallel
- Error codes use spec FR names throughout (`UnsupportedMimeType`, `FileTooLarge`, `EmptyFile`, `MissingFile`, `StorageUnavailable`, `DocumentNotFound`, `DocumentFileMissing`)
- `source: 'SOCIAL'` (uppercase) — same convention as the 013 announcements module
- `getRoleTier(user)` is the page-level layout gate; `user.roles.includes('HR_ADMIN')` is acceptable for per-card inline RBAC checks
- Uploader enrichment: de-duplicate `uploadedById` values before calling `HrCoreClient.getEmployeeRef` — max 1 HR Core call per unique uploader per page (SC-004)
- Storage operations are best-effort outside the DB transaction: a `DocumentStorage.put` failure aborts the write BEFORE the DB insert (no orphan row); a `DocumentStorage.delete` failure on PATCH/DELETE is logged but does NOT roll back the DB change (orphan file is acceptable)
- `document.uploaded` event is emitted from both POST and version-bumping PATCH paths — same event type, distinguished by `version` field
- `document.deleted` event is added on top of the user's prompt — costs ~zero and gives AI Agentic the signal it needs to prune `VectorDocument` rows
- SYSTEM JWT is only honored on `GET /documents/:id/download` — every other endpoint's `@Roles(...)` list excludes `'SYSTEM'`
- `sourceUrl` is intentionally excluded from API response shapes — it's an opaque internal storage key. Clients identify documents only by `id`
- The `apps/social/src/modules/documents/` directory does not yet exist; T001 creates it. The `apps/social/src/modules/announcements/` directory was created by feature 013 and provides the file layout precedent to copy from
- File-upload size cap is enforced at two layers: `FileInterceptor`'s `limits.fileSize` (raises `PayloadTooLargeException` automatically — translate to `FileTooLarge` in an exception filter or handle in the service before the route runs) AND an explicit `file.size > max` check in `DocumentsService.create/update` (defense in depth)
- The `Authorization` header is forwarded by the existing axios `socialClient` interceptor in `apps/web/src/lib/api/client.ts` — no per-request token wiring needed in the documents frontend functions
