import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionScope, RoleAssignmentClaim } from '@sentient/shared';
import { AgentNodeType, AgentRunStatus, AgentType, PermissionDecision } from '../../generated/prisma';
import { AiActorContext, SpecialistInput, SpecialistResult } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import { AgentTaskLogService } from '../agents/agent-task-log.service';
import { AnalyticsRow, AnalyticsScopeBinding, AnalyticsSqlClient } from './analytics-sql.client';
import { hasAnalyticsSqlAccess, hasCompensationAccess } from './analytics-schema-context';
import { SqlGeneratorService } from './sql-generator.service';
import { SqlValidatorService } from './sql-validator.service';

/** Rows rendered into the answer. Beyond this the table stops being readable. */
const MAX_RENDERED_ROWS = 40;

const PRIVILEGED_ROLES = ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'EXECUTIVE'];
const MANAGER_ROLES = ['MANAGER', 'TEAM_LEAD'];

@Injectable()
export class AnalyticsSqlService {
  private readonly logger = new Logger(AnalyticsSqlService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly generator: SqlGeneratorService,
    private readonly validator: SqlValidatorService,
    private readonly client: AnalyticsSqlClient,
    private readonly taskLog: AgentTaskLogService,
  ) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const aiConfig = this.config.get<AiAgenticConfig>('aiAgentic');
    if (!aiConfig) return this.refused('Analytics is not configured.');

    // WHY the role gate is re-checked here even though resolveSupervisorRoute
    // already checked it: the router check is a routing decision, this one is the
    // authorization. A later graph edit adding another inbound edge to this node
    // must not be able to bypass it.
    if (!aiConfig.analyticsSqlEnabled || !hasAnalyticsSqlAccess(input.actorContext.roles)) {
      return this.refused('You do not have access to the analytics query tool.');
    }

    const binding = this.resolveScope(input.actorContext);
    if (!binding) {
      return this.refused('Your account is not linked to an employee record, so I cannot scope this query.');
    }

    const generationLog = await this.taskLog.start({
      conversationId: input.conversationId,
      parentLogId: input.parentTaskLogId,
      agentType: AgentType.ANALYTICS_AGENT,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'analytics.sql_generated',
      actor: input.actorContext,
      inputSummary: input.userMessage,
    });

    let validatedSql: string;
    let explanation: string;
    try {
      const generated = await this.generator.generate(input.userMessage, input.actorContext.roles);
      if (!generated) {
        await this.taskLog.finish(generationLog.id, {
          status: AgentRunStatus.DEGRADED,
          outputSummary: 'SQL generation returned no usable statement.',
        });
        return this.degraded(
          "I couldn't turn that into a query I'm able to run. Try naming the metric and the time period explicitly.",
        );
      }

      const validation = this.validator.validate(
        generated.sql,
        input.actorContext.roles,
        aiConfig.analyticsSqlRowLimit,
      );

      if (!validation.ok) {
        await this.taskLog.finish(generationLog.id, {
          status: AgentRunStatus.REFUSED,
          outputSummary: `Rejected by validator: ${validation.reason}`,
          generatedSql: generated.sql,
        });
        // WHY the rejected SQL is not echoed to the user: it is model output shaped
        // by their message, and surfacing it invites probing the validator.
        return this.refused("I can't run that query safely, so I haven't run it at all.");
      }

      validatedSql = validation.sql;
      explanation = generated.explanation;

      await this.taskLog.finish(generationLog.id, {
        status: AgentRunStatus.SUCCESS,
        outputSummary: `Generated via ${generated.source}. ${generated.explanation}`,
        generatedSql: validatedSql,
      });
    } catch (err: unknown) {
      // WHY try/catch around the log lifecycle: executeSpecialist elsewhere leaks
      // rows at status RUNNING when a specialist throws. Analytics rows are the
      // audit trail for LLM-generated SQL, so they must always reach a terminal state.
      await this.taskLog.finish(generationLog.id, {
        status: AgentRunStatus.FAILED,
        errorCode: 'SQL_GENERATION_ERROR',
        errorMessage: this.errorText(err),
      });
      this.logger.warn(`Analytics SQL generation stage failed: ${this.errorText(err)}`);
      return this.degraded("I couldn't build a query for that question. Please try rephrasing it.");
    }

