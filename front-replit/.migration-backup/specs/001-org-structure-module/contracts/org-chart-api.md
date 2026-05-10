# API Contract: Org Chart

**Service**: HR Core (port 3001)  
**Base path**: `/api/hr/org-chart`  
**Auth**: `Authorization: Bearer <JWT>` (SharedJwtGuard + RbacGuard)

---

## GET /api/hr/org-chart

**Roles**: `HR_ADMIN`, `EXECUTIVE`, `SYSTEM` (Analytics Agent SYSTEM JWT)  
**Description**: Returns a complete hierarchical snapshot of the organization — active departments, their active teams, and each team's current employee count. Used by the AI Agentic Analytics Agent for org-chart visualization and org-scenario analysis.

### Query Parameters

None — the org-chart always returns the full active hierarchy. Filtering is not supported on this endpoint (the Analytics Agent needs the full picture).

### Response — 200 OK

```json
[
  {
    "id": "uuid-dept-eng",
    "name": "Engineering",
    "code": "ENG",
    "headId": "uuid-employee-or-null",
    "teams": [
      {
        "id": "uuid-team-be",
        "name": "Backend",
        "code": "BE-01",
        "leadId": "uuid-employee-or-null",
        "leadVacant": false,
        "projectFocus": "Payment Gateway v2",
        "employeeCount": 8
      },
      {
        "id": "uuid-team-fe",
        "name": "Frontend",
        "code": "FE-01",
        "leadId": "uuid-terminated-employee",
        "leadVacant": true,
        "projectFocus": null,
        "employeeCount": 5
      }
    ]
  },
  {
    "id": "uuid-dept-hr",
    "name": "Human Resources",
    "code": "HR",
    "headId": null,
    "teams": [
      {
        "id": "uuid-team-talent",
        "name": "Talent Acquisition",
        "code": null,
        "leadId": "uuid-employee",
        "leadVacant": false,
        "projectFocus": null,
        "employeeCount": 3
      }
    ]
  }
]
```

### Response Shape

```typescript
type OrgChartResponse = OrgChartDepartment[];

interface OrgChartDepartment {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  teams: OrgChartTeam[];
}

interface OrgChartTeam {
  id: string;
  name: string;
  code: string | null;
  leadId: string | null;
  leadVacant: boolean;      // true when leadId is set but employee is TERMINATED/missing
  projectFocus: string | null;
  employeeCount: number;    // count of employees with employmentStatus != TERMINATED assigned to this team
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 403 | Role is `EMPLOYEE` or `MANAGER` |
| 401 | Missing or invalid JWT |

### Performance Contract

- Must respond in < 1 second for an organization of up to 500 employees across 20 departments.
- Response is not paginated — the full hierarchy is returned in one request.
- Caching at the service layer (in-memory, TTL 60 seconds) is recommended for frequent Analytics Agent polling but is an implementation detail, not a contract requirement.

### Consumed By

| Consumer | Usage |
|----------|-------|
| AI Agentic — Analytics Agent | Org-chart visualization, org-scenario baseline |
| AI Agentic — Org Scenario Analyzer | Reads current structure before proposing `OrgScenario` changes |
| Web Frontend — Org Chart page | `org-chart-canvas.tsx` receives this as Server Component props |
| AI Agentic — Text-to-SQL | Context for department/team hierarchy in SQL generation |
