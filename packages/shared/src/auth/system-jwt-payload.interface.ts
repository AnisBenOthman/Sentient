export interface SystemJwtPayload {
  sub: 'system';
  roles: ['SYSTEM'];
  /** Always GLOBAL — system tasks operate across the full dataset. */
  scope: 'GLOBAL';
  /**
   * WHY: Scopes the token to a specific background task so that even if
   * a SYSTEM JWT leaks, it cannot be reused for arbitrary operations.
   * Example values: 'exit_survey_dispatch', 'engagement_snapshot',
   * 'org_scenario_amendment', 'regulation_seed'.
   */
  taskType: string;
  iat: number;
  /** Maximum 5 minutes — never long-lived. */
  exp: number;
}
