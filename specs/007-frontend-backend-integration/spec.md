# Feature Specification: Frontend–Backend Seamless Integration

**Feature Branch**: `007-frontend-backend-integration`  
**Created**: 2026-05-01  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Employee End-to-End Authenticated Journey (Priority: P1)

An employee opens the Sentient HRIS web app, signs in with their credentials, lands on the dashboard which shows their real leave statistics, navigates to the Leaves page, submits a new leave request, and sees the request appear in their "My Requests" tab immediately — all backed by live HR Core data with no mock fallbacks.

**Why this priority**: This is the core daily workflow for every user. If login, dashboard data, and leave submission do not work end-to-end, the application has zero production value. Every other story depends on auth being functional.

**Independent Test**: Can be fully tested by creating a real employee user in HR Core, signing in at `/login`, verifying the dashboard shows live counts, navigating to `/leaves`, submitting a request, and confirming the request appears in the list with status PENDING.

**Acceptance Scenarios**:

1. **Given** a valid employee account exists in HR Core, **When** the user enters their email and password and clicks "Sign In", **Then** they are redirected to the dashboard and their name/role is shown in the sidebar user card.
2. **Given** the user is authenticated, **When** the dashboard loads, **Then** stat cards reflect live database counts (pending leaves, approved leaves) and display no hardcoded or mock values.
3. **Given** the user is on the Leaves page, **When** they submit a new leave request with valid dates and leave type, **Then** the request is created in HR Core, appears in "My Requests" with status PENDING, and the leave balance updates to reflect pending days consumed.
4. **Given** the user submits a leave request that conflicts with existing approved leave, **When** the backend rejects it, **Then** an error message is shown to the user describing the conflict.

---

### User Story 2 — Manager / HR Admin Approval Workflow (Priority: P2)

A manager or HR admin sees pending leave requests from their team in the approval queue, can approve or reject each request with an optional review note, and the queue updates in real time to reflect the action — all wired to the HR Core approval endpoints.

**Why this priority**: Approval workflows are the primary interaction for managers. Without functional approve/reject buttons, the leave module is one-directional and the platform cannot replace manual processes.

**Independent Test**: Can be fully tested by logging in as a MANAGER role user, navigating to the Leaves page → Approval Queue tab, approving one request, and verifying the queue removes the request and the employee's request status changes to APPROVED.

**Acceptance Scenarios**:

1. **Given** there are pending leave requests from team members, **When** the manager opens the Approval Queue tab, **Then** the queue shows only requests relevant to their team (scope-filtered by HR Core).
2. **Given** the manager clicks "Approve" on a request, **When** the confirmation is submitted, **Then** the request is removed from the queue and a success notification appears.
3. **Given** the manager clicks "Reject" and enters a review note, **When** the rejection is submitted, **Then** the request status changes to REJECTED and the employee can see the review note on their request.
4. **Given** an HR Admin is logged in, **When** they access the approval queue, **Then** they see pending requests from all employees (GLOBAL scope), not just one team.

---

### User Story 3 — HR Admin Organisation Management via Settings (Priority: P3)

An HR Admin uses the Settings page to create, edit, and deactivate Business Units, Departments, and Teams — all actions persisted in HR Core with real-time confirmation feedback. No action should silently fail.

**Why this priority**: Settings management is a prerequisite for onboarding new employees (they must be assigned to a department/team). This unlocks subsequent employee management capabilities.

**Independent Test**: Can be fully tested by logging in as HR_ADMIN, going to `/settings`, creating a new Business Unit, then creating a Department within it, then creating a Team within the department, then deactivating all three and verifying they no longer appear active in the dropdown lists on the Add Employee form.

**Acceptance Scenarios**:

1. **Given** the HR Admin is on the Settings page, **When** they fill in the Business Unit form and click "Create", **Then** the new Business Unit appears in the list immediately, backed by a 201 response from HR Core.
2. **Given** the HR Admin creates a Department and assigns it to an existing Business Unit, **When** they navigate to Add Employee, **Then** the new department appears in the department dropdown.
3. **Given** the HR Admin deactivates a Department, **When** the update is saved, **Then** the department is no longer selectable when creating new employees.
4. **Given** an invalid form (missing required field), **When** the HR Admin submits the form, **Then** a validation error is shown and no request is sent to the backend.

---

### Edge Cases

