---
name: "frontend-code-review"
description: "Code review checklist for Sentient frontend (React 18, Vite 7, TanStack Query v5, Tailwind v4, shadcn/ui, TypeScript strict). Reviews a given file or component against project conventions."
argument-hint: "File path or component name to review (e.g. 'apps/web/src/pages/leaves.tsx')"
user-invocable: true
---

## User Input

```text
$ARGUMENTS
```

If a file path was provided, read that file first, then run every checklist section against it and report findings. If no path was given, explain the review criteria so the user can apply them manually.

For each finding use this format:
- **[SEVERITY]** `file:line` — description. Suggested fix (one line of code if applicable).

Severity levels: **BLOCKER** (must fix before merge) | **WARNING** (should fix) | **SUGGESTION** (nice to have).

---

# Frontend Code Review Checklist — Sentient HRIS

---

## 1. TypeScript Correctness

- [ ] No `any` type anywhere — use `unknown` and narrow, or use the correct interface
- [ ] No `as unknown as T` escape hatches — fix the type instead
- [ ] `noUncheckedIndexedAccess`: array access `list[0]` is `T | undefined` — guarded before use?
- [ ] All exported functions have explicit return types
- [ ] Props interfaces defined (not inlined `{ foo: string }` in function signature for complex components)
- [ ] Enums from `@sentient/shared` used for status/role strings — no raw string literals like `'PENDING'`
- [ ] Imported types use `import type` where applicable

```ts
// ❌
const first = employees[0].name;

// ✅
const first = employees[0]?.name ?? 'Unknown';
```

---

## 2. TanStack Query v5

- [ ] `queryKey` includes ALL filter params that affect the result (missing a param = stale data bug)
- [ ] `queryFn` is a function reference — not called directly: `queryFn: () => getEmployees(params)`
- [ ] Loading state handled — no render with `data` before `isLoading` check
- [ ] Error state handled — not silently ignored
- [ ] `invalidateQueries` key matches the query key shape (same array prefix)
- [ ] `mutation.isPending` used to disable submit button
- [ ] No `useEffect` fetching data — all data via `useQuery`
- [ ] `staleTime` set for read-heavy queries that don't need to refetch on every focus

```tsx
// ❌ Query key misses businessUnitId — shows all BUs' data
queryKey: ['leave-types']

// ✅
queryKey: ['leave-types', businessUnitId]
```

---

## 3. Component Structure

- [ ] Page component is thin — orchestrates, doesn't own business logic
- [ ] No business logic in JSX — extract to helper functions or hooks
- [ ] No API calls outside `useQuery`/`useMutation`
- [ ] No direct `localStorage`/`sessionStorage` access (use auth store or query cache)
- [ ] Large inline JSX blocks extracted into named sub-components
- [ ] `key` prop on list items uses stable unique id — not array index
- [ ] No anonymous arrow functions for stable event handlers in lists (use `useCallback` or named handlers)

```tsx
// ❌ index as key is unstable
{items.map((item, i) => <Row key={i} {...item} />)}

// ✅
{items.map((item) => <Row key={item.id} {...item} />)}
```

---

## 4. Styling — Tailwind v4

- [ ] No hardcoded hex/rgb colors in `className` — use design tokens (`text-brand`, `bg-surface`)
- [ ] No `style={{ color: '#...' }}` unless for dynamic user-supplied values (e.g. leave type color dot)
- [ ] `cn()` used for conditional class merging — not string concatenation
- [ ] Dark mode classes present on text/background that would be invisible in dark mode
- [ ] No `tailwind.config.ts` modifications — new tokens go in `src/index.css` `@theme {}`
- [ ] `cva` used for multi-variant components — not long conditional class strings

```tsx
// ❌
className={`px-2 py-1 rounded ${status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}

// ✅ — use cva badge variant
className={badge({ variant: status.toLowerCase() })}
```

---

## 5. shadcn/ui Usage

- [ ] Components imported from `@/components/ui/` — not from `radix-ui` directly
- [ ] `<Dialog>` controlled via `open`/`onOpenChange` — not uncontrolled
- [ ] `onOpenAutoFocus={(e) => e.preventDefault()}` on `DialogContent` (prevents jarring scroll-to-top)
- [ ] Destructive confirm uses `<AlertDialog>` — not a plain `confirm()` call
- [ ] `<Button disabled={mutation.isPending}>` — loading state shown in button label
- [ ] Form labels linked to inputs via `htmlFor` / `id`

```tsx
// ❌
if (window.confirm('Delete?')) deleteMutation.mutate(id);

// ✅ — use AlertDialog with explicit cancel/confirm actions
```

---

## 6. Auth & Permissions

- [ ] Protected pages check `user?.roles` before rendering sensitive content
- [ ] BU-scoped queries pass `businessUnitId` — not fetching global data for a BU-scoped user
- [ ] No JWT decoded inside a component — use `useAuth()` hook only
- [ ] HR-only UI sections hidden for `EMPLOYEE` role (`isHrAdmin` guard)
- [ ] No hardcoded role strings — compare against `user.roles.includes('HR_ADMIN')`

```tsx
// ❌
const payload = JSON.parse(atob(token.split('.')[1]));

// ✅
const { user } = useAuth();
```

---

## 7. API Client

- [ ] All API calls in `src/lib/api/hr-core.ts` (or social.ts / ai.ts) — not inlined in components
- [ ] Axios generic typed: `hrClient.get<LeaveType[]>(...)` — not returning `any`
- [ ] Query params passed as `{ params }` object — not concatenated into URL string
- [ ] Error handling: `onError` callback on mutations shows a toast or error message
- [ ] No `process.env` — use `import.meta.env.VITE_*` for Vite env vars

---

## 8. Accessibility

- [ ] All `<input>` / `<select>` / `<textarea>` have a visible `<Label>` with `htmlFor`
- [ ] Icon-only buttons have `aria-label`
- [ ] Color is not the only status indicator (pair with text or icon)
- [ ] `<img>` elements have `alt` text
- [ ] Keyboard navigation works for interactive components (shadcn/ui handles Radix primitives)

```tsx
// ❌
<Button onClick={openEdit}><Pencil /></Button>

// ✅
<Button onClick={openEdit} aria-label="Edit employee"><Pencil className="w-3.5 h-3.5" /></Button>
```

---

## 9. Performance

- [ ] `React.memo` only used with profiler evidence — not applied preemptively
- [ ] `useCallback` / `useMemo` — only at proven bottlenecks, not by default
- [ ] Images have explicit `width` and `height` (or `aspect-ratio`) to prevent layout shift
- [ ] Lists over ~100 items: consider virtualization (`@tanstack/react-virtual`)
- [ ] No `useEffect` with stale closure (missing dependency in array)

---

## 10. Code Cleanliness

- [ ] No commented-out code blocks
- [ ] No `console.log` left in production code
- [ ] No dead imports
- [ ] No `TODO` comments without a linked issue
- [ ] Magic numbers extracted to named constants
- [ ] Component file stays under ~250 lines — split if larger

---

## Summary Template

After reviewing, output:

```
## Review Summary — <filename>

### Blockers (must fix)
- ...

### Warnings (should fix)
- ...

### Suggestions (nice to have)
- ...

### Approved patterns (worth noting)
- ...
```
