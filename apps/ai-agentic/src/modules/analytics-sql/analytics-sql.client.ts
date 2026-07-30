import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { AiAgenticConfig } from '../../config';
import { AnalyticsScope, SESSION_VARS } from './analytics-schema-context';

export interface AnalyticsScopeBinding {
  scope: AnalyticsScope;
  scopeEntityId: string | null;
  actorEmployeeId: string | null;
  actorTeamId: string | null;
  compensationVisible: boolean;
}

export type AnalyticsRow = Record<string, unknown>;

export type AnalyticsQueryOutcome =
  | { status: 'OK'; rows: AnalyticsRow[] }
  | { status: 'TIMEOUT' }
  | { status: 'ERROR'; detail: string };

/** Postgres error code for statement_timeout expiry. */
const QUERY_CANCELED = '57014';

@Injectable()
export class AnalyticsSqlClient implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsSqlClient.name);
  private pool: Pool | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * WHY a dedicated client rather than pool.query() — this is a correctness
   * requirement, not a style preference. set_config(..., is_local => true) scopes
   * the setting to the current transaction ON THE CURRENT CONNECTION. pool.query()
   * checks out an arbitrary client per call, so issuing BEGIN, the set_configs, and
   * the SELECT as separate pool.query() calls can scatter them across different
   * backends; every current_setting() in the views would then return NULL.
   *
   * That failure is fail-closed by design (NULL scope excludes every row, so the
   * query returns zero rows rather than global rows) — but it is still a broken
   * feature, and it is invisible to any psql-based test because a psql session is
   * a single connection by definition.
   */
  async run(
    sql: string,
    binding: AnalyticsScopeBinding,
    timeoutMs: number,
  ): Promise<AnalyticsQueryOutcome> {
    const pool = this.ensurePool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN TRANSACTION READ ONLY');

      // Parameterized throughout: scope values come from verified JWT claims and
      // must never be interpolated into statement text. set_config is a function
      // call, not a write, so it is permitted inside a READ ONLY transaction.
      await client.query(
        `SELECT
           set_config($1, $2, true),
           set_config($3, $4, true),
           set_config($5, $6, true),
           set_config($7, $8, true),
           set_config($9, $10, true),
           set_config('statement_timeout', $11, true)`,
        [
          SESSION_VARS.scope,
          binding.scope,
          SESSION_VARS.scopeEntityId,
          binding.scopeEntityId ?? '',
          SESSION_VARS.actorEmployeeId,
          binding.actorEmployeeId ?? '',
          SESSION_VARS.actorTeamId,
          binding.actorTeamId ?? '',
          SESSION_VARS.compVisible,
          binding.compensationVisible ? 'true' : 'false',
          String(timeoutMs),
        ],
      );

      const result = await client.query<AnalyticsRow>(sql);
      return { status: 'OK', rows: result.rows };
    } catch (err: unknown) {
      if (isQueryCanceled(err)) return { status: 'TIMEOUT' };
      // WHY the detail is logged but not returned to the caller's user: Postgres
      // error text can echo column names, constraint definitions, and literal row
      // values. AnalyticsSqlService maps this to generic user-facing wording.
      const detail = err instanceof Error ? err.message : 'unknown database error';
      this.logger.warn(`Analytics SQL execution failed: ${detail}`);
      return { status: 'ERROR', detail };
    } finally {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The transaction may already be aborted; releasing the client is what matters.
      }
      client.release();
    }
  }

  private ensurePool(): Pool {
    if (this.pool) return this.pool;

    const aiConfig = this.config.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig) throw new Error('aiAgentic config is not registered');

    this.pool = new Pool({
      connectionString: aiConfig.analyticsDatabaseUrl,
      // WHY max 2: the analytics role is isolated, but the Postgres INSTANCE is
      // shared with HR Core and Social. An expensive generated join consumes CPU
      // and I/O they depend on, so the branch is capped at two concurrent queries.
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'sentient-analytics-sql',
    });

    this.pool.on('error', (err) => {
      this.logger.warn(`Analytics SQL pool error: ${err.message}`);
    });

    return this.pool;
  }
}

function isQueryCanceled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === QUERY_CANCELED
  );
}
