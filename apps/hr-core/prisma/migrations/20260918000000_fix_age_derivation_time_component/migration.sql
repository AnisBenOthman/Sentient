-- ============================================================================
-- Fix age/tenure derivation for timestamps carrying a time component
-- ============================================================================
-- THE BUG: `age(ts)` is shorthand for `age(current_date, ts)`, and current_date
-- is midnight. "dateOfBirth" and "hireDate" are `timestamp without time zone`,
-- so any row written with a time-of-day component is compared against midnight
-- and comes up short by that many hours. On the exact anniversary that pushes
-- the interval just under a whole year:
--
--   dateOfBirth = 1981-09-18 18:30   age() -> 44 years 11 mons 29 days  -> 44
--   dateOfBirth = 1981-09-18 00:00   age() -> 45 years                  -> 45
--
-- So an employee read as 44 on the morning of their 45th birthday and 45 the
-- next day, purely because of a time component nobody entered deliberately.
-- Prisma writes a JS Date straight through, so whether a row is affected
-- depends on how it was created: a date-only string parses to UTC midnight and
-- is safe, while a picker, an import, or a `now()`-based seed is not. That made
-- the bug invisible in most data and wrong for exactly the people on their
-- birthday — and it silently moved them between age bands.
--
-- THE FIX: cast to `::date` first, so both sides of the subtraction are
-- midnight and the interval is a clean whole-year count. `age(x::date)` still
-- uses current_date as its reference, so the one-argument form is kept.
--
-- Applies to all three derivations sharing the defect: v_employees.age_years,
-- v_employees.tenure_years (same class — tenure read a year short on the hire
-- anniversary, which moves employees between tenure bands and can hide someone
-- from a "5+ years of service" query on the day it matters), and
-- v_compensation.age_band.
--
-- Both views are restated in full because CREATE OR REPLACE VIEW requires the
-- complete SELECT; column names, order and types are unchanged, which is also
-- what CREATE OR REPLACE demands.

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
    ELSE date_part('year', age(e."dateOfBirth"::date))::int
  END                        AS age_years,
  date_part('year', age(e."hireDate"::date))::int AS tenure_years,
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
  d."businessUnitId"     AS business_unit_id,
  CASE
    WHEN e."dateOfBirth" IS NULL THEN NULL
    WHEN date_part('year', age(e."dateOfBirth"::date)) < 30 THEN '<30'
    WHEN date_part('year', age(e."dateOfBirth"::date)) < 45 THEN '30-44'
    ELSE '45+'
  END                    AS age_band
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

GRANT SELECT ON hr_analytics.v_employees    TO ai_analytics_readonly;
GRANT SELECT ON hr_analytics.v_compensation TO ai_analytics_readonly;
