import { PermissionDecision } from '../../generated/prisma';

export interface DownstreamRequestContext {
  jwt: string;
  correlationId: string;
}

export interface DownstreamResult<TData> {
  data: TData | null;
  permissionDecision: PermissionDecision;
  degradedReason: string | null;
  sourceType: string;
  sourceTitle: string;
}

export interface DownstreamSummary {
  id?: string;
  title?: string;
  status?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The result of a mutating downstream call (spec 017 FR-007). WHY a distinct
 * type from DownstreamResult<TData>: that type's ALLOWED/DENIED/UNAVAILABLE
 * vocabulary describes a READ's permission outcome, not a WRITE's execution
 * outcome — it has no field for an HTTP status code or a specific downstream
 * reason, both of which FR-010 requires be surfaced verbatim.
 *
 * httpStatus is `null` specifically for timeout and network failure (no
 * response was ever received) — distinct from a `number` status the
 * downstream service actually returned, matching FR-007's three named
 * failure categories.
 */
export type ActionExecutionOutcome<TData> =
  | { status: 'SUCCESS'; httpStatus: number; data: TData }
  | { status: 'FAILED'; httpStatus: number | null; reason: string };
