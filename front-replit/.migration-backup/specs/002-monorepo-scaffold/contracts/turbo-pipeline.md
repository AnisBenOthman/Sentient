# Contract: Turborepo Pipeline

**Feature**: `002-monorepo-scaffold`  
**File**: `turbo.json` at repo root

---

## Pipeline Tasks

### `build`

| Property | Value | Reason |
|----------|-------|--------|
| `dependsOn` | `["^build"]` | Build all workspace dependencies first. `^` = topological — `@sentient/shared` always compiles before services |
| `outputs` | `["dist/**", ".next/**", "src/generated/**"]` | Cached build artifacts (shared dist, Next.js build, Prisma generated client) |
| Cache | Enabled (default) | Identical inputs → skip rebuild |

**Build order enforced**:
```
@sentient/shared  →  @sentient/hr-core
                  →  @sentient/social
                  →  @sentient/ai-agentic
                  →  @sentient/web
```

### `dev`

| Property | Value | Reason |
|----------|-------|--------|
| `dependsOn` | `["^build"]` | Shared package must be built before any service starts in watch mode |
| `cache` | `false` | Dev servers must never serve cached output |
| `persistent` | `true` | Dev servers run indefinitely — Turborepo does not kill them after exit |

**Usage**:
```bash
turbo dev                         # start all services
turbo dev --filter=hr-core        # start only HR Core (+ shared build)
turbo dev --filter=@sentient/web  # start only frontend
```

### `test`

| Property | Value | Reason |
|----------|-------|--------|
| `dependsOn` | `["build"]` | Tests run against compiled code |
| `outputs` | `["coverage/**"]` | Coverage reports cached |
| Cache | Enabled | Re-runs only if source changed |

**Usage**:
```bash
turbo test                        # test all packages
turbo test --filter=hr-core       # test only HR Core
```

### `lint`

| Property | Value | Reason |
|----------|-------|--------|
| `dependsOn` | `[]` | Fully parallel — no build dependency |
| Cache | Enabled | Skip lint if files unchanged |

### `type-check`

| Property | Value | Reason |
|----------|-------|--------|
| `dependsOn` | `["^build"]` | Needs shared types compiled first |
| `outputs` | `[]` | No build artifacts, just type checking |

---

## Package Scripts (each service must implement)

| Script | Command | Used by Turbo |
|--------|---------|---------------|
| `build` | `nest build` / `next build` / `tsc` | `turbo build` |
| `dev` | `nest start --watch` / `next dev` | `turbo dev` |
| `start` | `nest start` | Direct execution |
| `start:prod` | `node dist/main` | Production |
| `test` | `jest` | `turbo test` |
| `lint` | `eslint src --ext .ts,.tsx` | `turbo lint` |
| `type-check` | `tsc --noEmit` | `turbo type-check` |

---

## Filter Examples

```bash
# Build only shared package
turbo build --filter=@sentient/shared

# Start HR Core and its dependencies
turbo dev --filter=hr-core...

# Test everything that changed since main branch
turbo test --filter=[main]

# Build everything except the frontend
turbo build --filter=!@sentient/web
```

---

## Dependency Graph

```
@sentient/shared
    ├── @sentient/hr-core    (workspace:*)
    ├── @sentient/social     (workspace:*)
    ├── @sentient/ai-agentic (workspace:*)
    └── @sentient/web        (workspace:*)
```

No service depends on another service at the package level — only on `@sentient/shared`. Cross-service communication is REST at runtime, not import-time.
