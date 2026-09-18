import { PendingTurnEntry, PendingTurnStore } from './pending-turn.store';

function buildEntry(overrides: Partial<PendingTurnEntry> = {}): PendingTurnEntry {
  return {
    turnId: 'turn-1',
    conversationId: 'conversation-1',
    ownerUserId: 'user-1',
    actor: {} as never,
    gate: {} as never,
    agentType: 'LEAVE_AGENT' as never,
    normalizedIntent: 'leave question',
    isDraftRequest: false,
    input: {} as never,
    conversation: {} as never,
    userMessage: {} as never,
    createdAt: Date.now(),
    ...overrides,
  };
}

function buildStore(streamingTurnTtlMs = 120_000): PendingTurnStore {
  const config = { get: () => ({ streamingTurnTtlMs }) } as never;
  return new PendingTurnStore(config);
}

describe('PendingTurnStore', () => {
  let store: PendingTurnStore;

  afterEach(() => {
    store.onModuleDestroy();
    jest.useRealTimers();
  });

  it('claims a freshly-put entry once', () => {
    store = buildStore();
    store.put(buildEntry());

    const claimed = store.claim('turn-1', 'conversation-1', 'user-1');

    expect(claimed?.turnId).toBe('turn-1');
  });

  it('never allows a second claim of the same turnId (single-use, no replay)', () => {
    store = buildStore();
    store.put(buildEntry());

    store.claim('turn-1', 'conversation-1', 'user-1');
    const secondClaim = store.claim('turn-1', 'conversation-1', 'user-1');

    expect(secondClaim).toBeNull();
  });

  it('deletes the entry on a failed claim too, so a wrong-owner guess cannot be retried', () => {
    store = buildStore();
    store.put(buildEntry());

    const wrongOwner = store.claim('turn-1', 'conversation-1', 'someone-else');
    const retryWithCorrectOwner = store.claim('turn-1', 'conversation-1', 'user-1');

    expect(wrongOwner).toBeNull();
    expect(retryWithCorrectOwner).toBeNull();
  });

  it('rejects a claim for the wrong conversationId', () => {
    store = buildStore();
    store.put(buildEntry());

    expect(store.claim('turn-1', 'conversation-2', 'user-1')).toBeNull();
  });

  it('rejects a claim once the TTL has elapsed', () => {
    jest.useFakeTimers();
    store = buildStore(1_000);
    store.put(buildEntry({ createdAt: Date.now() }));

    jest.advanceTimersByTime(1_001);

    expect(store.claim('turn-1', 'conversation-1', 'user-1')).toBeNull();
  });

  it('returns null for a turnId that was never put', () => {
    store = buildStore();
    expect(store.claim('never-put', 'conversation-1', 'user-1')).toBeNull();
  });

  describe('abandoned turns', () => {
    /**
     * WHY these matter: the POST already persisted the user's message and opened
     * the parent AgentTaskLog before handing back a turnId. Every path that drops
     * a pending entry without giving it to a streamer must notify the handler, or
     * that message is stranded with no reply and its audit log stays RUNNING.
     */
    it('notifies the handler when the sweeper drops an entry that was never claimed', () => {
      jest.useFakeTimers();
      store = buildStore(1_000);
      const onExpired = jest.fn().mockResolvedValue(undefined);
      store.onExpired(onExpired);
      const entry = buildEntry({ createdAt: Date.now() });
      store.put(entry);

      jest.advanceTimersByTime(30_001);

      expect(onExpired).toHaveBeenCalledTimes(1);
      expect(onExpired).toHaveBeenCalledWith(entry);
    });

    it('notifies the handler when a claim is rejected for the wrong owner', () => {
      store = buildStore();
      const onExpired = jest.fn().mockResolvedValue(undefined);
      store.onExpired(onExpired);
      const entry = buildEntry();
      store.put(entry);

      expect(store.claim('turn-1', 'conversation-1', 'someone-else')).toBeNull();
      expect(onExpired).toHaveBeenCalledWith(entry);
    });

    it('notifies the handler when a claim arrives after the TTL elapsed', () => {
      jest.useFakeTimers();
      store = buildStore(1_000);
      const onExpired = jest.fn().mockResolvedValue(undefined);
      store.onExpired(onExpired);
      const entry = buildEntry({ createdAt: Date.now() });
      store.put(entry);

      jest.advanceTimersByTime(1_001);

      expect(store.claim('turn-1', 'conversation-1', 'user-1')).toBeNull();
      expect(onExpired).toHaveBeenCalledWith(entry);
    });

    it('does not notify the handler on a successful claim — the streamer owns that turn', () => {
      store = buildStore();
      const onExpired = jest.fn().mockResolvedValue(undefined);
      store.onExpired(onExpired);
      store.put(buildEntry());

      expect(store.claim('turn-1', 'conversation-1', 'user-1')).not.toBeNull();
      expect(onExpired).not.toHaveBeenCalled();
    });
  });
});
