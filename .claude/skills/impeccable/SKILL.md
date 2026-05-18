---
name: "impeccable"
description: "Reads a file, finds every flaw, and rewrites it to production-perfect quality. Covers TypeScript strict-mode, TanStack Query v5, shadcn/ui, Tailwind v4, NestJS, Prisma, RBAC, accessibility, and Sentient project conventions. Unlike a review skill, this skill FIXES — it produces the final, committed version of the file."
argument-hint: "File path to make impeccable (e.g. 'apps/web/src/pages/leaves.tsx' or 'apps/hr-core/src/modules/leaves/requests/requests.service.ts')"
user-invocable: true
---

## User Input

```text
$ARGUMENTS
```

---

# Impeccable — Make It Production-Perfect

You are acting as a **Senior Full-Stack Engineer** performing a final polish pass before code ships. Your job is not to report findings — it is to **fix them**. When done, the file must be production-perfect: no warnings, no smell, no shortcuts.

## Step 1 — Orient

1. Read the file at the path provided.
2. Determine whether it is a **frontend file** (`apps/web/`) or a **backend file** (`apps/hr-core/`, `apps/social/`, `apps/ai-agentic/`), then apply the matching checklist below.
3. If the path is ambiguous or missing, ask once: "Which file should I make impeccable?"

## Step 2 — Audit (silent)

Work through every checklist section silently. Do not output the checklist — accumulate all findings internally.

---

## Frontend Checklist (apps/web/)

### TypeScript
- [ ] No `any` — use `unknown` + narrow, or the correct interface
- [ ] No `as unknown as T` — fix the type, not the error
- [ ] `noUncheckedIndexedAccess`: every `array[i]` access guarded with optional-chain or explicit check
- [ ] All exported functions and components have explicit return types
- [ ] Props interfaces are top-level named types, not inlined anonymous objects for anything non-trivial
- [ ] Status/role/enum strings use imported enums from `@sentient/shared`, never raw literals like `'PENDING'`
- [ ] `import type` used for type-only imports

### TanStack Query v5
- [ ] `queryKey` arrays include **all** filter parameters that change the result
- [ ] `queryFn` is a lambda `() => apiFn(params)`, never called directly
- [ ] Every `useQuery` has a loading branch and an error branch rendered in JSX
- [ ] `invalidateQueries` key matches the query key prefix of the query it is invalidating
- [ ] Submit buttons have `disabled={mutation.isPending}`
- [ ] No `useEffect` for data fetching — all async data goes through `useQuery`
- [ ] Read-heavy queries have `staleTime` set (avoid waterfall refetches on focus)
- [ ] Admin queries that include inactive records use a distinct query key segment (e.g. `"all"`) to avoid cache collision with filtered queries

### Component Structure
- [ ] Page component is thin — it orchestrates, it does not own business logic
- [ ] No API call logic inlined inside a component — all calls live in `src/lib/api/`
- [ ] List items use stable `key={item.id}` — not array index
- [ ] No anonymous functions as event handlers inside map() — extract or use `useCallback`
- [ ] Components over ~250 lines are split into named sub-components

### Styling — Tailwind v4
- [ ] No hardcoded hex/rgb colors in `className` — use design tokens from `@theme {}`
- [ ] Dynamic user-supplied colors (e.g. leave type dot) use `style={{ backgroundColor: t.color }}`
- [ ] `cn()` (from `@/lib/utils`) for conditional class merging, never template-string concatenation
- [ ] Dark-mode variants present on text/background that would be invisible in dark mode
- [ ] Multi-variant components use `cva` — not long conditional class strings

### shadcn/ui
- [ ] Components imported from `@/components/ui/` not from `radix-ui` directly
- [ ] `<Dialog>` controlled with `open` / `onOpenChange` state
- [ ] Destructive confirmations use `<AlertDialog>`, not `window.confirm()`
- [ ] Icon-only `<Button>` has `aria-label`
- [ ] Form `<Label>` linked to input via `htmlFor` / `id`

### Auth & Permissions
- [ ] Protected content checks `user?.roles.includes('HR_ADMIN')` before rendering
- [ ] BU-scoped queries pass `businessUnitId` from `user?.businessUnitId`
- [ ] No JWT decoded inside a component — only `useAuth()` hook

