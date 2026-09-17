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

  constructor(private readonly config?: ConfigService) {
    this.sweeper = setInterval(() => this.sweepExpired(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
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
    if (Date.now() - entry.createdAt > ttlMs) return null;
    if (entry.conversationId !== conversationId || entry.ownerUserId !== ownerUserId) return null;

    return entry;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  private sweepExpired(): void {
    const ttlMs = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingTurnTtlMs ?? 120_000;
    const now = Date.now();
    for (const [turnId, entry] of this.entries) {
      if (now - entry.createdAt > ttlMs) this.entries.delete(turnId);
    }
  }
}
