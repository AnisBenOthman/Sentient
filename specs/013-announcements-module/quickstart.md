# Quickstart: 013-Announcements Module

**Phase 1 output** | Branch: `013-announcements-module` | Date: 2026-05-21

---

## 1. Prerequisites

- Docker Compose running (`docker compose up -d`)
- HR Core running on port 3001
- Social service dependencies installed (`pnpm install`)

---

## 2. Run the Migration

```bash
# From repo root
cd apps/social
npx prisma migrate dev --name announcements_audience_targets_and_expiry
```

Expected output:
```
Applying migration `20260521_announcements_audience_targets_and_expiry`

The following migration(s) have been applied:
migrations/
  └─ 20260521_announcements_audience_targets_and_expiry/
    └─ migration.sql

Your database is now in sync with your schema.
```

Verify the new columns exist:
```bash
psql -U postgres -d sentient -c "\d social.announcements"
# Should show: targetDepartmentId, targetTeamId, expiresAt columns
```

---

## 3. Start the Social Service

```bash
# From repo root
turbo dev --filter=social
```

Service starts on port 3002.

---

## 4. Smoke Tests (curl)

Replace `<jwt>` with a valid JWT from HR Core (`POST /auth/login`).

### 4.1 Publish a COMPANY-wide announcement (HR_ADMIN)

```bash
curl -s -X POST http://localhost:3002/announcements \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Welcome to Sentient HRIS",
    "body": "We have launched the new HRIS platform. Please explore the features.",
    "audience": "COMPANY"
  }' | jq '.'
```

Expected: `201` with `author.firstName`, `audience: "COMPANY"`, `isPinned: false`.

### 4.2 List announcements (filtered by audience)

```bash
curl -s http://localhost:3002/announcements \
  -H "Authorization: Bearer <jwt>" | jq '.data | length'
```

Expected: Returns count matching announcements visible to this user's department/team.

### 4.3 Get announcement by ID

```bash
ANNOUNCEMENT_ID="<id from step 4.1>"
curl -s http://localhost:3002/announcements/$ANNOUNCEMENT_ID \
  -H "Authorization: Bearer <jwt>" | jq '.'
```

### 4.4 Pin an announcement (HR_ADMIN JWT required)

```bash
curl -s -X PATCH http://localhost:3002/announcements/$ANNOUNCEMENT_ID/pin \
  -H "Authorization: Bearer <hr-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"pinnedUntil": "2026-12-31T23:59:59.000Z"}' | jq '.isPinned'
```

Expected: `true`

### 4.5 Update announcement

```bash
curl -s -X PATCH http://localhost:3002/announcements/$ANNOUNCEMENT_ID \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}' | jq '.title'
```

Expected: `"Updated Title"`

### 4.6 Delete announcement

```bash
curl -s -X DELETE http://localhost:3002/announcements/$ANNOUNCEMENT_ID \
  -H "Authorization: Bearer <jwt>" -o /dev/null -w "%{http_code}"
```

Expected: `204`

---

## 5. Audience Filtering Verification

### 5.1 Publish a DEPARTMENT announcement as MANAGER

```bash
curl -s -X POST http://localhost:3002/announcements \
  -H "Authorization: Bearer <manager-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Standup Reminder",
    "body": "Daily standup at 9am in the Engineering channel.",
    "audience": "DEPARTMENT"
  }' | jq '.targetDepartmentId'
```

Expected: Returns the manager's `departmentId` from JWT (auto-filled).

### 5.2 Verify another department's employee cannot see it

```bash
# Login as employee from a different department and list announcements
curl -s http://localhost:3002/announcements \
  -H "Authorization: Bearer <other-dept-jwt>" | jq '.data[] | .audience'
```

Expected: Only `"COMPANY"` announcements visible; no `"DEPARTMENT"` announcements for wrong department.

---

## 6. Domain Event Verification

If InMemoryEventBus has a test subscriber wired (in development), verify `announcement.published` is emitted:

```typescript
// In a test or REPL context
eventBus.subscribe('announcement.published', (event) => {
  console.log('Event received:', event);
  // Verify: event.source === 'SOCIAL'
  // Verify: event.payload.announcementId is a UUID
  // Verify: event.payload.audience is 'COMPANY' | 'DEPARTMENT' | 'TEAM'
  // Verify: event.metadata.userId is the publisher's sub
});
```

---

## 7. Frontend

The frontend page lives at `apps/web/src/pages/announcements.tsx`, accessible via `/announcements` route.

```bash
# Start the web app
turbo dev --filter=web
```

Navigate to `http://localhost:3000/announcements`:
- All users see audience-filtered list; pinned items appear at top
- HR_ADMIN sees the "New Announcement" button and pin controls
- MANAGER sees the "New Announcement" button (for their scope) but no pin controls
- EMPLOYEE sees read-only list
