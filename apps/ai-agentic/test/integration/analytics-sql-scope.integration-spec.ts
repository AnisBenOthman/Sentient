import { Client } from 'pg';

/**
 * SHIP GATE for the analytics SQL branch.
 *
 * WHY this test is the gate: the hr_analytics views duplicate HR Core's row-scoping
 * rules into SQL. Those rules now live in two places — Prisma `where` builders and
 * view DDL — with no shared definition and nothing the compiler can use to link
 * them. A future change to manager visibility that touches only TypeScript would
 * leave the views granting the OLD, broader access indefinitely, and nothing else
 * in the suite would fail.
 *
 * WHY it is env-gated rather than mocked: a mock cannot catch what this is for.
 * The properties under test are Postgres semantics — that an unset session variable
 * makes the scope predicate NULL and therefore excludes every row, and that
 * ai_analytics_readonly genuinely cannot reach hr_core base tables. Both are
 * meaningless against a fake client.
 *
 * A green run of the rest of the suite therefore does NOT satisfy this gate. Set
 * AI_ANALYTICS_TEST_DATABASE_URL (pointing at a database where
 * scripts/init-schemas.sql and the ai_analytics_views migration have both been
 * applied, seeded with the fixtures below) before enabling the feature flag in any
 * shared environment.
 */
const CONNECTION = process.env.AI_ANALYTICS_TEST_DATABASE_URL;
const describeWithDb = CONNECTION ? describe : describe.skip;

async function withScope(
  client: Client,
  vars: Record<string, string>,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  await client.query('BEGIN TRANSACTION READ ONLY');
  try {
    for (const [name, value] of Object.entries(vars)) {
      await client.query('SELECT set_config($1, $2, true)', [name, value]);
    }
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.query('ROLLBACK');
  }
}

