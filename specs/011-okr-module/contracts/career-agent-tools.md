# Career Agent Tool Extensions: OKR Module

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **REST contract**: [rest-api.md](./rest-api.md)
**Where they live**: `apps/ai-agentic/src/tools/okr-tools/` + registered in `apps/ai-agentic/src/tools/tool-registry.ts` under a new `OkrTools` group.

This contract specifies the three new LangGraph-wrapped tools added to the existing **Career Agent** in AI Agentic. No new agent is created — these are extensions of the Career Agent's existing tool surface (its graph topology does not change).

---

## Design summary

| Tool | Purpose | LLM involvement | REST calls |
|---|---|---|---|
| `suggestObjectiveDraft` | Draft a personal Objective for the employee, aligned to a chosen department Objective | LLM (small deterministic prompt) | `GET /api/hr/objectives/:departmentOkrId`, `GET /api/hr/employees/:employeeId` |
| `suggestKeyResults` | Propose 2–4 measurable Key Results for an Objective | LLM (small deterministic prompt) | `GET /api/hr/objectives/:objectiveId` (if `objectiveId` provided) |
| `flagAtRiskOkrs` | Identify KRs scoring < 0.3 in a cycle and summarise risks for the Manager | No LLM (pure REST aggregation) | `GET /api/hr/okr-analytics/cycle/:cycleId/summary` |

All three tools use the standard `AgentContext` (`jwt`, `claims`, `isSystemContext`, `taskLogId`) and route REST calls through the existing `HrCoreClient`. RBAC is enforced **at the HR Core endpoints** — the tool itself does no pre-checking (research R10). On HTTP 403, the existing `GracefulDegradationHandler` returns `AgentDegradationResult` and the agent explains the limitation; on HTTP 200, the tool returns its typed output to the LangGraph state.

---

## Tool 1: `suggestObjectiveDraft`

### Purpose

Given an employee and a chosen department Objective, draft a personal `EMPLOYEE`-level Objective the employee could create, aligned to that department Objective. Returns a candidate `title`, `description`, and the parent's `title` for context.

### Input schema (Zod)

```ts
import { z } from 'zod';

export const SuggestObjectiveDraftInput = z.object({
  employeeId: z.string().uuid(),
  departmentOkrId: z.string().uuid(),
});

export type SuggestObjectiveDraftInput = z.infer<typeof SuggestObjectiveDraftInput>;
```

### Output schema (Zod)

```ts
export const SuggestObjectiveDraftOutput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  alignedTo: z.string(),                  // The parent department Objective's title (for confirmation in chat)
  rationale: z.string().max(1000),         // One-paragraph reasoning the agent shows in chat
});

export type SuggestObjectiveDraftOutput = z.infer<typeof SuggestObjectiveDraftOutput>;
```

### REST dependencies

| Call | Purpose | Failure handling |
|---|---|---|
| `HrCoreClient.getObjective(departmentOkrId, context)` | Loads parent title + description for the prompt | 404 → `AgentDegradationResult` "I couldn't find the department OKR you mentioned"; 403 → "You don't have access to that department OKR" |
| `HrCoreClient.getEmployee(employeeId, context)` | Loads employee's department + role for context | 404 → degradation; 403 → degradation |

### LLM prompt template

```
SYSTEM: You are an OKR coach helping an employee draft a personal Objective aligned to a department goal.
You produce ONE Objective, not a list. The Objective must be specific to this individual contributor.

DEPARTMENT GOAL:
- Title: {parentTitle}
- Description: {parentDescription}

EMPLOYEE CONTEXT:
- Role: {employeeRole}
- Department: {employeeDepartment}

USER REQUEST: Draft a personal Objective for this employee that contributes meaningfully to the department goal.

OUTPUT FORMAT (strict JSON):
{
  "title": "<≤200 chars, action-oriented, written in first person>",
  "description": "<≤500 chars, explains the why and the rough how>",
  "alignedTo": "<exact parent title>",
  "rationale": "<one paragraph explaining how this personal Objective rolls up to the department goal>"
}
```