- What happens when the JWT expires mid-session while the user is filling a form? The silent refresh interceptor should transparently renew the token; if refresh fails, the user should be redirected to login without losing their unsaved form state.
- How does the system handle an HR Core service that is temporarily unreachable? Error states should display a user-friendly message (not a raw stack trace or blank screen).
- What happens when a user navigates directly to `/org-chart` without the HR_ADMIN or EXECUTIVE role? The client-side guard should redirect them to `/dashboard`.
- What happens when the employee profile "Leave History" tab is opened for a specific employee by an HR Admin? It must show that employee's leave requests, not the HR Admin's own leaves.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All data displayed in `apps/web` pages (dashboard stats, employee lists, leave requests, org chart, settings) MUST be fetched exclusively from live HR Core endpoints — no hardcoded mock data, static arrays, or placeholder values may remain in production code.
- **FR-002**: The authentication flow (login → JWT storage → silent token refresh → logout) MUST function end-to-end: valid credentials produce a usable session, expired tokens are refreshed transparently, and logout clears all tokens and redirects to `/login`.
- **FR-003**: The employee profile Leave History tab MUST display leave requests for the viewed employee (using the employee's `id`), not the requests of the currently logged-in user. The current implementation calls the wrong endpoint and must be corrected.
- **FR-004**: The sidebar user card MUST display the authenticated user's real full name (currently shows `User <sub-prefix>`). The user's profile must be resolved from their JWT `sub` → employee record after login.
- **FR-005**: The Org Chart page (`/org-chart`) MUST enforce a client-side role guard restricting access to `HR_ADMIN` and `EXECUTIVE` roles, consistent with the backend `@Roles('HR_ADMIN', 'EXECUTIVE', 'SYSTEM')` restriction on `GET /org-chart`.
- **FR-006**: The `front-replit/` Replit prototype directory MUST be removed from the monorepo. It is a Vite+React proof-of-concept with 100% mock data — no real API calls — and a different tech stack from `apps/web`. The `apps/web` implementation (Next.js App Router + real HR Core endpoints) is already complete and supersedes every component in the prototype. No migration step is required because there are no patterns in the prototype that are not already implemented at higher quality in `apps/web`; the deletion itself satisfies this requirement.
- **FR-007**: Pages present in the `front-replit` prototype (Payroll, Recruitment, Welcome screen) that have no HR Core backend support MUST NOT be added to `apps/web` navigation in this feature. They are out of scope; their absence is the correct state for this milestone.
- **FR-008**: This integration milestone MUST cover HR Core (`:3001`) only. Social and AI Agentic service integrations are deferred to dedicated future feature branches once those backends are built.

### Key Entities

- **Employee**: Represents an HRIS user's work profile. Key attributes: id, firstName, lastName, email, department, team, position, employmentStatus, manager.
- **LeaveRequest**: A request for time off submitted by an employee. Attributes: id, employeeId, leaveTypeId, startDate, endDate, totalDays, status (PENDING/APPROVED/REJECTED/CANCELLED), reviewNote.
- **LeaveBalance**: Per-employee, per-leave-type quota tracking. Attributes: leaveTypeId, year, totalDays, usedDays, pendingDays, remainingDays.
- **Department / Team / BusinessUnit**: Organisational structure entities used to scope employee assignments and manager visibility.
- **OrgDepartment / OrgTeam**: Read-only projection returned by `GET /org-chart` for visualisation.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An employee can complete the full journey — sign in, view dashboard, submit a leave request, and sign out — in under 3 minutes without encountering any error related to missing or mock data.
- **SC-002**: 100% of interactive buttons visible to a given user role are functional: clicking them triggers the correct backend operation and the UI reflects the result within 2 seconds under normal conditions.
- **SC-003**: No page in `apps/web` renders data sourced from static mock arrays, hardcoded constants, or placeholder strings in the production build.
- **SC-004**: Role-based visibility rules are consistently enforced: a user with EMPLOYEE role cannot access Org Chart, Settings, or the Approval Queue tab regardless of direct URL navigation.
- **SC-005**: The employee profile "Leave History" tab always shows the viewed employee's own leave history, verified by opening the profile of two different employees and confirming different leave lists.

---

## Assumptions

- `apps/web` (Next.js at `:3000`) is the **canonical production frontend** for the Sentient platform. All integration work targets this application.
- HR Core (NestJS at `:3001`) is the only backend service that is currently operational and testable. Social and AI Agentic services are not built yet.
- The `front-replit/` directory is a Replit-hosted prototype (separate git repository) with a different tech stack (Vite + React) and no real API calls — it is a UI design reference, not a codebase to integrate directly.
- Users have stable internet connectivity and a modern browser (Chrome/Firefox/Edge, latest 2 versions).
- The HR Core backend is seeded with at least one user of each role (EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE) for testing purposes.
- The `apps/web` sidebar currently shows `User <sub-prefix>` because the full employee profile is not fetched post-login — resolving this requires an additional `GET /employees/me` call or equivalent.
- Silent token refresh is already implemented in `apps/web/src/lib/api/client.ts` and works correctly when HR Core is reachable.