    const executionLog = await this.taskLog.start({
      conversationId: input.conversationId,
      parentLogId: input.parentTaskLogId,
      agentType: AgentType.ANALYTICS_AGENT,
      nodeType: AgentNodeType.SPECIALIST,
      taskType: 'analytics.sql_executed',
      actor: input.actorContext,
      inputSummary: `scope=${binding.scope} compensation=${binding.compensationVisible}`,
    });

    try {
      const outcome = await this.client.run(validatedSql, binding, aiConfig.analyticsSqlTimeoutMs);

      if (outcome.status === 'TIMEOUT') {
        await this.taskLog.finish(executionLog.id, {
          status: AgentRunStatus.DEGRADED,
          outputSummary: 'Statement timeout',
          generatedSql: validatedSql,
        });
        return this.degraded(
          'That query took too long to complete. A narrower time range or fewer groupings should work.',
        );
      }

      if (outcome.status === 'ERROR') {
        await this.taskLog.finish(executionLog.id, {
          status: AgentRunStatus.FAILED,
          errorCode: 'SQL_EXECUTION_ERROR',
          errorMessage: outcome.detail,
          generatedSql: validatedSql,
        });
        return this.degraded('I could not complete that query against the reporting data.');
      }

      const capped = outcome.rows.length > aiConfig.analyticsSqlRowLimit;
      const rows = capped ? outcome.rows.slice(0, aiConfig.analyticsSqlRowLimit) : outcome.rows;
      const status = capped ? AgentRunStatus.PARTIAL : AgentRunStatus.SUCCESS;

      await this.taskLog.finish(executionLog.id, {
        status,
        outputSummary: `${rows.length} row(s) returned${capped ? ' (capped)' : ''}`,
        permissionDecision: PermissionDecision.ALLOWED,
        generatedSql: validatedSql,
      });

      return {
        agentType: AgentType.ANALYTICS_AGENT,
        status,
        summary: `Analytics query returned ${rows.length} row(s).`,
        userVisibleContent: this.render(rows, explanation, capped, aiConfig.analyticsSqlRowLimit),
        sourceContext: [
          {
            sourceType: 'ANALYTICS_SQL',
            title: 'Reporting views (hr_analytics)',
            referenceId: `scope:${binding.scope}`,
          },
        ],
        permissionDecision: PermissionDecision.ALLOWED,
      };
    } catch (err: unknown) {
      await this.taskLog.finish(executionLog.id, {
        status: AgentRunStatus.FAILED,
        errorCode: 'SQL_EXECUTION_ERROR',
        errorMessage: this.errorText(err),
        generatedSql: validatedSql,
      });
      this.logger.warn(`Analytics SQL execution stage failed: ${this.errorText(err)}`);
      return this.degraded('I could not complete that query against the reporting data.');
    }
  }

  /**
   * WHY this mirrors EmployeesService.buildProfileAccessFilter rather than reading
   * the flat departmentId/teamId claims: that method is the authoritative scope
   * builder, and its precedence chain keys on roleAssignments[].scopeEntityId. A
   * manager assigned to a department they are not a member of would otherwise be
   * scoped to the wrong rows.
   *
   * Resolving the ordered chain here — instead of replicating it in view DDL —
   * keeps each view's predicate flat and reviewable.
   *
   * Returns null where HR Core throws ForbiddenException.
   */
  resolveScope(actor: AiActorContext): AnalyticsScopeBinding | null {
    const compensationVisible = hasCompensationAccess(actor.roles);
    const base = {
      actorEmployeeId: actor.employeeId,
      actorTeamId: actor.teamId,
      compensationVisible,
    };

    if (actor.roles.some((role) => PRIVILEGED_ROLES.includes(role))) {
      return { ...base, scope: 'GLOBAL', scopeEntityId: null };
    }

    if (actor.roles.some((role) => MANAGER_ROLES.includes(role))) {
      const departmentAssignment = this.findAssignment(actor.roleAssignments, PermissionScope.DEPARTMENT);
      if (departmentAssignment?.scopeEntityId) {
        return { ...base, scope: 'DEPARTMENT', scopeEntityId: departmentAssignment.scopeEntityId };
      }

      const teamAssignment = this.findAssignment(actor.roleAssignments, PermissionScope.TEAM);
      if (teamAssignment?.scopeEntityId) {
        return { ...base, scope: 'TEAM', scopeEntityId: teamAssignment.scopeEntityId };
      }

      if (actor.employeeId || actor.teamId) {
        return { ...base, scope: 'MANAGER_FALLBACK', scopeEntityId: null };
      }
    }

    if (actor.employeeId) {
      return { ...base, scope: 'OWN', scopeEntityId: null };
    }

    return null;
  }

  private findAssignment(
    assignments: readonly RoleAssignmentClaim[],
    scope: PermissionScope,
  ): RoleAssignmentClaim | undefined {
    return assignments.find(
      (assignment) => MANAGER_ROLES.includes(assignment.roleCode) && assignment.scope === scope,
    );
  }

  private render(rows: AnalyticsRow[], explanation: string, capped: boolean, rowLimit: number): string {
    const parts: string[] = [];
    if (explanation) parts.push(explanation);

    if (rows.length === 0) {
      // WHY explicit: an empty result rendered as a zero or a blank total reads as
      // a real measurement. "No rows matched" is a different claim from "the answer is 0".
      parts.push('No rows matched that query.');
      return parts.join('\n\n');
    }

    const columns = Object.keys(rows[0] ?? {});
    const rendered = rows.slice(0, MAX_RENDERED_ROWS);

    const table = [
      `| ${columns.join(' | ')} |`,
      `| ${columns.map(() => '---').join(' | ')} |`,
      ...rendered.map((row) => `| ${columns.map((column) => formatCell(row[column])).join(' | ')} |`),
    ].join('\n');

    parts.push(table);

    if (capped) {
      parts.push(
        `Showing the first ${rowLimit} rows — this is not the complete result. Narrow the question to see the rest.`,
      );
    } else if (rows.length > rendered.length) {
      parts.push(`Showing ${rendered.length} of ${rows.length} rows.`);
    }

    return parts.join('\n\n');
  }

  private refused(message: string): SpecialistResult {
    return {
      agentType: AgentType.ANALYTICS_AGENT,
      status: AgentRunStatus.REFUSED,
      summary: 'Analytics query refused.',
      userVisibleContent: message,
      sourceContext: [],
      permissionDecision: PermissionDecision.DENIED,
    };
  }

  private degraded(message: string): SpecialistResult {
    return {
      agentType: AgentType.ANALYTICS_AGENT,
      status: AgentRunStatus.DEGRADED,
      summary: 'Analytics query could not be completed.',
      userVisibleContent: message,
      sourceContext: [],
      permissionDecision: PermissionDecision.UNAVAILABLE,
    };
  }

  private errorText(err: unknown): string {
    return err instanceof Error ? err.message : 'unknown error';
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    if (DECIMAL_STRING.test(value)) return formatNumber(Number(value));
    return value.replace(/\|/g, '\\|');
  }
  return JSON.stringify(value);
}

/**
 * WHY: node-postgres returns NUMERIC (every AVG/SUM over numeric columns) as a
 * string carrying ~16 fractional digits. Beyond being unreadable, that digit run
 * trips redactSensitiveText's long-number rule in the final-answer policy, so an
 * average of 10.6666666666666667 reached the user as "10.[redacted-number]".
 * Only values with a fractional part are touched — integer strings (bigint COUNTs,
 * codes) keep their exact text.
 */
const DECIMAL_STRING = /^-?\d+\.\d+$/;

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}
