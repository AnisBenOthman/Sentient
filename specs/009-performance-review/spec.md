# Feature Specification: Performance Review

**Feature Branch**: `009-performance-review`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "performance-review based on core-hris-class-diagram"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initiate a Review Cycle (Priority: P1)

An HR admin starts a review cycle for eligible employees so each employee and their reviewer know what review is expected, when it is due, and which form inputs must be completed.

**Why this priority**: Without an active review cycle, self-reviews and manager reviews have no shared schedule, population, or accountability.

**Independent Test**: Can be fully tested by initiating a review cycle for a defined employee group and confirming that draft review records exist for the expected employees with assigned reviewers and due dates.

**Acceptance Scenarios**:

1. **Given** eligible active employees exist with assigned managers, **When** an HR admin initiates a review cycle, **Then** each eligible employee receives one review assignment linked to the employee and reviewer.
2. **Given** an employee has no assigned reviewer, **When** an HR admin initiates a review cycle, **Then** that employee is flagged for HR resolution and no incomplete reviewer assignment is silently created.
3. **Given** a review cycle is already active for the same population and period, **When** an HR admin tries to start a duplicate cycle, **Then** the system prevents duplicate review assignments and explains the conflict.

---

### User Story 2 - Submit Employee Self-Review (Priority: P2)

An employee completes their self-review during an active cycle by recording satisfaction scores, training opportunities taken, work-life balance, self-rating, and comments.

**Why this priority**: Employee input is the foundation for a fair performance conversation and matches the review data described in the core HRIS class diagram.

**Independent Test**: Can be fully tested by opening an assigned active review as the employee, entering all required self-review inputs, submitting it, and confirming the review becomes available for manager assessment.

**Acceptance Scenarios**:

1. **Given** an employee has an active review assignment, **When** they submit valid self-review inputs, **Then** the system stores the submission and marks the employee portion complete.
2. **Given** a satisfaction or self-rating value falls outside the accepted five-point scale, **When** the employee attempts to submit, **Then** the system rejects the submission and identifies the invalid field.
3. **Given** the active review window has closed, **When** an employee attempts to submit or edit self-review inputs, **Then** the system blocks the change unless HR reopens the assignment.

---

### User Story 3 - Complete Manager Review (Priority: P3)

A reviewer evaluates assigned employees by reviewing employee self-review responses, adding the manager rating, and recording final comments for the review.

**Why this priority**: Manager assessment completes the performance record and creates an auditable outcome for HR decisions.

**Independent Test**: Can be fully tested by assigning a reviewer to an employee review, submitting the manager rating and comments, and confirming the review reaches completed status.

**Acceptance Scenarios**:

1. **Given** an employee has submitted their self-review, **When** the assigned reviewer submits a manager rating and comments, **Then** the review is marked complete and visible to authorized HR users.
2. **Given** a reviewer attempts to review an employee outside their assigned review list, **When** they access or submit the review, **Then** the system denies the action.
3. **Given** the manager rating is lower than the employee self-rating by two or more points, **When** the reviewer completes the review, **Then** the review is highlighted for HR follow-up.

---

### User Story 4 - Track Review Outcomes and Follow-Up (Priority: P4)

An HR admin views performance review outcomes across employees, departments, positions, and reviewers, and records any post-review salary follow-up when applicable.

**Why this priority**: HR needs review visibility for governance, compensation discussions, training planning, and employee history.

**Independent Test**: Can be fully tested by completing multiple reviews and confirming HR can filter results, inspect individual records, identify follow-up items, and record a salary-history reason tied to the review outcome.

**Acceptance Scenarios**:

1. **Given** multiple reviews exist, **When** HR filters by review period, department, reviewer, or rating, **Then** matching reviews are displayed with employee, reviewer, review date, and outcome summaries.
2. **Given** a completed review results in a compensation follow-up, **When** HR records the follow-up, **Then** the employee salary history includes the reason "Annual review" or another HR-entered reason.
3. **Given** a non-HR user views review data, **When** they access review lists, **Then** they only see reviews they are authorized to view.

### Edge Cases

