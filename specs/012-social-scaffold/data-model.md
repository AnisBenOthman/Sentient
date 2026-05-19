# Data Model — 012-social-scaffold

Canonical Prisma 5 (multiSchema) shape for the `social` Postgres schema. Eight models, eight enums, ten indexes, one intra-schema relation, zero cross-schema relations, one initial migration.

---

## File: `apps/social/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("SOCIAL_DATABASE_URL")
  schemas  = ["social"]
}

generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}
```

---

## Enums (8)

All declared under `@@schema("social")`. Values are case-sensitive and MUST match `packages/shared/src/enums/*.enum.ts` exactly.

```prisma
enum Audience {
  COMPANY
  DEPARTMENT
  TEAM
  ROLE
  INDIVIDUAL

  @@schema("social")
}

enum EventType {
  MEETING
  TRAINING
  SOCIAL
  ALL_HANDS
  ONBOARDING
  OFFSITE

  @@schema("social")
}

enum RsvpStatus {
  INVITED
  ACCEPTED
  DECLINED
  TENTATIVE
  ATTENDED
  NO_SHOW

  @@schema("social")
}

enum DocumentCategory {
  INTERNAL_POLICY
  HANDBOOK
  REGULATION
  TEMPLATE
  GUIDE
  OTHER

  @@schema("social")
}

enum SentimentLabel {
  POSITIVE
  NEUTRAL
  NEGATIVE
  MIXED

  @@schema("social")
}

enum FeedbackType {
  EVENT_FEEDBACK
  ANNOUNCEMENT_FEEDBACK
  GENERAL_FEEDBACK
  MANAGER_FEEDBACK
  PEER_FEEDBACK

  @@schema("social")
}

enum ExitSurveyStatus {
  PENDING
  SENT
  COMPLETED
  EXPIRED
  CANCELLED

  @@schema("social")
}

enum ExitSurveyQuestionKey {
  REASON_FOR_LEAVING
  MANAGER_RATING
  TEAM_CULTURE_RATING
  GROWTH_OPPORTUNITY_RATING
  WOULD_RECOMMEND_COMPANY
  OPEN_FEEDBACK

  @@schema("social")
}
```

> Note on existing shared enums. `EventType`, `DocumentCategory`, `ExitSurveyStatus`, and `ExitSurveyQuestionKey` already exist in `packages/shared/src/enums/`. The Prisma enum values listed above MUST match those shared files byte-for-byte. The four new shared enums (`Audience`, `RsvpStatus`, `SentimentLabel`, `FeedbackType`) are added in this feature.

---

## Models (8)

### 1. Announcement

```prisma
model Announcement {
  id           String    @id @default(uuid())
  title        String
  body         String    @db.Text
  authorId     String    // logical FK -> hr_core.employees.id (no Prisma relation)
  audience     Audience
  publishedAt  DateTime? // null = draft
  pinnedUntil  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([audience, publishedAt(sort: Desc)])
  @@schema("social")
  @@map("announcements")
}
```

### 2. Event

```prisma
model Event {
  id           String       @id @default(uuid())
  title        String
  description  String       @db.Text
  eventType    EventType
  organizerId  String       // logical FK -> hr_core.employees.id
  startAt      DateTime
  endAt        DateTime
  location     String?
  audience     Audience
  capacity     Int?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  attendees    EventAttendee[]

  @@index([eventType, startAt(sort: Desc)])
  @@schema("social")
  @@map("events")
}
```

### 3. EventAttendee

Immutable per-employee RSVP join row.

```prisma
model EventAttendee {
  id           String      @id @default(uuid())
  eventId      String
  employeeId   String      // logical FK -> hr_core.employees.id
  rsvpStatus   RsvpStatus
  respondedAt  DateTime
  createdAt    DateTime    @default(now())

  event        Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, employeeId])
  @@index([eventId])
  @@schema("social")
  @@map("event_attendees")
}
```

### 4. Document

```prisma
model Document {
  id            String           @id @default(uuid())
  title         String
  description   String?          @db.Text
  category      DocumentCategory
  sourceUrl     String           // object-store URL or local path
  mimeType      String
  sizeBytes     BigInt
  uploadedById  String           // logical FK -> hr_core.employees.id
  version       Int              @default(1)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([category, createdAt(sort: Desc)])
  @@schema("social")
  @@map("documents")
}
```

`category = INTERNAL_POLICY` is the trigger for AI Agentic RAG ingestion (CLAUDE.md §11). This scaffold only guarantees the column exists; ingestion ships with a later feature.

### 5. Feedback

```prisma
model Feedback {
  id            String          @id @default(uuid())
  feedbackType  FeedbackType
  subjectType   String          // 'EVENT' | 'ANNOUNCEMENT' | 'GENERAL' | ...
  subjectId     String?         // UUID of the targeted entity in its own schema
  content       String          @db.Text
  rating        Int?            // 1..5
  sentiment     SentimentLabel? // filled later by Engagement Agent
  isAnonymous   Boolean         @default(false)
  employeeId    String?         // null iff isAnonymous = true (structural anonymity)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([subjectType, subjectId])
  @@index([isAnonymous])
  @@schema("social")
  @@map("feedback")
}
```

Anonymity is enforced **at the application layer**: a future controller sets `employeeId = isAnonymous ? null : currentUser.employeeId`. The scaffold guarantees the column shape so the enforcement is possible.

### 6. EngagementSnapshot

```prisma
model EngagementSnapshot {
  id             String   @id @default(uuid())
  scopeType      String   // 'COMPANY' | 'DEPARTMENT' | 'TEAM'
  scopeId        String?  // null when scopeType = COMPANY
  periodStart    DateTime
  periodEnd      DateTime
  metrics        Json     // shape owned by Engagement Agent
  generatedById  String?  // null when generated by SYSTEM (cron)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([scopeType, scopeId, periodStart])
  @@schema("social")
  @@map("engagement_snapshots")
}
```

### 7. ExitSurvey

```prisma
model ExitSurvey {
  id                    String           @id @default(uuid())
  respondentId          String?          // populated at dispatch, NULLED on COMPLETED (§10 anonymization)
  terminationReference  String?          // opaque HR Core reference; never a hard FK
  status                ExitSurveyStatus @default(PENDING)
  surveyTokenHash       String           // hashed scoped token; never the plaintext
  sentAt                DateTime?
  expiresAt             DateTime?
  completedAt           DateTime?
  channel               String           // ChannelType (WEB/SLACK/WHATSAPP/EMAIL/IN_APP) — string until ChannelType lands as Prisma enum in Social
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  responses             ExitSurveyResponse[]

  @@index([status])
  @@index([expiresAt])
  @@schema("social")
  @@map("exit_surveys")
}
```

`channel` is a `String` (not a Prisma enum) in this scaffold. `ChannelType` lives in `@sentient/shared` already; promoting it to a Social Prisma enum would duplicate the source of truth. Application-layer validation against the shared enum is the contract.

### 8. ExitSurveyResponse

Carries **no** employee identifier — anonymity is structural.

```prisma
model ExitSurveyResponse {
  id            String                @id @default(uuid())
  surveyId      String
  questionKey   ExitSurveyQuestionKey
  answerText    String?               @db.Text
  answerRating  Int?                  // 1..5
  submittedAt   DateTime
  createdAt     DateTime              @default(now())

  survey        ExitSurvey            @relation(fields: [surveyId], references: [id], onDelete: Cascade)

  @@index([surveyId, questionKey])
  @@schema("social")
  @@map("exit_survey_responses")
}
```

---

## Index summary (10)

| # | Table | Index |
|---|---|---|
| 1 | `announcements` | `(audience, published_at DESC)` |
| 2 | `events` | `(event_type, start_at DESC)` |
| 3 | `event_attendees` | `(event_id)` + unique `(event_id, employee_id)` |
| 4 | `documents` | `(category, created_at DESC)` |
| 5 | `feedback` | `(subject_type, subject_id)` |
| 6 | `feedback` | `(is_anonymous)` |
| 7 | `engagement_snapshots` | `(scope_type, scope_id, period_start)` |
| 8 | `exit_surveys` | `(status)` |
| 9 | `exit_surveys` | `(expires_at)` |
| 10 | `exit_survey_responses` | `(survey_id, question_key)` |

---

## Relations

| From | To | Type | On Delete |
|---|---|---|---|
| `EventAttendee.eventId` | `Event.id` | many-to-one | `CASCADE` |
| `ExitSurveyResponse.surveyId` | `ExitSurvey.id` | many-to-one | `CASCADE` |

**No other relations.** All HR Core references (`authorId`, `organizerId`, `employeeId`, `uploadedById`, `generatedById`, `respondentId`) are plain `String` UUIDs validated at the application layer through `HrCoreClient`.

---

## State machine — `ExitSurveyStatus`

```
PENDING ──── HR admin dispatches ──▶ SENT ──── respondent completes ──▶ COMPLETED  (respondentId NULLED)
   │                                  │
   │                                  ├──── expiresAt elapsed ──▶ EXPIRED
   │                                  │
   │                                  └──── HR admin cancels ──▶ CANCELLED
   │
   └──── HR admin cancels (before SENT) ──▶ CANCELLED

COMPLETED / EXPIRED / CANCELLED → terminal
```

Enforcement of these transitions ships with the future Exit Survey feature module. The scaffold only provides the column shape.

---

## Migration

Single migration: `apps/social/prisma/migrations/20260520000000_init_social_scaffold/migration.sql`.

Order of operations:

1. `CREATE TYPE social."Audience" AS ENUM (...)` × 8 (one per Prisma enum).
2. `CREATE TABLE social.announcements (...)`.
3. `CREATE TABLE social.events (...)`.
4. `CREATE TABLE social.event_attendees (...)` with FK to `events`.
5. `CREATE TABLE social.documents (...)`.
6. `CREATE TABLE social.feedback (...)`.
7. `CREATE TABLE social.engagement_snapshots (...)`.
8. `CREATE TABLE social.exit_surveys (...)`.
9. `CREATE TABLE social.exit_survey_responses (...)` with FK to `exit_surveys`.
10. `CREATE INDEX` × 10 (the table-level `@@index` definitions emit standard B-tree indexes; the `@@unique` on `event_attendees` emits a `CREATE UNIQUE INDEX`).

The migration MUST be re-runnable on an already-migrated DB without producing pending changes (Prisma checks `_prisma_migrations` for the migration name).

---

## Shared enum files (companion to FR-015..FR-017)

New files added under `packages/shared/src/enums/`:

```ts
// audience.enum.ts
export enum Audience {
  COMPANY = 'COMPANY',
  DEPARTMENT = 'DEPARTMENT',
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  INDIVIDUAL = 'INDIVIDUAL',
}

// rsvp-status.enum.ts
export enum RsvpStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  TENTATIVE = 'TENTATIVE',
  ATTENDED = 'ATTENDED',
  NO_SHOW = 'NO_SHOW',
}

// sentiment-label.enum.ts
export enum SentimentLabel {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  MIXED = 'MIXED',
}

// feedback-type.enum.ts
export enum FeedbackType {
  EVENT_FEEDBACK = 'EVENT_FEEDBACK',
  ANNOUNCEMENT_FEEDBACK = 'ANNOUNCEMENT_FEEDBACK',
  GENERAL_FEEDBACK = 'GENERAL_FEEDBACK',
  MANAGER_FEEDBACK = 'MANAGER_FEEDBACK',
  PEER_FEEDBACK = 'PEER_FEEDBACK',
}
```

Each file is re-exported from `packages/shared/src/enums/index.ts`:

```ts
export * from './audience.enum';
export * from './rsvp-status.enum';
export * from './sentiment-label.enum';
export * from './feedback-type.enum';
```
