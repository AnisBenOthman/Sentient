# Quickstart: 014-Documents Module

**Phase 1 output** | Branch: `014-documents-module` | Date: 2026-05-23

---

## 1. Prerequisites

- Docker Compose running (`docker compose up -d`)
- HR Core running on port 3001
- `@sentient/shared` built (`pnpm --filter @sentient/shared build`)
- Social service dependencies installed (`pnpm install`)
- A writable directory for document storage (default: `apps/social/storage/documents/`)

---

## 2. Configure Environment Variables

Add to `apps/social/.env` (or the project root `.env` if shared):

```env
# Documents module — file storage backend
DOCUMENT_STORAGE_PATH=./storage/documents        # relative to apps/social/, or absolute
DOCUMENT_MAX_SIZE_BYTES=26214400                  # 25 MiB
DOCUMENT_MIME_WHITELIST=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html
```

Verify:
```bash
cd apps/social
node -e "console.log(require('@nestjs/config').ConfigService)"   # sanity
```

---

## 3. Add `@types/multer` Dev Dependency

```bash
pnpm --filter @sentient/social add -D @types/multer
```

(`multer` itself ships transitively with `@nestjs/platform-express` — no runtime dependency to add.)

---

## 4. Run the Migration

```bash
cd apps/social
npx prisma migrate dev --name documents_add_is_public_flag
```

Expected output:
```
Applying migration `20260523_documents_add_is_public_flag`

The following migration(s) have been applied:
migrations/
  └─ 20260523_documents_add_is_public_flag/
    └─ migration.sql

Your database is now in sync with your schema.
```

Verify the new column and index exist:
```bash
psql -U postgres -d sentient -c "\d social.documents"
# Should list: isPublic boolean not null default true
# And the index: documents_isPublic_createdAt_idx
```

---

## 5. Start the Social Service

```bash
# From repo root
turbo dev --filter=social
```

Service starts on port 3002. Swagger UI at `http://localhost:3002/api/docs` — verify the **Documents** tag lists 6 endpoints, and the multipart POST/PATCH endpoints declare `multipart/form-data` in the request body schema.

---

## 6. Smoke Tests (curl)

Replace `<jwt>` with a valid JWT from HR Core (`POST /auth/login`).

### 6.1 Upload a PDF (HR_ADMIN)

```bash
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/path/to/leave-policy.pdf" \
  -F "title=Annual Leave Policy 2026" \
  -F "category=INTERNAL_POLICY" \
  -F "description=Updated for the new fiscal year." \
  -F "isPublic=true" | jq '.'
```

Expected: `201` with the new document's metadata. Note the `id`; the file should exist at `apps/social/storage/documents/<id>/v1/leave-policy.pdf`.

### 6.2 Upload as EMPLOYEE — Should be Forbidden

```bash
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <employee-jwt>" \
  -F "file=@/path/to/file.pdf" \
  -F "title=Should Fail" \
  -F "category=OTHER" \
  -o /dev/null -w "%{http_code}\n"
```

Expected: `403`.

### 6.3 List Documents (Audience-Filtered)

```bash
# As EMPLOYEE — sees only isPublic = true
curl -s "http://localhost:3002/documents?page=1&pageSize=20" \
  -H "Authorization: Bearer <employee-jwt>" | jq '.items | length'

# As HR_ADMIN — sees everything
curl -s "http://localhost:3002/documents?page=1&pageSize=20" \
  -H "Authorization: Bearer <hr-admin-jwt>" | jq '.items | length'
```

### 6.4 Filter by Category and Search

```bash
curl -s "http://localhost:3002/documents?category=INTERNAL_POLICY&search=leave" \
  -H "Authorization: Bearer <jwt>" | jq '.items[] | { title, category }'
```

### 6.5 Get Document by ID

```bash
DOC_ID="<id from step 6.1>"
curl -s "http://localhost:3002/documents/$DOC_ID" \
  -H "Authorization: Bearer <jwt>" | jq '.'
```

### 6.6 Download Document

```bash
curl -s "http://localhost:3002/documents/$DOC_ID/download" \
  -H "Authorization: Bearer <jwt>" \
  -o downloaded-policy.pdf

# Verify byte-identity
sha256sum /path/to/leave-policy.pdf downloaded-policy.pdf
# The two checksums must match.
```

### 6.7 Update Metadata Only (no version bump, no event)

```bash
curl -s -X PATCH "http://localhost:3002/documents/$DOC_ID" \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "title=Annual Leave Policy 2026 (revised)" | jq '{ title, version }'
```

Expected: `version` stays at 1.

### 6.8 Replace File (version bump, emits event)

```bash
curl -s -X PATCH "http://localhost:3002/documents/$DOC_ID" \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/path/to/leave-policy-v2.pdf" | jq '{ version, sizeBytes }'
```

Expected: `version` is now 2. File at `apps/social/storage/documents/<id>/v2/leave-policy-v2.pdf`. The v1 file is best-effort removed (check the storage directory).

### 6.9 Delete

```bash
curl -s -X DELETE "http://localhost:3002/documents/$DOC_ID" \
  -H "Authorization: Bearer <hr-admin-jwt>" -o /dev/null -w "%{http_code}\n"
```

