# REST API Contract: Notifications

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **Data model**: [data-model.md](../data-model.md)
**Base path**: `/api/notifications` (HR Core, port 3001)
**Auth**: `SharedJwtGuard` + `RbacGuard` on every endpoint. Every authenticated user can call these endpoints — there is **no** role-restricted variant, because every endpoint is implicitly scoped to the caller's own inbox.

---

## Endpoints

### 1. `GET /api/notifications` — List my inbox

Lists notifications addressed to the caller, optionally filtered.

**Query parameters** (all optional):

| Name | Type | Description |
|---|---|---|
| `status` | `UNREAD \| READ \| DISMISSED` | Filter by status. Default: returns both UNREAD and READ; excludes DISMISSED. |
| `category` | `NotificationCategory` | Filter by category (FR-017). |
| `referenceType` | string | Filter by reference type (useful for "show me everything for this leave request"). |
| `cursor` | string (opaque) | Pagination cursor returned by the previous page. |
| `limit` | integer 1–100 | Defaults to 50. |

**Responses**:

`200 OK`

```json
{
  "items": [
    {
      "id": "9c7c…",
      "category": "LEAVE",
      "eventType": "REQUEST_SUBMITTED",
      "title": "New leave request from Alice Martin",
      "body": "Alice Martin requested 5 days of Annual Leave (Jul 1 – Jul 5).",
      "payload": {
        "requesterId": "emp-…",
        "requesterName": "Alice Martin",
        "leaveTypeName": "Annual Leave",
        "startDate": "2026-07-01",
        "endDate": "2026-07-05",
        "totalDays": 5
      },
      "referenceType": "leave_request",
      "referenceId": "lr-…",
      "status": "UNREAD",
      "createdAt": "2026-05-12T09:14:22.000Z",
      "readAt": null
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTEyVDA5OjE0OjIyLjAwMFoiLCJpZCI6IjljN2MuLi4ifQ==",
  "unreadCount": 7
}
```

`401 Unauthorized` — missing or invalid JWT.

**RBAC**: every authenticated user. Service implementation always adds `where: { recipientUserId: user.sub }` — there is no admin override.

---

### 2. `GET /api/notifications/unread-count` — Badge

Lightweight count endpoint used by the polling fallback and by stale-tab refresh.

**Response**: `200 OK`

```json
{ "unreadCount": 7 }
```

---

### 3. `PATCH /api/notifications/:id/read` — Mark one as read

Idempotent. If the notification is already `READ`, returns it unchanged. If it is `DISMISSED`, returns `409 Conflict`. If it belongs to a different user, returns `404 Not Found` (deliberately ambiguous to avoid leaking existence).

**Path params**: `id` (uuid).

**Request body**: none.

**Responses**:

- `200 OK` — full `NotificationResponseDto`.
- `404 Not Found` — id does not exist or is not owned by the caller.
- `409 Conflict` — notification is in `DISMISSED` state.

---

### 4. `PATCH /api/notifications/mark-all-read` — Bulk mark-all-read

Marks every `UNREAD` notification owned by the caller as `READ`. Accepts an optional `category` filter to limit the bulk action.

**Request body**:

```json
{ "category": "LEAVE" }   // optional
```

**Response**: `200 OK`

```json
{ "updatedCount": 12 }
```

---

### 5. `DELETE /api/notifications/:id` — Dismiss

Sets `status = DISMISSED`, `dismissedAt = now()`. Idempotent: a second DELETE on the same id returns the same `204`.

**Path params**: `id` (uuid).

**Responses**:

- `204 No Content` — dismissed (or already dismissed).
- `404 Not Found` — id does not exist or is not owned by the caller.

---

### 6. `GET /api/notifications/stream` — SSE stream

Server-Sent Events stream pushing two event kinds to the connected user:

- `notification.created` — a new notification has been created for the caller.
- `notification.updated` — a notification owned by the caller has changed status (e.g. another tab marked it read, or an HR admin's decision resolved a pending broadcast).

**Authentication**: header `Authorization: Bearer <token>` if available; otherwise query parameter `?accessToken=<token>`. The `SseAuthGuard` (a thin variant of `SharedJwtGuard`) re-uses the same secret and verifier and attaches `req.user`. See [research.md §R2](../research.md).

**Response headers**:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event format**:

```
event: notification.created
data: {"id":"9c7c…","category":"LEAVE","eventType":"REQUEST_SUBMITTED", ...full NotificationResponseDto...}

event: notification.updated
data: {"id":"9c7c…","status":"READ","readAt":"2026-05-12T09:16:01.000Z"}
```

**Lifecycle**:

- Server emits a keep-alive comment line (`: keep-alive`) every 30 seconds to prevent intermediate proxies from closing the connection.
- On JWT expiry, the server emits a single `event: auth.expired` message and closes the stream. The client refreshes the token and reconnects.
- The client (`apps/web/src/lib/notifications/sse-client.ts`) auto-reconnects with backoff and switches to the polling fallback after repeated failures (see [research.md §R10](../research.md)).

---

## DTOs

All DTOs live in `apps/hr-core/src/modules/notifications/dto/`. Shared types (e.g. `NotificationCategory`) are imported from `@sentient/shared`.

### `NotificationResponseDto`

```ts
import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationEventType,
  NotificationStatus,
} from '@sentient/shared';

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: NotificationCategory }) category!: NotificationCategory;
  @ApiProperty({ enum: NotificationEventType }) eventType!: NotificationEventType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) referenceType!: string | null;
  @ApiProperty({ nullable: true }) referenceId!: string | null;
  @ApiProperty({ enum: NotificationStatus }) status!: NotificationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) readAt!: string | null;
}
```

### `NotificationQueryDto`

```ts
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationCategory, NotificationStatus } from '@sentient/shared';

export class NotificationQueryDto {
  @IsOptional() @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional() @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @IsOptional() @IsString()
  referenceType?: string;

  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 50;
}
```

### `MarkAllReadDto`

```ts
import { IsEnum, IsOptional } from 'class-validator';
import { NotificationCategory } from '@sentient/shared';

export class MarkAllReadDto {
  @IsOptional() @IsEnum(NotificationCategory)
  category?: NotificationCategory;
}
```

### Cursor format

`cursor = base64url(JSON({ createdAt: iso, id: uuid }))`. Server decodes and applies `WHERE (created_at, id) < ($cursorCreatedAt, $cursorId)` for stable pagination across writes. Cursor is opaque to clients.

---

## RBAC matrix (this module)

| Endpoint | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE | SYSTEM_ADMIN |
|---|---|---|---|---|---|
| `GET /api/notifications` | OWN | OWN | OWN | OWN | OWN |
| `GET /api/notifications/unread-count` | OWN | OWN | OWN | OWN | OWN |
| `PATCH /:id/read` | OWN | OWN | OWN | OWN | OWN |
| `PATCH /mark-all-read` | OWN | OWN | OWN | OWN | OWN |
| `DELETE /:id` | OWN | OWN | OWN | OWN | OWN |
| `GET /stream` | OWN | OWN | OWN | OWN | OWN |

There is **no** admin-wide view (`security.md` §2; FR-013).
