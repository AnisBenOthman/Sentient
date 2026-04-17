# Data Model: Employee Module

**Branch**: `003-employee-module` | **Date**: 2026-04-13

## Entities

### Employee (extends existing table)

The existing Employee table is extended with new fields. Fields marked with `[NEW]` are additions; unmarked fields already exist.

| Field            | Type              | Constraints                          | Notes                              |
|------------------|-------------------|--------------------------------------|------------------------------------|
| id               | UUID              | PK, auto-generated                   | Exists                             |
| employeeCode     | String            | Unique, not null `[NEW]`             | Format: `EMP-XXXX`, auto-generated |
| firstName        | String            | Not null                             | Exists                             |
| lastName         | String            | Not null                             | Exists                             |
| email            | String            | Unique, not null `[NEW]`             | Business email                     |
| phone            | String            | Optional `[NEW]`                     | Contact phone                      |
| dateOfBirth      | DateTime          | Optional `[NEW]`                     | PII — stripped for non-admin roles |
| hireDate         | DateTime          | Not null `[NEW]`                     | Date employee joined               |
| employmentStatus | EmploymentStatus  | Not null, default ACTIVE             | Exists (enum extended with RESIGNED) |
| contractType     | ContractType      | Not null `[NEW]`                     | FULL_TIME, PART_TIME, etc.         |
| currentSalary    | Decimal(12,2)     | Optional `[NEW]`                     | CONFIDENTIAL — stripped for non-admin |
| positionId       | UUID              | FK → Position, optional `[NEW]`      | Job title reference                |
| departmentId     | UUID              | FK → Department, optional            | Exists                             |
| teamId           | UUID              | FK → Team, optional                  | Exists                             |
| managerId        | UUID              | Self-ref FK → Employee, optional `[NEW]` | Direct manager (hierarchy)     |
| createdAt        | DateTime          | Auto, not null `[NEW]`               | Record creation timestamp          |
| updatedAt        | DateTime          | Auto, not null `[NEW]`               | Last update timestamp              |

**Indexes** (in addition to existing departmentId, teamId, employmentStatus):
- `@@index([email])` — unique constraint handles lookups
- `@@index([employeeCode])` — unique constraint handles lookups
- `@@index([positionId])`
- `@@index([managerId])`

**Relations**:
- `department` → Department (many-to-one, optional)
- `team` → Team (many-to-one, optional)
- `position` → Position (many-to-one, optional)
- `manager` → Employee (self-ref many-to-one, optional)
- `directReports` → Employee[] (self-ref one-to-many)
- `salaryHistory` → SalaryHistory[] (one-to-many)

### SalaryHistory (new table)

| Field          | Type          | Constraints               | Notes                           |
|----------------|---------------|---------------------------|---------------------------------|
| id             | UUID          | PK, auto-generated        |                                 |
| employeeId     | UUID          | FK → Employee, not null   | The employee whose salary changed |
| previousSalary | Decimal(12,2) | Not null                  | Salary before the change        |
| newSalary      | Decimal(12,2) | Not null                  | Salary after the change         |
| effectiveDate  | DateTime      | Not null                  | When the change takes effect    |
| reason         | String        | Optional                  | Justification for the change    |
| changedById    | String        | Not null                  | userId (from JWT) who made the change |
| createdAt      | DateTime      | Auto, not null            | Record creation timestamp       |

**Indexes**:
- `@@index([employeeId])`
- `@@index([effectiveDate])`

**Relations**:
- `employee` → Employee (many-to-one)

## Enum Changes

### EmploymentStatus (update shared package)

Add `RESIGNED` to `packages/shared/src/enums/employment-status.enum.ts`:

```
ACTIVE, ON_LEAVE, PROBATION, TERMINATED, RESIGNED
```

The Prisma schema already has `RESIGNED`. The shared TS enum must be synchronized.

### ContractType (already exists)

No changes needed. Exists at `packages/shared/src/enums/contract-type.enum.ts` with: `FULL_TIME`, `PART_TIME`, `INTERN`, `CONTRACTOR`, `FIXED_TERM`.

A matching Prisma enum must be added to the HR Core schema file.

## State Machine: Employment Status

```
                  ┌──────────┐
         ┌──────→│ ON_LEAVE │──────┐
         │        └──────────┘      │
         │                          ▼
    ┌────────┐               ┌──────────┐
    │ ACTIVE │──────────────→│TERMINATED│
    └────────┘               └──────────┘
         │                         
         ├──────────────────→┌──────────┐
         │                   │ RESIGNED │
         │                   └──────────┘
         │
         ▼
    ┌───────────┐
    │ PROBATION │──→ ACTIVE (confirmed) or TERMINATED (failed)
    └───────────┘
```

**Transition rules**:
- ACTIVE → ON_LEAVE, PROBATION, TERMINATED, RESIGNED
- ON_LEAVE → ACTIVE, TERMINATED
- PROBATION → ACTIVE, TERMINATED
- TERMINATED → (terminal state, no transitions)
- RESIGNED → (terminal state, no transitions)

## Domain Events

| Event                | Trigger                    | Payload                                          |
|----------------------|----------------------------|--------------------------------------------------|
| `employee.created`   | New employee record saved  | `{ employeeId, departmentId, teamId }`           |
| `employee.updated`   | Employee record updated    | `{ employeeId, changedFields: string[] }`        |
| `employee.terminated`| Status → TERMINATED or RESIGNED | `{ employeeId, reason, effectiveDate }`     |
