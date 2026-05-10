import { DomainEvent } from './domain-event.interface';

export interface IEventBus {
  /**
   * Emit a domain event. In Phase 1 this is a synchronous REST call;
   * in Phase 2 the same call publishes to a Kafka topic.
   * WHY: Business logic never calls REST directly — it calls emit().
   * Swapping the transport requires only changing the implementation,
   * not the callers.
   */
  emit<T>(event: DomainEvent<T>): Promise<void>;

  /**
   * Subscribe to a domain event type. In Phase 1 this registers an
   * in-process handler; in Phase 2 it creates a Kafka consumer.
   */
  subscribe<T>(
    eventType: string,
    handler: (event: DomainEvent<T>) => Promise<void>,
  ): void;
}

export const EVENT_BUS = Symbol('IEventBus');
