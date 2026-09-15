/**
 * WHY: single source of truth for three consumers that must never drift apart —
 * the generator prompt, the validator allowlist, and the session variables the
 * client sets. A view described in the prompt but missing from the allowlist
 * produces confusing refusals; a session variable named differently here than in
 * the view DDL yields NULL, which silently means "zero rows" and gets debugged as
 * a query bug rather than a scoping bug.
 *
 * The view definitions themselves live in
 * apps/hr-core/prisma/migrations/20260729000000_ai_analytics_views/migration.sql.
 */

export const ANALYTICS_SCHEMA = 'hr_analytics';

/**
 * Session variables read by every view's scope predicate. These names are a
 * contract with the migration — changing one here without changing the DDL makes
 * every query return zero rows.
 */
export const SESSION_VARS = {
  scope: 'sentient.scope',
  scopeEntityId: 'sentient.scope_entity_id',
  actorEmployeeId: 'sentient.actor_employee_id',
  actorTeamId: 'sentient.actor_team_id',
  compVisible: 'sentient.comp_visible',
} as const;

/** Resolved row-scope discriminator. Mirrors EmployeesService.buildProfileAccessFilter. */
export type AnalyticsScope = 'GLOBAL' | 'DEPARTMENT' | 'TEAM' | 'MANAGER_FALLBACK' | 'OWN';

export interface AnalyticsView {
  name: string;
  description: string;
  columns: string;
  /** When true, only actors with compensation access may reference this view. */
  compensation?: boolean;
}

export const ANALYTICS_VIEWS: readonly AnalyticsView[] = [
  {
    name: 'v_employees',
    description: 'One row per active (non-deleted) employee, already scope-filtered.',
    columns:
      'employee_id, employee_code, first_name, last_name, hire_date, employment_status, ' +
      'contract_type, gender, marital_status, education_level, education_field, age_years, ' +
      'tenure_years, position_id, position_title, department_id, department_name, team_id, ' +
      'team_name, manager_id, business_unit_id',
  },
  {
    name: 'v_departments',
    description: 'Department reference data.',
    columns: 'department_id, department_name, department_code, business_unit_id, is_active',
  },
  {
    name: 'v_teams',
    description: 'Team reference data.',
    columns: 'team_id, team_name, team_code, department_id, business_unit_id, project_focus, is_active',
  },
  {
    name: 'v_positions',
    description: 'Position/job-title reference data.',
    columns: 'position_id, position_title, position_level, is_active, is_key_position',
  },
  {
    name: 'v_leave_requests',
    description:
      'One row per leave request. status is one of PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED. ' +
      'Use status = \'APPROVED\' for leave actually taken.',
    columns:
      'leave_request_id, employee_id, department_id, team_id, leave_type_id, leave_type_name, ' +
      'start_date, end_date, total_days, status, reviewed_at, created_at',
  },
  {
    name: 'v_leave_balances',
    description: 'Per-employee, per-type, per-year leave entitlement and usage.',
    columns:
      'leave_balance_id, employee_id, department_id, team_id, leave_type_id, leave_type_name, ' +
      'year, total_days, used_days, pending_days, remaining_days',
  },
  {
    name: 'v_leave_types',
    description: 'Leave type reference data.',
    columns:
      'leave_type_id, leave_type_name, business_unit_id, default_days_per_year, requires_approval, is_active',
  },
  {
    name: 'v_holidays',
    description: 'Public and company holidays.',
    columns: 'holiday_id, business_unit_id, holiday_name, holiday_date, is_recurring, year',
  },
  {
    name: 'v_skills',
    description: 'Skill reference data.',
    columns: 'skill_id, skill_name, skill_domain, skill_category',
  },
  {
    name: 'v_employee_skills',
    description: 'Skills held by employees, with proficiency.',
    columns:
      'employee_id, department_id, team_id, skill_id, skill_name, skill_domain, proficiency, acquired_date',
  },
  {
    name: 'v_performance_reviews',
    description:
      'Completed and in-flight performance reviews. Ratings are text enums such as ' +
      'EXCEPTIONAL, EXCEEDS_EXPECTATIONS, MEETS_EXPECTATIONS, NEEDS_IMPROVEMENT, UNSATISFACTORY.',
    columns:
      'review_id, employee_id, review_date, status, department_id, department_name, team_id, ' +
      'team_name, position_title, self_rating, manager_rating, job_satisfaction, ' +
      'environment_satisfaction, work_life_balance, training_opportunities_taken, completed_at',
  },
  {
    name: 'v_compensation',
    description:
      'Salary rows with NO employee identifier or name — aggregate use only. Already filtered to ' +
      'the caller\'s permitted scope.',
    columns:
      'department_id, department_name, team_id, team_name, position_title, position_level, ' +
      'contract_type, gross_salary, net_salary, business_unit_id',
    compensation: true,
  },
] as const;

/** Roles permitted to use the analytics SQL branch at all. */
export const ANALYTICS_SQL_ROLES = ['MANAGER', 'TEAM_LEAD', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE'] as const;

/**
 * Roles permitted to read compensation. Mirrors
 * EmployeesService.buildCompensationAccessFilter: managers and team leads are
 * included, and their rows are narrowed by the scope predicate in the view.
 */
export const COMPENSATION_ROLES = ['MANAGER', 'TEAM_LEAD', 'HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE'] as const;

export function hasAnalyticsSqlAccess(roles: readonly string[]): boolean {
  return roles.some((role) => (ANALYTICS_SQL_ROLES as readonly string[]).includes(role));
}

export function hasCompensationAccess(roles: readonly string[]): boolean {
  return roles.some((role) => (COMPENSATION_ROLES as readonly string[]).includes(role));
}

/** Fully-qualified view names this actor may reference, e.g. `hr_analytics.v_employees`. */
export function allowedRelations(roles: readonly string[]): Set<string> {
  const compensationAllowed = hasCompensationAccess(roles);
  const names = ANALYTICS_VIEWS.filter((view) => compensationAllowed || view.compensation !== true).map(
    (view) => `${ANALYTICS_SCHEMA}.${view.name}`,
  );
  return new Set(names);
}

/** The schema block injected into the generator prompt. */
export function schemaPrompt(roles: readonly string[]): string {
  const compensationAllowed = hasCompensationAccess(roles);
  const lines = ANALYTICS_VIEWS.filter((view) => compensationAllowed || view.compensation !== true).map(
    (view) => `${ANALYTICS_SCHEMA}.${view.name} — ${view.description}\n  columns: ${view.columns}`,
  );
  return lines.join('\n');
}
