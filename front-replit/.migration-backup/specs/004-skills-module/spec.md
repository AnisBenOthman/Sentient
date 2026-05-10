# Feature Specification: Skills Module

**Feature Branch**: `004-skills-module`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "skills. look at the skills-class-diagram.drawio and engage with me to craft this feature"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record an employee's proficiency and auto-audit it (Priority: P1)

An HR administrator or a manager records or updates the proficiency level of one of their employees on a given skill (e.g. "Promote Alice from INTERMEDIATE to ADVANCED on React, source=CERTIFICATION"). The system stores the new current level and automatically writes an immutable history entry capturing the previous level, the new level, the source, the author of the assessment, an optional note, and the effective date.

**Why this priority**: This is the core value of the module. Without it, neither the catalog nor the history has anything to show. Everything else (read views, audits, analytics) depends on proficiencies being captured reliably.

**Independent Test**: An HR admin can create a skill in the catalog, assign it to an employee at BEGINNER, then update it to ADVANCED. A subsequent read of the employee's skills shows ADVANCED, and a read of the skill history for that employee returns exactly two ordered entries (BEGINNER with `previousLevel = null`, then INTERMEDIATE→ADVANCED or BEGINNER→ADVANCED depending on the path) with correct source, author, and effective date. No agent, no frontend required.

**Acceptance Scenarios**:

1. **Given** an employee has no prior record for skill "Kubernetes", **When** a manager with scope over that employee assigns proficiency INTERMEDIATE with source=MANAGER, **Then** one current-skill entry and one history entry are created, the history entry has `previousLevel = null` and `newLevel = INTERMEDIATE`, and the author is recorded as the manager.
2. **Given** an employee currently holds ADVANCED on skill "React" (source=CERTIFICATION), **When** an HR admin downgrades them to INTERMEDIATE with source=MANAGER and a note explaining the reason, **Then** the current-skill entry is updated to INTERMEDIATE and a new history entry is appended with `previousLevel = ADVANCED`, `newLevel = INTERMEDIATE`, and the note preserved.
3. **Given** a manager submits an assessment with the exact same level the employee already has, **When** the request is processed, **Then** the system rejects it as a no-op (no history row is written), so that history only contains real transitions.
4. **Given** a manager tries to update the proficiency of an employee outside their team, **When** the request reaches the system, **Then** the action is denied with an authorization error and no change is made to current skills or history.
5. **Given** an employee self-initiated PEER_REVIEW feedback was gathered offline, **When** a manager records the proficiency change with source=PEER_REVIEW, **Then** the history entry stores PEER_REVIEW as the origin, but the author field still identifies the manager as the person who took the decision.

---

### User Story 2 - See current skill portfolios with the right visibility (Priority: P2)

Employees can view their own current skills and their own history of changes. Managers can view the current skills and history of employees they manage. HR administrators can view everyone. No user ever sees the proficiencies of employees outside their authorized scope.

**Why this priority**: As soon as data exists, users must be able to read it within clear boundaries. Visibility without the right scope leaks compensation-adjacent information (skills are commonly used for raises, promotions, and staffing decisions).

**Independent Test**: With three seeded users (Employee A, Manager M of A, HR admin H) and skill entries for A, the system returns A's own skills to A, returns A's skills to M and H, and rejects a request from Employee B (unrelated) for A's skills with a forbidden response.

**Acceptance Scenarios**:

1. **Given** an employee is signed in, **When** they request their own skill portfolio, **Then** they receive all of their active (non-deleted) skills with their current proficiency levels.
2. **Given** an employee requests the skills of another employee they do not manage, **When** the request is processed, **Then** it is denied.
3. **Given** a manager requests the skill portfolio of a direct report, **When** the request is processed, **Then** the portfolio is returned in full.
4. **Given** an HR administrator requests a company-wide listing filtered by skill (e.g. "everyone at ADVANCED or above on Python"), **When** the request is processed, **Then** the matching employees and their levels are returned.
5. **Given** an employee requests their own history for the last 12 months, **When** the request is processed, **Then** the full ordered history (including any first-assessment rows with `previousLevel = null`) is returned.

---

### User Story 3 - Manage the global skill catalog (Priority: P3)

HR administrators maintain a single, company-wide catalog of skills. They can add new skills, edit descriptions/categories, and deactivate skills that are no longer relevant. Deactivation preserves all existing assignments and history; it only prevents the skill from being chosen on new assessments.

**Why this priority**: The catalog is the vocabulary the rest of the system writes against. It must exist before P1 can be exercised in practice, but for MVP, catalog entries can be seeded and then enriched over time, so it sits below "record proficiency" and "view skills".

**Independent Test**: An HR admin creates a skill "Terraform" in category "DevOps", edits its description, then deactivates it. The skill disappears from catalog-pick lists but remains visible on every employee portfolio that already references it, with full history preserved.

**Acceptance Scenarios**:

