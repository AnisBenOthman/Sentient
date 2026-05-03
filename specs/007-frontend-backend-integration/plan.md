# Implementation Plan: Frontend–Backend Seamless Integration

**Branch**: `007-frontend-backend-integration` | **Date**: 2026-05-01 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/007-frontend-backend-integration/spec.md`

## Summary

Wire the remaining gaps between `apps/web` (Next.js :3000) and HR Core (:3001). The integration is largely complete — no mock data exists in `apps/web/src`, all pages have real API clients, and Settings/Leaves/Employees/Dashboard are fully functional. The delta is four targeted fixes: correct the LeavesTab endpoint bug (FR-003), show the real user name in the sidebar (FR-004), add a client-side role guard on `/org-chart` (FR-005), and audit/delete the `front-replit/` prototype (FR-006). One small backend change is required to support the LeavesTab fix.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: Next.js 14 (App Router), NestJS 10, SWR, Prisma 5, `@sentient/shared`  
**Storage**: PostgreSQL 16 / `hr_core` schema (no schema changes in this feature)  
**Testing**: Manual E2E against seeded HR Core (:3001)  
**Target Platform**: Browser (Chrome/Firefox/Edge latest)  
**Project Type**: Full-stack web application — monorepo  
**Performance Goals**: UI reflects backend action within 2 seconds (SC-002)  
**Constraints**: HR Core only (FR-008); no new pages for Payroll/Recruitment (FR-007)  
**Scale/Scope**: 4 frontend fixes, 1 backend change, 1 prototype cleanup

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No cross-service imports | PASS | All changes stay in `apps/web` and `apps/hr-core` |
| Every endpoint has `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles` | PASS | Backend change adds RBAC check, not removes it |
| No mock data in production code | PASS | `apps/web/src` has zero mock data (grep confirmed) |
| Strict TypeScript — no `any` | PASS | Will be enforced in all edits |
| Security — scope-filtered queries | PASS | LeavesTab backend fix will scope-check the `employeeId` override |

## Project Structure

### Documentation (this feature)

```text
specs/007-frontend-backend-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output — changed API contract
│   └── leave-requests-query.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (modified files only)

```text
apps/hr-core/src/modules/leaves/requests/
└── requests.controller.ts   # Add employeeId override for HR_ADMIN/EXECUTIVE/MANAGER

apps/web/src/
├── lib/api/hr-core.ts        # Add getEmployeeLeaveRequests()
├── components/layout/sidebar.tsx           # Resolve real user name via SWR
└── app/
    ├── employees/[id]/page.tsx   # Fix LeavesTab to call getEmployeeLeaveRequests()
    └── org-chart/page.tsx        # Add role guard + redirect

front-replit/                 # DELETE after audit (separate git repo)
```

## Complexity Tracking

No constitution violations.

---

## Phase 0: Research (Resolved)

All unknowns resolved via direct code inspection on 2026-05-01. See `research.md` for details.

| Decision | Resolution |
|----------|-----------|
| FR-003: how to get a specific employee's leave requests | Backend controller ignores `query.employeeId` — fix by adding scope-checked override in controller |
| FR-004: source for sidebar real name | Use existing `getEmployee(user.employeeId)` via SWR in Sidebar; JWT already has `employeeId` claim |
| FR-005: where to add org-chart guard | Client-side in `OrgChartPage` component — check roles, redirect to `/dashboard` |
| FR-006: what to extract from front-replit | Nothing: apps/web login, leaves, employees, settings, org-chart are all superior implementations. Audit then delete. |
| FR-001/SC-003: mock data present? | Confirmed absent — grep of `apps/web/src` for mock/hardcoded patterns returned zero results |

---

## Phase 1: Design & Implementation

### Fix 1 — FR-003: LeavesTab correct endpoint (backend + frontend)

