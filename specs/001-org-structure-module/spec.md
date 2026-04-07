# Feature Specification: Organization Structure Module (Departments, Teams, Positions)

**Feature Branch**: `001-org-structure-module`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "based on claude.md and class diagram of HR core generate a full specify for the organization module (Departments, Teams, Positions)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HR Admin Manages Departments (Priority: P1)

An HR Admin sets up the company's departmental hierarchy by creating departments with unique codes and optionally designating a department head. They can update department details or deactivate a department that has been dissolved.

**Why this priority**: Departments are the root of the org structure. Every team and employee placement depends on them. Nothing else in this module can work without departments existing first.

**Independent Test**: Can be fully tested by creating, reading, updating, and soft-deleting a Department as an HR Admin — delivers a usable org-structure foundation with zero dependencies on teams or positions.

**Acceptance Scenarios**:

1. **Given** an HR Admin is authenticated, **When** they create a department with a unique name and code (e.g. "Engineering", "ENG"), **Then** the department is persisted as active and is immediately available for team assignment.
2. **Given** a department exists, **When** an HR Admin assigns a department head (employee reference), **Then** the headId is stored and the relationship is visible in the department detail view.
3. **Given** a department exists with active teams, **When** an HR Admin deactivates it, **Then** the department is soft-deactivated (`isActive = false`) and remains visible in history but is excluded from active org-chart queries.
4. **Given** an HR Admin tries to create a department with a duplicate name or code, **Then** the system rejects the request with a clear conflict error.
5. **Given** an EMPLOYEE role user, **When** they attempt to create or update a department, **Then** the system returns a 403 Forbidden.

---

### User Story 2 - HR Admin Manages Teams Within Departments (Priority: P2)

An HR Admin creates teams that belong to a specific department, optionally assigns a team lead (an employee), and sets a project focus. Teams can be updated and deactivated independently of their parent department.

**Why this priority**: Teams are the direct unit of day-to-day work allocation and are referenced by leave risk assessment (team availability checks) and the org-scenario analyzer. They cannot exist without departments (P1), but are themselves independent from positions.

**Independent Test**: Can be fully tested by creating a Team under an existing department, assigning a lead, listing teams by department, and deactivating one — delivers team management independently of positions.

**Acceptance Scenarios**:

1. **Given** an HR Admin and at least one active department, **When** they create a team with name "Backend", linked to the "Engineering" department, **Then** the team is persisted, linked to its department, and appears in the department's team list.
2. **Given** a team exists, **When** an HR Admin assigns a team lead (employee reference) and a project focus description, **Then** both are persisted and visible in the team detail.
3. **Given** an HR Admin provides a duplicate team code, **Then** the system rejects the request with a conflict error.
4. **Given** a Manager who leads a team, **When** they query the team detail, **Then** they see the full team record including members count (resolved from Employee references).
5. **Given** an HR Admin deactivates a team, **Then** `isActive` becomes false; the team is excluded from active assignment dropdowns but remains queryable for historical reference.

---

### User Story 3 - HR Admin Manages Job Positions (Priority: P3)

An HR Admin maintains the catalog of job positions (e.g. "Software Engineer - Senior") that can be assigned to employees. Positions are organization-wide (not department-scoped) and have an optional seniority level descriptor.

**Why this priority**: Positions are referenced by employee profiles, job history records, and contract amendments. They must exist before employees can be fully onboarded, but the position catalog is simpler to manage and has no internal dependencies within this module.

**Independent Test**: Can be fully tested by creating, listing, updating, and soft-deactivating positions in isolation — delivers a usable position catalog with no dependency on departments or teams.

**Acceptance Scenarios**:

1. **Given** an HR Admin, **When** they create a position with title "Software Engineer" and level "Senior", **Then** the position is persisted with a unique title and becomes available for employee assignment.
2. **Given** a position title already exists, **When** an HR Admin tries to create another with the same title, **Then** the system rejects with a conflict error.
3. **Given** a position is no longer used, **When** an HR Admin deactivates it, **Then** `isActive` becomes false and it is excluded from new-hire dropdowns but retained in historical employee records.
4. **Given** any authenticated user (any role), **When** they query the list of active positions, **Then** they receive the full position catalog (positions are not sensitive data).

---

### User Story 4 - Manager Views Their Team Composition (Priority: P4)

