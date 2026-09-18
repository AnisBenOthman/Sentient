import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { RbacGuard, SharedJwtGuard } from '@sentient/shared';
import {
  AgentNodeType,
  AgentRunStatus,
  AgentType,
  PermissionDecision,
} from '../../src/generated/prisma';
import { ActorContextFactory } from '../../src/common/graph';
import { AgentGuardrailService, FinalAnswerPolicyService } from '../../src/common/safety';
import { AgentNodeRunService } from '../../src/modules/agents/agent-node-run.service';
import { AgentTaskLogService } from '../../src/modules/agents/agent-task-log.service';
import { FinalAnswerNodeService } from '../../src/modules/agents/nodes/final-answer-node.service';
import { SupervisorLangGraphRunnerService } from '../../src/modules/agents/supervisor-langgraph-runner.service';
import { ConversationStreamController } from '../../src/modules/conversations/conversation-stream.controller';
import { ConversationStreamRunnerService } from '../../src/modules/conversations/conversation-stream-runner.service';
import { ConversationsService } from '../../src/modules/conversations/conversations.service';
import { PendingTurnEntry, PendingTurnStore } from '../../src/modules/conversations/pending-turn.store';

/**
 * WHY this suite exists: every other streaming test calls a service method
 * directly, so the one thing none of them prove is the part the browser
 * actually consumes — the SSE wire format over a real HTTP socket, and the
 * fact that frames are flushed as they are produced rather than buffered
 * until the handler finishes. A regression there (a stray Content-Length, a
 * global interceptor collecting the Observable, a header the gateway strips)
 * breaks the feature completely while every unit test stays green.
 *
 * The transport, the controller, the stream runner, the pending-turn store,
 * the guards and the whole final-answer policy pass are REAL here. Only the
 * two edges are stubbed: the specialist LLM call (so tokens are scripted and
 * timing is controllable) and the database tail.
 */

const JWT_SECRET = 'streaming-integration-secret';
const KEEP_ALIVE_MS = 60;

interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

/** The scripted specialist: resolves its tokens through the test's control handles. */
interface SpecialistScript {
  deltas: string[];
  /** Awaited after the first delta, so a test can prove the first frame arrived before the rest were produced. */
  holdAfterFirstDelta?: Promise<void>;
  /** Awaited before any delta, to simulate a slow tool round that only keep-alives cover. */
  holdBeforeFirstDelta?: Promise<void>;
  status?: AgentRunStatus;
}