The prompt is deterministic-ish (temperature 0.3) — we want consistent, conservative drafts the employee can edit, not creative leaps.

### AgentTaskLog

| Field | Value |
|---|---|
| `taskType` | `'okr.suggest_objective_draft'` |
| `agentType` | `CAREER_AGENT` |
| `targetService` | `HR_CORE` |
| `input` | `{ employeeId, departmentOkrId }` |
| `output` | `SuggestObjectiveDraftOutput` (or `null` on degradation) |
| `parentLogId` | Conversation's root log id |
| `status` | `SUCCESS` / `DEGRADED` / `FAILED` |
| `durationMs` | LLM call + REST round-trips |

### RBAC (enforced by REST endpoints)

| Caller | Allowed when |
|---|---|
| `EMPLOYEE` | `employeeId == caller.employeeId` (own draft only) |
| `MANAGER` | `employeeId == caller.employeeId` OR employee is a direct report |
| `HR_ADMIN` | Always |
| `EXECUTIVE` | Denied (Executives don't draft personal OKRs) |

The HR Core `GET /api/hr/employees/:id` endpoint already enforces this; on 403 the tool returns degradation.

---

## Tool 2: `suggestKeyResults`

### Purpose

Given an Objective (title + description, optionally referenced by id), propose 2–4 measurable Key Results the user could attach. Each KR includes a `title`, `metricType`, suggested `targetValue`, and `unit` — ready to drop into the `POST /api/hr/key-results` form.

### Input schema (Zod)

```ts
export const SuggestKeyResultsInput = z.object({
  // Either pass an existing Objective id, or the raw title + description for a draft-stage Objective
  objectiveId: z.string().uuid().optional(),
  objectiveTitle: z.string().min(1).max(200).optional(),
  objectiveDescription: z.string().max(2000).optional(),
}).refine(
  (v) => v.objectiveId || v.objectiveTitle,
  { message: 'Must provide either objectiveId or objectiveTitle' },
);

export type SuggestKeyResultsInput = z.infer<typeof SuggestKeyResultsInput>;
```

### Output schema (Zod)

```ts
export const SuggestKeyResultsOutput = z.object({
  keyResults: z.array(z.object({
    title: z.string().min(1).max(200),
    metricType: z.enum(['PERCENTAGE', 'NUMBER', 'CURRENCY', 'BOOLEAN']),
    targetValue: z.number().positive(),
    unit: z.string().min(1).max(32),
    rationale: z.string().max(500),
  })).min(2).max(4),
});

export type SuggestKeyResultsOutput = z.infer<typeof SuggestKeyResultsOutput>;
```

### REST dependencies

| Call | When | Failure handling |
|---|---|---|
| `HrCoreClient.getObjective(objectiveId, context)` | Only if `objectiveId` provided | 404 → degradation; 403 → degradation |

If only `objectiveTitle` + `objectiveDescription` are provided, no REST call is made — the tool goes straight to the LLM.

### LLM prompt template

```
SYSTEM: You are an OKR coach. Given one Objective, generate 2–4 Key Results.
Every KR MUST be measurable — pick a metricType from {PERCENTAGE, NUMBER, CURRENCY, BOOLEAN} and a sensible target.
KRs must be specific and outcome-focused — never task lists.

OBJECTIVE:
- Title: {objectiveTitle}
- Description: {objectiveDescription}

CONSTRAINTS:
- Return between 2 and 4 KRs (typical: 3).
- For BOOLEAN KRs, targetValue MUST be 1.
- For PERCENTAGE KRs, unit should be "%".
- For CURRENCY KRs, unit should be the currency code (e.g. "DZD", "EUR").
- For NUMBER KRs, unit is the noun being counted (e.g. "hires", "blog posts", "incidents").

OUTPUT FORMAT (strict JSON):
{
  "keyResults": [
    {
      "title": "<≤200 chars, starts with a verb, names the metric>",
      "metricType": "PERCENTAGE" | "NUMBER" | "CURRENCY" | "BOOLEAN",
      "targetValue": <number>,
      "unit": "<≤32 chars>",
      "rationale": "<≤500 chars; why this KR measures progress on the Objective>"
    }
  ]
}
```

Temperature 0.4 (slightly higher than `suggestObjectiveDraft` because KR creativity is helpful — we want a small spread of measure types to pick from).

### AgentTaskLog

| Field | Value |
|---|---|
| `taskType` | `'okr.suggest_key_results'` |
| `agentType` | `CAREER_AGENT` |
| `targetService` | `HR_CORE` (when `objectiveId` provided) or `null` (LLM-only) |
| `input` | `SuggestKeyResultsInput` |
| `output` | `SuggestKeyResultsOutput` |
| `parentLogId` | Conversation's root log id |
| `status` | `SUCCESS` / `DEGRADED` / `FAILED` |

### RBAC (enforced when REST call happens)

| Caller | Allowed when |
|---|---|
| `EMPLOYEE` | Read access to the Objective (own personal Objective, or department Objective in their dept, or any company Objective) |
| `MANAGER` | Read access (own dept + company) |
| `HR_ADMIN` | Always |
| `EXECUTIVE` | Allowed (read-only — Executives may draft KRs as suggestions for HR_ADMIN to consider) |

Note: this tool does NOT call any write endpoint. The suggested KRs are returned to the user in chat; the user (or the agent on the user's behalf via a future `createKeyResult` tool) decides whether to persist them.

---

## Tool 3: `flagAtRiskOkrs`

### Purpose

For a given Manager and cycle, identify all Key Results in the Manager's department whose `score < 0.3` AND status is not `ACHIEVED` / `CANCELLED` AND that have at least one approved check-in. Returns a compact list ready for the agent to summarise verbally.

### Input schema (Zod)

```ts
export const FlagAtRiskOkrsInput = z.object({
  managerId: z.string().uuid(),       // Employee.id of the Manager
  cycleId: z.string().uuid(),
});

export type FlagAtRiskOkrsInput = z.infer<typeof FlagAtRiskOkrsInput>;
```

### Output schema (Zod)

```ts
export const FlagAtRiskOkrsOutput = z.object({
  atRisk: z.array(z.object({
    keyResultId: z.string().uuid(),
    title: z.string(),
    score: z.number().min(0).max(1),
    employeeIds: z.array(z.string().uuid()),     // assignees (display names resolved in chat by the agent)
    objectiveId: z.string().uuid(),
    objectiveTitle: z.string(),
  })),
  cycleName: z.string(),
  departmentName: z.string(),
});

export type FlagAtRiskOkrsOutput = z.infer<typeof FlagAtRiskOkrsOutput>;
```

### REST dependencies

| Call | Purpose | Failure handling |
|---|---|---|
| `HrCoreClient.getCycleSummary(cycleId, context)` | Returns the dashboard summary including `atRiskKrs` array; the tool filters by the Manager's department | 403 → degradation: "I can only show this to a Manager of the relevant department" |

This is a pure REST aggregation — **no LLM call**. The Career Agent uses the returned data to compose a chat reply ("3 KRs are at risk in Engineering — `Reduce p95 latency to 50ms` is at 0.18, …").

### AgentTaskLog

| Field | Value |
|---|---|
| `taskType` | `'okr.flag_at_risk_okrs'` |
| `agentType` | `CAREER_AGENT` |
| `targetService` | `HR_CORE` |
| `input` | `{ managerId, cycleId }` |
| `output` | `FlagAtRiskOkrsOutput` |
| `parentLogId` | Conversation's root log id |
| `status` | `SUCCESS` / `DEGRADED` / `FAILED` |

### RBAC (enforced by `/api/hr/okr-analytics/cycle/:cycleId/summary`)

| Caller | Allowed |
|---|---|
| `EMPLOYEE` | ❌ — returns 403, agent degrades gracefully |
| `MANAGER` | ✅ for own dept only (response is scope-filtered server-side) |
| `HR_ADMIN` | ✅ (all departments) |
| `EXECUTIVE` | ✅ (read-only, all departments) |

When an EMPLOYEE asks the Career Agent "what's at risk in Engineering?", the tool is called, gets a 403 from HR Core, returns `AgentDegradationResult`. The agent responds: "I can't show you department-level risk data — that's visible to your Manager and HR. I can share your own portfolio if you'd like."

---

## ToolRegistry integration

In `apps/ai-agentic/src/tools/tool-registry.ts`:

```ts
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { suggestObjectiveDraftTool } from './okr-tools/suggest-objective-draft.tool';
import { suggestKeyResultsTool } from './okr-tools/suggest-key-results.tool';
import { flagAtRiskOkrsTool } from './okr-tools/flag-at-risk-okrs.tool';
// ...existing imports

export const OkrTools = (deps: ToolDeps) => [
  suggestObjectiveDraftTool(deps),
  suggestKeyResultsTool(deps),
  flagAtRiskOkrsTool(deps),
];

// In the Career Agent's graph builder:
const tools = [
  ...EmployeeTools(deps),
  ...PerformanceTools(deps),
  ...OkrTools(deps),                                  // ← new
];
```

Each tool factory returns a `DynamicStructuredTool` with:
- `name` matching the tool id (`suggestObjectiveDraft`, etc.).
- `description` (a one-line invocation hint for the LLM).
- `schema` = the Zod input schema above.
- `func` = the implementation calling `HrCoreClient` + LLM.

---

## Frontend wiring

The three tools are invoked from the existing Career Agent chat UI (`apps/web/src/pages/chat.tsx` or whichever route the existing Career Agent uses). No new frontend page is added for AI tool exposure — these are tools the LLM picks from based on the user's natural-language request:

- "Help me draft a personal OKR aligned to Engineering's 'Ship 4 features' goal" → LLM calls `suggestObjectiveDraft`.
- "What Key Results should I attach to this Objective?" → LLM calls `suggestKeyResults`.
- "Which of my team's KRs are at risk this quarter?" → LLM calls `flagAtRiskOkrs`.

The agent's response renders inline in chat with structured cards (using the existing Conversation/Message rendering); when `suggestObjectiveDraft` or `suggestKeyResults` returns, the chat reply includes a **"Create this in my OKRs"** button that deep-links to `/my-okrs` (or `/okr-cycle-management` for HR_ADMIN) with the draft pre-filled in the URL hash. This is a small UX polish — the user always edits before saving.

---

## Testing

Per the testing strategy in `.claude/rules/testing.md`:

- **Unit tests** (`apps/ai-agentic/src/tools/okr-tools/*.spec.ts`):
  - Mock `HrCoreClient` and the LLM (`mockLlm` helper).
  - Assert Zod input/output schemas accept/reject correctly.
  - Assert 403 → `AgentDegradationResult` (graceful path).
  - Assert REST call URLs and JWT forwarding.

- **Contract test** (`apps/ai-agentic/test/contracts/hr-core-client.contract.spec.ts`, extended):
  - Nock-stub `GET /api/hr/objectives/:id`, `GET /api/hr/employees/:id`, `GET /api/hr/okr-analytics/cycle/:id/summary`.
  - Assert `HrCoreClient.getObjective`, `getEmployee`, `getCycleSummary` return shapes match the OKR REST contract above.

No integration test for the Career Agent itself is in scope for this feature — that test lives with the agent's own test suite when it ships. The three tools are unit-tested in isolation.
