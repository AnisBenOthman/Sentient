---
name: "react-vite-best-practices"
description: "Guidance on React 18 + Vite 7 best practices for the Sentient project stack: TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui, TypeScript strict mode."
argument-hint: "Optional: specific topic (e.g. 'data fetching', 'forms', 'routing', 'styling')"
user-invocable: true
---

## User Input

```text
$ARGUMENTS
```

If the user supplied a topic, focus on that area. Otherwise cover the full checklist.

---

# React 18 + Vite 7 Best Practices — Sentient Project

This project uses: **React 18**, **Vite 7**, **TanStack Query v5**, **wouter**, **Tailwind CSS v4**, **shadcn/ui**, **TypeScript strict mode** (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`).

---

## 1. TypeScript — Strict Mode Rules

```ts
// ❌ never
const data: any = response;
const el = list[0]; // noUncheckedIndexedAccess means this is T | undefined

// ✅ always
const data: Employee[] = response;
const el = list[0]; // type is Employee | undefined — guard before use
if (el) doSomething(el);

// ✅ explicit return types on all exported functions
export function formatDate(iso: string): string { … }

// ✅ narrow unknown at boundaries
function parse(raw: unknown): CreateLeaveRequestDto {
  if (!isCreateLeaveRequestDto(raw)) throw new Error('invalid');
  return raw;
}
```

---

## 2. Data Fetching — TanStack Query v5

### Query pattern
```tsx
// ✅ typed queryFn, stable queryKey
const { data, isLoading, isError } = useQuery({
  queryKey: ['employees', params] as const,
  queryFn: () => getEmployees(params),
  staleTime: 30_000,
});

// ✅ always handle loading + error in UI
if (isLoading) return <Skeleton />;
if (isError) return <ErrorBanner />;
```

### Mutation pattern
```tsx
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: createLeaveRequest,
  onSuccess: () => {
    // Invalidate the exact key shape used by the query above
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    toast.success('Request submitted');
  },
  onError: (err) => toast.error(err.message),
});

// In JSX
<Button onClick={() => mutation.mutate(dto)} disabled={mutation.isPending}>
  {mutation.isPending ? 'Saving…' : 'Submit'}
</Button>
```

### Query key conventions
```ts
// Scope every key by entity + filter — prevents stale cross-BU data
['leave-types', businessUnitId]
['employees', { page, search, departmentId }]
['employee', id]            // single entity
['leave-requests', 'mine']  // scoped list
```

---

## 3. Routing — wouter

```tsx
// App.tsx — all routes in one place
import { Switch, Route, Redirect } from 'wouter';

<Switch>
  <Route path="/" component={SignIn} />
  <Route path="/dashboard">
    <ProtectedRoute><Dashboard /></ProtectedRoute>
  </Route>
  <Route path="/employees/:id">
    {(params) => <EmployeeProfile id={params.id} />}
  </Route>
  <Route><NotFound /></Route>
</Switch>

// Navigation — use wouter's Link or useLocation
import { useLocation } from 'wouter';
const [, navigate] = useLocation();
navigate('/employees');
```

---

## 4. Component Structure

```
src/
├── pages/          # One file per route, thin — composes components
├── components/
│   ├── ui/         # shadcn/ui primitives — never edit directly
│   ├── layout.tsx  # Sidebar shell
│   └── *.tsx       # Shared feature components
├── hooks/          # Custom hooks (use-mobile, use-toast, etc.)
└── lib/
    ├── api/        # Typed Axios functions only — no business logic
    ├── auth.ts     # JWT decode + authStore
    └── utils.ts    # cn() and pure helpers
```

**Page files are thin:**
```tsx
// ✅ pages/employees.tsx — orchestrates, does not own logic
export default function Employees() {
  const { data, isLoading } = useQuery(…);
  return <EmployeeTable rows={data} loading={isLoading} />;
}

// ✅ components/employee-table.tsx — owns rendering
```

---

## 5. Styling — Tailwind CSS v4

```css
/* src/index.css — ALL design tokens here, no tailwind.config.ts */
@import "tailwindcss";

@theme {
  --color-brand: #6366f1;
  --color-surface: #f8fafc;
  --radius-card: 0.75rem;
}
```

```tsx
// ✅ use cva for component variants
import { cva } from 'class-variance-authority';

const badge = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    status: {
      pending:  'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    },
  },
});

<span className={badge({ status: request.status.toLowerCase() as 'pending' })}>…</span>

// ✅ cn() for conditional class merging
import { cn } from '@/lib/utils';
<div className={cn('base-class', isActive && 'active-class', className)} />
```

**Rules:**
- No `tailwind.config.ts` — tokens in `@theme {}` only
- No `postcss.config.js` — uses `@tailwindcss/vite` plugin
- Dark mode via `@custom-variant dark (&:is(.dark *))`

---

## 6. shadcn/ui Usage

```tsx
// ✅ import from components/ui — never from node_modules directly
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ✅ use asChild for polymorphic rendering
<Button asChild>
  <Link href="/employees">View all</Link>
</Button>

// ✅ controlled dialogs — no uncontrolled state
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen}>…</Dialog>
```

---

## 7. Forms — React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const form = useForm<FormValues>({ resolver: zodResolver(schema) });

const onSubmit = form.handleSubmit((data) => mutation.mutate(data));
```

---

## 8. Auth Pattern

```tsx
// Read auth state from context — never decode JWT in components
import { useAuth } from '@/components/providers/auth-provider';

const { user } = useAuth();  // user is JwtPayload | null

// Guard by role
const isHrAdmin = user?.roles.includes('HR_ADMIN') ?? false;

// Guard by BU for filtered queries
queryFn: () => getLeaveTypes(user?.businessUnitId ? { businessUnitId: user.businessUnitId } : undefined)
```

---

## 9. API Client Pattern

```ts
// src/lib/api/hr-core.ts — typed Axios functions, no business logic
import { hrClient } from './client';  // Axios instance with refresh interceptor

export async function getLeaveTypes(params?: { businessUnitId?: string }): Promise<LeaveType[]> {
  const { data } = await hrClient.get<LeaveType[]>('/leave-types', { params });
  return data;
}

// ✅ Vite proxy routes /api → http://localhost:3001 — no CORS in dev
// ✅ Use query params for filters, never build URLs with string concatenation
// ✅ Always type the generic: hrClient.get<T>(), hrClient.post<T>()
```

---

## 10. Performance Checklist

- [ ] `staleTime` set on read-heavy queries (avoid waterfall refetches)
- [ ] Query keys include all filter params (prevents stale cross-filter data)
- [ ] `React.memo` only when profiler shows a real problem — not by default
- [ ] Large lists: use `@tanstack/react-virtual` if >200 rows
- [ ] Images: use `loading="lazy"` and explicit `width`/`height`
- [ ] Avoid anonymous functions in JSX for stable references in lists
- [ ] `useCallback`/`useMemo` only at proven bottlenecks

---

## 11. Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| `queryKey: ['leave-types']` without BU filter | Include `businessUnitId` in key |
| Calling API functions outside `queryFn` | Always wrap in TanStack Query |
| Editing `src/components/ui/` primitives | Compose them instead |
| `process.env` in component | Use Vite's `import.meta.env` |
| `any` return type on API function | Use the Prisma-generated or shared interface |
| Hardcoded service URLs | Vite proxy handles routing; use `/api/...` paths |
| Missing `disabled={mutation.isPending}` on submit | Always guard submit buttons |
