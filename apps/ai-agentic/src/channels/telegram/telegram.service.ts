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
import { Bot, BotError, Context, InlineKeyboard } from 'grammy';
import type { Update } from 'grammy/types';
import { ChannelType } from '@sentient/shared';
import { ChannelType as PrismaChannelType } from '../../generated/prisma';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { ActorContextFactory, AiActorContext } from '../../common/graph';
import { AiAgenticConfig } from '../../config';
import { ActionProposalService } from '../../modules/agents/actions/action-proposal.service';
import {
  confirmationCardLines,
  ConfirmationPayloadResponse,
  outcomeLines,
} from '../../modules/agents/actions/confirmation-card.presenter';
import { ConversationTurnResponse } from '../../modules/conversations/conversation-response.mapper';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { ChannelConversationLinkService } from '../channel-conversation-link.service';
import { encodeCallbackData, parseCallbackData } from './callback-data';
import { chunkTelegramMessage, renderCardText } from './telegram-message.util';

interface CachedSession {
  accessToken: string;
  expiresAt: number;
}

type TelegramMode = 'polling' | 'webhook';

/**
 * WHY 120s and not 30s: a turn can legitimately run close to requestTimeoutMs
 * (60s), and the exchanged JWT is forwarded verbatim to HR Core on the final
 * createLeaveRequest. A token that expires mid-turn would 401 at the worst
 * possible moment — after the user confirmed.
 */
const TOKEN_REFRESH_MARGIN_SECONDS = 120;
const TYPING_REFRESH_MS = 4_000;
const MAX_INBOUND_CHARS = 8_000;
const TELEGRAM = ChannelType.TELEGRAM;
const PRISMA_TELEGRAM = PrismaChannelType.TELEGRAM;

const LINK_HINT = 'Open My Profile > Linked Channels in the Sentient web app to get a code, then send /link <code> here.';
const HELP_TEXT = [
  "I'm Sentient, your HR assistant. You can ask me things like:",
  '• What is my leave balance?',
  '• When is the next public holiday?',
  '• Book 2 days of annual leave next week',
  "• I'm not feeling well today",
  '',
  'Bookings are never submitted until you tap Confirm.',
  '',
  'Commands: /new starts a fresh conversation, /whoami checks your link, /help shows this.',
].join('\n');