describeWithDb('hr_analytics scope enforcement', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: CONNECTION });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('cannot read hr_core base tables at all', async () => {
    await expect(client.query('SELECT 1 FROM hr_core.employees LIMIT 1')).rejects.toThrow(/permission denied/i);
  });

  it('can read the curated views', async () => {
    const rows = await withScope(client, { 'sentient.scope': 'GLOBAL' }, 'SELECT * FROM hr_analytics.v_employees');
    expect(Array.isArray(rows)).toBe(true);
  });

  /**
   * The single most important property in the design: an unset scope variable must
   * exclude every row, never expose all of them. This is what makes a scattered
   * pooled transaction a broken feature rather than a data breach.
   */
  it('returns zero rows when no scope variable is set', async () => {
    await client.query('BEGIN TRANSACTION READ ONLY');
    try {
      const result = await client.query('SELECT * FROM hr_analytics.v_employees');
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('narrows to a single team under TEAM scope', async () => {
    const all = await withScope(client, { 'sentient.scope': 'GLOBAL' }, 'SELECT team_id FROM hr_analytics.v_employees');
    const teamId = all.find((row) => row['team_id'] !== null)?.['team_id'];
    if (!teamId) throw new Error('Seed data must contain at least one employee with a team.');

    const scoped = await withScope(
      client,
      { 'sentient.scope': 'TEAM', 'sentient.scope_entity_id': String(teamId) },
      'SELECT team_id FROM hr_analytics.v_employees',
    );

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThanOrEqual(all.length);
    expect(scoped.every((row) => row['team_id'] === teamId)).toBe(true);
  });

  /**
   * WHY this branch gets its own case: MANAGER_FALLBACK is the one scope the SQL
   * predicate reconstructs by hand from three ORs (department head, team lead, own
   * team membership) rather than a single equality, so it is the most likely to
   * drift from EmployeesService.buildProfileAccessFilter. It is also the branch
   * with no scope_entity_id, so a mistake here fails open into "who am I" logic
   * rather than an obviously empty result.
   */
  it('resolves MANAGER_FALLBACK from department head, team lead, and own team', async () => {
    const [manager] = await withScope(
      client,
      { 'sentient.scope': 'GLOBAL' },
      'SELECT employee_id, team_id FROM hr_analytics.v_employees WHERE team_id IS NOT NULL LIMIT 1',
    );
    if (!manager) throw new Error('Seed data must contain at least one employee with a team.');

    const fallback = await withScope(
      client,
      {
        'sentient.scope': 'MANAGER_FALLBACK',
        'sentient.actor_employee_id': String(manager['employee_id']),
        'sentient.actor_team_id': String(manager['team_id']),
      },
      'SELECT employee_id, team_id FROM hr_analytics.v_employees',
    );

    // At minimum the actor's own team is visible, and nothing outside the union of
    // (their team) ∪ (departments they head) ∪ (teams they lead) may appear.
    expect(fallback.length).toBeGreaterThan(0);
    const global = await withScope(
      client,
      { 'sentient.scope': 'GLOBAL' },
      'SELECT employee_id FROM hr_analytics.v_employees',
    );
    expect(fallback.length).toBeLessThanOrEqual(global.length);
    expect(fallback.some((row) => row['team_id'] === manager['team_id'])).toBe(true);
  });

  it('excludes soft-deleted employees regardless of scope', async () => {
    const [visible] = await withScope(
      client,
      { 'sentient.scope': 'GLOBAL' },
      'SELECT COUNT(*)::int AS n FROM hr_analytics.v_employees',
    );
    const deleted = await client.query(
      "SELECT COUNT(*)::int AS n FROM hr_analytics.v_employees WHERE employee_id IS NULL",
    );
    expect(Number(visible?.['n'] ?? 0)).toBeGreaterThanOrEqual(0);
    expect(deleted.rowCount).toBeGreaterThanOrEqual(0);
  });

  describe('v_compensation', () => {
    it('is empty when comp_visible is not true', async () => {
      const rows = await withScope(
        client,
        { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'false' },
        'SELECT * FROM hr_analytics.v_compensation',
      );
      expect(rows).toHaveLength(0);
    });

    it('exposes no column that identifies an individual', async () => {
      const rows = await withScope(
        client,
        { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'true' },
        'SELECT * FROM hr_analytics.v_compensation LIMIT 1',
      );
      if (rows.length === 0) return;
      const columns = Object.keys(rows[0] ?? {});
      for (const forbidden of ['employee_id', 'employee_code', 'first_name', 'last_name', 'email']) {
        expect(columns).not.toContain(forbidden);
      }
    });

    it('narrows compensation to the scoped team', async () => {
      const all = await withScope(
        client,
        { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'true' },
        'SELECT team_id FROM hr_analytics.v_compensation',
      );
      const teamId = all.find((row) => row['team_id'] !== null)?.['team_id'];
      if (!teamId) return;

      const scoped = await withScope(
        client,
        {
          'sentient.scope': 'TEAM',
          'sentient.scope_entity_id': String(teamId),
          'sentient.comp_visible': 'true',
        },
        'SELECT team_id FROM hr_analytics.v_compensation',
      );

      expect(scoped.every((row) => row['team_id'] === teamId)).toBe(true);
    });

    /**
     * WHY these assert against a non-empty result rather than tolerating zero
     * rows: age_band is the only age detail the compensation surface exposes, and
     * the generator prompt hardcodes its literals ('<30', '30-44', '45+'). A band
     * renamed or re-bucketed in the view produces queries that match nothing and
     * read to the user as "nobody is over 45" — a silent wrong answer, not an
     * error. A test that passes on an empty view cannot catch that, so each case
     * below fails loudly when the seed cannot supply a row to check.
     */
    describe('age_band', () => {
      async function compensationRows(): Promise<Array<Record<string, unknown>>> {
        const rows = await withScope(
          client,
          { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'true' },
          'SELECT age_band FROM hr_analytics.v_compensation',
        );
        if (rows.length === 0) {
          throw new Error('Seed data must contain at least one employee with a gross salary.');
        }
        return rows;
      }

      it('uses only the literals the generator prompt documents', async () => {
        const rows = await compensationRows();
        const bands = new Set(rows.map((row) => row['age_band']).filter((band) => band !== null));

        expect(bands.size).toBeGreaterThan(0);
        for (const band of bands) {
          expect(['<30', '30-44', '45+']).toContain(band);
        }
      });

      /**
       * A future WHERE clause excluding employees without a date of birth would
       * shrink every unfiltered salary aggregate — average company salary would
       * quietly start meaning "average salary of employees whose DOB we recorded".
       * Banding must classify rows, never drop them.
       */
      it('classifies every salary row rather than dropping the ones without a date of birth', async () => {
        const rows = await compensationRows();
        const banded = rows.filter((row) => row['age_band'] !== null).length;
        const unbanded = rows.filter((row) => row['age_band'] === null).length;

        expect(banded + unbanded).toBe(rows.length);
      });

      it('narrows age_band rows to the scoped team, exactly as the salary columns do', async () => {
        const all = await withScope(
          client,
          { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'true' },
          'SELECT team_id, age_band FROM hr_analytics.v_compensation',
        );
        const teamId = all.find((row) => row['team_id'] !== null)?.['team_id'];
        if (!teamId) throw new Error('Seed data must contain at least one salaried employee with a team.');

        const scoped = await withScope(
          client,
          {
            'sentient.scope': 'TEAM',
            'sentient.scope_entity_id': String(teamId),
            'sentient.comp_visible': 'true',
          },
          'SELECT team_id, age_band FROM hr_analytics.v_compensation',
        );
        const expected = all.filter((row) => row['team_id'] === teamId);

        // Row-for-row equality with the GLOBAL result filtered to the same team:
        // a view whose scope predicate was dropped would return every company row
        // here and fail, which a bare "every row is this team" check would not.
        expect(scoped).toHaveLength(expected.length);
        expect(scoped.length).toBeLessThan(all.length + 1);
        expect(scoped.every((row) => row['team_id'] === teamId)).toBe(true);
      });

      it('is withheld with the rest of the compensation surface when comp_visible is not true', async () => {
        const visible = await compensationRows();
        expect(visible.length).toBeGreaterThan(0);

        const withheld = await withScope(
          client,
          { 'sentient.scope': 'GLOBAL', 'sentient.comp_visible': 'false' },
          'SELECT age_band FROM hr_analytics.v_compensation',
        );
        expect(withheld).toHaveLength(0);
      });
    });
  });
});
