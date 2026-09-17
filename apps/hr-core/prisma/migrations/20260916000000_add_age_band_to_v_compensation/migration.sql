-- ============================================================================
-- v_compensation gains age_band — salary analytics segmented by age
-- ============================================================================
-- WHY a column on the existing view rather than a new pre-aggregated one:
-- v_compensation carries the compensation dimensions (department, team,
-- position, contract type) while v_employees carries the demographic ones
-- (age_years, tenure_years, gender), and the two share no join key by design —
-- v_compensation exposes no employee identifier. That gap makes "average salary
-- by age" unanswerable, and the same is true of every other demographic
-- dimension. Answering each one with its own pre-aggregated view would need a
-- migration, a schema-context entry and a generator prompt rule per question
-- shape, and a pre-averaged view also forces the caller to recombine buckets
-- with a count-weighted mean to answer anything broader — arithmetic that
-- LLM-generated SQL gets silently wrong. One extra grouping column answers the
-- whole family through the generic aggregation path instead.
--
-- WHY no k-anonymity floor: this mirrors the decision already recorded for
-- v_compensation itself (AGENTS.md) — the view is scope-filtered first, so every
-- actor who can reach a row is already entitled to that individual's
-- compensation through HR Core RBAC, and a k>=5 floor would empty the manager
-- surface entirely (most teams are under five people). A suppressed bucket also
-- surfaces to the user as "No rows matched that query", which reads as "no such
-- data exists" rather than "withheld" — a silent falsehood, not a safeguard.
--
-- WHY the band and not age_years: a coarse band is the weakest form of the age
-- signal that still answers the question. Exact age alongside salary in one row
-- would make an individual trivially re-identifiable to anyone who also reads
-- v_employees (name + age_years, same scope), which is precisely the link
-- v_compensation's missing identifier exists to prevent.
--
-- Band labels state their own boundaries exactly — '30-44' is 30 <= age < 45 and
-- '45+' is age >= 45 — so a question about "over 45" is answered for, and must
-- be reported as, employees aged 45 and over. An employee with no recorded date
-- of birth keeps their salary row with a NULL age_band, so age-filtered queries
-- exclude them without dropping them from unfiltered salary aggregates.
--
-- CREATE OR REPLACE VIEW can only APPEND columns — existing names, order and
-- types must stay byte-identical to migration 20260729000000 or this fails with
-- "cannot change name of view column". age_band is therefore last.
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
    WHEN date_part('year', age(e."dateOfBirth")) < 30 THEN '<30'
    WHEN date_part('year', age(e."dateOfBirth")) < 45 THEN '30-44'
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

-- Idempotent: CREATE OR REPLACE preserves existing grants, but re-issuing keeps
-- this migration self-contained if it is ever replayed onto a fresh view.
GRANT SELECT ON hr_analytics.v_compensation TO ai_analytics_readonly;
