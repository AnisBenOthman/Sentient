import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentType, Conversation, Message } from '../../generated/prisma';
import { AiAgenticConfig } from '../../config';
import { AiActorContext } from '../../common/graph';
import { SupervisorGateResult } from '../agents/supervisor-gate.service';
import { ExecuteConversationTurnInput } from '../agents/supervisor-agent.service';

export interface PendingTurnEntry {
  turnId: string;
  conversationId: string;
  ownerUserId: string;
  actor: AiActorContext;
  gate: SupervisorGateResult;
  agentType: AgentType;
  normalizedIntent: string;
  isDraftRequest: boolean;
  input: ExecuteConversationTurnInput;
  conversation: Conversation;
  userMessage: Message;
  createdAt: number;
}

const SWEEP_INTERVAL_MS = 30_000;

/**
 * Notified with an entry the sweeper dropped because it was never claimed.
 * WHY a callback rather than the store persisting anything itself: the store
 * stays a dependency-free map; the runner owns what an abandoned turn means.
 */
export type PendingTurnExpiryHandler = (entry: PendingTurnEntry) => Promise<void>;

/**
 * WHY in-memory rather than DB-backed: a pending turn is short-lived (claimed
 * within seconds, TTL-bounded at a couple of minutes at most) and exists purely
 * to hand off from the POST that resolved routing to the GET that streams the
 * answer. This is explicitly single-instance-scoped — a horizontally-scaled
 * deployment (the Phase 2 Kafka era) would need this backed by Redis or the
 * database instead, keyed the same way.
 */
@Injectable()
export class PendingTurnStore implements OnModuleDestroy {
  private readonly entries = new Map<string, PendingTurnEntry>();
  private readonly sweeper: ReturnType<typeof setInterval>;
  private expiryHandler: PendingTurnExpiryHandler | null = null;

  constructor(private readonly config?: ConfigService) {
    this.sweeper = setInterval(() => this.sweepExpired(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  /** Registered by ConversationStreamRunnerService so an abandoned turn still gets an honest outcome. */
  onExpired(handler: PendingTurnExpiryHandler): void {
    this.expiryHandler = handler;
  }

  put(entry: PendingTurnEntry): void {
    this.entries.set(entry.turnId, entry);
  }

  /**
   * Single-use claim: deletes the entry on the first call regardless of outcome,
   * so a second request against the same turnId — a retry, a replay, a stale tab —
   * always gets a clean "not found" rather than a second execution. Every
   * mismatch (unknown id, expired, wrong conversation, wrong owner) returns the
   * same null so the caller never leaks which check failed.
   */
  claim(turnId: string, conversationId: string, ownerUserId: string): PendingTurnEntry | null {
    const entry = this.entries.get(turnId);
    if (!entry) return null;
    this.entries.delete(turnId);

    const ttlMs = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingTurnTtlMs ?? 120_000;
    const expired = Date.now() - entry.createdAt > ttlMs;
    const mismatched = entry.conversationId !== conversationId || entry.ownerUserId !== ownerUserId;
    if (expired || mismatched) {
      /**
       * The entry is consumed either way (that is what closes the replay
       * window), so the rightful owner can never claim it now — the turn is
       * abandoned and must still be finalized rather than left dangling.
       */
      void this.expiryHandler?.(entry);
      return null;
    }

    return entry;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  /**
   * WHY the handler and not a silent delete: the POST already persisted the
   * user's message, so a turn whose stream is never claimed (tab closed between
   * the POST and the GET, a claim rejected by the ownership/TTL guards, a
   * dropped connection) would otherwise strand that message with no reply and
   * leave its AgentTaskLog RUNNING forever. Dropping the entry is not the same
   * as finishing the turn.
   */
  private sweepExpired(): void {
    const ttlMs = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingTurnTtlMs ?? 120_000;
    const now = Date.now();
    for (const [turnId, entry] of this.entries) {
      if (now - entry.createdAt <= ttlMs) continue;
      this.entries.delete(turnId);
      void this.expiryHandler?.(entry);
    }
  }
}