Expected: `204`. The row is gone (`GET /documents/$DOC_ID` returns 404). The storage directory `apps/social/storage/documents/<id>/` is best-effort removed.

---

## 7. Error Code Verification

### 7.1 UnsupportedMimeType

```bash
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/path/to/image.jpg" \
  -F "title=Image" \
  -F "category=OTHER" | jq '.message'
```

Expected: `"UnsupportedMimeType"`

### 7.2 FileTooLarge

```bash
# Create a 30 MiB dummy file
dd if=/dev/zero of=/tmp/oversize.pdf bs=1M count=30 2>/dev/null

curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/tmp/oversize.pdf;type=application/pdf" \
  -F "title=Oversize" \
  -F "category=OTHER" | jq '.message'
```

Expected: `"FileTooLarge"`

### 7.3 EmptyFile

```bash
touch /tmp/empty.pdf
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/tmp/empty.pdf;type=application/pdf" \
  -F "title=Empty" \
  -F "category=OTHER" | jq '.message'
```

Expected: `"EmptyFile"`

### 7.4 MissingFile

```bash
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "title=No File" \
  -F "category=OTHER" | jq '.message'
```

Expected: `"MissingFile"`

### 7.5 DocumentNotFound

```bash
curl -s "http://localhost:3002/documents/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer <jwt>" | jq '.message'
```

Expected: `"DocumentNotFound"` with status `404`.

### 7.6 DocumentFileMissing

After uploading a document, manually delete the file from `apps/social/storage/documents/<id>/v1/`:

```bash
rm apps/social/storage/documents/<id>/v1/*
curl -s "http://localhost:3002/documents/<id>/download" \
  -H "Authorization: Bearer <jwt>" -o /dev/null -w "%{http_code}\n"
```

Expected: `410` with body `{ "message": "DocumentFileMissing" }`.

---

## 8. Visibility Verification

### 8.1 Upload a private document as HR_ADMIN

```bash
curl -s -X POST http://localhost:3002/documents \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -F "file=@/path/to/internal.pdf" \
  -F "title=Internal Only" \
  -F "category=INTERNAL_POLICY" \
  -F "isPublic=false" | jq '{ id, isPublic }'
```

### 8.2 EMPLOYEE list does NOT include the private doc

```bash
curl -s "http://localhost:3002/documents" \
  -H "Authorization: Bearer <employee-jwt>" \
  | jq '.items[] | select(.isPublic == false)'
```

Expected: empty (no rows).

### 8.3 EMPLOYEE direct GET on the private doc returns 404 (not 403)

```bash
PRIVATE_ID="<id from step 8.1>"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <employee-jwt>" \
  "http://localhost:3002/documents/$PRIVATE_ID"
```

Expected: `404`.

### 8.4 HR_ADMIN sees the private doc

```bash
curl -s "http://localhost:3002/documents/$PRIVATE_ID" \
  -H "Authorization: Bearer <hr-admin-jwt>" | jq '{ id, isPublic }'
```

---

## 9. Domain Event Verification

If a test subscriber is wired into the InMemoryEventBus (in development), verify `document.uploaded` fires on POST and version-bumping PATCH:

```typescript
// In a test or REPL context — inside the Social process
eventBus.subscribe('document.uploaded', (event) => {
  console.log('document.uploaded:', event);
  // Verify: event.source === 'SOCIAL'
  // Verify: event.payload.documentId is a UUID
  // Verify: event.payload.category is a DocumentCategory value
  // Verify: event.payload.version starts at 1 for POST, increments on file-replace PATCH
  // Verify: event.metadata.userId is the publisher's sub
  // Verify: event.metadata.correlationId is forwarded
});

eventBus.subscribe('document.deleted', (event) => {
  console.log('document.deleted:', event);
  // Verify payload: { documentId, category, uploadedById }
});
```

Then run the smoke flow (steps 6.1, 6.8, 6.9) and inspect the console output.

---

## 10. Frontend

```bash
# Start the web app
turbo dev --filter=web
```

Navigate to `http://localhost:3000/documents`:
- All authenticated users see a searchable, category-filterable list of public documents
- HR_ADMIN sees the "Upload document" button and per-card edit/delete controls; the upload modal accepts a file picker, title, description, category dropdown, and an isPublic toggle
- EMPLOYEE/MANAGER see only the list (no upload button, no edit/delete on cards)
- Clicking "Download" on a card triggers the browser file save with the original-extension filename
- The search input is debounced (~300 ms) before refetching
- Clicking a category chip filters the list; clicking the active chip clears the filter

---

## 11. AI Agentic Integration Check (Out of Scope but Verifiable)

After uploading a PDF and confirming `document.uploaded` fires, if AI Agentic's RAG worker is wired:
1. The worker should consume the event within a few seconds.
2. Inspect `VectorDocument` rows in the `ai_agent` schema:
   ```bash
   psql -U postgres -d sentient -c "SELECT id, source_type, metadata FROM ai_agent.vector_documents WHERE metadata->>'documentId' = '<DOC_ID>';"
   ```
3. Expect ≥ 1 row with `source_type = 'INTERNAL_POLICY'` and `metadata.documentId` matching the uploaded document.

If AI Agentic is not yet subscribed, no rows appear and that is acceptable for this feature's acceptance — the producer side (Social) is independently verifiable via the event bus subscriber pattern above.
