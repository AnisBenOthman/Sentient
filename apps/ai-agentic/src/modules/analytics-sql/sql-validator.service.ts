import { Injectable } from '@nestjs/common';
import { ANALYTICS_SCHEMA, allowedRelations } from './analytics-schema-context';

export type SqlValidationResult =
  | { ok: true; sql: string }
  | { ok: false; reason: string };

/**
 * Statement types that must never appear. Checked against the scrubbed text
 * (comments and string literals removed) so a keyword cannot be smuggled inside
 * a literal or a comment.
 */
// NOTE: `replace` is deliberately absent — `create` already blocks
// `CREATE OR REPLACE`, and listing it would reject the legitimate REPLACE() string
// function. `set` is safe next to OFFSET: there is no word boundary inside "offset".
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|merge|call|do|execute|prepare|vacuum|analyse|analyze|explain|listen|notify|lock|reindex|refresh|reset|discard|begin|commit|rollback|savepoint|set|into|returning)\b/i;

/**
 * Functions and catalogs that would let generated SQL inspect the database or
 * rewrite its own row scope.
 *
 * set_config / current_setting are the critical pair: the entire scoping model
 * rests on session variables the service sets, so generated SQL must never be
 * able to read or overwrite them.
 */
const FORBIDDEN_IDENTIFIERS =
  /\b(pg_catalog|information_schema|pg_[a-z_]+|current_setting|set_config|dblink|current_user|session_user|current_database|version|has_table_privilege|to_regclass|query_to_xml)\b/i;

