# Quickstart — Leave Management Module Implementation Guide

Step-by-step build guide for the Leave module inside `apps/hr-core`. Steps are ordered by dependency — each step compiles cleanly before moving to the next.

---

## Step 1 — Schema and migration

1. Open `apps/hr-core/prisma/schema.prisma`.
2. Add the `HalfDay`, `LeaveStatus`, and `AccrualFrequency` enums at the top with the other enums (`@@schema("hr_core")`).
3. Add reverse relations on `BusinessUnit` (no scalar columns):
   ```prisma
   leaveTypes LeaveType[]
   holidays   Holiday[]
   ```
4. Append the six new models from [data-model.md](./data-model.md) — `LeaveType`, `LeaveBalance`, `LeaveRequest`, `Holiday`, `LeaveBalanceAdjustment`, `LeaveAccrualRun`.
5. Add reverse relations on `Employee`:
   ```prisma
   leaveBalances  LeaveBalance[]
   leaveRequests  LeaveRequest[] @relation("EmployeeLeaveRequests")
   reviewedLeaves LeaveRequest[] @relation("EmployeeReviewedLeaves")
   ```
6. Generate migration:
   ```bash
   cd apps/hr-core
   npx prisma migrate dev --name add_leave_module
   ```
7. Open the generated migration file and add a CHECK constraint on LeaveRequest manually (Prisma does not generate raw CHECK constraints):
   ```sql
   ALTER TABLE "hr_core"."leave_requests"
     ADD CONSTRAINT "leave_requests_date_order_check"
     CHECK (end_date >= start_date);
   ```
   No `BusinessUnit.country` backfill step — none needed.
8. Re-run `npx prisma migrate dev` (it will apply the edits atomically) and `npx prisma generate`.

**Verify**:
```bash
npx prisma studio  # open hr_core.leave_types etc. — should all be empty
```

---

## Step 2 — Shared enum export

1. Create `packages/shared/src/enums/half-day.enum.ts`:
   ```ts
   export enum HalfDay {
     MORNING = 'MORNING',
     AFTERNOON = 'AFTERNOON',
   }
   ```
2. Create `packages/shared/src/enums/accrual-frequency.enum.ts`:
   ```ts
   export enum AccrualFrequency {
     MONTHLY = 'MONTHLY',
     YEARLY = 'YEARLY',
   }
   ```
3. Export both new enums from `packages/shared/src/enums/index.ts`.
4. Confirm `leave-status.enum.ts` is already exported (it is — present from earlier features).

---

## Step 3 — Utilities (pure functions, test-first)

1. Create `apps/hr-core/src/modules/leaves/util/bu-resolver.util.ts`:
   ```ts
   export function resolveEmployeeBusinessUnitId(
     employee: { team?: { businessUnit: { id: string } } | null;
                 department?: { businessUnit: { id: string } } | null }
   ): string | null {
     return employee.team?.businessUnit?.id
         ?? employee.department?.businessUnit?.id
         ?? null;
   }
   ```
2. Create `apps/hr-core/src/modules/leaves/util/business-day.util.ts` with the algorithm from research R-001. Signature:
   ```ts
   export function countBusinessDays(
     startDate: Date,
     endDate: Date,
     startHalf: HalfDay | null,
     endHalf: HalfDay | null,
     holidays: Set<string>, // 'YYYY-MM-DD' keys
   ): number;
   ```
3. Write `business-day.util.spec.ts` first. Cover:
   - 5-day Mon–Fri → 5.00
   - 7-day Mon–Sun → 5.00
   - Fri–Mon (weekend in middle) → 2.00
   - Mon–Fri with Wed=holiday → 4.00
   - Mon with `startHalf=AFTERNOON` and `endHalf=AFTERNOON` → 0.50
   - Mon–Fri with `startHalf=AFTERNOON` → 4.50
   - Mon–Fri with both halves set → 4.00
   - Single day, both halves null → 1.00
   - All-weekend range (Sat–Sun) → 0.00
4. Implement until tests pass.

---

## Step 4 — DTOs

Create the following in `apps/hr-core/src/modules/leaves/dto/`:

- `create-leave-type.dto.ts` — `@IsUUID() businessUnitId`, `@IsString() name`, `@IsEnum(AccrualFrequency) @IsOptional() accrualFrequency` (default MONTHLY), `@IsNumber() @Min(0) @Max(366) defaultDaysPerYear`, `@IsNumber() @Min(0) maxCarryoverDays`, `@IsBoolean() requiresApproval`, `@IsOptional() @IsHexColor() color`. Custom class-validator `@IsCarryoverWithinDefault()` on the class.
- `update-leave-type.dto.ts` — `PartialType(CreateLeaveTypeDto)` with `businessUnitId` and `accrualFrequency` omitted (immutable after creation/first accrual).
- `create-holiday.dto.ts` — `@IsUUID() businessUnitId`, `@IsString() name`, `@IsDateString() date`, `@IsBoolean() isRecurring`. Custom validator enforces XOR: `isRecurring=true → year must be null`; `isRecurring=false → year must equal date's year`.
- `update-holiday.dto.ts` — `PartialType(CreateHolidayDto)` with `businessUnitId` omitted (immutable).
- `create-leave-request.dto.ts` — `@IsUUID() leaveTypeId`, `@IsDateString() startDate/endDate`, `@IsOptional() @IsEnum(HalfDay) startHalfDay/endHalfDay`, `@IsOptional() @MaxLength(500) reason`. Custom validator `@IsValidLeaveRange()` enforces endDate >= startDate and same-day half-day rules (R-007).
- `review-leave-request.dto.ts` — `@IsOptional() @MaxLength(500) reviewNote`. Use the same class for approve; reject service enforces `reviewNote` non-empty.
- `adjust-balance.dto.ts` — `@IsNumber() newTotalDays`, `@IsString() @MaxLength(255) reason`.
- `leave-query.dto.ts` — optional filters (`@IsOptional() @IsEnum(LeaveStatus) status`, `@IsOptional() @IsUUID() employeeId`, `@IsOptional() @IsInt() year`).
- `patch-agent-assessment.dto.ts` — `@IsOptional() @IsObject() agentRiskAssessment`, `@IsOptional() @IsObject() agentSuggestedDates`.

---

## Step 5 — Services

Implement in order of dependency:

### 5a. `leave-types.service.ts`
- `findAll(businessUnitId?: string, callerBuId?: string)`, `findOne(id)`, `create(dto)`, `update(id, dto)`.
- On update: if `accrualFrequency` provided, check if any `LeaveBalance` or `LeaveBalanceAdjustment` references this type → throw `BadRequestException('AccrualFrequencyLocked')`.
- Wrap Prisma `P2002` as `ConflictException('Duplicate leave type name in this business unit')`.

### 5b. `holidays.service.ts`
- CRUD + `listForBusinessUnit(businessUnitId: string, year: number)` — returns holidays where `businessUnitId = $1` AND (`year = $2` OR `isRecurring = true`).
- Caller is the submission service — expect per-year caching inside one request only (no cross-request cache in MVP).

### 5c. `balances.service.ts`
- `findByEmployee(employeeId, year)`.
- `adjust(balanceId, dto, userId)` — wraps Prisma tx: load balance, write adjustment row, update totalDays.
- Computes `remainingDays` in the DTO mapper.

### 5d. `requests.service.ts`
- `create(employeeId, dto)`:
  1. Load employee with team+department+businessUnit relations.
  2. Resolve `businessUnitId` via `bu-resolver.util`; throw 400 `UnresolvedBusinessUnit` if null.
  3. Verify `leaveType.businessUnitId === resolvedBusinessUnitId`; throw 400 `LeaveTypeOutOfScope` if mismatch.
  4. Load applicable holidays via `holidays.service.listForBusinessUnit(businessUnitId, year)` as a Set of `YYYY-MM-DD` strings.
  5. Compute `totalDays` via `business-day.util`.
  5. Open `prisma.$transaction(…, { isolationLevel: 'Serializable' })`:
     - Query for overlaps (R-003).
     - Load LeaveBalance; reject if `remainingDays < totalDays`.
     - If `leaveType.requiresApproval`, set status=PENDING and increment `pendingDays`; else set APPROVED and increment `usedDays`.
     - Insert LeaveRequest.
     - Emit `leave.requested` (via in-tx outbox or direct `EventEmitter2.emit`).
  6. Return serialized LeaveRequest.
- `approve(id, dto, reviewerId)`, `reject(id, dto, reviewerId)`, `cancel(id, ownerId)` — each inside a serializable tx that updates status + adjusts balance + emits event.
- `patchAgentAssessment(id, dto)` — direct UPDATE, no balance side effect.
- `teamCalendar(managerId, from, to)` — raw query per R-011.

### 5e. `accrual.service.ts`
- `@Cron('0 5 1 * *')` method `runMonthlyAccrual()`:
  1. Compute `runMonth = 'YYYY-MM'`.
  2. Open serializable tx:
     - Insert `LeaveAccrualRun` (expect P2002 as no-op if already ran — return early).
     - Load all active employees (`status != TERMINATED`, `hireDate <= firstOfMonth`) with their resolved BU.
     - For each employee, load leave types where `businessUnitId = resolvedBuId`.
     - For each (emp, leaveType):
       - If `accrualFrequency === MONTHLY`: upsert `LeaveBalance` for current year, increment `totalDays` by `round(defaultDaysPerYear/12, 2)`, insert `LeaveBalanceAdjustment` (reason='Monthly accrual YYYY-MM').
       - If `accrualFrequency === YEARLY` **and** `runMonth` ends in `-01` (January): upsert `LeaveBalance` for current year, increment `totalDays` by `defaultDaysPerYear`, insert `LeaveBalanceAdjustment` (reason='Yearly grant YYYY'). Skip YEARLY types in all other months.
     - Update `employeesProcessed` on the run row.
