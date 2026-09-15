-- ============================================================================
-- hr_analytics — curated read-only views for the AI Text-to-SQL branch
-- ============================================================================
-- WHY: The Analytics SQL branch lets an LLM generate SELECT statements against
-- HR data. Those statements never touch hr_core base tables. They may only read
-- the views below, which:
--   1. strip PII (phone, dateOfBirth, email, free-text comments)
--   2. bake in the soft-delete filter ("deletedAt" IS NULL)
--   3. alias camelCase columns to snake_case so generated SQL needs no quoting
--   4. enforce row-level scoping from per-transaction session variables
--
-- Views are owned by hr_core_svc (the role Prisma migrates as), so they read the
-- base tables with OWNER privileges while ai_analytics_readonly holds no
-- base-table grant whatsoever.
--
-- security_invoker is pinned to false on every view: the whole grant model
-- depends on owner-privilege execution. Postgres 15+ defaults it to false, but
-- writing it explicitly means a future default change or a CREATE OR REPLACE
-- cannot silently flip these into permission-denied.
--
-- SCOPE PREDICATE — mirrors EmployeesService.buildProfileAccessFilter.
-- The ordered precedence chain is resolved in TypeScript
-- (AnalyticsSqlService.resolveScope); these views receive only the RESOLVED
-- result, so each view carries one flat predicate and no precedence logic:
--
--   sentient.scope             GLOBAL | DEPARTMENT | TEAM | MANAGER_FALLBACK | OWN
--   sentient.scope_entity_id   department id (DEPARTMENT) or team id (TEAM)
--   sentient.actor_employee_id acting employee, for MANAGER_FALLBACK and OWN
--   sentient.actor_team_id     acting employee's own team, for MANAGER_FALLBACK
--   sentient.comp_visible      'true' unlocks v_compensation rows
--
-- FAIL-CLOSED BY CONSTRUCTION: current_setting(..., true) returns NULL when the
-- variable is unset, and `NULL = 'GLOBAL'` is NULL, so every OR branch is NULL,
-- the predicate is NULL, and the row is EXCLUDED. A query that forgets to set the
-- session variables — or one whose set_config landed on a different pooled
-- connection — returns ZERO rows, never all rows. Never wrap these in COALESCE
-- with a default, and never use missing_ok => false; both destroy that property.
-- ============================================================================

-- WHY created here as well as in scripts/init-schemas.sql: `prisma migrate dev`
-- replays every migration into a throwaway shadow database that init-schemas.sql
-- never touches. Raising an error on a missing schema would make the shadow build
-- fail and block all future migrations. IF NOT EXISTS makes this a no-op on a
-- normally initialised database.
CREATE SCHEMA IF NOT EXISTS hr_analytics;
GRANT USAGE ON SCHEMA hr_analytics TO ai_analytics_readonly;

-- ── Reference data (no employee rows, therefore unscoped) ───────────────────

CREATE OR REPLACE VIEW hr_analytics.v_departments
  WITH (security_invoker = false) AS
SELECT
  d."id"             AS department_id,
  d."name"           AS department_name,
  d."code"           AS department_code,
  d."businessUnitId" AS business_unit_id,
  d."isActive"       AS is_active
FROM hr_core."departments" d;

CREATE OR REPLACE VIEW hr_analytics.v_teams
  WITH (security_invoker = false) AS
SELECT
  t."id"             AS team_id,
  t."name"           AS team_name,
  t."code"           AS team_code,
  t."departmentId"   AS department_id,
  t."businessUnitId" AS business_unit_id,
  t."projectFocus"   AS project_focus,
  t."isActive"       AS is_active
FROM hr_core."teams" t;

CREATE OR REPLACE VIEW hr_analytics.v_positions
  WITH (security_invoker = false) AS
SELECT
  p."id"              AS position_id,
  p."title"           AS position_title,
  p."level"::text     AS position_level,
  p."isActive"        AS is_active,
  p."isKeyPosition"   AS is_key_position
FROM hr_core."positions" p;

CREATE OR REPLACE VIEW hr_analytics.v_skills
  WITH (security_invoker = false) AS
SELECT
  s."id"            AS skill_id,
  s."name"          AS skill_name,
  s."domain"::text  AS skill_domain,
  s."category"      AS skill_category
FROM hr_core."skills" s;

CREATE OR REPLACE VIEW hr_analytics.v_leave_types
  WITH (security_invoker = false) AS
