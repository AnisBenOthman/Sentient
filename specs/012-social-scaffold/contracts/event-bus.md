# Contract — EventBus (Social)

The Social-local mirror of HR Core's EventBus wiring, satisfying CLAUDE.md §3.4. Social emits / subscribes via the shared `EVENT_BUS` symbol provided by `@sentient/shared`. The implementation IS local.

---

## 1. Module location

```text
apps/social/src/common/event-bus/
├── event-bus.module.ts        # @Global() module binding EVENT_BUS → InMemoryEventBus
└── in-memory-event-bus.ts     # Phase 1 implementation (mirror of HR Core's)
```

`AppModule.imports` MUST include `EventBusModule`.

## 2. Token

The provider token MUST be the `EVENT_BUS` symbol exported from `@sentient/shared/event-bus`:

```ts
import { EVENT_BUS, IEventBus } from '@sentient/shared';
```

Consumers inject via:

```ts
constructor(@Inject(EVENT_BUS) private readonly eventBus: IEventBus) {}
```

No Social-local re-declaration of the symbol is permitted.

## 3. Implementation: `InMemoryEventBus`

Behaviorally identical to `apps/hr-core/src/common/event-bus/in-memory-event-bus.ts`:

```ts
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
```

`@Module` shape:

```ts
@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: InMemoryEventBus }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
```

## 4. `DomainEvent` field expectations for Social emitters

Every event emitted by Social MUST conform to:

| Field | Required | Value rule |
|---|---|---|
| `id` | yes | `crypto.randomUUID()` |
| `type` | yes | One of the strings in CLAUDE.md §3.4 Social-emits column, e.g. `'announcement.published'`. |
| `source` | yes | The literal `'social'`. |
| `timestamp` | yes | `new Date()`. |
| `payload` | yes | Strongly-typed, documented per event in the future feature spec. |
| `metadata.userId` | yes when there is an actor | `request.user.sub` extracted from JWT claims. |
| `metadata.correlationId` | yes | Propagated from `request.headers['x-correlation-id']` (set by `CorrelationIdMiddleware`). |

The scaffold itself emits NO events; this table is the standing contract feature modules must follow.

## 5. Smoke test

`apps/social/src/common/__smoke__/event-bus.spec.ts` MUST contain at least:

```ts
it('AppModule provides EVENT_BUS and accepts a scaffold.ping emit', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const bus = moduleRef.get<IEventBus>(EVENT_BUS);
  await expect(
    bus.emit({
      id: 'test-uuid',
      type: 'scaffold.ping',
      source: 'social',
      timestamp: new Date(),
      payload: { ok: true },
      metadata: { correlationId: 'test-corr' },
    }),
  ).resolves.toBeUndefined();
});
```

## 6. What the scaffold does NOT do

- It MUST NOT emit any real Social domain events (`announcement.published`, `event.created`, etc.). Those are owned by their respective future feature modules.
- It MUST NOT register subscribers for HR Core / AI Agentic events. Those subscriptions are also added by feature modules at their point of need.
- It MUST NOT introduce a transport switch (Kafka, NATS, etc.). The Phase 2 migration changes the `useClass` of the `EVENT_BUS` provider without touching callers.