**Problem**: `LeavesTab` in `apps/web/src/app/employees/[id]/page.tsx:180` calls `getMyLeaveRequests()`, which calls `GET /leave-requests` scoped to the logged-in user. When an HR Admin views any employee's profile, they see their own leaves, not the viewed employee's.

**Root cause (backend)**: `RequestsController.findByEmployee()` always uses `requireEmployeeId(user)` from the JWT — it ignores the `employeeId` field already declared in `LeaveQueryDto`. The DTO field is dead code.

**Fix — backend** (`requests.controller.ts`):
```
@Get()
@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN')
async findByEmployee(query, user):
  // HR_ADMIN/EXECUTIVE/MANAGER with explicit query.employeeId → use that
  // (scope: only if the requester has the right role)
  // EMPLOYEE → always own employeeId
  const targetId = resolveTargetEmployeeId(user, query.employeeId);
  return this.requestsService.findByEmployee(targetId, query);
```

Concretely, add a private helper:
```typescript
private resolveTargetEmployeeId(user: JwtPayload, queryEmployeeId?: string): string {
  const privileged = user.roles.some(r =>
    ['HR_ADMIN', 'EXECUTIVE', 'MANAGER'].includes(r),
  );
  if (privileged && queryEmployeeId) return queryEmployeeId;
  return requireEmployeeId(user);
}
```

**Fix — frontend** (`hr-core.ts`):
```typescript
export async function getEmployeeLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
  const { data } = await hrClient.get<LeaveRequest[]>('/leave-requests', {
    params: { employeeId },
  });
  return data;
}
```

**Fix — frontend** (`employees/[id]/page.tsx` — `LeavesTab`):
```typescript
// Before:
() => getMyLeaveRequests()
// After:
() => getEmployeeLeaveRequests(employeeId)
```

Also update the import to include `getEmployeeLeaveRequests` instead of (or alongside) `getMyLeaveRequests`.

---

### Fix 2 — FR-004: Sidebar real user name

**Problem**: `sidebar.tsx:41` — `const displayName = user ? \`User ${user.sub.slice(0, 6)}\` : '—';`

The `JwtPayload` has `employeeId` but not `firstName/lastName`. A call to `GET /employees/:id` is needed.

**Fix** (`sidebar.tsx`):
```typescript
import useSWR from 'swr';
import { getEmployee } from '@/lib/api/hr-core';

// Inside Sidebar():
const { data: profile } = useSWR(
  user?.employeeId ? `me-${user.employeeId}` : null,
  () => getEmployee(user!.employeeId!),
);
const displayName = profile
  ? `${profile.firstName} ${profile.lastName}`
  : user
    ? `User ${user.sub.slice(0, 6)}`
    : '—';
```

Remove the old `displayName` constant. SWR will cache the result — the profile is fetched once after login and reused across navigations.

**Note**: No backend change needed. `GET /employees/:id` is already accessible to all authenticated roles for their own profile, and HR Admins can access any employee.

---

### Fix 3 — FR-005: Org chart client-side role guard

**Problem**: `OrgChartPage` in `apps/web/src/app/org-chart/page.tsx` has no role check. Any authenticated user can access `/org-chart` directly.

**Fix** (`org-chart/page.tsx`):
```typescript
import { useAuth } from '@/components/providers/auth-provider';
import { hasRole } from '@/lib/auth';

// Inside OrgChartPage(), before the return:
const { user } = useAuth();
const roles = user?.roles ?? [];
if (!hasRole(roles, ['HR_ADMIN', 'EXECUTIVE'])) {
  router.replace('/dashboard');
  return null;
}
```

The `useRouter` import is already present. `useAuth` needs to be added. The guard must run synchronously before any data fetch.

---

### Fix 4 — FR-006: front-replit audit and deletion