SELECT
  lt."id"                 AS leave_type_id,
  lt."name"               AS leave_type_name,
  lt."businessUnitId"     AS business_unit_id,
  lt."defaultDaysPerYear" AS default_days_per_year,
  lt."requiresApproval"   AS requires_approval,
  lt."isActive"           AS is_active
FROM hr_core."leave_types" lt;

CREATE OR REPLACE VIEW hr_analytics.v_holidays
  WITH (security_invoker = false) AS
SELECT
  h."id"             AS holiday_id,
  h."businessUnitId" AS business_unit_id,
  h."name"           AS holiday_name,
  h."date"           AS holiday_date,
  h."isRecurring"    AS is_recurring,
  h."year"           AS year
FROM hr_core."holidays" h;

-- ── Employee-derived data (scope-filtered) ──────────────────────────────────

-- WHY age_years instead of dateOfBirth: age-band analytics is a real reporting
-- need, but the date of birth itself is PII and never leaves hr_core.
CREATE OR REPLACE VIEW hr_analytics.v_employees
  WITH (security_invoker = false) AS
SELECT
  e."id"                     AS employee_id,
  e."employeeCode"           AS employee_code,
  e."firstName"              AS first_name,
  e."lastName"               AS last_name,
  e."hireDate"               AS hire_date,
  e."employmentStatus"::text AS employment_status,
  e."contractType"::text     AS contract_type,
  e."gender"::text           AS gender,
  e."maritalStatus"::text    AS marital_status,
  e."educationLevel"::text   AS education_level,
  e."educationField"         AS education_field,
  CASE
    WHEN e."dateOfBirth" IS NULL THEN NULL
    ELSE date_part('year', age(e."dateOfBirth"))::int
  END                        AS age_years,
  date_part('year', age(e."hireDate"))::int AS tenure_years,
  e."positionId"             AS position_id,
  p."title"                  AS position_title,
  e."departmentId"           AS department_id,
  d."name"                   AS department_name,
  e."teamId"                 AS team_id,
  t."name"                   AS team_name,
  e."managerId"              AS manager_id,
  d."businessUnitId"         AS business_unit_id
FROM hr_core."employees" e
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
LEFT JOIN hr_core."positions"   p ON p."id" = e."positionId"
WHERE e."deletedAt" IS NULL
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

CREATE OR REPLACE VIEW hr_analytics.v_leave_requests
  WITH (security_invoker = false) AS
SELECT
  lr."id"           AS leave_request_id,
  lr."employeeId"   AS employee_id,
  e."departmentId"  AS department_id,
  e."teamId"        AS team_id,
  lr."leaveTypeId"  AS leave_type_id,
  lt."name"         AS leave_type_name,
  lr."startDate"    AS start_date,
  lr."endDate"      AS end_date,
  lr."totalDays"    AS total_days,
  lr."status"::text AS status,
  lr."reviewedAt"   AS reviewed_at,
  lr."createdAt"    AS created_at
FROM hr_core."leave_requests" lr
JOIN      hr_core."employees"   e ON e."id"  = lr."employeeId"
JOIN      hr_core."leave_types" lt ON lt."id" = lr."leaveTypeId"
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
WHERE e."deletedAt" IS NULL
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

CREATE OR REPLACE VIEW hr_analytics.v_leave_balances
  WITH (security_invoker = false) AS
SELECT
  lb."id"          AS leave_balance_id,
  lb."employeeId"  AS employee_id,
  e."departmentId" AS department_id,
  e."teamId"       AS team_id,
  lb."leaveTypeId" AS leave_type_id,
  lt."name"        AS leave_type_name,
  lb."year"        AS year,
  lb."totalDays"   AS total_days,
  lb."usedDays"    AS used_days,
  lb."pendingDays" AS pending_days,
  (lb."totalDays" - lb."usedDays" - lb."pendingDays") AS remaining_days
FROM hr_core."leave_balances" lb
JOIN      hr_core."employees"   e ON e."id"  = lb."employeeId"
JOIN      hr_core."leave_types" lt ON lt."id" = lb."leaveTypeId"
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
WHERE e."deletedAt" IS NULL
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

CREATE OR REPLACE VIEW hr_analytics.v_employee_skills
  WITH (security_invoker = false) AS