- If an employee changes manager during an active cycle, the existing review keeps its assigned reviewer unless HR explicitly reassigns it.
- If an employee becomes inactive during an active cycle, pending reviews for that employee are paused and HR is prompted to complete, cancel, or reassign them.
- If a reviewer leaves the organization before completing assigned reviews, HR can reassign those reviews without losing submitted employee input.
- If an employee has multiple historical reviews, users can distinguish them by review date and cycle period.
- If review comments contain sensitive personal information, access remains limited to authorized participants and HR roles.
- If a review is completed, later edits require an HR reopen action and a visible audit reason.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow HR admins to initiate a review cycle for a defined set of eligible active employees.
- **FR-002**: The system MUST create one review assignment per eligible employee per review cycle and prevent duplicates for the same employee and cycle.
- **FR-003**: The system MUST assign each review to the reviewed employee and a reviewer, normally the employee's current manager unless HR overrides the reviewer.
- **FR-004**: The system MUST allow HR admins to resolve employees who lack an assigned reviewer before those employees can enter the review workflow.
- **FR-005**: Employees MUST be able to submit self-review inputs for environment satisfaction, job satisfaction, relationship satisfaction, training opportunities taken, work-life balance, self-rating, and comments.
- **FR-006**: The system MUST validate all satisfaction values on a five-point scale from very dissatisfied to very satisfied.
- **FR-007**: The system MUST validate all performance rating values on a five-point scale from unacceptable to above and beyond.
- **FR-008**: The system MUST allow assigned reviewers to view employee self-review input and submit manager rating and reviewer comments.
- **FR-009**: The system MUST track review status from assignment through employee submission, manager completion, and HR closure.
- **FR-010**: The system MUST prevent employees from editing submitted or closed review inputs unless HR reopens the review.
- **FR-011**: HR admins MUST be able to reopen a submitted or completed review with a required reason.
- **FR-012**: The system MUST preserve the review's employee, reviewer, review date, satisfaction values, training count, ratings, comments, status, and creation history.
- **FR-013**: HR admins MUST be able to search and filter reviews by employee, reviewer, department, position, review period, status, and rating outcome.
- **FR-014**: Managers MUST be able to view summary progress for reviews assigned to them, including not started, employee submitted, overdue, and completed reviews.
- **FR-015**: HR admins MUST be able to identify reviews where manager rating differs from self-rating by two or more points.
- **FR-016**: HR admins MUST be able to record a post-review salary follow-up reason when a completed review leads to a pay change.
- **FR-017**: The system MUST limit review visibility so employees see their own reviews, reviewers see assigned reviews, and HR admins see all reviews.
- **FR-018**: The system MUST record who performed key review actions and when they happened.
- **FR-019**: The system MUST provide clear validation messages when required review fields are missing or values are outside accepted ranges.
- **FR-020**: The system MUST support historical review lookup for each employee without overwriting prior reviews.

### Key Entities

- **Performance Review**: A review record for one employee and one reviewer, including review date, satisfaction scores, training opportunities taken, work-life balance, self-rating, manager rating, comments, status, and creation history.
- **Employee**: The person being reviewed. The employee can submit self-review inputs and can have multiple historical performance reviews.
- **Reviewer**: The employee assigned to assess another employee's performance, normally the reviewed employee's manager.
- **Review Cycle**: The HR-defined review period that determines the eligible employee population, active submission window, due dates, and whether self-review is currently available.
- **Satisfaction Level**: A five-point scale used for environment, job, relationship, and work-life balance measures.
- **Performance Rating**: A five-point scale used for employee self-rating and manager rating, ranging from unacceptable to above and beyond.
- **Salary Follow-Up**: A post-review compensation action recorded when a completed review leads to salary history changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: HR admins can initiate a review cycle for 500 eligible employees in under 5 minutes, excluding time spent resolving missing reviewer assignments.
- **SC-002**: At least 95% of employees with an assigned active review can submit a complete self-review on their first attempt without HR assistance.
- **SC-003**: Assigned reviewers can complete a manager review in under 10 minutes after employee self-review submission.
- **SC-004**: HR admins can identify overdue, incomplete, and rating-gap reviews for a cycle in under 2 minutes.
- **SC-005**: 100% of completed reviews retain employee, reviewer, review date, satisfaction scores, ratings, and comments for historical lookup.
- **SC-006**: Unauthorized users are blocked from viewing or changing reviews outside their permitted scope in all access tests.
- **SC-007**: Duplicate review assignments for the same employee and review cycle occur in 0 accepted initiation attempts.

## Assumptions

- Review cycles are initiated and governed by HR admins.
- Active employees with a current manager are eligible by default.
- Managers are the default reviewers, with HR able to override or reassign reviewers.
- Employees can submit self-review inputs only during an active review window.
- Completed reviews become read-only unless HR reopens them with a reason.
- Salary changes are not part of the review itself; the feature only supports recording a post-review salary follow-up reason for salary history workflows.
- The core HRIS class diagram is the source of truth for the main Performance Review fields and the Employee, Satisfaction Level, and Performance Rating relationships.
