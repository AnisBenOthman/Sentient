# API Contract: Employees (HR Core :3001)

**Base path**: `/employees`  
**Guards**: `SharedJwtGuard`, `RbacGuard` on all endpoints

---

## POST /employees

**Summary**: Create a new employee  
**Roles**: `HR_ADMIN`

**Request Body**:
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required, unique, valid email)",
  "phone": "string (optional)",
  "dateOfBirth": "ISO date string (optional)",
  "hireDate": "ISO date string (required)",
  "contractType": "FULL_TIME | PART_TIME | INTERN | CONTRACTOR | FIXED_TERM (required)",
  "currentSalary": "number (optional, decimal)",
  "positionId": "UUID (optional, must exist)",
  "departmentId": "UUID (optional, must exist)",
  "teamId": "UUID (optional, must exist)",
  "managerId": "UUID (optional, must exist as Employee)",
  "employeeCode": "string (optional, auto-generated if omitted)"
}
```

**Responses**:
| Status | Description |
|--------|-------------|
| 201    | Employee created. Returns full Employee object with generated `employeeCode` and `id`. |
| 400    | Validation error (missing required fields, invalid format). |
| 403    | Forbidden — caller is not HR_ADMIN. |
| 404    | Referenced position, department, team, or manager not found. |
| 409    | Conflict — email or employeeCode already exists. |

---

## GET /employees

**Summary**: List employees with filtering, pagination, search  
**Roles**: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE`

**Query Parameters**:
| Param            | Type    | Default | Description |
|------------------|---------|---------|-------------|
| page             | number  | 1       | Page number (1-based) |
| limit            | number  | 20      | Items per page (max 100) |
| search           | string  | —       | Partial match on firstName or lastName |
| departmentId     | UUID    | —       | Filter by department |
| teamId           | UUID    | —       | Filter by team |
| employmentStatus | string  | —       | Filter by status enum value |
| contractType     | string  | —       | Filter by contract type enum value |
| positionId       | UUID    | —       | Filter by position |
| sortBy           | string  | firstName | Sort field: firstName, lastName, hireDate, employmentStatus |
| sortOrder        | string  | asc     | asc or desc |

**Scope filtering** (applied automatically from JWT):
- EMPLOYEE → returns only own record
- MANAGER → returns only employees in caller's team
- HR_ADMIN → returns all employees
- EXECUTIVE → returns all employees (read-only)

**Responses**:
| Status | Description |
|--------|-------------|
| 200    | Paginated list: `{ data: Employee[], total: number, page: number, limit: number }`. Salary/DOB stripped for non-HR_ADMIN/EXECUTIVE. |
| 403    | Forbidden — missing required role. |

---

## GET /employees/:id

**Summary**: Get single employee profile  
**Roles**: `EMPLOYEE` (own only), `MANAGER` (team only), `HR_ADMIN`, `EXECUTIVE`

**Responses**:
| Status | Description |
|--------|-------------|
| 200    | Employee profile with relations (department, team, position, manager). Salary/DOB stripped per role. Salary history included for HR_ADMIN/EXECUTIVE. |
| 403    | Forbidden — scope violation (e.g., EMPLOYEE accessing another's profile). |
| 404    | Employee not found. |

---

## PATCH /employees/:id

**Summary**: Update employee fields  
**Roles**: `HR_ADMIN`

**Request Body** (all fields optional):
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string (valid email)",
  "phone": "string",
  "dateOfBirth": "ISO date string",
  "contractType": "FULL_TIME | PART_TIME | INTERN | CONTRACTOR | FIXED_TERM",
  "currentSalary": "number (decimal) — triggers SalaryHistory creation",
  "salaryChangeReason": "string (required if currentSalary is changed)",
  "positionId": "UUID (must exist)",
  "departmentId": "UUID (must exist)",
  "teamId": "UUID (must exist)",
  "managerId": "UUID (must exist as Employee)"
}
```

**Responses**:
| Status | Description |
|--------|-------------|
| 200    | Updated Employee object. |
| 400    | Validation error. If salary changed without reason, returns error. |
| 403    | Forbidden — caller is not HR_ADMIN. |
| 404    | Employee or referenced entity not found. |
| 409    | Conflict — email already in use. |

**Side effects**:
- If `currentSalary` changes → creates `SalaryHistory` entry
- Emits `employee.updated` domain event

---

## PATCH /employees/:id/status

**Summary**: Transition employee employment status  
**Roles**: `HR_ADMIN`

**Request Body**:
```json
{
  "status": "ACTIVE | ON_LEAVE | PROBATION | TERMINATED | RESIGNED (required)",
  "reason": "string (required for TERMINATED and RESIGNED)",
  "effectiveDate": "ISO date string (optional, defaults to now)"
}
```

**Responses**:
| Status | Description |
|--------|-------------|
| 200    | Updated Employee with new status. |
| 400    | Invalid transition (e.g., TERMINATED → ACTIVE) or missing reason. |
| 403    | Forbidden — caller is not HR_ADMIN. |
| 404    | Employee not found. |
| 409    | Conflict — employee already in target status. |

**Side effects**:
- TERMINATED or RESIGNED → emits `employee.terminated` domain event
- Other transitions → emits `employee.updated` domain event

---

## GET /employees/:id/salary-history

**Summary**: Get salary history for an employee  
**Roles**: `HR_ADMIN`, `EXECUTIVE`

**Query Parameters**:
| Param | Type   | Default | Description |
|-------|--------|---------|-------------|
| limit | number | 50      | Max entries to return |

**Responses**:
| Status | Description |
|--------|-------------|
| 200    | Array of SalaryHistory entries, ordered by effectiveDate descending. |
| 403    | Forbidden — caller is not HR_ADMIN or EXECUTIVE. |
| 404    | Employee not found. |