- `@Cron('0 3 1 1 *')` method `runYearEndCarryover()`:
  1. For each balance in the previous year, compute `carryDays = min(remainingDays, leaveType.maxCarryoverDays)`, forfeit the rest.
  2. Upsert next-year balance seeded with carry.
  3. Write LeaveBalanceAdjustment rows on both sides (carryover for next year, forfeit note on prior year).
- Expose `triggerManualAccrual(month, userId)` for the HR_ADMIN endpoint.

---

## Step 6 — Controllers

- `leave-types.controller.ts` — CRUD under `/leave-types`.
- `holidays.controller.ts` — CRUD under `/holidays`.
- `balances.controller.ts` — `GET /leave-balances`, `POST /leave-balances/:id/adjust`, `GET /leave-balances/:id/adjustments`, `POST /leave-balances/accrual/trigger`.
- `requests.controller.ts` — `POST /leave-requests`, `GET /leave-requests`, `GET /leave-requests/:id`, `POST /leave-requests/:id/approve`, `.../reject`, `.../cancel`, `PATCH /leave-requests/:id/agent-assessment`.
- `team-calendar.controller.ts` — `GET /leave-requests/team-calendar` (separate class for clarity).

Every method gets:
- Swagger: `@ApiOperation`, `@ApiResponse(200/201/400/403/404/409)`.
- Guards and `@Roles(...)` declared but commented per R-013 until IAM lands.

---

## Step 7 — Module wiring

Create `leaves.module.ts`:
```ts
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, EventBusModule],
  controllers: [
    LeaveTypesController,
    HolidaysController,
    BalancesController,
    RequestsController,
    TeamCalendarController,
  ],
  providers: [
    LeaveTypesService,
    HolidaysService,
    BalancesService,
    RequestsService,
    AccrualService,
  ],
})
export class LeavesModule {}
```

Import `LeavesModule` in `app.module.ts` and add `ScheduleModule.forRoot()` if not already present.

---

## Step 8 — Tests

Test hierarchy (mirrors `rules/testing.md`):

- **Unit** (`*.service.spec.ts`):
  - `business-day.util.spec.ts` (Step 3).
  - `bu-resolver.util.spec.ts` — verifies team-first then department fallback, null when neither present.
  - `requests.service.spec.ts` — mock Prisma, cover: happy path, insufficient balance, overlap reject, auto-approve path, zero-day reject, retroactive accepted, half-day math.
  - `accrual.service.spec.ts` — mock Prisma, cover: idempotency (two runs same month = one write), terminated skipped, new-hire mid-month, year-end carryover cap.
  - `balances.service.spec.ts` — adjust audit row written, remainingDays math.

- **Integration** (`test/integration/leaves.integration.spec.ts`, real DB per `rules/testing.md`):
  - End-to-end: seed → submit → approve → balance math intact.
  - Concurrency: 10 parallel submissions sharing one balance → exactly `floor(remaining/requested)` succeed.
  - Accrual scheduler: trigger manually for a frozen month → balances increment; re-trigger → no duplicate.

- **Contract**: none (no inter-service client added here).

---

## Step 9 — Seed

Extend `apps/hr-core/prisma/seed.ts`:
- For each active `BusinessUnit`, upsert 5 LeaveType rows on `(name, businessUnitId)` (R-012):
  - ANNUAL (MONTHLY, 24 days, carryover=5), SICK (MONTHLY, 12 days, carryover=0), MATERNITY (YEARLY, 98 days, carryover=0), PATERNITY (YEARLY, 3 days, carryover=0), UNPAID (YEARLY, 0 days, carryover=0).
- For each active `BusinessUnit`, upsert 6–8 2026 holidays on `(date, businessUnitId, year)` (New Year, Labour Day, Independence Day, Revolution Day, and regional/Islamic holidays — recurring where fixed-date).
- No country backfill step needed.

Run:
```bash
pnpm --filter hr-core prisma:seed
```

---

## Step 10 — Swagger verification

1. `turbo dev --filter=hr-core`
2. Visit `http://localhost:3001/api/docs`.
3. Confirm all 15+ endpoints show under the "Leave Management" tag with correct schemas.
4. Manually submit a leave request with curl, approve it, verify balance.

---

## Definition of Done

- [ ] Migration applied, `pnpm prisma migrate status` clean.
- [ ] `pnpm --filter hr-core build` green.
- [ ] `pnpm --filter hr-core test` green.
- [ ] All acceptance scenarios from spec validated in integration tests.
- [ ] Swagger docs render the full surface.
- [ ] Seed populates 5 leave types + holidays per BusinessUnit (idempotent).
- [ ] Monthly accrual cron registered and logs "registered" on service start (MONTHLY types accrue each month; YEARLY types only in January).
- [ ] Domain events observable on the event bus (stub subscriber in dev logs).
- [ ] Guards present in source (commented, with `TODO(iam)`).