A Manager can view the current members of their team, the team's department, and its lead assignment. This drives the leave risk assessment (AI Agentic checks team availability before approving leave) and manager decision-making.

**Why this priority**: The Manager team-view is a read-only consumer of the org structure data already established in P1–P3. It is a critical driver of leave management and AI agent behavior but adds no mutation complexity.

**Independent Test**: Can be fully tested by having a Manager query their team and verifying member resolution is scope-filtered to their team only — no dependency on leave or AI subsystems needed.

**Acceptance Scenarios**:

1. **Given** a Manager JWT with a `teamId` claim, **When** they request their team detail, **Then** they see the full team record including department name and current lead.
2. **Given** a Manager, **When** they attempt to query a team they do not lead, **Then** the system returns 403 Forbidden (TEAM scope enforced).
3. **Given** a Manager's team, **When** one of its members is on leave, **Then** the team view still reflects the full member list (availability is a concern for the Leave Agent, not this module).

---

### User Story 5 - Org Chart Read Access for Analytics and AI Agents (Priority: P5)

The Analytics Agent and any EXECUTIVE or HR Admin can retrieve a structured org-chart snapshot — departments with nested teams and their employee counts — to support reporting, scenario planning, and Text-to-SQL queries.

**Why this priority**: This is a read-only aggregation endpoint consumed by the AI Agentic service's Analytics Agent for org-chart visualization and scenario modeling. It is downstream of all mutation stories and does not block them.

**Independent Test**: Can be fully tested by querying the org-chart endpoint as an HR Admin and verifying the nested department → team → employee-count structure is returned correctly.

**Acceptance Scenarios**:

1. **Given** departments and teams exist, **When** an HR Admin or EXECUTIVE queries the org-chart endpoint, **Then** they receive a hierarchical structure: departments containing their active teams with aggregate employee counts.
2. **Given** an EMPLOYEE or MANAGER, **When** they query the org-chart endpoint, **Then** the system returns 403 Forbidden (GLOBAL scope required).
3. **Given** the Analytics Agent (SYSTEM JWT), **When** it calls the org-chart endpoint, **Then** it receives the full hierarchy for use in org-scenario analysis.

---

### Edge Cases

- What happens when a department is deactivated but still has active teams assigned to it? The deactivation is allowed; existing teams retain the departmentId reference but the parent department is flagged inactive. Active teams remain usable — HR Admin must deactivate teams separately if needed.
- What happens when a team lead (employee) is terminated? The `leadId` reference is retained in the database (logical FK — no cascading delete). The system must surface a warning that the lead slot is vacant when the team is queried.
- What happens when a position is deactivated but employees still hold it? Existing employee records keep the `positionId` reference unchanged. The position is only excluded from new assignment dropdowns.
- What happens when a department head (`headId`) no longer maps to a valid employee? The reference is a logical FK; the system returns the department with a nullable resolved head and does not fail.
- What happens when creating a team with a department that is inactive? The system should reject the team creation — teams may only be assigned to active departments.

---

## Requirements *(mandatory)*

### Functional Requirements

**Departments**

- **FR-001**: System MUST allow HR Admins to create a department with a unique name and a unique short code (e.g. "ENG", "HR").
- **FR-002**: System MUST allow HR Admins to update department name, code, description, and department head assignment.
- **FR-003**: System MUST enforce name and code uniqueness at the data layer — duplicate submissions must be rejected with a conflict error.
- **FR-004**: System MUST support soft-deactivation of departments (`isActive = false`), preserving historical records and employee references.
- **FR-005**: System MUST exclude inactive departments from active org-chart and team-creation dropdowns while keeping them queryable via explicit filters.
- **FR-006**: System MUST allow assigning an optional department head by referencing an employee identifier (logical reference — no cross-schema FK).
- **FR-007**: System MUST reject team creation requests that reference an inactive or non-existent department.

**Teams**

- **FR-008**: System MUST allow HR Admins to create a team within an active department, with an optional unique code and optional project focus text.
- **FR-009**: System MUST allow HR Admins to assign a team lead by employee reference; the lead assignment may be null (vacant).
- **FR-010**: System MUST allow HR Admins to update team name, code, description, project focus, lead, and active status independently.
- **FR-011**: System MUST enforce team code uniqueness across the entire organization (not just within a department) when a code is provided.
- **FR-012**: System MUST support soft-deactivation of teams, retaining the record and department link for historical reference.
- **FR-013**: System MUST scope team read access so Managers see only their own team's detail; HR Admins and Executives see all teams.