### API Client
- [ ] All API calls defined in `src/lib/api/hr-core.ts` (or social.ts / ai.ts)
- [ ] Axios calls are typed: `hrClient.get<T>(...)` — never returning `any`
- [ ] Query params passed as `{ params }` object — not string-concatenated into the URL
- [ ] `onError` on every mutation shows a toast or sets an error state

### Accessibility
- [ ] Every `<input>` / `<select>` / `<textarea>` has a visible `<Label htmlFor>`
- [ ] Icon-only interactive elements have `aria-label`
- [ ] Status is communicated by text or icon, not color alone

### Code Cleanliness
- [ ] No `console.log` left in production code
- [ ] No commented-out code blocks
- [ ] No unused imports
- [ ] No magic numbers — extract to named constants
- [ ] No `TODO` comments without a linked issue number

---

## Backend Checklist (apps/hr-core/ · apps/social/ · apps/ai-agentic/)

### TypeScript
- [ ] No `any` — use `unknown` and narrow, or the correct Prisma/DTO type
- [ ] All public service methods have explicit return types (`Promise<T>`)
- [ ] No `as unknown as T` casts — fix the type
- [ ] `noUncheckedIndexedAccess`: `array[0]` is `T | undefined` — guarded before use

### NestJS Architecture
- [ ] Controller methods are thin — validate input (DTO + pipes), delegate to service, return
- [ ] No business logic in controllers
- [ ] Every controller has `@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)` (unless explicitly exempted)
- [ ] Every endpoint has `@Roles(...)` decorator
- [ ] Every endpoint has `@ApiOperation` and at least one `@ApiResponse`
- [ ] Constructor injection only — no property injection for required deps

### DTOs
- [ ] All input DTOs validated with `class-validator` decorators
- [ ] `@IsOptional()` placed before the type decorator on optional fields
- [ ] No business logic inside DTOs

### Service Layer
- [ ] Services trust their validated inputs — no double-validation of what DTOs already checked
- [ ] Prisma `findUnique` / `findFirst` return values checked for `null` before use
- [ ] `NotFoundException` thrown when an entity is not found (not a raw `Error`)
- [ ] `BadRequestException` used for recoverable business rule violations with a machine-readable code (e.g. `'InsufficientBalance'`)
- [ ] `ConflictException` used for uniqueness violations (P2002)
- [ ] Cross-service calls go through injected REST clients — never direct Prisma queries across schema boundaries

### Prisma
- [ ] Every model has `@@schema(...)` annotation
- [ ] Every model has `@@map(...)` snake_case table name
- [ ] No raw `$queryRawUnsafe` with user-provided input — use parameterized `$queryRaw` template literals
- [ ] Soft-deleted entities (e.g. `isActive: false`) fetched with explicit filter when listing

### RBAC
- [ ] Every endpoint restricts to the minimum set of roles needed
- [ ] Scope filtering applied in service queries (OWN / TEAM / DEPARTMENT / GLOBAL)
- [ ] SYSTEM role allowed only on endpoints explicitly designed for scheduled/agent tasks

### Error Codes
- [ ] All exception messages are machine-readable PascalCase codes (`'LeaveTypeInactive'`, not `'Leave type is inactive'`)
- [ ] Frontend maps every expected code to a user-friendly string

### Code Cleanliness
- [ ] No `console.log` — use NestJS `Logger` with `this.logger = new Logger(ClassName.name)`
- [ ] No commented-out code
- [ ] No unused imports or injected providers
- [ ] Comments explain WHY, not WHAT

---

## Step 3 — Rewrite

Apply **every fix** from the audit directly to the file. Use the `Edit` tool for targeted changes and `Write` tool only if a full rewrite is cleaner. Do not leave any finding unaddressed.

If a fix requires a change in another file (e.g. adding a missing API function to `hr-core.ts`), make that change too and note it in the summary.

## Step 4 — Verify

After writing, read the patched file back and confirm:
- No `any`, no raw string enums, no missing guards
- All query keys are scoped correctly
- All mutations disable their submit button on `isPending`
- All API functions are typed end-to-end

## Step 5 — Report

Output a concise summary:

```
## Impeccable — <filename>

### Fixed
- [what was broken and what the fix was, one line each]

### Still needs attention (requires external changes)
- [things that can't be fixed in this file alone, e.g. missing migration, missing API endpoint]

### Status
✅ File is now production-ready  /  ⚠️ See "still needs attention" above
```

Do NOT output the full checklist. Do NOT narrate your process. Only output the summary after all fixes are applied.
