import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SocketModeClient } from '@slack/socket-mode';
import type { GenericMessageEvent, KnownBlock, SlackEvent } from '@slack/types';
import { WebClient } from '@slack/web-api';
import { ChannelType } from '@sentient/shared';
import { ChannelType as PrismaChannelType } from '../../generated/prisma';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { ActorContextFactory, AiActorContext } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import { ActionProposalService } from '../../modules/agents/actions/action-proposal.service';
import { CardLines, confirmationCardLines, outcomeLines } from '../../modules/agents/actions/confirmation-card.presenter';
import { ConversationTurnResponse } from '../../modules/conversations/conversation-response.mapper';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { encodeCallbackData, parseCallbackData } from '../telegram/callback-data';
import { verifySlackSignature } from './slack-signature.util';

interface CachedSession {
  accessToken: string;
  expiresAt: number;
}

type SlackMode = 'socket' | 'events';

const SLACK = ChannelType.SLACK;
const PRISMA_SLACK = PrismaChannelType.SLACK;

// WHY 120s and not 30s: mirrors TelegramService — a turn can legitimately run
// close to requestTimeoutMs, and the exchanged JWT is forwarded verbatim to HR
// Core on the final createLeaveRequest. A token expiring mid-turn would 401 at
// the worst possible moment, after the user confirmed.
const TOKEN_REFRESH_MARGIN_SECONDS = 120;
const MAX_INBOUND_CHARS = 8_000;

const LINK_HINT = 'Get a link code from My Profile > Linked Channels in the web app, then send me `link <code>` here.';
const HELP_TEXT = [
  "I'm Sentient, your HR assistant. You can ask me things like:",
  '• What is my leave balance?',
  '• When is the next public holiday?',
  '• Book 2 days of annual leave next week',
  '',
  'Bookings are never submitted until you tap Confirm.',
  '',
  'Commands: `new` starts a fresh conversation, `whoami` checks your link, `help` shows this.',
].join('\n');

/**
 * Commands recognised only as a bare word (optionally slash-prefixed) — never
 * as the first word of a longer sentence. Without this gate, "new leave
 * request please" would hit the `new` case and clear the conversation link
 * instead of answering, because handleDirectMessage matches on the first
 * whitespace-delimited token.
 */
const COMMANDS = new Set(['start', 'help', 'link', 'unlink', 'whoami', 'new']);

/**
 * The two outer Events API envelopes this service cares about. Slack sends
 * `url_verification` once when the Request URL is saved and `event_callback`
 * for everything after; other envelope types are acknowledged and ignored.
 */
export interface SlackEventsPayload {
  type: string;
  challenge?: string;
  event?: SlackEvent;
  event_id?: string;
}

interface SocketModeEventArgs {
  ack: () => Promise<void>;
  event: SlackEvent;
}

/**
 * Shape of a Block Kit `block_actions` interactive payload — the envelope
 * Socket Mode emits under the event name `interactive`, distinct from the
 * `events_api` branch `message`/`app_mention`/etc. use. Minimal by design:
 * only the fields this handler actually reads.
 */
interface SlackInteractivePayload {
  type: string;
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
}

interface SocketModeInteractiveArgs {
  ack: () => Promise<void>;
  body: SlackInteractivePayload;
}

/**
 * WHY Socket Mode is the default: it is Slack's equivalent of Telegram long
 * polling — an outbound WebSocket from this process, no public URL, works
 * behind docker-compose's localhost-only ports. The Events API over HTTP
 * (SLACK_MODE=events) is opt-in for a tunnel in dev or a real domain in
 * production; both modes feed the same handleEvent() below.
 *
 * externalId for Slack is the Slack user id (U…), not the DM channel id:
 * chat.postMessage accepts a user id as `channel` and routes to that user's
 * DM with the app, so HR Core's channel_identities row stays stable even if
 * the DM channel is ever recreated, and it matches RedeemLinkCodeDto's
 * "Telegram chatId or Slack userId" contract.
 */