**Audit result** (2026-05-01):
- `front-replit/artifacts/sentient-hris/` — Vite+React prototype with 100% mock data. UI pattern is structurally similar to apps/web but inferior (no real API, hardcoded colors, single-file components). Nothing to extract.
- `front-replit/artifacts/mockup-sandbox/` — Alternative login mockups. The existing `apps/web/src/app/login/page.tsx` is already superior (animated mesh canvas, demo account quick-fill, proper error handling, Suspense boundary).
- `front-replit/lib/api-client-react/` — orval-generated hooks covering only `/api/healthz`. Not used by apps/web. Nothing to port.

**Conclusion**: Zero extraction needed. Delete the entire `front-replit/` directory from the monorepo.

**Deletion command** (run from repo root):
```bash
rm -rf front-replit/
```

`front-replit/` has its own `.git` subdirectory (it was a Replit-hosted project) — deleting the directory removes it entirely from the monorepo working tree. It was never tracked in the main repo's git history (confirmed via `git status` showing it as `??` untracked).

Since it is untracked, simply deleting it removes it with no git history impact.

**After deletion**, commit:
```bash
git add -A
git commit -m "chore: delete front-replit prototype (design reference only, no extraction needed)"
```

---

### Verification checklist (SC-002 / FR-001 / SC-003)

After all fixes are applied, run the following manual checks:

**Auth flow (FR-002)**:
- [ ] Login with employee@sentient.dev — redirected to /dashboard
- [ ] Dashboard shows live DB counts (pending leaves, approved leaves)
- [ ] Logout clears session, redirects to /login

**Sidebar name (FR-004)**:
- [ ] Sidebar shows "Firstname Lastname" for the logged-in user, not "User XXXXXX"

**Leave submission (User Story 1, SC-001)**:
- [ ] Employee can submit a leave request, sees PENDING in My Requests
- [ ] Cancel button on PENDING request works
- [ ] Leave balance updates to reflect pending days

**Approval queue (User Story 2)**:
- [ ] Manager sees only team members' requests in Approval Queue
- [ ] HR Admin sees all requests
- [ ] Approve button → request moves out of queue; Reject with note → status REJECTED

**Settings CRUD (User Story 3)**:
- [ ] HR Admin: create Business Unit → appears in list
- [ ] HR Admin: create Department within BU → appears in Add Employee dropdown
- [ ] HR Admin: deactivate Department → no longer selectable

**LeavesTab (FR-003 / SC-005)**:
- [ ] Open employee A profile → Leave History shows employee A's leaves
- [ ] Open employee B profile → Leave History shows employee B's leaves
- [ ] (NOT the HR Admin's own leaves)

**Org Chart guard (FR-005 / SC-004)**:
- [ ] Login as employee@sentient.dev → navigate to /org-chart directly → redirected to /dashboard
- [ ] Login as hradmin@sentient.dev → /org-chart loads normally

**No mock data (FR-001 / SC-003)**:
- [ ] `grep -r "mock\|hardcoded\|placeholder\|sample" apps/web/src --include="*.ts" --include="*.tsx"` — zero results (excluding strings in UI labels/comments)

**Button audit (SC-002 — all visible buttons must be functional)**:

| Page | Buttons | Wired? |
|------|---------|--------|
| Login | Sign In, Demo account quick-fill | Yes |
| Leaves / My Requests | Request Leave, Cancel, status filters | Yes |
| Leaves / Approval Queue | Approve, Reject | Yes |
| Employees | Search, filter dropdowns, Add Employee, row click | Yes |
| Employees / [id] | Back, tab switches, Salary tab (HR only) | Yes |
| Org Chart | Team card click → slide-over, View employee | Yes |
| Settings / BU | Add, Edit, Deactivate/Delete | Yes |
| Settings / Departments | Add, Edit, Deactivate/Delete | Yes |
| Settings / Teams | Add, Edit, Deactivate/Delete | Yes |
| Sidebar | Navigation links, Logout | Yes |

---

## quickstart.md cross-reference

See `quickstart.md` for the environment setup and seed data required to test these changes.

---

## Dependencies

- HR Core must be running on `:3001` with seed data for each role
- No new npm packages needed
- No Prisma schema migrations needed (backend change is controller logic only)
