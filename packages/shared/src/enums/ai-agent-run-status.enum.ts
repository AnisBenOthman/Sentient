export enum AiAgentRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DEGRADED = 'DEGRADED',
  PARTIAL = 'PARTIAL',
  ESCALATED = 'ESCALATED',
  REFUSED = 'REFUSED',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
  /** A mutating action was proposed and awaits the user's explicit confirm/cancel tap. */
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  /** The downstream write apparently succeeded but the independent read-back did not confirm it. */
  UNVERIFIED = 'UNVERIFIED',
}