1. **Given** an HR administrator is signed in, **When** they create a skill with a new unique name, **Then** the skill appears in the catalog and is available to be assigned.
2. **Given** an HR administrator tries to create a skill whose name already exists (case-insensitive match on trimmed value), **When** the request is processed, **Then** it is rejected as a duplicate.
3. **Given** a skill is currently assigned to at least one employee, **When** an HR administrator deactivates it, **Then** existing assignments and history are untouched and the skill no longer appears in selection lists for new assessments.
4. **Given** a non-HR user attempts to create, update, or deactivate a skill, **When** the request is processed, **Then** it is rejected with an authorization error.

---

### User Story 4 - Audit a team's skill evolution between two dates (Priority: P4)

A manager or HR administrator queries the skill-change history for a single employee, a team, or a department between two dates, filtered optionally by skill or source. The report lists every level change with author, source, effective date, and note.

**Why this priority**: Audit-style queries are required for compliance, performance reviews, and promotion committees, but they are a consumer of data captured in P1 — they add no new write paths.

**Independent Test**: Seed an employee with three history entries spanning different months, then issue a history query restricted to a 60-day window that encloses exactly two of them: the response returns exactly those two entries in chronological order.

**Acceptance Scenarios**:

1. **Given** HR queries the history of a single employee between two dates, **When** the request is processed, **Then** entries with `effectiveDate` inside the inclusive range are returned in chronological order.
2. **Given** a manager queries the history of their team, filtered by source=CERTIFICATION, **When** the request is processed, **Then** only certification-originated changes for employees under that manager are returned.
3. **Given** a manager queries the history of an employee outside their team, **When** the request is processed, **Then** it is denied.

---

### Edge Cases

- **First assessment**: `previousLevel` is null on the initial history row for any (employee, skill) pair.
- **Idempotent update**: an assessment that matches the current level produces no history row and returns a clear "no-op" response, so the history timeline only contains true transitions.
- **Same-skill, same-employee duplicate assignment**: attempting to create a second "current" row for an (employee, skill) pair already present is rejected; callers must use the update path.
- **Skill removed from employee**: removal is a soft delete on the current entry (the row is marked deleted, not physically removed). No history row is written for removal; the last recorded level remains the authoritative history tail. A later re-assignment starts a fresh entry with `previousLevel = null` again.
- **Deactivated catalog skill**: cannot be chosen for a new assignment but remains fully readable on every employee portfolio and in every history query.
- **Backdated assessment**: `effectiveDate` may be in the past (e.g. recording a certification obtained last month). The author, `createdAt`, and `effectiveDate` are all stored; ordering in history queries follows `effectiveDate`.
- **Author without scope over target**: denied regardless of role, except HR_ADMIN (GLOBAL).
- **Terminated employee**: skills and history are preserved read-only; no further writes are accepted.

## Requirements *(mandatory)*

### Functional Requirements

**Catalog**

- **FR-001**: The system MUST maintain a single, company-wide catalog of skills; no per-department scoping of the catalog.
- **FR-002**: Each skill MUST have a unique name (case-insensitive, trimmed), an optional category, an optional description, an active/inactive flag, and a creation timestamp.
- **FR-003**: Only HR administrators MUST be able to create, edit, or deactivate skills.
- **FR-004**: Deactivating a skill MUST NOT delete it nor affect any existing assignments or history; it only removes it from selection lists for new assessments.

**Current proficiency (EmployeeSkill)**

