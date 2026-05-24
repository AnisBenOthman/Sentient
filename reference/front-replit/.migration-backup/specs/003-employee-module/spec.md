# Feature Specification: Employee Module

**Feature Branch**: `003-employee-module`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Employee feature, take into consideration a small employee table in HR-core schema"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HR Admin Creates a New Employee Record (Priority: P1)

An HR Administrator onboards a new hire by creating their employee record in the system. The admin enters the employee's personal details (name, email, phone, date of birth), professional details (employee code, hire date, position, department, team, contract type), and initial salary. The system generates a unique employee code if not provided and sets the employment status to ACTIVE by default.

**Why this priority**: Employee creation is the foundational operation — no other HR workflow (leaves, performance, probation) can function without employee records existing first.

**Independent Test**: Can be fully tested by creating an employee via the API with all required fields and verifying the record is persisted with correct defaults. Delivers immediate value by enabling the HR team to digitize their workforce data.

**Acceptance Scenarios**:

1. **Given** an authenticated HR Admin, **When** they submit a valid employee creation form with all required fields, **Then** the system creates the employee record, assigns a unique employee code, and returns the complete employee profile.
2. **Given** an authenticated HR Admin, **When** they submit an employee creation form with a duplicate email, **Then** the system rejects the request with a clear conflict error.
3. **Given** an authenticated Employee (non-admin), **When** they attempt to create a new employee record, **Then** the system denies the request with a 403 Forbidden response.

---

### User Story 2 - View Employee Profile (Priority: P1)

Users can view employee profiles with data visibility controlled by their role. An Employee sees their own full profile. A Manager sees profiles of their direct reports (team scope). An HR Admin sees all employee profiles including salary information. An Executive sees all profiles in read-only mode.

**Why this priority**: Viewing employee data is equally foundational — both humans and AI agents need to retrieve employee information for every downstream workflow.

**Independent Test**: Can be tested by requesting employee profiles with different role-scoped JWTs and verifying that the response includes only the fields and records permitted for each role.

**Acceptance Scenarios**:

1. **Given** an authenticated Employee, **When** they request their own profile, **Then** the system returns their full profile excluding salary history.
2. **Given** an authenticated Manager, **When** they request the list of employees, **Then** the system returns only employees in their team.
3. **Given** an authenticated HR Admin, **When** they request any employee's profile, **Then** the system returns the complete profile including current salary and salary history.
4. **Given** an authenticated Employee, **When** they request another employee's profile, **Then** the system denies the request.

---

### User Story 3 - Update Employee Information (Priority: P2)

An HR Admin updates an employee's information such as department reassignment, team transfer, position change, or personal details update. When a salary change is made, the system automatically creates a salary history entry preserving the previous salary record. Only HR Admins can update employee records — employees cannot self-update any fields.

**Why this priority**: Employee data changes frequently (transfers, promotions, corrections). Without update capability, data becomes stale quickly, impacting all dependent modules.

**Independent Test**: Can be tested by updating an employee's department and salary via the API and verifying both the employee record and a new salary history entry are created.

**Acceptance Scenarios**:

1. **Given** an authenticated HR Admin and an existing employee, **When** they update the employee's department, **Then** the system updates the department reference and records the change timestamp.
2. **Given** an authenticated HR Admin and an existing employee, **When** they update the employee's salary, **Then** the system updates `currentSalary` and creates a new SalaryHistory entry with the previous salary, effective date, and reason.
3. **Given** an authenticated Employee (non-admin), **When** they attempt to update any field on their own or another employee's profile, **Then** the system denies the request with a 403 Forbidden response.

---

### User Story 4 - List and Search Employees (Priority: P2)

HR Admins and Managers can search and filter the employee directory. Filters include department, team, employment status, contract type, and position. Results are paginated and sortable. Managers see only their scoped employees; HR Admins see all.

**Why this priority**: As the workforce grows, browsing and filtering employees becomes essential for day-to-day HR operations and for AI agents querying employee data.

**Independent Test**: Can be tested by creating several employees across departments and verifying that filtered queries return correct subsets with proper pagination.

**Acceptance Scenarios**:

1. **Given** an HR Admin and 50 employees in the system, **When** they request employees filtered by department "Engineering", **Then** the system returns only Engineering employees, paginated.
2. **Given** a Manager of Team Alpha, **When** they list employees, **Then** only Team Alpha members are returned.
3. **Given** an HR Admin, **When** they search employees by name "Ali", **Then** the system returns employees whose first or last name contains "Ali".

---

### User Story 5 - Employee Lifecycle Transitions (Priority: P2)

HR Admins manage employee lifecycle transitions: activating, placing on leave, starting probation, terminating, or recording resignation. Each transition updates the employment status and emits a domain event so downstream services (Social, AI Agentic) can react accordingly.

**Why this priority**: Status transitions drive critical business processes — termination triggers exit surveys, probation triggers the onboarding companion agent, etc.

**Independent Test**: Can be tested by transitioning an employee from ACTIVE to TERMINATED and verifying the status update and that an `employee.terminated` domain event is emitted.

**Acceptance Scenarios**:

1. **Given** an active employee, **When** HR Admin terminates the employee with a reason and effective date, **Then** the employment status changes to TERMINATED and an `employee.terminated` event is emitted.
2. **Given** an active employee, **When** HR Admin marks the employee as resigned, **Then** the employment status changes to RESIGNED and an `employee.terminated` event is emitted (same downstream effects).
3. **Given** a terminated employee, **When** HR Admin attempts to approve a leave request for them, **Then** the system rejects the action.

