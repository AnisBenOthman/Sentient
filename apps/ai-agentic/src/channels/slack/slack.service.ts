import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocketModeClient } from '@slack/socket-mode';
import type { GenericMessageEvent, SlackEvent } from '@slack/types';
import { WebClient } from '@slack/web-api';
import { ChannelType } from '@sentient/shared';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { verifySlackSignature } from './slack-signature.util';

interface CachedSession {
  accessToken: string;
  expiresAt: number;
}

type SlackMode = 'socket' | 'events';

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

  constructor(
    private readonly config: ConfigService,
    private readonly hrCore: HrCoreClient,
  ) {}

  async onModuleInit(): Promise<void> {
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
    // TEMP DIAGNOSTIC — remove once inbound delivery is confirmed working.
    socket.on('slack_event', (a: { type: string; body?: { event?: { type?: string; subtype?: string; channel_type?: string } } }) => {
      this.logger.warn(`DIAG slack_event type=${a.type} inner=${a.body?.event?.type} subtype=${a.body?.event?.subtype} channel_type=${a.body?.event?.channel_type}`);
    });
    socket.on('message', async ({ ack, event }: SocketModeEventArgs) => {
      // WHY ack first: Slack redelivers any envelope not acked within ~3s,
      // and a redeemLinkCode round-trip to HR Core can take longer than that
      // on a cold start. Acking up front turns one DM into one handler run.
      await ack();
      await this.handleEvent(event);
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
   */
  private async handleDirectMessage(userId: string, channelId: string, text: string): Promise<void> {
    const [rawCommand = '', ...rest] = text.split(/\s+/);
    const command = rawCommand.toLowerCase().replace(/^\//, '');
    const argument = rest.join(' ').trim();

    switch (command) {
      case 'start':
      case 'help':
        await this.reply(
          channelId,
          "Hi, I'm Sentient. Get a link code from Settings > Linked Channels in the web app, " +
            'then send me `link <code>` here to connect this Slack account to your HR account.',
        );
        return;

      case 'link': {
        if (!argument) {
          await this.reply(channelId, 'Usage: `link <code>` — get the code from Settings > Linked Channels in the web app.');
          return;
        }
        try {
          await this.hrCore.redeemLinkCode(ChannelType.SLACK, userId, argument);
          this.sessionCache.delete(userId);
          await this.reply(channelId, "Linked! I'll recognize you from now on.");
        } catch (err: unknown) {
          this.logger.warn(`Link failed for Slack user ${userId}: ${this.errorMessage(err)}`);
          await this.reply(channelId, 'That code is invalid or expired. Generate a new one from Settings and try again.');
        }
        return;
      }

      case 'unlink':
        this.sessionCache.delete(userId);
        await this.reply(channelId, 'To unlink this Slack account, use Settings > Linked Channels in the Sentient web app.');
        return;

      case 'whoami': {
        const session = await this.resolveSession(userId);
        await this.reply(
          channelId,
          session ? 'This Slack account is linked to your Sentient account.' : "This Slack account isn't linked yet. Send `link <code>`.",
        );
        return;
      }

      default: {
        const session = await this.resolveSession(userId);
        if (!session) {
          await this.reply(channelId, "This Slack account isn't linked to a Sentient account yet. Send `link <code>` to connect it.");
          return;
        }
        // WHY: same seam as TelegramService — the conversation/agent
        // pipeline plugs in here once it lands; nothing above changes then.
        await this.reply(
          channelId,
          "I'm connected to your account, but full conversations aren't wired up yet — that part of Sentient is still being built.",
        );
      }
    }
  }

  /**
   * WHY: Proactive push (HR Core calling in after a manager decision) has no
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

  private async resolveSession(userId: string): Promise<CachedSession | null> {
    const cached = this.sessionCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    try {
      const result = await this.hrCore.exchangeChannelIdentity(ChannelType.SLACK, userId);
      const session: CachedSession = {
        accessToken: result.accessToken,
        // Refresh 30s early so a cached token is never used right at expiry.
        expiresAt: Date.now() + Math.max(result.expiresIn - 30, 0) * 1_000,
      };
      this.sessionCache.set(userId, session);
      return session;
    } catch (err: unknown) {
      this.logger.debug(`No linked session for Slack user ${userId}: ${this.errorMessage(err)}`);
      return null;
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