- **FR-005**: An employee MAY hold at most one current entry per skill. Attempting to create a second current entry for the same (employee, skill) pair MUST be rejected.
- **FR-006**: Every current entry MUST carry a proficiency level (one of BEGINNER, INTERMEDIATE, ADVANCED, EXPERT), the employee, the skill, an optional acquired date, a creation timestamp, and an updated timestamp.
- **FR-007**: A current entry on a deactivated skill MUST remain readable; the deactivated skill only blocks new assignments.
- **FR-008**: The system MUST support soft-deleting a current entry (removing the skill from the employee's portfolio) without physically destroying the row, so historical joins remain intact.

**Authorship of changes**

- **FR-009**: Only managers (for employees they manage) and HR administrators (globally) MUST be able to create, update, or remove an employee's skill. Employees MUST NOT self-edit their proficiency levels.
- **FR-010**: Every assessment write MUST record the user who authored it ("assessed by").
- **FR-011**: Every assessment MUST record a source, chosen from: RECRUITMENT, TRAINING, CERTIFICATION, MANAGER, PEER_REVIEW. The source describes the origin of the information; the author (manager or HR) remains the decision-maker even when source=PEER_REVIEW.

**Audit trail (SkillHistory)**

- **FR-012**: Whenever a current proficiency changes (including the first time a skill is assigned), the system MUST append one immutable history entry capturing: employee, skill, previous level (null on first assignment), new level, effective date, source, author, optional note, and creation timestamp.
- **FR-013**: An assessment write whose new level equals the current level MUST NOT append a history entry and MUST be reported back to the caller as a no-op.
- **FR-014**: Soft-deleting a current entry MUST NOT append a history entry. The last recorded level in history remains the authoritative tail.
- **FR-015**: History entries MUST be append-only: they MUST NOT be edited or deleted through any regular user-facing path.

**Visibility / scoping**

- **FR-016**: Employees MUST be able to read their own current skills and their own full history.
- **FR-017**: Managers MUST be able to read the current skills and history of employees under their scope.
- **FR-018**: HR administrators MUST be able to read current skills and history for all employees.
- **FR-019**: Any read of current skills or history outside the caller's scope MUST be denied.
- **FR-020**: The system MUST support company-wide catalog-first queries (e.g. "list employees whose level on skill X is ADVANCED or higher") for HR administrators and for executives in read-only form.

**Audit queries**

- **FR-021**: The system MUST support history queries filtered by employee, by team or department (subject to scope), by skill, by source, and by an inclusive date range on the effective date.
- **FR-022**: History query results MUST be returned in chronological order of effective date, with ties broken by creation timestamp.

**Lifecycle & integrity**

- **FR-023**: When an employee is terminated, their current skills and history MUST be retained read-only; no further assessment writes MUST be accepted for them.
- **FR-024**: Deactivating a catalog skill MUST NOT cascade to employee records; all references survive.

**Domain events (design-ready, not yet consumed)**

- **FR-025**: The system SHOULD emit a domain event whenever a current proficiency is created, changed, or removed, so that downstream consumers (Career Agent, Analytics Agent, notifications) can react in a later feature. No consumer is wired in this feature.

### Key Entities *(include if feature involves data)*

- **Skill (catalog entry)**: The company-wide definition of a skill. Attributes: unique name, optional category, optional description, active flag, creation timestamp. One skill fans out to many current employee entries and many history entries.
- **EmployeeSkill (current snapshot)**: The current proficiency of a specific employee on a specific skill. One row per (employee, skill) pair at most. Attributes: employee reference, skill reference, proficiency level, optional acquired date, creation and update timestamps, soft-delete marker.
- **SkillHistory (audit trail)**: An immutable journal of every level change, including first assignments. Attributes: employee reference, skill reference, previous level (nullable for first assignment), new level, effective date, source (RECRUITMENT / TRAINING / CERTIFICATION / MANAGER / PEER_REVIEW), optional note, optional "assessed by" employee reference, creation timestamp.
- **ProficiencyLevel (enumeration)**: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT.
- **SourceLevel (enumeration)**: RECRUITMENT, TRAINING, CERTIFICATION, MANAGER, PEER_REVIEW.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An HR administrator can create a skill, assign it to an employee, and update the proficiency in under 60 seconds end-to-end (interactive path), with the full history immediately visible afterward.
- **SC-002**: For any employee with up to 50 skill assignments and 200 history entries, retrieval of their current portfolio returns in under 500 milliseconds at the 95th percentile, and retrieval of their full history returns in under 800 milliseconds at the 95th percentile.
- **SC-003**: 100% of attempts by a user to view or write skill data outside their authorized scope are rejected (measured through an RBAC test matrix covering the four roles × four scopes on every read and write path).
- **SC-004**: 100% of proficiency changes on the system produce exactly one corresponding history entry; assessments that match the current level produce zero history entries (measured by a reconciliation check: for every (employee, skill) pair, the number of distinct levels visited equals the count of history rows).
- **SC-005**: History queries over a date range on a department of up to 500 employees return results in under 2 seconds at the 95th percentile.
- **SC-006**: Deactivating a catalog skill that is assigned to at least 10 employees leaves all 10 employee portfolios and histories intact and readable (zero dropped records).

## Assumptions

- The module lives inside the HR Core service and its `hr_core` schema, alongside the existing employee and organization modules. This matches the project-level service boundary decision recorded in CLAUDE.md; no cross-service writes are involved.
- The `Employee` entity already exists with stable identifiers, manager relationships, and termination status. This feature references employees by ID and relies on the existing scope-filter infrastructure (OWN / TEAM / DEPARTMENT / GLOBAL).
- Agent consumption of skills data (Career Agent, Analytics Agent) is explicitly out of scope for this feature. The module is designed to emit domain events so agents can be wired in a follow-up feature without a schema change.
- A frontend surface for skills management is out of scope for this specification; the feature is delivered behind REST endpoints that a future Next.js UI will consume.
- Training and Certification as full domain modules (tracking courses, completions, issuing bodies) are out of scope. `SourceLevel.TRAINING` and `SourceLevel.CERTIFICATION` are labels recorded on history entries; the upstream training/certification systems, if any, live outside this feature.
- Peer-review workflows (how peer feedback is gathered) are out of scope. `SourceLevel.PEER_REVIEW` is a label applied by a manager or HR admin when they enter a proficiency change informed by peer input; this feature does not provide a peer-to-peer feedback surface.
- Skill-gap analysis against Position or Team requirements (which skills a position *requires*) is out of scope for this feature and will be addressed when the Position entity grows required-skill relationships.
- The catalog starts empty. An initial seed list of common skills may be provided as seed data but is not part of the functional scope of this feature.
- Soft-delete on `EmployeeSkill` is intentional, not a bug: we never destroy history, and we allow the same (employee, skill) pair to be re-added later with a clean first-assessment row. No automatic restore flow is provided.