---

### User Story 6 - Salary History Tracking (Priority: P3)

The system maintains a complete salary history for each employee. Every salary change records the previous salary, new salary, effective date, reason, and who approved the change. HR Admins and Executives can view salary history; other roles cannot.

**Why this priority**: Compensation tracking is important for auditing and analytics but is not blocking for other module development.

**Independent Test**: Can be tested by performing multiple salary updates for one employee and verifying the complete history is retrievable by an HR Admin.

**Acceptance Scenarios**:

1. **Given** an employee with two prior salary changes, **When** an HR Admin requests their salary history, **Then** the system returns all entries ordered by effective date descending.
2. **Given** an Employee role user, **When** they request salary history for any employee (including themselves), **Then** the system denies the request.

---

### Edge Cases

- What happens when an employee is created with a position that does not exist? The system rejects the request with a validation error referencing the invalid position.
- What happens when an employee's department is deleted while they are still assigned to it? The system prevents department deletion if active employees are assigned.
- How does the system handle concurrent salary updates for the same employee? The system uses optimistic concurrency — the second update sees the changed salary and creates the correct history entry.
- What happens when an HR Admin tries to terminate an already-terminated employee? The system returns a conflict error indicating the employee is already terminated.
- How does the system handle employee code uniqueness across the organization? Employee codes are globally unique and enforced at the database level.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow HR Admins to create new employee records with personal details (first name, last name, email, phone, date of birth), professional details (employee code, hire date, position, department, team, contract type), and initial salary.
- **FR-002**: System MUST auto-generate a unique employee code if none is provided during creation (format: `EMP-XXXX` where XXXX is a sequential number).
- **FR-003**: System MUST enforce email uniqueness across all employees.
- **FR-004**: System MUST allow users to view employee profiles with data visibility governed by RBAC scope (OWN, TEAM, DEPARTMENT, GLOBAL).
- **FR-005**: System MUST strip salary and date-of-birth fields from responses for users without HR_ADMIN or EXECUTIVE roles.
- **FR-006**: System MUST allow only HR Admins to update employee records. Employees cannot self-update any fields.
- **FR-007**: System MUST automatically create a SalaryHistory entry whenever an employee's current salary is changed, recording previous salary, new salary, effective date, reason, and the ID of the user who made the change.
- **FR-008**: System MUST support listing employees with filtering by department, team, employment status, contract type, and position, with pagination (page + limit) and sorting (by name, hire date, or status).
- **FR-009**: System MUST support searching employees by name (partial match on first or last name).
- **FR-010**: System MUST allow HR Admins to transition employee status (ACTIVE, ON_LEAVE, PROBATION, TERMINATED, RESIGNED) with a required reason for termination and resignation.
- **FR-011**: System MUST emit domain events on employee lifecycle changes: `employee.created`, `employee.updated`, `employee.terminated`.
- **FR-012**: System MUST prevent deletion of departments or teams that have active employees assigned.
- **FR-013**: System MUST expose employee endpoints that AI agents can call with forwarded JWT context for scope-filtered results.
- **FR-014**: System MUST maintain a SalaryHistory entity with fields: employee reference, previous salary, new salary, effective date, reason, and changed-by user reference.
- **FR-015**: System MUST validate that referenced department, team, and position exist before creating or updating an employee.

### Key Entities

- **Employee**: Represents a person employed by the organization. Key attributes: employee code, name, email, phone, date of birth, hire date, employment status, contract type, current salary, manager reference, position reference, department reference, team reference. Central entity referenced by leaves, performance reviews, probation, complaints, and AI agents.
- **SalaryHistory**: Tracks every salary change for an employee over time. Key attributes: employee reference, previous salary, new salary, effective date, reason for change, changed-by reference. Provides an auditable compensation trail for HR and executives.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: HR Admins can create a complete employee record in under 30 seconds via the API.
- **SC-002**: Employee profile retrieval returns results in under 500 milliseconds for any single employee.
- **SC-003**: Listing and filtering employees with up to 10,000 records returns paginated results in under 1 second.
- **SC-004**: 100% of salary changes are captured in salary history with no data loss.
- **SC-005**: Role-based access control correctly restricts data visibility — unauthorized users never see salary or restricted personal data.
- **SC-006**: All employee lifecycle transitions emit the correct domain events consumed by downstream services.
- **SC-007**: Employee search by name returns relevant results with partial matches.

## Assumptions

- The existing small Employee table in the HR Core Prisma schema (with id, firstName, lastName, departmentId, teamId, employmentStatus) will be extended with additional fields rather than replaced — a migration will add new columns.
- The Department, Team, and Position entities already exist in the schema and will be referenced by the Employee entity.
- Authentication (JWT issuance and validation) is already handled by the IAM module — the Employee module only needs to apply guards and decorators.
- The `EmploymentStatus` enum already exists and will be reused. The `ContractType` enum (FULL_TIME, PART_TIME, CONTRACTOR, INTERN) will need to be created in `packages/shared/src/enums/`.
- Manager hierarchy is represented by a self-referencing `managerId` field on Employee pointing to another Employee's ID.
- The EventBus abstraction from `packages/shared` is available for emitting domain events.
- Salary values are stored as decimal numbers (not integers in cents) consistent with the existing schema patterns.
