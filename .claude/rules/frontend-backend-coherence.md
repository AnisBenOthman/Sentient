# Frontend ↔ Backend Coherence Rule

> **Applies to: Claude Code AND Codex.**
> Every frontend change must be verified against the backend it calls. The frontend is a
> thin client — it must reflect backend reality, not diverge from it.

---

## The Core Rule

**Before marking any frontend task done, run through this checklist for every API boundary touched.**

---

## 1. Type Shapes Must Match

The TypeScript interface in `apps/web/src/lib/api/hr-core.ts` (or `social.ts`, `ai.ts`)
is the contract between frontend and backend. It must exactly mirror what the backend returns.

**Check:**
- Every field in the frontend interface exists on the Prisma model or DTO response
- Field names match (camelCase on both sides)
- Optional fields (`field?: T`) match nullable/optional Prisma/DTO fields
- Enum values match the shared enum in `packages/shared/src/enums/`

```ts
// ❌ Frontend says isActive doesn't exist
export interface LeaveType {
  id: string;
  name: string;
  // missing: isActive, accrualFrequency, maxCarryoverDays
}

// ✅ Matches the Prisma LeaveType model exactly
export interface LeaveType {
  id: string;
  businessUnitId: string;
  name: string;
  defaultDaysPerYear: number;
  requiresApproval: boolean;
  accrualFrequency: string;
  maxCarryoverDays: number;
  color: string | null;
  isActive: boolean;
}
```

---

## 2. Query Params Must Match Backend DTOs

When a backend `@Query()` DTO has optional fields, the frontend Axios call must pass them
with matching key names.

**Check:**
- Every filter the frontend passes exists in the backend `@Query()` DTO
- Optional params typed as `?: T` on both sides
- Boolean query params that NestJS receives as strings handled on the backend
  (NestJS `@Query()` delivers `true` as `"true"` — backend must check both)

```ts
// Backend DTO
export interface LeaveTypeQueryDto {
  businessUnitId?: string;
  includeInactive?: boolean | string;  // NestJS delivers query strings as strings
}

// ✅ Frontend passes the same keys
getLeaveTypes({ businessUnitId, includeInactive: true })
// ❌ Frontend passes a key the backend doesn't know
getLeaveTypes({ buId: businessUnitId })   // backend ignores it silently — data bug
```

---

## 3. Error Codes Must Be Fully Mapped

Every `throw new BadRequestException('SomeCode')` in a backend service must have a
corresponding string match in the frontend `onError` handler. A missing mapping produces
a generic "Failed" message instead of a useful one.

**Check:**
- Read the service file for all `throw new BadRequestException(...)` and `throw new NotFoundException(...)`
- Every machine-readable code string appears in the frontend `onError` mapping
- Add new codes to `onError` whenever a new backend exception is added

```ts
// Backend (requests.service.ts)
throw new BadRequestException('LeaveTypeInactive');
throw new BadRequestException('InsufficientBalance');
throw new BadRequestException('OverlappingRequest');
throw new BadRequestException('ZeroDayRequest');

// ✅ Frontend maps ALL of them
onError: (err: unknown) => {
  const msg = extractApiError(err);
  setFormError(
    msg === 'LeaveTypeInactive'  ? 'This leave type is no longer available.' :
    msg === 'InsufficientBalance'? 'Insufficient leave balance.' :
    msg === 'OverlappingRequest' ? 'Dates overlap with an existing request.' :
    msg === 'ZeroDayRequest'     ? 'No working days in selected range.' :
    'Failed to submit. Please try again.',
  );
},
```

---

## 4. Query Keys Must Include All Active Filters

A TanStack Query key that omits a filter parameter will serve stale data from a different
filter context. Every param that changes the response shape must appear in the key.

**Check:**
- `queryKey` array includes `businessUnitId`, `includeInactive`, pagination params, search,
  or any other filter that is passed to the `queryFn`
- Admin queries that include inactive records use a distinct segment (`"all"`) so they don't
  collide with employee queries that only see active records

```ts
// ❌ Missing filters → stale data across BU switches
queryKey: ['leave-types']

// ✅ All filters in key
queryKey: ['leave-types', businessUnitId, 'all']   // admin (includeInactive: true)
queryKey: ['leave-types', businessUnitId]           // employee (active only)
```

---

## 5. New Endpoints Must Be Wired Immediately

When a backend endpoint is added, the corresponding frontend API function must be added
in the same task — not "later". An unwired endpoint is a dead endpoint.

**Check when adding a backend endpoint:**
- [ ] Add typed function in `apps/web/src/lib/api/hr-core.ts` (or social/ai)
- [ ] Function uses `hrClient.get<T>()` / `.post<T>()` with the correct generic
- [ ] Route path matches the NestJS `@Controller` prefix + `@Get/@Post/@Patch/@Delete` decorator
- [ ] Auth is handled by the Axios interceptor (not manually in the function)

```ts
// Backend: POST /leave-types/:id/reactivate  @Roles('HR_ADMIN')
// ✅ Frontend wired immediately
export async function reactivateLeaveType(id: string): Promise<LeaveType> {
  const { data } = await hrClient.post<LeaveType>(`/leave-types/${id}/reactivate`);
  return data;
}
```

---

## 6. Soft-Delete Logic Must Be Mirrored on Frontend

When a backend uses soft-delete (`isActive`, `deletedAt`, `status`), the frontend must
show the complete picture — not pretend the record is gone.

**Check:**
- If backend has `isActive: boolean`, HR Admin views must pass `includeInactive: true`
  and render inactive records visually distinct (grayed, badge, strikethrough)
- Employee/restricted views must rely on the backend's default filter (`isActive: true`)
  and NOT pass `includeInactive`
- Reactivation endpoints must have a corresponding UI button in the admin view

---

## 7. RBAC Must Be Reflected in UI

Backend `@Roles('HR_ADMIN')` means the action is gated. The UI must hide or disable
that action for non-admin users — it should never show a button that will 403.

**Check:**
- Every mutation that calls an HR_ADMIN-only endpoint is conditionally rendered:
  `{isHrAdmin && <Button>...}` or `disabled={!isHrAdmin}`
- Role check uses `user?.roles.includes('HR_ADMIN')` from `useAuth()` — never hardcoded
- Employee-scoped queries pass `employeeId` or BU filter matching the JWT claims

---

## How to Apply This Rule (Both Agents)

When you finish a frontend change, spend 2 minutes on this:

1. **Open the backend service file** that the changed component calls.
2. **Read every `throw`** — are all error codes mapped on the frontend?
3. **Read the response type / Prisma model** — does the frontend interface match?
4. **Read the `@Query()` / `@Body()` DTO** — do frontend call params match field names?
5. **Check `@Roles()`** — is the UI gate in place for restricted endpoints?

If you find a mismatch while working on the backend, fix the frontend in the same commit.
If you find a mismatch while working on the frontend, fix the backend type/error in the same commit.

**One PR = one coherent full-stack slice. Never leave the frontend ahead of or behind the backend.**
