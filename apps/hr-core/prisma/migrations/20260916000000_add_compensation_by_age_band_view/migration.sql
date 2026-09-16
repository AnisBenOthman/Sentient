-- ============================================================================
-- v_compensation_by_age_band — safely-aggregated compensation by age band
-- ============================================================================
-- WHY this exists instead of joining v_compensation to v_employees: v_compensation
-- deliberately carries no employee_id (see its own header comment in migration
-- 20260729000000) so salary can never be re-identified to a person from
-- hr_analytics alone. v_employees carries age_years but no salary. There is no
-- shared key — that gap is intentional, not an oversight, and this view must not
-- try to close it by exposing employee_id anywhere. It re-derives age directly
-- from hr_core.employees, the same way v_employees does, and aggregates in the
-- SAME statement so no row-level (age, salary) pair is ever readable through
-- hr_analytics.
--
-- WHY grouped ONLY by age_band, with no department/team/position slicing: age
-- and salary together are a much stronger re-identification signal than salary
-- alone, so finer grouping is deliberately avoided — more dimensions means
-- smaller, riskier buckets, and it would also force an LLM-generated query to
-- recombine several pre-averaged rows with a count-weighted mean instead of a
-- plain AVG to get one "average salary over 45" figure, which is exactly the
-- kind of arithmetic mistake LLM-generated SQL makes silently. A genuine
-- department/team-level age-band reporting need should get its own,
-- separately-reviewed view rather than widening this one's grain.
--
-- WHY HAVING COUNT(*) >= 5: suppresses any (scope, age_band) bucket too small to
-- protect the people in it. 5 is a standard small-cell-suppression default;
-- there is no existing precedent for this number elsewhere in this codebase, so
-- it is intentionally hardcoded in the view rather than made a runtime session
-- variable — a threshold change should be a deliberate, reviewable migration,
-- not something a config change could silently loosen.
--
-- Age bands mirror v_employees.age_years' derivation (age(dateOfBirth)) exactly.
-- A person with no recorded date of birth is excluded from every bucket (never
-- miscounted into one) via the dateOfBirth IS NOT NULL filter. Bands are coarse,
-- not year-exact: "more than 45" maps to the '45+' bucket by design — someone
-- exactly 45 falls in '45+', not '30-45'. This is a deliberate anonymization
-- trade-off; it should not be "fixed" into an exact->45 filter later, which
-- would re-narrow group sizes and defeat the suppression above.
--
-- Gated the same way as v_compensation: BOTH sentient.comp_visible (role gate)
-- AND the same five-branch scope predicate used by every other scoped view.
CREATE OR REPLACE VIEW hr_analytics.v_compensation_by_age_band
  WITH (security_invoker = false) AS
SELECT
  CASE
    WHEN date_part('year', age(e."dateOfBirth")) < 30 THEN '<30'
    WHEN date_part('year', age(e."dateOfBirth")) < 45 THEN '30-45'
    ELSE '45+'
  END                                   AS age_band,
  COUNT(*)::int                         AS employee_count,
  ROUND(AVG(e."grossSalary"), 2)        AS avg_gross_salary,
  ROUND(AVG(e."netSalary"), 2)          AS avg_net_salary
FROM hr_core."employees" e
LEFT JOIN hr_core."departments" d ON d."id" = e."departmentId"
LEFT JOIN hr_core."teams"       t ON t."id" = e."teamId"
WHERE e."deletedAt" IS NULL
  AND e."grossSalary" IS NOT NULL
  AND e."dateOfBirth" IS NOT NULL
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
  )
GROUP BY age_band
HAVING COUNT(*) >= 5;

GRANT SELECT ON hr_analytics.v_compensation_by_age_band TO ai_analytics_readonly;
