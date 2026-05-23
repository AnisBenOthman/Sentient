# Domain Event Contracts: 014-Documents Module

**Service**: Social (port 3002) | **Date**: 2026-05-23

---

## document.uploaded

Emitted immediately after a new document is persisted AND the file is confirmed on storage (POST), or after a successful version-bumping PATCH (i.e., a PATCH that included a new `file`).

**Type**: `DomainEvent<DocumentUploadedPayload>` (from `@sentient/shared`)

**Full event shape**:
```typescript
interface DocumentUploadedEvent {
  id: string;                     // randomUUID() — unique event ID
  type: 'document.uploaded';
  source: 'SOCIAL';               // UPPERCASE — matches ServiceName.SOCIAL
  timestamp: Date;                // new Date() at emit time
  payload: DocumentUploadedPayload;
  metadata: {
    userId: string;               // jwt.sub of the HR_ADMIN who published / re-uploaded
    correlationId: string;        // from CorrelationIdMiddleware header
  };
}

interface DocumentUploadedPayload {
  documentId: string;
  category: DocumentCategory;     // 'INTERNAL_POLICY' | 'HANDBOOK' | 'REGULATION' | 'TEMPLATE' | 'GUIDE' | 'OTHER'
  mimeType: string;
  title: string;
  uploadedById: string;           // Employee.id
  sizeBytes: number;              // serialized from BigInt — bounded by 25 MiB upload cap
  sourceUrl: string;              // opaque storage key — consumer fetches via GET /documents/:id/download
  version: number;                // 1 on initial upload, N+1 on version-bumping PATCH
  isPublic: boolean;
}
```

**Trigger**:
- `DocumentsService.create()` — after the DB INSERT commits and `DocumentStorage.put` resolves.
- `DocumentsService.update()` — after the DB UPDATE commits, the new file write completes, and the old-file delete is best-effort attempted. Only when the PATCH included a new `file`. Metadata-only PATCHes do NOT emit any event.

**Consumer**: AI Agentic — the RAG worker subscribes to `document.uploaded` and:
1. Mints a SYSTEM JWT via `AgentContextFactory.forSystemTask({ taskType: 'rag_indexing' })`.
2. Calls `GET /documents/:id/download` with the SYSTEM JWT to fetch the bytes.
3. Chunks + embeds the content and inserts `VectorDocument` rows with `sourceType = 'INTERNAL_POLICY'` and a back-reference to `documentId` + `version`.
4. On `version > 1`, deletes any prior `VectorDocument` rows with the same `documentId` before inserting the new chunks (re-index semantics).

**Emit pattern** (mirrors announcements + HR Core convention):
```typescript
await this.eventBus.emit({
  id: randomUUID(),
  type: 'document.uploaded',
  source: 'SOCIAL',
  timestamp: new Date(),
  payload: {
    documentId: persisted.id,
    category: persisted.category,
    mimeType: persisted.mimeType,
    title: persisted.title,
    uploadedById: persisted.uploadedById,
    sizeBytes: Number(persisted.sizeBytes),
    sourceUrl: persisted.sourceUrl,
    version: persisted.version,
    isPublic: persisted.isPublic,
  },
  metadata: {
    userId: user.sub,
    correlationId: correlationId ?? randomUUID(),
  },
});
```

**Delivery semantics**: Best-effort, in-process bus (Phase 1). Subscriber failures do NOT roll back the upload. Failed deliveries are logged but not retried.

---

## document.deleted

Emitted immediately after a successful hard delete of a document. Lets downstream consumers (AI Agentic vector store) prune indexes that back-reference the deleted `documentId`.

**Type**: `DomainEvent<DocumentDeletedPayload>` (from `@sentient/shared`)

**Full event shape**:
```typescript
interface DocumentDeletedEvent {
  id: string;
  type: 'document.deleted';
  source: 'SOCIAL';
  timestamp: Date;
  payload: DocumentDeletedPayload;
  metadata: {
    userId: string;               // jwt.sub of the HR_ADMIN who deleted
    correlationId: string;
  };
}

interface DocumentDeletedPayload {
  documentId: string;
  category: DocumentCategory;
  uploadedById: string;           // for downstream attribution / cleanup
}
```

**Trigger**: `DocumentsService.remove()` — after the DB DELETE commits. The best-effort file removal from storage happens before or alongside the emit; its outcome does NOT gate event emission.

**Consumer**: AI Agentic — the RAG worker subscribes to `document.deleted` and:
1. Deletes all `VectorDocument` rows with `metadata.documentId === payload.documentId`.
2. (Optional) Emits an `agent.task_log` entry for traceability.

**Emit pattern**:
```typescript
await this.eventBus.emit({
  id: randomUUID(),
  type: 'document.deleted',
  source: 'SOCIAL',
  timestamp: new Date(),
  payload: {
    documentId: removed.id,
    category: removed.category,
    uploadedById: removed.uploadedById,
  },
  metadata: {
    userId: user.sub,
    correlationId: correlationId ?? randomUUID(),
  },
});
```

---

## Events NOT Emitted by This Feature

- **Metadata-only PATCH** (no file replacement) — silent. The file bytes did not change, so the RAG pipeline has nothing to do.
- **Failed uploads** (MIME rejected, file too large, storage unavailable) — no event. The row was never persisted.
- **GET requests** — never emit events.

---

## Cross-Service Event Map

| Event | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `document.uploaded` | Social | AI Agentic | Trigger RAG chunk + embed + insert into `VectorDocument` |
| `document.deleted` | Social | AI Agentic | Trigger pruning of `VectorDocument` rows that back-reference the deleted document |

Both events are listed in the project's domain events catalog in `.claude/CLAUDE.md` §3.4 (Social emits → consumed by AI Agentic).
