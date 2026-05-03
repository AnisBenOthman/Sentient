import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent, IEventBus } from '@sentient/shared';

/**
 * WHY: Phase 1 implementation of IEventBus. Events are logged to the
 * console and dispatched to in-process handlers synchronously.
 * Phase 2 swaps this for a KafkaEventBus without changing any caller.
 */
@Injectable()
export class InMemoryEventBus implements IEventBus {
  private readonly logger = new Logger(InMemoryEventBus.name);
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async emit<T>(event: DomainEvent<T>): Promise<void> {
    this.logger.log(
      `[EVENT] ${event.type} | source=${event.source} | id=${event.id} | payload=${JSON.stringify(event.payload)}`,
    );

    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map((h) => h(event as DomainEvent)));
  }

  subscribe<T>(eventType: string, handler: (event: DomainEvent<T>) => Promise<void>): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [
      ...existing,
      handler as (event: DomainEvent) => Promise<void>,
    ]);
  }
}
