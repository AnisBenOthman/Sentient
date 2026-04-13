# Research: Employee Module

**Branch**: `003-employee-module` | **Date**: 2026-04-13

## R-001: Employee Table Extension Strategy

**Decision**: Extend the existing Employee model in `apps/hr-core/prisma/schema.prisma` by adding new columns via a Prisma migration. No table replacement.

**Rationale**: The existing Employee table already has `id`, `firstName`, `lastName`, `departmentId`, `teamId`, `employmentStatus` and relations to Department/Team. Adding fields (email, phone, dateOfBirth, employeeCode, hireDate, positionId, managerId, contractType, currentSalary, timestamps) is a non-breaking migration. Prisma handles `ALTER TABLE ADD COLUMN` cleanly.

**Alternatives considered**:
- Drop & recreate: Rejected — would break existing Department/Team relations and any seed data.
- Separate `EmployeeProfile` table: Rejected — unnecessary join overhead for a single aggregate.

## R-002: ContractType Enum Location

**Decision**: Use the existing `ContractType` enum at `packages/shared/src/enums/contract-type.enum.ts`. It already has `FULL_TIME`, `PART_TIME`, `INTERN`, `CONTRACTOR`, `FIXED_TERM`.

**Rationale**: The enum already exists in the shared package. The Prisma schema will define its own `ContractType` enum (Prisma requires enums in the schema file) with the same values, and the shared TS enum is used in DTOs and service logic.

**Alternatives considered**: None needed — already exists.

## R-003: EmploymentStatus Enum — Missing RESIGNED

**Decision**: Add `RESIGNED` to the `EmploymentStatus` enum in both the shared package (`packages/shared/src/enums/employment-status.enum.ts`) and the Prisma schema.

**Rationale**: The spec requires RESIGNED as a lifecycle state. The Prisma schema already has it (`RESIGNED`), but the shared TS enum does not. These must stay in sync.

**Alternatives considered**:
- Map RESIGNED to TERMINATED: Rejected — they have different business semantics (voluntary vs. involuntary).

## R-004: Salary Storage Type

**Decision**: Use `Decimal` (Prisma's `@db.Decimal(12, 2)`) for `currentSalary` and salary history amounts.

**Rationale**: Floating-point arithmetic causes rounding errors with currency. `Decimal` provides exact precision. 12 digits total with 2 decimal places supports salaries up to 9,999,999,999.99.

**Alternatives considered**:
- `Float`: Rejected — rounding errors.
- Integer (cents): Rejected — project guidelines specify decimal, and Algerian Dinar uses fractional units minimally.

## R-005: Employee Code Auto-Generation

**Decision**: Auto-generate employee codes with format `EMP-XXXX` using a database sequence via Prisma's `@default(autoincrement())` on a separate `employeeCodeSeq` field, then format on creation.

**Rationale**: Database sequences guarantee uniqueness under concurrency without application-level locking. The service generates `EMP-` + zero-padded sequence number.

**Alternatives considered**:
- UUID-based codes: Rejected — not human-readable, spec requires `EMP-XXXX`.
- Application-level counter with MAX query: Rejected — race condition risk under concurrent writes.

## R-006: Scope Filtering Strategy

**Decision**: Build a `buildScopeFilter` helper in the employees service that returns a `Prisma.EmployeeWhereInput` based on the requesting user's JWT claims (roles, employeeId, teamId, departmentId).

**Rationale**: Matches the pattern described in `rules/security.md`. OWN scope filters by `id = user.employeeId`, TEAM scope by `teamId = user.teamId`, DEPARTMENT by `departmentId = user.departmentId`, GLOBAL returns no filter.

**Alternatives considered**:
- Global interceptor: Rejected — scope logic varies per resource; keeping it in the service is more explicit.

## R-007: Salary History Automatic Creation

**Decision**: Handle salary history creation inside `EmployeesService.update()` as a Prisma transaction. When `currentSalary` changes, create a `SalaryHistory` entry and update the employee atomically.

**Rationale**: Transaction guarantees no salary change is lost. The service compares `dto.currentSalary` with the existing value; if different, wraps both writes in `prisma.$transaction`.

**Alternatives considered**:
- Database trigger: Rejected — hides business logic from the application, harder to test, not Prisma-native.
- Separate endpoint for salary changes: Rejected — the spec defines salary update as part of the general update flow.

## R-008: Domain Event Emission

**Decision**: Use the existing `IEventBus` interface from `packages/shared/src/event-bus/`. Inject `EVENT_BUS` token in `EmployeesService`. Emit `employee.created`, `employee.updated`, `employee.terminated` events after successful database writes.

**Rationale**: The EventBus abstraction is already in the shared package. HR Core should provide an `InMemoryEventBus` implementation (Phase 1) that logs events and will be swapped for Kafka in Phase 2.

**Alternatives considered**: Direct REST callbacks — rejected in favor of the event bus abstraction already designed.

## R-009: Pagination Strategy

**Decision**: Use offset-based pagination (page + limit) for employee listing, matching common HR admin usage patterns. Support cursor-based as a secondary option for AI agent consumption.

**Rationale**: The departments module uses cursor-based pagination. However, employee listing commonly needs "go to page 5" behavior for HR admins. Support both: `page`/`limit` for human users, `cursor` for programmatic access.

**Alternatives considered**:
- Cursor-only: Rejected — HR admins need page numbers for bulk review workflows.
