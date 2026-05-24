# Domain Event Contracts: 013-Announcements Module

**Service**: Social (port 3002) | **Date**: 2026-05-21

---

## announcement.published

Emitted immediately after a new announcement is persisted and `publishedAt` is set.

**Type**: `DomainEvent<AnnouncementPublishedPayload>` (from `@sentient/shared`)

**Full event shape**:
```typescript
interface AnnouncementPublishedEvent {
  id: string;                     // randomUUID() — unique event ID
  type: 'announcement.published';
  source: 'SOCIAL';               // UPPERCASE — matches ServiceName.SOCIAL
  timestamp: Date;                // new Date() at emit time
  payload: AnnouncementPublishedPayload;
  metadata: {
    userId: string;               // jwt.sub (User.id who published)
    correlationId: string;        // from CorrelationIdMiddleware header
  };
}

interface AnnouncementPublishedPayload {
  announcementId: string;
  audience: Audience;             // 'COMPANY' | 'DEPARTMENT' | 'TEAM'
  authorId: string;               // Employee.id
  targetDepartmentId: string | null;
  targetTeamId: string | null;
  title: string;                  // for downstream notification rendering
}
```

**Trigger**: `AnnouncementsService.create()` after successful Prisma write, inside the service method (not in the controller).

**Consumer**: AI Agentic service — HR Assistant agent subscribes to `announcement.published` for document ingestion into the RAG pipeline (per CLAUDE.md domain events catalog).

**Emit pattern** (mirrors HR Core convention):
```typescript
await this.eventBus.emit({
  id: randomUUID(),
  type: 'announcement.published',
  source: 'SOCIAL',
  timestamp: new Date(),
  payload: {
    announcementId: created.id,
    audience: created.audience,
    authorId: created.authorId,
    targetDepartmentId: created.targetDepartmentId,
    targetTeamId: created.targetTeamId,
    title: created.title,
  },
  metadata: {
    userId: user.sub,
    correlationId: correlationId ?? randomUUID(),
  },
});
```

---

## Notes

- No other domain events are emitted by this feature (edit, delete, pin do not emit events per spec).
- The `correlationId` is pulled from the `Request` object via `request['correlationId']` (set by `CorrelationIdMiddleware`).
- In Phase 1, the InMemoryEventBus in `apps/social/src/common/event-bus/in-memory-event-bus.ts` handles dispatch. Phase 2 will swap to Kafka transparently via the `IEventBus` interface.
