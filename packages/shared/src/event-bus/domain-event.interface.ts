export interface DomainEvent<T = Record<string, unknown>> {
  /** Unique event ID — used for idempotency in Phase 2 Kafka transport. */
  id: string;
  /** Dot-notation event type, e.g. 'leave.requested', 'employee.terminated'. */
  type: string;
  /** Originating service name, e.g. 'HR_CORE', 'SOCIAL'. */
  source: string;
  timestamp: Date;
  payload: T;
  metadata: {
    /** The userId from the JWT at the time the event was emitted. */
    userId: string | null;
    /**
     * WHY: Propagated across all events in a request chain so that
     * AgentTaskLog entries and inter-service calls can be correlated
     * end-to-end in logs and the AI Governance Center.
     */
    correlationId: string;
  };
}