describe('GET /conversations/:id/turns/:turnId/stream (SSE over HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let pendingTurns: PendingTurnStore;
  let script: SpecialistScript;
  const persistTurnOutcome = jest.fn();
  const taskLogFinish = jest.fn();

  function mintJwt(userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        employeeId: `employee-${userId}`,
        roles: ['EMPLOYEE'],
        departmentId: 'dept-1',
        teamId: 'team-1',
        businessUnitId: 'bu-1',
        roleAssignments: [],
        channel: 'WEB',
      },
      JWT_SECRET,
      { expiresIn: '5m' },
    );
  }

  /**
   * Builds a claimable pending turn. The POST half that normally mints these is
   * covered by its own specs; seeding the store directly is what isolates this
   * suite to the streaming half.
   */
  function seedTurn(overrides: Partial<PendingTurnEntry> = {}): PendingTurnEntry {
    const turnId = overrides.turnId ?? `turn-${Math.random().toString(16).slice(2)}`;
    const entry = {
      turnId,
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      actor: { userId: 'user-1', roles: ['EMPLOYEE'] },
      gate: {
        parentLog: { id: 'parent-log-1' },
        sequence: 1,
        routingNodes: [
          {
            nodeType: AgentNodeType.SUPERVISOR,
            agentType: AgentType.SUPERVISOR_AGENT,
            status: AgentRunStatus.SUCCESS,
            summary: 'gate resolved',
          },
        ],
      },
      agentType: AgentType.GENERAL_HELP_AGENT,
      normalizedIntent: 'general question',
      isDraftRequest: false,
      input: { message: 'hello' },
      conversation: { id: 'conversation-1' },
      userMessage: { id: 'message-1' },
      createdAt: Date.now(),
      ...overrides,
      // Partial fixtures for types whose full shape this suite never reads.
    } as never as PendingTurnEntry;
    pendingTurns.put(entry);
    return entry;
  }

  function streamUrl(entry: PendingTurnEntry, conversationId = entry.conversationId): string {
    return `${baseUrl}/conversations/${conversationId}/turns/${entry.turnId}/stream`;
  }

  /** Opens the stream and yields parsed frames one at a time, as they arrive off the socket. */
  async function* openStream(url: string, token?: string): AsyncGenerator<SseFrame, void, void> {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
    /**
     * A Content-Length on an open-ended stream makes the API gateway (a raw
     * pipe that forwards this header verbatim) truncate or hang the response.
     */
    expect(response.headers.get('content-length')).toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          let event = '';
          const dataLines: string[] = [];
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          // A frame without a data line is not something this endpoint emits.
          expect(dataLines.length).toBeGreaterThan(0);
          yield { event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      // Abandoning the generator must close the socket, or a failing assertion
      // leaves an open handle and the suite hangs instead of reporting.
      await reader.cancel().catch(() => undefined);
    }
  }

  /**
   * Reads one frame with a deadline. Without this, a buffering regression would
   * deadlock the suite (the server waits for the specialist, the specialist
   * waits for the test, the test waits for a frame) and CI would time out with
   * no diagnosis instead of a named failure.
   */
  async function nextFrameWithin(
    stream: AsyncGenerator<SseFrame, void, void>,
    timeoutMs: number,
    failureMessage: string,
  ): Promise<SseFrame> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(failureMessage)), timeoutMs);
    });
    try {
      const result = await Promise.race([stream.next(), deadline]);
      if (result.done) throw new Error('Stream closed before any frame arrived');
      return result.value;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function collectStream(url: string, token?: string): Promise<SseFrame[]> {
    const frames: SseFrame[] = [];
    for await (const frame of openStream(url, token)) frames.push(frame);
    return frames;
  }

  async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  beforeAll(async () => {
    const supervisorRunner = {
      executeSpecialistStreaming: async (
        _input: unknown,
        _parentLogId: string,
        agentType: AgentType,
        _intent: string,
        _isDraft: boolean,
        onToken: (delta: string) => void,
      ) => {
        if (script.holdBeforeFirstDelta) await script.holdBeforeFirstDelta;
        for (const [index, delta] of script.deltas.entries()) {
          onToken(delta);
          if (index === 0 && script.holdAfterFirstDelta) await script.holdAfterFirstDelta;
        }
        return {
          agentType,
          status: script.status ?? AgentRunStatus.SUCCESS,
          summary: 'scripted specialist',
          userVisibleContent: script.deltas.join(''),
          sourceContext: [],
          permissionDecision: PermissionDecision.ALLOWED,
        };
      },
    };

    const config = {
      get: (key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        if (key === 'aiAgentic') return { streamingKeepAliveMs: KEEP_ALIVE_MS, streamingTurnTtlMs: 120_000 };
        return undefined;
      },
      getOrThrow: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : 'unused'),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ConversationStreamController],
      providers: [
        ConversationStreamRunnerService,
        PendingTurnStore,
        FinalAnswerNodeService,
        FinalAnswerPolicyService,
        AgentGuardrailService,
        ActorContextFactory,
        { provide: SupervisorLangGraphRunnerService, useValue: supervisorRunner },
        { provide: AgentTaskLogService, useValue: { finish: taskLogFinish } },
        { provide: AgentNodeRunService, useValue: { record: jest.fn() } },
        { provide: ConversationsService, useValue: { persistTurnOutcome } },
        { provide: ConfigService, useValue: config },
        // The real global guards, so auth on this route is genuinely exercised.
        { provide: APP_GUARD, useClass: SharedJwtGuard },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    pendingTurns = moduleRef.get(PendingTurnStore);
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    persistTurnOutcome.mockReset();
    taskLogFinish.mockReset();
    // Echo the composed answer back the way the real persistence tail does.
    persistTurnOutcome.mockImplementation((_conversation, _userMessage, finalAnswer) => ({
      conversation: { id: 'conversation-1', title: 'Streamed turn' },
      userMessage: { id: 'message-1', role: 'USER', content: 'hello' },
      assistantMessage: {
        id: 'assistant-1',
        role: 'ASSISTANT',
        content: (finalAnswer as { content: string }).content,
        status: (finalAnswer as { status: AgentRunStatus }).status,
      },
      routing: { status: (finalAnswer as { status: AgentRunStatus }).status, nodes: [] },
    }));
    script = { deltas: ['Your ', 'leave ', 'balance ', 'is ', '12 days.'] };
  });

  it('emits token frames in order and terminates with a single done frame', async () => {
    const entry = seedTurn();

    const frames = await collectStream(streamUrl(entry), mintJwt('user-1'));

    const tokens = frames.filter((frame) => frame.event === 'token');
    const done = frames.filter((frame) => frame.event === 'done');
    expect(tokens.map((frame) => frame.data.delta)).toEqual(script.deltas);
    expect(done).toHaveLength(1);
    expect(frames[frames.length - 1]!.event).toBe('done');
    expect(tokens.every((frame) => frame.data.turnId === entry.turnId)).toBe(true);
  });

  /**
   * The regression this whole suite is really for. The specialist blocks after
   * its first delta until the test has already read that delta off the socket,
   * so if anything ever buffers the response until the handler completes, this
   * deadlocks and fails instead of silently degrading to a non-streaming feature.
   */
  it('flushes each token as it is produced rather than buffering the response', async () => {
    let releaseSpecialist: () => void = () => undefined;
    script = {
      deltas: ['first ', 'second ', 'third'],
      holdAfterFirstDelta: new Promise<void>((resolve) => {
        releaseSpecialist = resolve;
      }),
    };
    const entry = seedTurn();

    const stream = openStream(streamUrl(entry), mintJwt('user-1'));
    let firstFrame: SseFrame;
    try {
      firstFrame = await nextFrameWithin(
        stream,
        1_500,
        'No frame arrived while the specialist was still producing: the SSE response is being buffered instead of flushed per token.',
      );
    } finally {
      // Always unblock the handler, so a failure closes the socket rather than
      // leaving the server mid-turn.
      releaseSpecialist();
    }

    expect(firstFrame).toMatchObject({ event: 'token', data: { delta: 'first ' } });

    const rest: SseFrame[] = [];
    for await (const frame of stream) rest.push(frame);
    expect(rest.map((frame) => frame.event)).toEqual(['token', 'token', 'done']);
  });

  it('keeps the connection alive while the specialist produces nothing', async () => {
    let releaseSpecialist: () => void = () => undefined;
    script = {
      deltas: ['done at last'],
      holdBeforeFirstDelta: new Promise<void>((resolve) => {
        releaseSpecialist = resolve;
      }),
    };
    const entry = seedTurn();

    const stream = openStream(streamUrl(entry), mintJwt('user-1'));
    const frames: SseFrame[] = [];
    for await (const frame of stream) {
      frames.push(frame);
      // Two keep-alives prove the timer is running, not that one frame slipped out.
      if (frames.filter((candidate) => candidate.event === 'keep-alive').length >= 2) {
        releaseSpecialist();
      }
      if (frame.event === 'done') break;
    }

    expect(frames.filter((frame) => frame.event === 'keep-alive').length).toBeGreaterThanOrEqual(2);
    expect(frames[frames.length - 1]!.event).toBe('done');
  });

  /**
   * The safety contract behind "stream live, silently correct": streamed tokens
   * are provisional, and the done frame carries whatever FinalAnswerPolicyService
   * decided. A draft turn is the deterministic case — the policy pass prepends a
   * draft label the specialist never produced.
   */
  it('carries the policy-reviewed answer in done, even when it differs from the streamed tokens', async () => {
    const entry = seedTurn({ isDraftRequest: true });

    const frames = await collectStream(streamUrl(entry), mintJwt('user-1'));

    const streamed = frames
      .filter((frame) => frame.event === 'token')
      .map((frame) => frame.data.delta as string)
      .join('');
    const done = frames.find((frame) => frame.event === 'done')!;
    const authoritative = (done.data.assistantMessage as { content: string }).content;

    expect(streamed).toBe(script.deltas.join(''));
    expect(authoritative).not.toBe(streamed);
    expect(authoritative).toMatch(/^Draft - please review before use\./);
    expect(authoritative).toContain(streamed);
  });

  it('refuses an unknown turnId with an error frame and no tokens', async () => {
    const frames = await collectStream(
      `${baseUrl}/conversations/conversation-1/turns/00000000-0000-0000-0000-000000000000/stream`,
      mintJwt('user-1'),
    );

    expect(frames.filter((frame) => frame.event === 'token')).toHaveLength(0);
    expect(frames.map((frame) => frame.event)).toEqual(['error']);
  });

  it('refuses a replayed claim of an already-streamed turn', async () => {
    const entry = seedTurn();
    const token = mintJwt('user-1');

    const first = await collectStream(streamUrl(entry), token);
    const replay = await collectStream(streamUrl(entry), token);

    expect(first[first.length - 1]!.event).toBe('done');
    expect(replay.map((frame) => frame.event)).toEqual(['error']);
  });

  /**
   * A rejected claim consumes the entry (that is what closes the replay window),
   * so the rightful owner can never stream it — the turn is abandoned and must
   * still be finalized, or the user's already-persisted message is stranded with
   * no reply and its task log stays RUNNING forever.
   */
  it('finalizes the turn when another user claims it, instead of stranding the message', async () => {
    const entry = seedTurn();

    const stolen = await collectStream(streamUrl(entry), mintJwt('someone-else'));

    expect(stolen.map((frame) => frame.event)).toEqual(['error']);
    await waitFor(() => persistTurnOutcome.mock.calls.length > 0);
    const [, , finalAnswer, , , , turnFailed] = persistTurnOutcome.mock.calls[0]!;
    expect((finalAnswer as { status: AgentRunStatus }).status).toBe(AgentRunStatus.FAILED);
    expect(turnFailed).toBe(true);
    expect(taskLogFinish).toHaveBeenCalledWith(
      'parent-log-1',
      expect.objectContaining({ status: AgentRunStatus.FAILED }),
    );
  });

  it('rejects an unauthenticated stream request before any frame is written', async () => {
    const entry = seedTurn();

    const response = await fetch(streamUrl(entry));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).not.toMatch(/event-stream/);
  });
});
