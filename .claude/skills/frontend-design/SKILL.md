---
name: "frontend-design"
description: "Frontend design guidance for Sentient: layout, component composition, Tailwind v4 tokens, shadcn/ui patterns, dark mode, responsive design, and UX conventions used across the app."
argument-hint: "Optional: page or component to design (e.g. 'employee profile card', 'leave request form')"
user-invocable: true
---

## User Input

```text
$ARGUMENTS
```

If the user named a specific page or component, produce a concrete design for it following the conventions below. Otherwise explain the design system and patterns.

---

# Frontend Design Guide — Sentient HRIS

Stack: **React 18 + Vite 7**, **Tailwind CSS v4**, **shadcn/ui**, **wouter**.

---

## 1. Design Tokens — `src/index.css`

All tokens live in `@theme {}`. Never hardcode colors or radii in components.

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-brand:          #6366f1;   /* indigo-500 */
  --color-brand-light:    #e0e7ff;
  --color-brand-dark:     #4338ca;

  /* Surface */
  --color-surface:        #f8fafc;
  --color-surface-raised: #ffffff;
  --color-border:         #e2e8f0;

  /* Status */
  --color-success:  #16a34a;
  --color-warning:  #d97706;
  --color-danger:   #dc2626;
  --color-info:     #0284c7;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui;

  /* Radii */
  --radius-sm:   0.375rem;
  --radius-card: 0.75rem;
  --radius-full: 9999px;
}

/* Dark mode */
@custom-variant dark (&:is(.dark *));
```

---

## 2. Page Layout Shell

Every authenticated page renders inside `<Layout>` (sidebar + main content area).

```
┌──────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main (flex-1)      │
│                         │                     │
│  • Logo                 │  <page heading>     │
│  • Nav links            │  <content area>     │
│  • User avatar          │                     │
└──────────────────────────────────────────────┘
```

**Page container pattern:**
```tsx
// Every page starts with this shell
export default function MyPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Page Title
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Short description of this section.
        </p>
      </div>

      {/* Optional toolbar: filters + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* filters left */}
        </div>
        <div className="flex items-center gap-2">
          {/* actions right */}
        </div>
      </div>

      {/* Content */}
    </div>
  );
}
```

---

## 3. Card Patterns

```tsx
// Standard data card
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
      Section Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>

// Stat card (dashboard)
<Card>
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Total Employees</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">247</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
        <Users className="w-5 h-5 text-brand" />
      </div>
    </div>
    <p className="text-xs text-muted-foreground mt-2">
      <span className="text-success font-medium">+12</span> this month
    </p>
  </CardContent>
</Card>
```

---

## 4. Table Pattern

```tsx
<Card>
  <CardContent className="p-0">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          // Skeleton rows while loading
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={4}>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </TableCell>
            </TableRow>
          ))
        ) : rows.map((row) => (
          <TableRow key={row.id} className="hover:bg-muted/50 cursor-pointer">
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{row.department}</TableCell>
            <TableCell><StatusBadge status={row.status} /></TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm"><Pencil className="w-3.5 h-3.5" /></Button>
            </TableCell>
          </TableRow>
        ))}
        {!isLoading && rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
              No records found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

---

## 5. Status Badge Pattern

```tsx
import { cva } from 'class-variance-authority';

const badge = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        active:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      },
    },
  }
);
```

---

## 6. Form Layout (Dialog)

```tsx
<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
  <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
    <DialogHeader>
      <DialogTitle>Form Title</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-2">
      {/* Text field */}
      <div className="space-y-1.5">
        <Label htmlFor="field-name">Field Label</Label>
        <Input id="field-name" value={form.name} onChange={…} placeholder="Placeholder" />
      </div>

      {/* Two-column row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">…</div>
        <div className="space-y-1.5">…</div>
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Feature Toggle</p>
          <p className="text-xs text-muted-foreground">Description of what this does.</p>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm(p => ({ ...p, enabled: v }))} />
      </div>

      {/* Inline error */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 7. Empty States

```tsx
// Full-page empty state (no data yet)
<div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
  <ListChecks className="w-10 h-10 text-muted-foreground" />
  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">No records yet</h2>
  <p className="text-sm text-muted-foreground max-w-xs">
    Get started by creating your first entry.
  </p>
  <Button size="sm" onClick={openCreate}>
    <Plus className="w-3.5 h-3.5 mr-1" /> Add First
  </Button>
</div>

// Inline empty state (inside a table/card)
<div className="py-12 text-center text-sm text-muted-foreground">
  Nothing here yet.
</div>
```

---

## 8. Loading States

```tsx
// Skeleton text line
<div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />

// Skeleton card
<Card>
  <CardContent className="p-6 space-y-3">
    <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
  </CardContent>
</Card>

// Spinner button
<Button disabled>
  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Loading…
</Button>
```

---

## 9. Responsive Design

This is a desktop-first internal tool. Breakpoints to use:
- **`lg:`** (1024px) — primary responsive breakpoint
- **`md:`** (768px) — tablet fallback
- **`sm:`** (640px) — rarely needed

```tsx
// Dashboard stats grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// Side-by-side on desktop, stacked on mobile
<div className="flex flex-col lg:flex-row gap-6">

// Hide on mobile
<div className="hidden lg:block">
```

---

## 10. Icon Usage

Always use **lucide-react** icons. Consistent sizing:
- `w-3.5 h-3.5` — inside buttons
- `w-4 h-4` — inline with text
- `w-5 h-5` — standalone (nav, stat cards)
- `w-10 h-10` — empty state illustrations

```tsx
import { Plus, Pencil, Trash2, RefreshCw, ChevronDown, Search } from 'lucide-react';

<Button size="sm">
  <Plus className="w-3.5 h-3.5 mr-1" /> Add
</Button>
```

---

## 11. Accessibility Checklist

- [ ] All form inputs have a `<Label htmlFor>` linked by id
- [ ] Destructive actions use `<AlertDialog>` with confirmation text
- [ ] Loading states have `aria-busy` or visually communicate progress
- [ ] Interactive elements are keyboard-navigable (shadcn/ui handles most of this)
- [ ] Color is never the only indicator — pair with text or icon
- [ ] Focus visible (`onOpenAutoFocus={(e) => e.preventDefault()}` in dialogs to avoid jarring focus)
