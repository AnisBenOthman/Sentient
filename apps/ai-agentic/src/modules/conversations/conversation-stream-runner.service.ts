import { Injectable, Logger, MessageEvent, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { AgentNodeType, AgentRunStatus, AgentType, PermissionDecision } from '../../generated/prisma';
import { RoutingTrace } from '../../common/dto';
import { AgentGuardrailService } from '../../common/safety';
import { FinalAnswerResult } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import { AgentNodeRunService } from '../agents/agent-node-run.service';
import { AgentTaskLogService } from '../agents/agent-task-log.service';
import { pendingActionFrom, sourceCategories, sumTokens } from '../agents/agent-result.util';
import { FinalAnswerNodeService } from '../agents/nodes/final-answer-node.service';
import { SupervisorLangGraphRunnerService } from '../agents/supervisor-langgraph-runner.service';
import { ConversationsService, TURN_FAILURE_MESSAGE } from './conversations.service';
import { PendingTurnEntry, PendingTurnStore } from './pending-turn.store';

@Injectable()
export class ConversationStreamRunnerService implements OnModuleInit {
  private readonly logger = new Logger(ConversationStreamRunnerService.name);

  constructor(
    private readonly pendingTurns: PendingTurnStore,
    private readonly runner: SupervisorLangGraphRunnerService,
    private readonly finalAnswerNode: FinalAnswerNodeService,
    private readonly guardrails: AgentGuardrailService,
    private readonly taskLogs: AgentTaskLogService,
    private readonly nodeRuns: AgentNodeRunService,
    private readonly conversations: ConversationsService,
    private readonly config?: ConfigService,
  ) {}

  onModuleInit(): void {
    this.pendingTurns.onExpired((entry) => this.finalizeAbandonedTurn(entry));

    /**
     * WHY this is logged rather than left implicit: streaming now ships on by
     * default, and it carries a deployment constraint that is invisible until
     * it breaks — a turn is handed off in-process from the POST that resolved
     * its routing to the GET that streams it, so a second replica without
     * sticky sessions would fail every streamed turn.
     */
    const aiConfig = this.config?.get<AiAgenticConfig>('aiAgentic');
    if (aiConfig?.streamingEnabled) {
      this.logger.log(
        `Token streaming enabled for ${aiConfig.streamingAgentTypes.join(', ')}. ` +
          'Each turn must reach this same instance for both its POST and its stream GET: ' +
          'run one replica, use sticky sessions, or set AI_AGENT_STREAMING_ENABLED=false.',
      );
    }
  }

  /**
   * A streaming turn whose stream is never successfully claimed — the tab closed
   * between the POST and the GET, the connection dropped, or a claim was rejected
   * by the ownership/TTL guards (which consume the entry to close the replay
   * window). The user's message is already persisted, so leaving it there with no
   * reply and an AgentTaskLog stuck on RUNNING is the one outcome this path must
   * not produce: finalize it exactly like a synchronous turn that failed.
   */
  private async finalizeAbandonedTurn(entry: PendingTurnEntry): Promise<void> {
    this.logger.warn(`Finalizing abandoned streaming turn ${entry.turnId} for conversation ${entry.conversationId}.`);
    await this.recoverFromFailure(entry, { next: () => undefined }, new Error('Streaming turn was never claimed'));
  }

  run(conversationId: string, turnId: string, ownerUserId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const controller = new AbortController();
      let keepAlive: ReturnType<typeof setInterval> | undefined;

      void (async () => {
        const entry = this.pendingTurns.claim(turnId, conversationId, ownerUserId);
        if (!entry) {
          subscriber.next({ type: 'error', data: { turnId, message: 'This response is no longer available. Please send your message again.' } });
          subscriber.complete();
          return;
        }

        const keepAliveMs = this.config?.get<AiAgenticConfig>('aiAgentic')?.streamingKeepAliveMs ?? 15_000;
        keepAlive = setInterval(() => {
          subscriber.next({ type: 'keep-alive', data: { at: new Date().toISOString() } });
        }, keepAliveMs);

        try {
          await this.runTurn(entry, subscriber, controller.signal);
        } catch (error: unknown) {
          await this.recoverFromFailure(entry, subscriber, error);
        } finally {
          if (keepAlive) clearInterval(keepAlive);
          subscriber.complete();
        }
      })();

      return () => {
        if (keepAlive) clearInterval(keepAlive);
        controller.abort();
      };
    });
  }

  private async runTurn(
    entry: PendingTurnEntry,
    subscriber: { next: (event: MessageEvent) => void },
    signal: AbortSignal,
  ): Promise<void> {
    const specialistResult = await this.runner.executeSpecialistStreaming(
      entry.input,
      entry.gate.parentLog.id,
      entry.agentType,
      entry.normalizedIntent,
      entry.isDraftRequest,
      (delta) => subscriber.next({ type: 'token', data: { turnId: entry.turnId, delta } }),
      signal,
    );

    /**
     * WHY the exact same compose() call the LangGraph final-answer node makes:
     * FinalAnswerPolicyService.review() runs inside compose() unchanged, so a
     * streamed answer gets the identical safety/redaction/draft-labeling pass
     * as a non-streamed one. Tokens shown live are provisional; this reviewed
     * content is authoritative and is what the `done` event carries.
     */
    const finalAnswer = this.finalAnswerNode.compose({
      guardrailMessage: null,
      guardrailStatus: null,
      policyRefusalMessage: null,
      clarificationQuestion: null,
      specialistResults: [specialistResult],
      escalation: null,
      declinedTopics: [],
      isDraft: entry.isDraftRequest,
      hasTeamLeaveScope: this.guardrails.hasTeamLeaveScope(entry.actor.roles),
    });

    await this.nodeRuns.record({
      conversationId: entry.conversationId,
      taskLogId: entry.gate.parentLog.id,
      nodeType: AgentNodeType.SPECIALIST,
      agentType: specialistResult.agentType,
      status: specialistResult.status,
      sequence: entry.gate.sequence,
    });
    await this.nodeRuns.record({
      conversationId: entry.conversationId,
      taskLogId: entry.gate.parentLog.id,
      nodeType: AgentNodeType.FINAL_ANSWER,
      agentType: AgentType.SUPERVISOR_AGENT,
      status: finalAnswer.status,
      sequence: entry.gate.sequence + 1,
    });

    const turnTokens = sumTokens([specialistResult]);
    await this.taskLogs.finish(entry.gate.parentLog.id, {
      status: finalAnswer.status,
      outputSummary: finalAnswer.content,
      sourceCategories: sourceCategories([specialistResult]),
      permissionDecision:
        specialistResult.permissionDecision === PermissionDecision.DENIED ||
        specialistResult.permissionDecision === PermissionDecision.UNAVAILABLE
          ? PermissionDecision.PARTIAL
          : PermissionDecision.ALLOWED,
      tokensIn: turnTokens.tokensIn,
      tokensOut: turnTokens.tokensOut,
    });

    const routing: RoutingTrace = {
      status: finalAnswer.status,
      nodes: [
        ...entry.gate.routingNodes,
        {
          nodeType: AgentNodeType.SPECIALIST,
          agentType: specialistResult.agentType,
          status: specialistResult.status,
          summary: specialistResult.summary,
        },
        {
          nodeType: AgentNodeType.FINAL_ANSWER,
          agentType: AgentType.SUPERVISOR_AGENT,
          status: finalAnswer.status,
          summary: 'Final answer composed by the streaming turn runner.',
        },
      ],
    };

    const turn = await this.conversations.persistTurnOutcome(
      entry.conversation,
      entry.userMessage,
      finalAnswer,
      routing,
      pendingActionFrom([specialistResult]),
      entry.actor,
      false,
    );

    subscriber.next({
      type: 'done',
      data: { turnId: entry.turnId, conversation: turn.conversation, assistantMessage: turn.assistantMessage, routing: turn.routing },
    });
  }

  /**
   * WHY persistTurnOutcome again rather than a bare `error` event: the user's
   * message is already saved, so — exactly like a synchronous turn that throws —
   * the honest outcome is a normal FAILED assistant message, not a dead end. The
   * task log is explicitly finished as FAILED here (the synchronous path leaves
   * it RUNNING on a thrown error today) because a streaming failure is more
   * likely to happen mid-generation, and a stuck RUNNING row is a worse audit
   * gap to introduce than to leave alone.
   */
  private async recoverFromFailure(
    entry: PendingTurnEntry,
    subscriber: { next: (event: MessageEvent) => void },
    error: unknown,
  ): Promise<void> {
    this.logger.error(
      `Streaming turn failed for conversation ${entry.conversationId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      error instanceof Error ? error.stack : undefined,
    );
    const failedAnswer: FinalAnswerResult = {
      status: AgentRunStatus.FAILED,
      content: TURN_FAILURE_MESSAGE,
      sourceContext: [],
      routingSummary: '',
    };
    try {
      await this.taskLogs.finish(entry.gate.parentLog.id, {
        status: AgentRunStatus.FAILED,
        outputSummary: failedAnswer.content,
      });
      const turn = await this.conversations.persistTurnOutcome(
        entry.conversation,
        entry.userMessage,
        failedAnswer,
        { status: AgentRunStatus.FAILED, nodes: entry.gate.routingNodes },
        undefined,
        entry.actor,
        true,
      );
      subscriber.next({
        type: 'done',
        data: { turnId: entry.turnId, conversation: turn.conversation, assistantMessage: turn.assistantMessage, routing: turn.routing },
      });
    } catch (persistError: unknown) {
      this.logger.error(
        `Failed to persist the failure outcome for streaming turn ${entry.turnId}`,
        persistError instanceof Error ? persistError.stack : undefined,
      );
      subscriber.next({ type: 'error', data: { turnId: entry.turnId, message: TURN_FAILURE_MESSAGE } });
    }
  }
}
