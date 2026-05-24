# Data Model: 013-Announcements Module

**Phase 1 output** | Branch: `013-announcements-module` | Date: 2026-05-21

---

## Entities

### Announcement (extended from 012 scaffold)

The 012-social-scaffold already created the `Announcement` model. This feature adds three nullable columns and two indexes.

**Existing fields** (do not change):
| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(uuid())` | Primary key |
| `title` | `String` | Required |
| `body` | `String @db.Text` | Required |
| `authorId` | `String` | Logical FK → hr_core.employees.id |
| `audience` | `Audience` | Enum: COMPANY, DEPARTMENT, TEAM, ROLE, INDIVIDUAL |
| `publishedAt` | `DateTime?` | null = draft |
| `pinnedUntil` | `DateTime?` | null = not pinned |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |

**New fields** (this feature adds):
| Field | Type | Notes |
|-------|------|-------|
| `targetDepartmentId` | `String?` | Logical FK → hr_core.departments.id; required when audience=DEPARTMENT |
| `targetTeamId` | `String?` | Logical FK → hr_core.teams.id; required when audience=TEAM |
| `expiresAt` | `DateTime?` | GET filters out announcements where expiresAt < now() |

**New indexes** (this feature adds):
```prisma
@@index([targetDepartmentId])
@@index([targetTeamId])
```

**Full Prisma model after migration**:
```prisma
model Announcement {
  id                   String    @id @default(uuid())
  title                String
  body                 String    @db.Text
  authorId             String
  audience             Audience
  publishedAt          DateTime?
  pinnedUntil          DateTime?
  targetDepartmentId   String?
  targetTeamId         String?
  expiresAt            DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([audience, publishedAt(sort: Desc)])
  @@index([targetDepartmentId])
  @@index([targetTeamId])
  @@schema("social")
  @@map("announcements")
}
```

**Migration name**: `announcements_audience_targets_and_expiry`

---

## Response Shapes (TypeScript Interfaces)

These are the shapes returned by the API — not Prisma models directly.

### AnnouncementAuthor
```typescript
interface AnnouncementAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}
```
Source: `HrCoreClient.getEmployeeRef(authorId)` — TTL-cached, max 1 call per unique authorId per page.

### AnnouncementResponse (list + detail)
```typescript
interface AnnouncementResponse {
  id: string;
  title: string;
  body: string;
  author: AnnouncementAuthor;
  audience: Audience;
  targetDepartmentId: string | null;
  targetTeamId: string | null;
  publishedAt: string;           // ISO 8601
  expiresAt: string | null;      // ISO 8601
  isPinned: boolean;             // derived: pinnedUntil != null && pinnedUntil > now()
  pinnedUntil: string | null;    // ISO 8601, exposed for HR_ADMIN display
  createdAt: string;
  updatedAt: string;
}
```

### AnnouncementListResponse
```typescript
interface AnnouncementListResponse {
  data: AnnouncementResponse[];
  total: number;
  page: number;
  limit: number;
}
```

---

## Inter-Service Reference Interfaces

These are added to `apps/social/src/common/clients/` to support FR-016 (author enrichment + audience target validation).

### DepartmentRef (new)
```typescript
// apps/social/src/common/clients/department-ref.interface.ts
export interface DepartmentRef {
  id: string;
  name: string;
}
```
Source: `GET /departments/:id` on HR Core → projects `{ id, name }` from full `DepartmentDetail`.

### TeamRef (new)
```typescript
// apps/social/src/common/clients/team-ref.interface.ts
export interface TeamRef {
  id: string;
  name: string;
  departmentId: string;
}
```
Source: `GET /teams/:id` on HR Core → projects `{ id, name, departmentId }` from full `TeamWithVacancy`.

---

## DTO Shapes

### CreateAnnouncementDto
```typescript
{
  title: string;                        // @IsString @MaxLength(200)
  body: string;                         // @IsString
  audience: Audience;                   // @IsEnum(Audience)
  targetDepartmentId?: string | null;   // @IsOptional @IsUUID — required by service when audience=DEPARTMENT + HR_ADMIN
  targetTeamId?: string | null;         // @IsOptional @IsUUID — required by service when audience=TEAM + HR_ADMIN
  expiresAt?: string | null;            // @IsOptional @IsISO8601
  publishedAt?: string | null;          // @IsOptional @IsISO8601 — defaults to now() if omitted
}
```

### UpdateAnnouncementDto
```typescript
{
  title?: string;                       // @IsOptional @IsString @MaxLength(200)
  body?: string;                        // @IsOptional @IsString
  expiresAt?: string | null;            // @IsOptional @IsISO8601
}
// Note: audience + targeting cannot be changed after publish (FR-009)
```

### PinAnnouncementDto
```typescript
{
  pinnedUntil: string | null;           // @IsISO8601 or null to unpin — HR_ADMIN only
}
```

### AnnouncementQueryDto
```typescript
{
  page?: number;      // @IsOptional @IsInt @Min(1), default: 1
  limit?: number;     // @IsOptional @IsInt @Min(1) @Max(50), default: 20
}
```

---

## State Transitions

```
POST /announcements → publishedAt = now() (no draft state in this release)
PATCH /:id/pin { pinnedUntil: "2026-06-01T..." } → pinnedUntil updated → isPinned = true
PATCH /:id/pin { pinnedUntil: null } → pinnedUntil = null → isPinned = false
DELETE /:id → hard delete (no soft-delete needed for announcements per spec FR-010)
```

---

## Audience Filtering Logic (GET /announcements)

Applied server-side in `AnnouncementsService.findAll()`:

```
jwt.departmentId = D, jwt.teamId = T

WHERE publishedAt IS NOT NULL          -- published only
  AND (expiresAt IS NULL OR expiresAt > NOW())   -- not expired
  AND (
    audience = 'COMPANY'
    OR (audience = 'DEPARTMENT' AND targetDepartmentId = D)
    OR (audience = 'TEAM' AND targetTeamId = T)
  )
ORDER BY
  CASE WHEN pinnedUntil > NOW() THEN 0 ELSE 1 END ASC,  -- pinned first
  publishedAt DESC
```

HR_ADMIN sees all announcements regardless of audience/targeting (no filter applied for global scope).