SELECT
  es."employeeId"        AS employee_id,
  e."departmentId"       AS department_id,
  e."teamId"             AS team_id,
  es."skillId"           AS skill_id,
  s."name"               AS skill_name,
  s."domain"::text       AS skill_domain,
  es."proficiency"::text AS proficiency,
  es."acquiredDate"      AS acquired_date
FROM hr_core."employee_skills" es
JOIN      hr_core."employees"   e ON e."id" = es."employeeId"
JOIN      hr_core."skills"      s ON s."id" = es."skillId"
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
WHERE es."deletedAt" IS NULL
  AND e."deletedAt" IS NULL
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

-- Free-text employeeComments / managerComments are deliberately excluded: they are
-- narrative HR content, not analytics dimensions, and can carry sensitive detail.
CREATE OR REPLACE VIEW hr_analytics.v_performance_reviews
  WITH (security_invoker = false) AS
SELECT
  pr."id"                          AS review_id,
  pr."employeeId"                  AS employee_id,
  pr."reviewDate"                  AS review_date,
  pr."status"::text                AS status,
  pr."departmentId"                AS department_id,
  pr."departmentName"              AS department_name,
  pr."teamId"                      AS team_id,
  pr."teamName"                    AS team_name,
  pr."positionTitle"               AS position_title,
  pr."selfRating"::text            AS self_rating,
  pr."managerRating"::text         AS manager_rating,
  pr."jobSatisfaction"::text       AS job_satisfaction,
  pr."environmentSatisfaction"::text AS environment_satisfaction,
  pr."workLifeBalance"::text       AS work_life_balance,
  pr."trainingOpportunitiesTaken"  AS training_opportunities_taken,
  pr."completedAt"                 AS completed_at
FROM hr_core."performance_reviews" pr
JOIN      hr_core."employees"   e ON e."id" = pr."employeeId"
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
WHERE e."deletedAt" IS NULL
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

-- ── Compensation ────────────────────────────────────────────────────────────
-- Gated on BOTH sentient.comp_visible (the role gate, mirroring
-- EmployeesService.buildCompensationAccessFilter, which grants MANAGER/TEAM_LEAD
-- compensation and delegates row filtering to buildProfileAccessFilter) AND the
-- same scope predicate as v_employees. A manager sees their team's compensation
-- and nothing beyond it.
--
-- NO employee identifier or name in the SELECT list — scope filtering reads
-- e."teamId" / e."departmentId" in the WHERE clause without exposing e."id".
-- This keeps the Text-to-SQL channel aggregate-shaped per security.md §3 #6.
CREATE OR REPLACE VIEW hr_analytics.v_compensation
  WITH (security_invoker = false) AS
SELECT
  e."departmentId"       AS department_id,
  d."name"               AS department_name,
  e."teamId"             AS team_id,
  t."name"               AS team_name,
  p."title"              AS position_title,
  p."level"::text        AS position_level,
  e."contractType"::text AS contract_type,
  e."grossSalary"        AS gross_salary,
  e."netSalary"          AS net_salary,
  d."businessUnitId"     AS business_unit_id
FROM hr_core."employees" e
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
LEFT JOIN hr_core."positions"   p ON p."id" = e."positionId"
WHERE e."deletedAt" IS NULL
  AND e."grossSalary" IS NOT NULL
  AND current_setting('sentient.comp_visible', true) = 'true'
  AND (
    current_setting('sentient.scope', true) = 'GLOBAL'
    OR (current_setting('sentient.scope', true) = 'DEPARTMENT'
        AND e."departmentId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'TEAM'
        AND e."teamId" = current_setting('sentient.scope_entity_id', true))
    OR (current_setting('sentient.scope', true) = 'MANAGER_FALLBACK'
        AND (d."headId" = current_setting('sentient.actor_employee_id', true)
          OR t."leadId" = current_setting('sentient.actor_employee_id', true)
          OR e."teamId" = current_setting('sentient.actor_team_id', true)))
    OR (current_setting('sentient.scope', true) = 'OWN'
        AND e."id" = current_setting('sentient.actor_employee_id', true))
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Explicit per-view SELECT. There is deliberately no ALTER DEFAULT PRIVILEGES:
-- adding a view to this schema must be a conscious act, not an inherited grant.

GRANT SELECT ON hr_analytics.v_departments        TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_teams              TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_positions          TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_skills             TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_leave_types        TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_holidays           TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_employees          TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_leave_requests     TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_leave_balances     TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_employee_skills    TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_performance_reviews TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_compensation       TO ai_analytics_readonly;