@Injectable()
export class SlackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackService.name);
  private web: WebClient | null = null;
  private socket: SocketModeClient | null = null;
  private mode: SlackMode = 'socket';
  private signingSecret: string | null = null;
  private botUserId: string | null = null;
  private readonly sessionCache = new Map<string, CachedSession>();
  /**
   * Users with a turn in flight. A second message while one is running is
   * refused, not queued — same rationale as TelegramService: it is honest,
   * it keeps Message rows from interleaving on one conversation, and it is a
   * stricter limit than the HTTP throttle this channel bypasses entirely.
   */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly hrCore: HrCoreClient,
    private readonly actors: ActorContextFactory,
    private readonly conversations: ConversationsService,
    private readonly links: ChannelConversationLinkService,
    private readonly proposals: ActionProposalService,
  ) {}

  async onModuleInit(): Promise<void> {
    // WHY: unit tests bootstrap Nest modules without network access; never
    // open a real WebSocket from inside a Jest worker (same guard as
    // TelegramService and the embedding backfill).
    if (process.env.JEST_WORKER_ID) return;

    const enabled = this.config.get<string>('SLACK_ENABLED', 'false') === 'true';
    if (!enabled) {
      this.logger.log('Slack channel disabled (set SLACK_ENABLED=true to start it)');
      return;
    }

    const botToken = this.config.get<string>('SLACK_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('SLACK_ENABLED=true but SLACK_BOT_TOKEN is not set — channel not started');
      return;
    }

    this.mode = this.config.get<string>('SLACK_MODE', 'socket') === 'events' ? 'events' : 'socket';

    const web = new WebClient(botToken, { timeout: 10_000 });
    try {
      // WHY auth.test before anything else: it validates the bot token once
      // at boot (a bad token fails loudly here instead of on the first DM)
      // and yields the bot's own user id so its replies never re-enter
      // handleEvent() as if a person had typed them.
      const auth = await web.auth.test();
      this.botUserId = auth.user_id ?? null;
    } catch (err: unknown) {
      this.logger.error(`Slack auth.test failed — channel not started: ${this.errorMessage(err)}`);
      return;
    }
    this.web = web;

    if (this.mode === 'socket') {
      this.startSocketMode();
    } else {
      this.startEventsMode();
    }
  }

  private startSocketMode(): void {
    const appToken = this.config.get<string>('SLACK_APP_TOKEN');
    if (!appToken) {
      this.logger.warn('SLACK_MODE=socket but SLACK_APP_TOKEN (xapp-…) is not set — channel not started');
      this.web = null;
      return;
    }

    const socket = new SocketModeClient({ appToken });
    socket.on('message', async ({ ack, event }: SocketModeEventArgs) => {
      // WHY ack first: Slack redelivers any envelope not acked within ~3s,
      // and a redeemLinkCode round-trip to HR Core can take longer than that
      // on a cold start. Acking up front turns one DM into one handler run.
      await ack();
      await this.handleEvent(event);
    });
    // WHY a separate listener: Block Kit button taps arrive as a distinct
    // `interactive` envelope (block_actions), not wrapped in `events_api` —
    // the SDK emits it under its own outer type, with `body` holding the raw
    // interactivity payload rather than an `event` field.
    socket.on('interactive', async ({ ack, body }: SocketModeInteractiveArgs) => {
      await ack();
      await this.handleInteractive(body);
    });
    this.socket = socket;

    // WHY not awaited: start() resolves only once the WebSocket handshake
    // completes and auto-reconnects on drops; blocking Nest's bootstrap on
    // Slack's availability would take the whole service down with it.
    socket
      .start()
      .then(() => this.logger.log('Slack app connected (Socket Mode)'))
      .catch((err: unknown) => {
        this.logger.error(`Slack Socket Mode failed to start: ${this.errorMessage(err)}`);
        this.socket = null;
      });
  }

  private startEventsMode(): void {
    const secret = this.config.get<string>('SLACK_SIGNING_SECRET');
    if (!secret) {
      this.logger.warn('SLACK_MODE=events but SLACK_SIGNING_SECRET is not set — channel not started');
      this.web = null;
      return;
    }
    this.signingSecret = secret;
    this.logger.log('Slack app ready (Events API over HTTP — point the Request URL at /channels/slack/events)');
  }

  /**
   * WHY the signature check lives here rather than a guard: this route
   * carries no Sentient JWT — Slack sends none — so the shared auth guards
   * don't apply. The X-Slack-Signature HMAC over the raw body is the only
   * thing distinguishing a real Slack delivery from anyone who finds the
   * URL. A mismatch (or events mode not actually running) is a 403 from the
   * caller (SlackController), never a silent accept.
   */
  verifySignature(timestamp: string | undefined, signature: string | undefined, rawBody: string | undefined): boolean {
    if (this.mode !== 'events' || this.signingSecret === null) return false;
    return verifySlackSignature({ signingSecret: this.signingSecret, timestamp, signature, rawBody });
  }

  /**
   * Returns the `url_verification` challenge Slack expects echoed back when
   * the Request URL is first saved; undefined for everything else. Event
   * processing is deliberately not awaited — see the ack comment in
   * startSocketMode(): the HTTP 200 must go out before HR Core is called.
   */
  async handleEventsPayload(payload: SlackEventsPayload): Promise<{ challenge: string } | undefined> {
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge ?? '' };
    }
    if (payload.type === 'event_callback' && payload.event) {
      void this.handleEvent(payload.event).catch((err: unknown) => {
        this.logger.error(`Slack event handler error: ${this.errorMessage(err)}`);
      });
    }
    return undefined;
  }

  async handleEvent(event: SlackEvent): Promise<void> {
    if (!this.web) return;
    if (!isDirectMessage(event)) return;
    // Our own chat.postMessage replies come back as message events too.
    if (event.bot_id !== undefined || (this.botUserId !== null && event.user === this.botUserId)) return;

    await this.handleDirectMessage(event.user, event.channel, (event.text ?? '').trim());
  }

  async onModuleDestroy(): Promise<void> {
    if (this.socket) {
      await this.socket.disconnect().catch((err: unknown) => {
        this.logger.warn(`Slack Socket Mode disconnect failed: ${this.errorMessage(err)}`);
      });
      this.socket = null;
    }
    this.web = null;
  }

  /**
   * WHY plain-text commands instead of Slack slash commands: a slash command
   * has to be registered in the app manifest and, over HTTP, arrives on a
   * separate form-encoded endpoint. DM text works identically in both modes
   * and needs only the message.im event subscription. A leading slash is
   * tolerated so "/link 123456" copied from the Telegram instructions still
   * works if Slack lets it through.
   *
   * Commands only match as the WHOLE first token (via COMMANDS), never as a
   * prefix of a longer sentence — "new leave request please" must reach the
   * agent pipeline, not the `new` command.
   */
  private async handleDirectMessage(userId: string, channelId: string, text: string): Promise<void> {
    const [rawCommand = '', ...rest] = text.split(/\s+/);
    const hasSlash = rawCommand.startsWith('/');
    const normalized = rawCommand.toLowerCase().replace(/^\//, '');
    const argument = rest.join(' ').trim();
    // WHY not "first token matches" alone: 'new' and 'help' are real command
    // words, so a bare first-token match would hijack "new leave request
    // please" into the /new command instead of the agent pipeline. A command
    // fires only when it is slash-prefixed, IS 'link' (which always expects a
    // trailing code), or is the entire message with nothing else attached.
    const isCommand = COMMANDS.has(normalized) && (hasSlash || normalized === 'link' || argument === '');
    const command = isCommand ? normalized : null;

    switch (command) {
      case 'start':
      case 'help':
        await this.reply(channelId, `Hi, I'm Sentient. ${LINK_HINT}\n\n${HELP_TEXT}`);
        return;

      case 'link': {
        if (!argument) {
          await this.reply(channelId, `Usage: \`link <code>\`. ${LINK_HINT}`);
          return;
        }
        try {
          await this.hrCore.redeemLinkCode(SLACK, userId, argument);
          this.sessionCache.delete(userId);
          await this.reply(channelId, "Linked! I'll recognize you from now on. Send `help` to see what I can do.");
        } catch (err: unknown) {
          this.logger.warn(`Link failed for Slack user ${userId}: ${this.errorMessage(err)}`);
          await this.reply(channelId, 'That code is invalid or expired. Generate a new one from My Profile > Linked Channels and try again.');
        }
        return;
      }

      case 'unlink':
        this.sessionCache.delete(userId);
        await this.reply(channelId, 'To unlink this Slack account, use My Profile > Linked Channels in the Sentient web app.');
        return;

      case 'whoami': {
        const session = await this.resolveSession(userId);
        await this.reply(
          channelId,
          session.kind === 'ok'
            ? 'This Slack account is linked to your Sentient account.'
            : session.kind === 'unlinked'
              ? `This Slack account isn't linked yet. ${LINK_HINT}`
              : "I can't reach your account right now. Please try again in a moment.",
        );
        return;
      }

      case 'new':
        await this.links.clear(PRISMA_SLACK, userId);
        await this.reply(channelId, 'Starting fresh — your next message begins a new conversation.');
        return;

      default:
        await this.onText(userId, channelId, text);
    }
  }

  // ---- Free text ---------------------------------------------------------

  private async onText(userId: string, channelId: string, text: string): Promise<void> {
    if (text.length === 0) return;
    if (text.length > MAX_INBOUND_CHARS) {
      await this.reply(channelId, `That message is too long for me (${text.length} characters). Please keep it under ${MAX_INBOUND_CHARS}.`);
      return;
    }
    if (!this.claim(userId)) {
      await this.reply(channelId, 'Still working on your last message — give me a moment.');
      return;
    }

    try {
      const actor = await this.actorFor(userId, channelId);
      if (!actor) return;

      const turn = await this.runWithTimeout(channelId, () => this.sendTurn(userId, actor, text));
      if (turn) await this.deliverTurn(channelId, turn);
    } catch (err: unknown) {
      this.logger.error(`Slack turn failed for user ${userId}: ${this.errorMessage(err)}`);
      await this.reply(channelId, "Something went wrong on my side. Your message wasn't lost — please try again in a moment.");
    } finally {
      this.inFlight.delete(userId);
    }
  }

  /**
   * Continues the user's linked conversation, or starts one. A link that
   * points at a conversation this user can no longer send to (deleted or
   * archived from the web app) is dropped and a fresh conversation started,
   * rather than surfacing an error for state the user changed elsewhere.
   */
  private async sendTurn(userId: string, actor: AiActorContext, text: string): Promise<ConversationTurnResponse> {
    const linked = await this.links.find(PRISMA_SLACK, userId);
    if (linked) {
      try {
        return await this.conversations.sendMessage(linked, actor, { message: text });
      } catch (err: unknown) {
        if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) throw err;
        this.logger.log(`Dropping stale conversation link for Slack user ${userId}: ${this.errorMessage(err)}`);
        await this.links.clear(PRISMA_SLACK, userId);
      }
    }
    const turn = await this.conversations.createConversation(actor, { message: text });
    await this.links.set(PRISMA_SLACK, userId, turn.conversation.id);
    return turn;
  }

  private async deliverTurn(channelId: string, turn: ConversationTurnResponse): Promise<void> {
    await this.reply(channelId, turn.assistantMessage.content);
    const payload = turn.assistantMessage.confirmationPayload;
    if (payload) await this.sendCard(channelId, confirmationCardLines(payload), payload.confirmationToken);
  }

  private async sendCard(channelId: string, card: CardLines, confirmationToken: string): Promise<void> {
    if (!this.web) return;
    const blocks = buildCardBlocks(card, confirmationToken);
    try {
      await this.web.chat.postMessage({ channel: channelId, text: card.headline, blocks });
    } catch (err: unknown) {
      this.logger.warn(`Slack sendCard to channel ${channelId} failed: ${this.errorMessage(err)}`);
    }
  }

  // ---- Confirm / Cancel taps ----------------------------------------------

  private async handleInteractive(body: SlackInteractivePayload): Promise<void> {
    if (body.type !== 'block_actions') return;
    const userId = body.user?.id;
    const channelId = body.channel?.id;
    const messageTs = body.message?.ts;
    if (!userId || !channelId) return;

    const raw = body.actions?.[0]?.value;
    const parsed = parseCallbackData(raw);
    if (!parsed) {
      if (messageTs) await this.stripCard(channelId, messageTs);
      await this.reply(channelId, "I don't recognise that button any more. If you still want to book leave, just ask me again.");
      return;
    }
    if (!this.claim(userId)) {
      await this.reply(channelId, 'Still working on your last request — give me a moment, then tap again if needed.');
      return;
    }

    try {
      const actor = await this.actorFor(userId, channelId);
      if (!actor) return;

      // Route the tap by the proposal's own token, not the user's conversation
      // link: if they ran `new` between the card and the tap, the link points
      // elsewhere and a conversation-scoping check would refuse a legitimate tap.
      const proposal = await this.proposals.findByToken(parsed.token);
      if (!proposal || proposal.actorUserId !== actor.userId) {
        // Unknown, or somebody else's — indistinguishable on purpose.
        if (messageTs) await this.stripCard(channelId, messageTs);
        await this.reply(channelId, "I don't recognise that confirmation any more. If you still want to book leave, just ask me again.");
        return;
      }

      if (messageTs) await this.stripCard(channelId, messageTs);

      const turn = await this.runWithTimeout(channelId, () =>
        this.conversations.sendMessage(proposal.conversationId, actor, {
          message: parsed.action === 'confirm' ? 'Confirm' : 'Cancel',
          confirmed: parsed.action === 'confirm',
          confirmationToken: parsed.token,
        }),
      );
      if (!turn) return;

      if (turn.actionOutcome) {
        await this.reply(channelId, outcomeLines(turn.actionOutcome).footer);
      } else {
        await this.reply(channelId, turn.assistantMessage.content);
      }
    } catch (err: unknown) {
      this.logger.error(`Slack interactive callback failed for user ${userId}: ${this.errorMessage(err)}`);
      await this.reply(
        channelId,
        'Something went wrong while handling that tap. Please check the Leaves page in the web app before trying again — the booking may already have gone through.',
      );
    } finally {
      this.inFlight.delete(userId);
    }
  }

  /**
   * WHY chat.update with empty blocks rather than resupplying the original
   * card minus its buttons: the tap handler only has the proposal's token,
   * not the full card content, and re-deriving it would need an extra
   * Prisma read the equivalent Telegram path doesn't need either (grammY's
   * callback context already holds the message it came from). Reducing to a
   * plain "processing" line is an accepted simplification for v1 — the
   * outcome message that follows immediately after carries the full result,
   * and the DB-level conditional update (not this UI edit) is what actually
   * prevents a double-submit.
   */
  private async stripCard(channelId: string, ts: string): Promise<void> {
    if (!this.web) return;
    await this.web.chat
      .update({ channel: channelId, ts, text: 'One moment…', blocks: [] })
      .catch(() => undefined);
  }

  /**
   * WHY: proactive push (HR Core calling in after a manager decision) has no
   * inbound event to reply to. Both "channel disabled" and "Slack rejected
   * the send" (app uninstalled, user deactivated, DMs restricted) must
   * resolve to a quiet no-op rather than a thrown error: the caller only
   * ever wanted best-effort delivery, never a reason to fail its own request.
   */
  async sendMessage(externalId: string, text: string): Promise<{ delivered: boolean }> {
    if (!this.web) {
      this.logger.debug(`Slack channel disabled — dropping proactive message to user ${externalId}`);
      return { delivered: false };
    }

    try {
      await this.web.chat.postMessage({ channel: externalId, text });
      return { delivered: true };
    } catch (err: unknown) {
      this.logger.warn(`Slack postMessage to user ${externalId} failed: ${this.errorMessage(err)}`);
      return { delivered: false };
    }
  }

  private async reply(channelId: string, text: string): Promise<void> {
    if (!this.web) return;
    try {
      await this.web.chat.postMessage({ channel: channelId, text });
    } catch (err: unknown) {
      this.logger.warn(`Slack reply to channel ${channelId} failed: ${this.errorMessage(err)}`);
    }
  }

  // ---- Session / actor -----------------------------------------------------

  private async actorFor(userId: string, channelId: string): Promise<AiActorContext | null> {
    const session = await this.resolveSession(userId);
    if (session.kind === 'unlinked') {
      await this.reply(channelId, `This Slack account isn't linked to a Sentient account yet. ${LINK_HINT}`);
      return null;
    }
    if (session.kind === 'unavailable') {
      await this.reply(channelId, "I can't reach your account right now. Please try again in a moment.");
      return null;
    }
    try {
      return this.actors.fromChannelToken(session.accessToken, {
        channel: SLACK,
        correlationId: `sl-${randomUUID()}`,
      });
    } catch (err: unknown) {
      this.logger.warn(`Rejected channel token for Slack user ${userId}: ${this.errorMessage(err)}`);
      this.sessionCache.delete(userId);
      await this.reply(channelId, `Your session couldn't be verified. Please re-link this account: ${LINK_HINT}`);
      return null;
    }
  }

  /**
   * WHY three outcomes and not a nullable: "not linked" and "HR Core is down"
   * need different replies, and a transient outage must never tell the user
   * to re-link. Failures are not cached; only a good session is.
   */
  private async resolveSession(
    userId: string,
  ): Promise<{ kind: 'ok'; accessToken: string } | { kind: 'unlinked' } | { kind: 'unavailable' }> {
    const cached = this.sessionCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return { kind: 'ok', accessToken: cached.accessToken };

    try {
      const result = await this.hrCore.exchangeChannelIdentity(SLACK, userId);
      this.sessionCache.set(userId, {
        accessToken: result.accessToken,
        expiresAt: Date.now() + Math.max(result.expiresIn - TOKEN_REFRESH_MARGIN_SECONDS, 0) * 1_000,
      });
      return { kind: 'ok', accessToken: result.accessToken };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) return { kind: 'unlinked' };
      if (err instanceof ServiceUnavailableException) {
        this.logger.warn(`HR Core unavailable while resolving Slack user ${userId}: ${this.errorMessage(err)}`);
        return { kind: 'unavailable' };
      }
      this.logger.warn(`Session exchange failed for Slack user ${userId}: ${this.errorMessage(err)}`);
      return { kind: 'unavailable' };
    }
  }

  // ---- Turn execution helpers ----------------------------------------------

  private claim(userId: string): boolean {
    if (this.inFlight.has(userId)) return false;
    this.inFlight.add(userId);
    return true;
  }

  /**
   * Bounds a turn by the same requestTimeoutMs the HTTP path enforces. On
   * timeout the turn keeps running and persists its own result — the reply
   * points at the web app and never claims failure, because the work may
   * well complete. No typing indicator: Slack has none that fits a plain
   * Web API bot (assistant.threads.setStatus needs the Agents/AI Apps
   * feature, not enabled here) — skipped rather than faked.
   */
  private async runWithTimeout<T>(channelId: string, work: () => Promise<T>): Promise<T | null> {
    const timeoutMs = this.config.get<AiAgenticConfig>('aiAgentic')?.requestTimeoutMs ?? 60_000;

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const job = work();
    job.catch(() => undefined);

    try {
      const result = await Promise.race([job, timeout]);
      if (result === null) {
        this.logger.warn(`Slack turn for channel ${channelId} exceeded ${timeoutMs}ms; replying with a deferral.`);
        await this.reply(
          channelId,
          "This is taking longer than usual. I'm still working on it — you'll find the answer in the Sentient web app under AI Assistant in a moment.",
        );
      }
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Narrows the full Slack event union to a human-typed DM. `subtype` is
 * undefined only for ordinary messages (edits, joins, bot posts all carry
 * one), and `channel_type === 'im'` excludes channels the app was added to.
 */
function isDirectMessage(event: SlackEvent): event is GenericMessageEvent {
  if (event.type !== 'message') return false;
  const candidate: { subtype?: string; channel_type?: string; user?: string } = event;
  return candidate.subtype === undefined && candidate.channel_type === 'im' && typeof candidate.user === 'string';
}

/**
 * Renders CardLines (the same channel-neutral shape web and Telegram read)
 * as Block Kit: one section per field, a divider, citations, the footer as
 * context, and a two-button actions block carrying the callback-data codec
 * shared with Telegram in `value` — Slack's action payload has no 64-byte
 * cap, but reusing the codec keeps one decode path across channels.
 */
function buildCardBlocks(card: CardLines, confirmationToken: string): KnownBlock[] {
  const blocks: KnownBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: card.headline, emoji: true } },
    {
      type: 'section',
      fields: card.lines.map((line) => ({ type: 'mrkdwn', text: `*${line.label}:*\n${line.value}` })),
    },
  ];
  if (card.citations.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: card.citations.join('\n') } });
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: card.footer }] });
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '✅ Confirm', emoji: true },
        style: 'primary',
        action_id: 'confirm_action',
        value: encodeCallbackData('confirm', confirmationToken),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '✖ Cancel', emoji: true },
        style: 'danger',
        action_id: 'cancel_action',
        value: encodeCallbackData('cancel', confirmationToken),
      },
    ],
  });
  return blocks;
}