**Positions**

- **FR-014**: System MUST allow HR Admins to create a position with a globally unique title and an optional level descriptor (e.g. "Junior", "Senior", "Lead").
- **FR-015**: System MUST allow HR Admins to update position title, level, and active status.
- **FR-016**: System MUST enforce position title uniqueness across the organization.
- **FR-017**: System MUST support soft-deactivation of positions, keeping them visible in historical employee and job-history records but excluding them from active assignment options.
- **FR-018**: System MUST allow all authenticated users to read the position catalog (positions are not sensitive data — they are needed for profile display and form dropdowns).

**Org Chart**

- **FR-019**: System MUST expose an org-chart read endpoint that returns a hierarchical view: active departments with their active teams and each team's active employee count.
- **FR-020**: The org-chart endpoint MUST be accessible to HR Admins, Executives, and SYSTEM-role callers (Analytics Agent); it MUST return 403 for EMPLOYEE and MANAGER roles.
- **FR-021**: System MUST surface a lead-vacancy indicator when a team's `leadId` references a terminated employee, without failing the query.

### Key Entities

- **Department**: Represents a top-level organizational unit (e.g. Engineering, HR). Has a unique name, a short unique code, an optional description, and an optional department head (employee reference). Supports soft-deactivation. One Department has many Teams.
- **Team**: Represents a sub-unit within a Department (e.g. Backend, Frontend). Has a unique code (optional), an optional project focus, and an optional team lead (employee reference). Must belong to an active Department. Supports soft-deactivation.
- **Position**: Represents a job title category (e.g. "Software Engineer - Senior"). Organization-wide catalog, not scoped to any department. Has a unique title and an optional seniority level descriptor. Referenced by Employee, JobHistory, and ContractAmendment entities. Supports soft-deactivation.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: HR Admins can create, update, and deactivate any department, team, or position in under 30 seconds per operation with no more than 2 form interactions.
- **SC-002**: The org-chart endpoint returns a full hierarchical snapshot for an organization of up to 500 employees across 20 departments in under 1 second.
- **SC-003**: Duplicate name/code conflicts are detected and reported to the user before any data is persisted — zero silent overwrites.
- **SC-004**: 100% of EMPLOYEE and MANAGER role requests to restricted endpoints (org-chart, department mutations, position mutations) are blocked with a clear permission error.
- **SC-005**: Deactivated departments, teams, or positions remain fully queryable by HR Admins via an explicit `isActive=false` filter, ensuring zero data loss.
- **SC-006**: The Analytics Agent can retrieve the complete org-chart structure in a single request, enabling org-scenario analysis without additional round-trips.
- **SC-007**: All RBAC scope rules are enforced consistently — Managers restricted to their own team, Executives and HR Admins with global read access — with zero bypass vectors.

---

## Assumptions

- The Organization module is part of the HR Core microservice (port 3001, schema `hr_core`) and shares authentication with all other HR Core modules via the shared JWT guard.
- Department heads (`headId`) and team leads (`leadId`) are stored as logical employee references with no database-level foreign key — validation of existence occurs at the application layer via the Employees module within the same service.
- Positions are organization-wide and not scoped to departments; a single position title (e.g. "Software Engineer") may be held by employees across multiple departments.
- Soft-delete (via `isActive` flag) is the only deletion strategy — no hard deletes are performed on any org structure entity, as they are referenced by employee profiles and historical records.
- The org-chart endpoint resolves employee counts by reading from the Employee entity within the same HR Core service (no cross-service call needed for counts).
- The Analytics Agent access to the org-chart endpoint uses a SYSTEM JWT minted by `AgentContextFactory.forSystemTask()`, as defined in the AI governance architecture.
- Mobile or external channel access to this module is out of scope for this specification — the UI is the web frontend only.
- Pagination is applied by default on list endpoints (departments list, teams list, positions list) using cursor-based pagination as per HR Core conventions.
- Seed data for initial departments, teams, and positions will be provided via `apps/hr-core/prisma/seed.ts` as part of the development setup.
