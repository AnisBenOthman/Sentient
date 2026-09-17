import { SqlValidatorService } from './sql-validator.service';

const HR_ADMIN = ['HR_ADMIN'];
const MANAGER = ['MANAGER'];
const EMPLOYEE = ['EMPLOYEE'];
const ROW_LIMIT = 1000;

function reject(result: ReturnType<SqlValidatorService['validate']>): string {
  if (result.ok) throw new Error(`Expected rejection but got: ${result.sql}`);
  return result.reason;
}

describe('SqlValidatorService', () => {
  const validator = new SqlValidatorService();

  it('accepts a schema-qualified aggregate over an allowlisted view', () => {
    const result = validator.validate(
      "SELECT department_name, COUNT(*) AS headcount FROM hr_analytics.v_employees GROUP BY department_name",
      HR_ADMIN,
      ROW_LIMIT,
    );

    expect(result.ok).toBe(true);
  });

  // WHY rowLimit + 1: without the extra row there is no way to distinguish a
  // capped result from one that happens to return exactly rowLimit rows, and the
  // service promises the user an explicit "not the complete result" notice.
  it('wraps the statement and requests one row beyond the limit', () => {
    const result = validator.validate(
      'SELECT employee_id FROM hr_analytics.v_employees',
      HR_ADMIN,
      ROW_LIMIT,
    );

    if (!result.ok) throw new Error(result.reason);
    expect(result.sql).toContain('SELECT * FROM (');
    expect(result.sql).toContain(') AS _q LIMIT 1001');
  });

  it('caps a query that already carries a larger LIMIT', () => {
    const result = validator.validate(
      'SELECT employee_id FROM hr_analytics.v_employees LIMIT 999999',
      HR_ADMIN,
      ROW_LIMIT,
    );

    if (!result.ok) throw new Error(result.reason);
    // The inner LIMIT survives, but the outer wrapper bounds the result set.
    expect(result.sql.endsWith('LIMIT 1001')).toBe(true);
  });

  it('rejects multiple statements', () => {
    const reason = reject(
      validator.validate(
        'SELECT 1 FROM hr_analytics.v_employees; DROP TABLE hr_core.employees',
        HR_ADMIN,
        ROW_LIMIT,
      ),
    );
    expect(reason).toMatch(/multiple statements/i);
  });

  it('tolerates a single trailing semicolon', () => {
    const result = validator.validate(
      'SELECT employee_id FROM hr_analytics.v_employees;',
      HR_ADMIN,
      ROW_LIMIT,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    'DELETE FROM hr_analytics.v_employees',
    "UPDATE hr_analytics.v_employees SET first_name = 'x'",
    'SELECT employee_id INTO tmp FROM hr_analytics.v_employees',
    'DROP VIEW hr_analytics.v_employees',
    'GRANT SELECT ON hr_analytics.v_employees TO PUBLIC',
  ])('rejects the mutating statement: %s', (sql) => {
    // The specific reason varies (statement-type gate vs keyword gate); what
    // matters is that no mutating statement is ever returned as executable.
    expect(validator.validate(sql, HR_ADMIN, ROW_LIMIT).ok).toBe(false);
  });

  it('rejects a non-allowlisted relation', () => {
    const reason = reject(
      validator.validate('SELECT * FROM hr_core.employees', HR_ADMIN, ROW_LIMIT),
    );
    expect(reason).toMatch(/not permitted/i);
  });

  it('rejects an unqualified relation even when the bare name matches a view', () => {
    const reason = reject(validator.validate('SELECT * FROM v_employees', HR_ADMIN, ROW_LIMIT));
    expect(reason).toMatch(/not permitted/i);
  });

  // WHY: the entire scoping model rests on session variables the service sets, so
  // generated SQL must not be able to read them back or overwrite them.
  it.each(['current_setting', 'set_config'])('rejects %s', (fn) => {
    const sql = `SELECT ${fn}('sentient.scope', true) FROM hr_analytics.v_employees`;
    expect(reject(validator.validate(sql, HR_ADMIN, ROW_LIMIT))).toMatch(/disallowed identifier/i);
  });

  it('rejects catalog probing', () => {
    const reason = reject(
      validator.validate('SELECT * FROM pg_catalog.pg_tables', HR_ADMIN, ROW_LIMIT),
    );
    expect(reason).toMatch(/disallowed identifier/i);
  });

  it('rejects comma joins rather than trying to parse the relation list', () => {
    const reason = reject(
      validator.validate(
        'SELECT * FROM hr_analytics.v_employees e, hr_analytics.v_teams t',
        HR_ADMIN,
        ROW_LIMIT,
      ),
    );
    expect(reason).toMatch(/comma joins/i);
  });

  it('accepts explicit JOIN syntax with aliases', () => {
    const result = validator.validate(
      'SELECT e.employee_id FROM hr_analytics.v_employees AS e ' +
        'JOIN hr_analytics.v_teams AS t ON t.team_id = e.team_id',
      HR_ADMIN,
      ROW_LIMIT,
    );
    expect(result.ok).toBe(true);
  });

  it('permits a CTE to reference itself but still checks its own sources', () => {
    const ok = validator.validate(
      'WITH counts AS (SELECT department_id, COUNT(*) AS n FROM hr_analytics.v_employees GROUP BY department_id) ' +
        'SELECT * FROM counts',
      HR_ADMIN,
      ROW_LIMIT,
    );
    expect(ok.ok).toBe(true);

    const reason = reject(
      validator.validate(
        'WITH counts AS (SELECT * FROM hr_core.employees) SELECT * FROM counts',
        HR_ADMIN,
        ROW_LIMIT,
      ),
    );
    expect(reason).toMatch(/not permitted/i);
  });

  // WHY: scrubbing runs before every other check, so a keyword or view name hidden
  // inside a comment or a string literal cannot influence the verdict.
  it('ignores relations mentioned only inside comments or string literals', () => {
    const commented = validator.validate(
      'SELECT employee_id FROM hr_analytics.v_employees -- FROM hr_core.employees',
      HR_ADMIN,
      ROW_LIMIT,
    );
    expect(commented.ok).toBe(true);

    const literal = validator.validate(
      "SELECT 'DELETE FROM hr_core.employees' AS note FROM hr_analytics.v_employees",
      HR_ADMIN,
      ROW_LIMIT,
    );
    expect(literal.ok).toBe(true);
  });

  it('rejects a query that reads no view at all', () => {
    expect(reject(validator.validate('SELECT 1', HR_ADMIN, ROW_LIMIT))).toMatch(/does not read/i);
  });

  // WHY these are asserted rather than reasoned about: the forbidden-keyword list
  // uses word boundaries, and it is easy to assume `\bset\b` swallows OFFSET or
  // that a column name containing a keyword trips the gate. These pin the actual
  // behaviour so the list can be edited safely.
  it.each([
    'SELECT employee_id FROM hr_analytics.v_employees ORDER BY employee_id OFFSET 10',
    'SELECT REPLACE(department_name, %27-%27, %27 %27) AS d FROM hr_analytics.v_employees',
    'SELECT COUNT(*) AS total_headcount FROM hr_analytics.v_employees',
  ])('accepts the legitimate statement: %s', (sql) => {
    const result = validator.validate(sql.replace(/%27/g, "'"), HR_ADMIN, ROW_LIMIT);
    if (!result.ok) throw new Error(`Unexpected rejection: ${result.reason}`);
    expect(result.ok).toBe(true);
  });

  describe('compensation allowlist', () => {
    it('permits v_compensation for a manager', () => {
      const result = validator.validate(
        'SELECT AVG(gross_salary) AS avg_salary FROM hr_analytics.v_compensation',
        MANAGER,
        ROW_LIMIT,
      );
      expect(result.ok).toBe(true);
    });

    it('refuses v_compensation for a role without compensation access', () => {
      const reason = reject(
        validator.validate(
          'SELECT AVG(gross_salary) AS avg_salary FROM hr_analytics.v_compensation',
          EMPLOYEE,
          ROW_LIMIT,
        ),
      );
      expect(reason).toMatch(/not permitted/i);
    });
  });
});