/**
 * WHY long polling (bot.start()) is the default: no public URL, no domain, no
 * TLS — the whole reason Telegram is free to run for this project. The tradeoff
 * is exactly one poller per bot token: a second instance makes getUpdates
 * return 409, which bot.catch() logs as a duplicate-poller conflict rather than
 * a token problem.
 *
 * TELEGRAM_MODE=webhook is the opt-in alternative for a tunnel in dev or a real
 * domain in production — Telegram's setWebhook rejects anything but a public
 * https:// URL, and docker-compose only exposes localhost, so polling stays the
 * only path that works unconfigured. Both modes drive the same handlers below.
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private mode: TelegramMode = 'polling';
  private webhookSecret: string | null = null;
  private readonly sessionCache = new Map<string, CachedSession>();
  /**
   * Chats with a turn in flight. A second message while one is running is
   * refused, not queued: it is honest, it keeps Message rows from interleaving
   * on one conversation, and it is a stricter limit than the HTTP throttle the
   * bot path bypasses.
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
    // WHY: unit tests bootstrap Nest modules without network access; never open
    // a poller from inside a Jest worker (same guard as the embedding backfill).
    if (process.env.JEST_WORKER_ID) return;

    const enabled = this.config.get<string>('TELEGRAM_ENABLED', 'false') === 'true';
    if (!enabled) {
      this.logger.log('Telegram channel disabled (set TELEGRAM_ENABLED=true to start it)');
      return;
    }

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_ENABLED=true but TELEGRAM_BOT_TOKEN is not set — channel not started');
      return;
    }

    this.mode = this.config.get<string>('TELEGRAM_MODE', 'polling') === 'webhook' ? 'webhook' : 'polling';

    const bot = new Bot(token);
    this.bot = bot;
    this.registerHandlers(bot);

    bot.catch((err: BotError) => {
      const message = this.errorMessage(err.error);
      if (message.includes('409')) {
        this.logger.error('Telegram getUpdates conflict (409) — another instance is already polling this bot token.');
        return;
      }
      this.logger.error(`Telegram handler error: ${message}`);
    });

    if (this.mode === 'webhook') {
      await this.startWebhook(bot);
      return;
    }

    // bot.start() resolves only when bot.stop() is called — it is the polling
    // loop. Awaiting it would hang Nest's bootstrap; onModuleDestroy stops it.
    bot
      .start({ onStart: () => this.logger.log('Telegram bot connected (long polling)') })
      .catch((err: unknown) => this.logger.error(`Telegram bot failed to start: ${this.errorMessage(err)}`));
  }

  private async startWebhook(bot: Bot): Promise<void> {
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!webhookUrl || !secret) {
      this.logger.warn(
        'TELEGRAM_MODE=webhook but TELEGRAM_WEBHOOK_URL or TELEGRAM_WEBHOOK_SECRET is not set — channel not started',
      );
      this.bot = null;
      return;
    }
    this.webhookSecret = secret;

    try {
      // WHY bot.init() instead of bot.start(): init() only fetches botInfo
      // (required before handleUpdate() will process anything) without opening
      // a getUpdates long-polling loop — the two are mutually exclusive on
      // Telegram's side.
      await bot.init();
      await bot.api.setWebhook(webhookUrl, { secret_token: secret });
      this.logger.log(`Telegram bot connected (webhook: ${webhookUrl})`);
    } catch (err: unknown) {
      this.logger.error(`Telegram setWebhook failed: ${this.errorMessage(err)}`);
    }
  }

  /**
   * WHY the secret-token check lives here rather than a guard: the webhook
   * route carries no Sentient JWT — Telegram sends none — so the shared auth
   * guards don't apply. The X-Telegram-Bot-Api-Secret-Token header, echoed back
   * on every delivery once set via setWebhook, is the only thing distinguishing
   * a real Telegram delivery from anyone who finds the URL. A mismatch (or
   * webhook mode not actually running) is a 403 from TelegramController, never
   * a silent accept.
   */
  verifyWebhookSecret(providedSecret: string | undefined): boolean {
    return this.mode === 'webhook' && this.webhookSecret !== null && providedSecret === this.webhookSecret;
  }

  /**
   * NOTE: a full agent turn can run close to requestTimeoutMs, while Telegram
   * gives a webhook ~60s before it retries the delivery. runWithTyping() bounds
   * the turn and replies with a deferral rather than hanging, which keeps the
   * ack inside that window in practice; polling (the default) has no such bound.
   */
  async handleWebhookUpdate(update: Update): Promise<void> {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.bot) return;
    if (this.mode === 'webhook') {
      // WHY: a stale webhook pointed at a dead tunnel/instance means Telegram
      // silently drops every update until someone notices. Clearing it on
      // shutdown makes the next boot's setWebhook the only source of truth.
      await this.bot.api.deleteWebhook().catch((err: unknown) => {
        this.logger.warn(`Telegram deleteWebhook failed: ${this.errorMessage(err)}`);
      });
      return;
    }
    await this.bot.stop();
  }

  /**
   * WHY: proactive push (HR Core calling in after a manager decision) is a
   * different failure surface than the inbound handlers — there is no ctx.reply
   * to fall back on. Both "channel disabled" and "Telegram rejected the send"
   * (user blocked the bot, chat deleted) must resolve to a quiet no-op rather
   * than a thrown error: the caller only ever wanted best-effort delivery,
   * never a reason to fail its own request.
   */
  async sendMessage(chatId: string, text: string): Promise<{ delivered: boolean }> {
    if (!this.bot) {
      this.logger.debug(`Telegram channel disabled — dropping proactive message to chat ${chatId}`);
      return { delivered: false };
    }

    try {
      await this.bot.api.sendMessage(chatId, text);
      return { delivered: true };
    } catch (err: unknown) {
      this.logger.warn(`Telegram sendMessage to chat ${chatId} failed: ${this.errorMessage(err)}`);
      return { delivered: false };
    }
  }

  // ---------------------------------------------------------------------------

  private registerHandlers(bot: Bot): void {
    bot.command('start', async (ctx) => {
      await ctx.reply(`Hi, I'm Sentient. ${LINK_HINT}`);
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(HELP_TEXT);
    });

    bot.command('link', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const code = ctx.match.trim();
      if (!code) {
        await ctx.reply(`Usage: /link <code>. ${LINK_HINT}`);
        return;
      }
      try {
        await this.hrCore.redeemLinkCode(TELEGRAM, chatId, code);
        this.sessionCache.delete(chatId);
        await ctx.reply("Linked! I'll recognise this chat from now on. Send /help to see what I can do.");
      } catch (err: unknown) {
        this.logger.warn(`Link failed for chat ${chatId}: ${this.errorMessage(err)}`);
        await ctx.reply('That code is invalid or expired. Generate a new one from My Profile > Linked Channels and try again.');
      }
    });

    bot.command('unlink', async (ctx) => {
      this.sessionCache.delete(String(ctx.chat.id));
      await ctx.reply('To unlink this chat, use My Profile > Linked Channels in the Sentient web app.');
    });

    bot.command('whoami', async (ctx) => {
      const session = await this.resolveSession(String(ctx.chat.id));
      await ctx.reply(
        session.kind === 'ok'
          ? 'This chat is linked to your Sentient account.'
          : session.kind === 'unlinked'
            ? `This chat isn't linked yet. ${LINK_HINT}`
            : "I can't reach your account right now. Please try again in a moment.",
      );
    });

    bot.command('new', async (ctx) => {
      await this.links.clear(PRISMA_TELEGRAM, String(ctx.chat.id));
      await ctx.reply('Starting fresh — your next message begins a new conversation.');
    });

    bot.on('message:text', (ctx) => this.onText(ctx));
    bot.on('callback_query:data', (ctx) => this.onCallback(ctx));
  }

  // ---- Free text -------------------------------------------------------------

  private async onText(ctx: Context & { message: { text: string }; chat: { id: number } }): Promise<void> {
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text.trim();
    if (text.length === 0) return;
    if (text.length > MAX_INBOUND_CHARS) {
      await ctx.reply(`That message is too long for me (${text.length} characters). Please keep it under ${MAX_INBOUND_CHARS}.`);
      return;
    }
    if (!this.claim(chatId)) {
      await ctx.reply("Still working on your last message — give me a moment.");
      return;
    }

    try {
      const actor = await this.actorFor(ctx, chatId);
      if (!actor) return;

      const turn = await this.runWithTyping(ctx, chatId, () => this.sendTurn(chatId, actor, text));
      if (turn) await this.deliverTurn(ctx, turn);
    } catch (err: unknown) {
      this.logger.error(`Telegram turn failed for chat ${chatId}: ${this.errorMessage(err)}`);
      await ctx.reply("Something went wrong on my side. Your message wasn't lost — please try again in a moment.");
    } finally {
      this.inFlight.delete(chatId);
    }
  }

  /**
   * Continues the chat's linked conversation, or starts one. A link that points
   * at a conversation this user can no longer send to (deleted or archived from
   * the web app) is dropped and a fresh conversation started, rather than
   * surfacing an error for state the user changed elsewhere.
   */
  private async sendTurn(chatId: string, actor: AiActorContext, text: string): Promise<ConversationTurnResponse> {
    const linked = await this.links.find(PRISMA_TELEGRAM, chatId);
    if (linked) {
      try {
        return await this.conversations.sendMessage(linked, actor, { message: text }, false);
      } catch (err: unknown) {
        if (!(err instanceof NotFoundException) && !(err instanceof BadRequestException)) throw err;
        this.logger.log(`Dropping stale conversation link for chat ${chatId}: ${this.errorMessage(err)}`);
        await this.links.clear(PRISMA_TELEGRAM, chatId);
      }
    }
    const turn = await this.conversations.createConversation(actor, { message: text }, false);
    await this.links.set(PRISMA_TELEGRAM, chatId, turn.conversation.id);
    return turn;
  }

  private async deliverTurn(ctx: Context, turn: ConversationTurnResponse): Promise<void> {
    for (const chunk of chunkTelegramMessage(turn.assistantMessage.content)) {
      await ctx.reply(chunk);
    }
    const payload = turn.assistantMessage.confirmationPayload;
    if (payload) await this.sendCard(ctx, payload);
  }

  private async sendCard(ctx: Context, payload: ConfirmationPayloadResponse): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('✅ Confirm', encodeCallbackData('confirm', payload.confirmationToken))
      .text('✖ Cancel', encodeCallbackData('cancel', payload.confirmationToken));
    await ctx.reply(renderCardText(confirmationCardLines(payload)), { reply_markup: keyboard });
  }

  // ---- Confirm / Cancel taps -------------------------------------------------

  private async onCallback(ctx: Context & { callbackQuery: { data: string } }): Promise<void> {
    /**
     * Answer FIRST, on every path including refusals. Otherwise the client
     * shows a spinner and Telegram redelivers the update — one tap becomes several.
     */
    await ctx.answerCallbackQuery().catch(() => undefined);

    const chatId = ctx.chat ? String(ctx.chat.id) : null;
    if (!chatId) return;

    const parsed = parseCallbackData(ctx.callbackQuery.data);
    if (!parsed) {
      await this.stripKeyboard(ctx);
      await ctx.reply("I don't recognise that button any more. If you still want to book leave, just ask me again.");
      return;
    }
    if (!this.claim(chatId)) {
      await ctx.reply('Still working on your last request — give me a moment, then tap again if needed.');
      return;
    }

    try {
      const actor = await this.actorFor(ctx, chatId);
      if (!actor) return;

      /**
       * Route the tap by the proposal's token, not by the chat's conversation
       * link: if the user ran /new between the card and the tap, the link points
       * elsewhere and the conversation-scoping check would refuse a legitimate
       * tap. The proposal knows its own conversation.
       */
      const proposal = await this.proposals.findByToken(parsed.token);
      if (!proposal || proposal.actorUserId !== actor.userId) {
        // Unknown, or somebody else's — indistinguishable on purpose.
        await this.stripKeyboard(ctx);
        await ctx.reply("I don't recognise that confirmation any more. If you still want to book leave, just ask me again.");
        return;
      }

      await this.stripKeyboard(ctx);

      const turn = await this.runWithTyping(ctx, chatId, () =>
        this.conversations.sendMessage(
          proposal.conversationId,
          actor,
          {
            message: parsed.action === 'confirm' ? 'Confirm' : 'Cancel',
            confirmed: parsed.action === 'confirm',
            confirmationToken: parsed.token,
          },
          false,
        ),
      );
      if (!turn) return;

      if (turn.actionOutcome) {
        await ctx.reply(renderCardText(outcomeLines(turn.actionOutcome)));
      } else {
        for (const chunk of chunkTelegramMessage(turn.assistantMessage.content)) await ctx.reply(chunk);
      }
    } catch (err: unknown) {
      this.logger.error(`Telegram callback failed for chat ${chatId}: ${this.errorMessage(err)}`);
      await ctx.reply(
        "Something went wrong while handling that tap. Please check the Leaves page in the web app before trying again — the booking may already have gone through.",
      );
    } finally {
      this.inFlight.delete(chatId);
    }
  }

  private async stripKeyboard(ctx: Context): Promise<void> {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  }

  // ---- Session / actor -------------------------------------------------------

  private async actorFor(ctx: Context, chatId: string): Promise<AiActorContext | null> {
    const session = await this.resolveSession(chatId);
    if (session.kind === 'unlinked') {
      await ctx.reply(`This chat isn't linked to a Sentient account yet. ${LINK_HINT}`);
      return null;
    }
    if (session.kind === 'unavailable') {
      await ctx.reply("I can't reach your account right now. Please try again in a moment.");
      return null;
    }
    try {
      return this.actors.fromChannelToken(session.accessToken, {
        channel: TELEGRAM,
        correlationId: `tg-${randomUUID()}`,
      });
    } catch (err: unknown) {
      this.logger.warn(`Rejected channel token for chat ${chatId}: ${this.errorMessage(err)}`);
      this.sessionCache.delete(chatId);
      await ctx.reply("Your session couldn't be verified. Please re-link this chat: " + LINK_HINT);
      return null;
    }
  }

  /**
   * WHY three outcomes and not a nullable: "not linked" and "HR Core is down"
   * need different replies, and a transient outage must never tell the user to
   * re-link. Failures are not cached; only a good session is.
   */
  private async resolveSession(
    chatId: string,
  ): Promise<{ kind: 'ok'; accessToken: string } | { kind: 'unlinked' } | { kind: 'unavailable' }> {
    const cached = this.sessionCache.get(chatId);
    if (cached && cached.expiresAt > Date.now()) return { kind: 'ok', accessToken: cached.accessToken };

    try {
      const result = await this.hrCore.exchangeChannelIdentity(TELEGRAM, chatId);
      this.sessionCache.set(chatId, {
        accessToken: result.accessToken,
        expiresAt: Date.now() + Math.max(result.expiresIn - TOKEN_REFRESH_MARGIN_SECONDS, 0) * 1_000,
      });
      return { kind: 'ok', accessToken: result.accessToken };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) return { kind: 'unlinked' };
      if (err instanceof ServiceUnavailableException) {
        this.logger.warn(`HR Core unavailable while resolving chat ${chatId}: ${this.errorMessage(err)}`);
        return { kind: 'unavailable' };
      }
      this.logger.warn(`Session exchange failed for chat ${chatId}: ${this.errorMessage(err)}`);
      return { kind: 'unavailable' };
    }
  }

  // ---- Turn execution helpers --------------------------------------------------

  private claim(chatId: string): boolean {
    if (this.inFlight.has(chatId)) return false;
    this.inFlight.add(chatId);
    return true;
  }

  /**
   * Runs a turn with Telegram's native typing indicator kept alive, bounded by
   * the same requestTimeoutMs the HTTP path enforces. On timeout the turn keeps
   * running and persists its own result — the reply points at the web app and
   * never claims failure, because the work may well complete.
   */
  private async runWithTyping<T>(ctx: Context, chatId: string, work: () => Promise<T>): Promise<T | null> {
    const timeoutMs = this.config.get<AiAgenticConfig>('aiAgentic')?.requestTimeoutMs ?? 60_000;
    const typing = setInterval(() => void ctx.replyWithChatAction('typing').catch(() => undefined), TYPING_REFRESH_MS);
    void ctx.replyWithChatAction('typing').catch(() => undefined);

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const job = work();
    // A timed-out job must still settle the in-flight claim and never surface as unhandled.
    job.catch(() => undefined).finally(() => {
      clearInterval(typing);
      this.inFlight.delete(chatId);
    });

    try {
      const result = await Promise.race([job, timeout]);
      if (result === null) {
        this.logger.warn(`Telegram turn for chat ${chatId} exceeded ${timeoutMs}ms; replying with a deferral.`);
        await ctx.reply(
          "This is taking longer than usual. I'm still working on it — you'll find the answer in the Sentient web app under AI Assistant in a moment.",
        );
      }
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      clearInterval(typing);
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