/** Matches a schema-qualified or bare identifier, or an opening parenthesis. */
const RELATION_TOKEN = /^(?:\(|[a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)*)/i;

/** Keywords that may follow a relation and must not be mistaken for an alias. */
const NON_ALIAS_KEYWORDS = new Set([
  'on', 'using', 'where', 'group', 'order', 'having', 'limit', 'offset', 'join',
  'inner', 'left', 'right', 'full', 'cross', 'lateral', 'union', 'intersect',
  'except', 'window', 'fetch', 'for',
]);

@Injectable()
export class SqlValidatorService {
  /**
   * WHY fail-closed token matching instead of a SQL parser: "every referenced
   * relation is allowlisted" is not expressible as a naive regex — aliases, CTE
   * names shadowing view names, comments, and view names inside string literals
   * all defeat it. Rather than take on a parser dependency, this inverts the
   * burden of proof: an identifier the validator cannot positively account for is
   * a rejection. False rejections are the correct failure direction — the user
   * gets a refusal, never unscoped data.
   */
  validate(rawSql: string, roles: readonly string[], rowLimit: number): SqlValidationResult {
    const sql = rawSql.trim().replace(/;\s*$/, '').trim();
    if (sql.length === 0) return { ok: false, reason: 'Empty statement' };

    const scrubbed = scrub(sql);

    if (scrubbed.includes(';')) {
      return { ok: false, reason: 'Multiple statements are not allowed' };
    }
    if (!/^\s*(select|with)\b/i.test(scrubbed)) {
      return { ok: false, reason: 'Only SELECT and WITH statements are allowed' };
    }

    const forbiddenKeyword = FORBIDDEN_KEYWORDS.exec(scrubbed);
    if (forbiddenKeyword) {
      return { ok: false, reason: `Disallowed keyword: ${forbiddenKeyword[0].toUpperCase()}` };
    }

    const forbiddenIdentifier = FORBIDDEN_IDENTIFIERS.exec(scrubbed);
    if (forbiddenIdentifier) {
      return { ok: false, reason: `Disallowed identifier: ${forbiddenIdentifier[0]}` };
    }

    const relationError = this.checkRelations(scrubbed, roles);
    if (relationError !== null) return { ok: false, reason: relationError };

    // WHY wrap instead of appending LIMIT: appending breaks on trailing comments,
    // UNION, an existing OFFSET, or a statement ending in ')'. Wrapping is one
    // mechanism with no parsing, and an inner LIMIT cannot exceed the outer one.
    // rowLimit + 1 is requested so the caller can tell "capped" from "returned
    // exactly rowLimit rows" and report PARTIAL honestly.
    return { ok: true, sql: `SELECT * FROM (\n${sql}\n) AS _q LIMIT ${rowLimit + 1}` };
  }

  /** Returns null when every referenced relation is accounted for, else the rejection reason. */
  private checkRelations(scrubbed: string, roles: readonly string[]): string | null {
    const allowed = allowedRelations(roles);
    const cteNames = collectCteNames(scrubbed);

    const sourceKeyword = /\b(?:from|join)\b\s+/gi;
    let match: RegExpExecArray | null;
    let sawRelation = false;

    while ((match = sourceKeyword.exec(scrubbed)) !== null) {
      const rest = scrubbed.slice(match.index + match[0].length);
      const tokenMatch = RELATION_TOKEN.exec(rest);
      if (!tokenMatch) {
        return 'Could not identify the table being queried';
      }

      const token = tokenMatch[0];
      // A subquery or LATERAL block: its own FROM/JOIN is checked by a later iteration.
      if (token === '(') continue;

      sawRelation = true;
      const normalized = token.toLowerCase();
      if (!allowed.has(normalized) && !cteNames.has(normalized)) {
        return `Relation not permitted: ${token}. Only ${ANALYTICS_SCHEMA} views are readable.`;
      }

      // Old-style comma joins bypass the FROM/JOIN scan entirely, so reject them
      // rather than attempt to parse a comma-separated relation list.
      const afterRelation = rest.slice(token.length);
      if (startsWithCommaAfterAlias(afterRelation)) {
        return 'Comma joins are not allowed — use explicit JOIN syntax';
      }
    }

    if (!sawRelation) {
      return 'Query does not read any permitted view';
    }
    return null;
  }
}

/**
 * Removes line comments, block comments, and single-quoted string literals.
 * Runs before every other check so a forbidden keyword or view name cannot be
 * hidden inside a literal or a comment.
 */
function scrub(sql: string): string {
  let result = '';
  let index = 0;

  while (index < sql.length) {
    const two = sql.slice(index, index + 2);

    if (two === '--') {
      const newline = sql.indexOf('\n', index);
      index = newline === -1 ? sql.length : newline;
      result += ' ';
      continue;
    }

    if (two === '/*') {
      const close = sql.indexOf('*/', index + 2);
      index = close === -1 ? sql.length : close + 2;
      result += ' ';
      continue;
    }

    if (sql[index] === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'") {
          // '' is an escaped quote inside the literal, not a terminator.
          if (sql[index + 1] === "'") {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      result += " '' ";
      continue;
    }

    result += sql[index];
    index += 1;
  }

  return result;
}

/** Names introduced by a WITH clause, which may legitimately be referenced by FROM/JOIN. */
function collectCteNames(scrubbed: string): Set<string> {
  const names = new Set<string>();
  if (!/\bwith\b/i.test(scrubbed)) return names;

  // Anchored on `WITH [RECURSIVE]` for the first CTE and on `,` for each
  // subsequent one — a bare `^` anchor misses the first, since it sits after WITH.
  const pattern =
    /(?:\bwith\b\s+(?:recursive\s+)?|,)\s*([a-z_][a-z0-9_$]*)\s*(?:\([^)]*\)\s*)?as\s+(?:materialized\s+|not\s+materialized\s+)?\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(scrubbed)) !== null) {
    const name = match[1];
    if (name) names.add(name.toLowerCase());
  }
  return names;
}

/**
 * True when the text following a relation (and its optional alias) begins with a
 * comma — the signature of an old-style comma join.
 */
function startsWithCommaAfterAlias(text: string): boolean {
  let rest = text.replace(/^\s+/, '');
  if (rest.startsWith(',')) return true;

  const asMatch = /^as\s+/i.exec(rest);
  if (asMatch) rest = rest.slice(asMatch[0].length);

  const aliasMatch = /^[a-z_][a-z0-9_$]*/i.exec(rest);
  if (aliasMatch && !NON_ALIAS_KEYWORDS.has(aliasMatch[0].toLowerCase())) {
    rest = rest.slice(aliasMatch[0].length).replace(/^\s+/, '');
  }

  return rest.startsWith(',');
}
