import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError } from 'grammy';
import type { Update } from 'grammy/types';
import { ChannelType } from '@sentient/shared';
import { HrCoreClient } from '../../common/clients/hr-core.client';

interface CachedSession {
  accessToken: string;
  expiresAt: number;
}

type TelegramMode = 'polling' | 'webhook';

/**
 * WHY two modes behind one switch rather than replacing polling: this repo
 * has no public HTTPS URL in local dev (docker-compose only exposes
 * localhost ports; api-gateway calls AI Agentic over host.docker.internal).
 * Telegram's setWebhook rejects anything but a public https:// URL, so
 * polling stays the default and only path that works without a tunnel.
 * TELEGRAM_MODE=webhook is opt-in, for a tunnel (ngrok/cloudflared) in dev
 * or a real domain in production — both talk to the same handlers below.
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private mode: TelegramMode = 'polling';
  private webhookSecret: string | null = null;
  private readonly sessionCache = new Map<string, CachedSession>();

  constructor(
    private readonly config: ConfigService,
    private readonly hrCore: HrCoreClient,
  ) {}

  async onModuleInit(): Promise<void> {
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
    } else {
      // WHY: bot.start() resolves only when bot.stop() is called — it's a
      // long-polling loop. Awaiting it here would hang Nest's bootstrap
      // forever, so it's fired without awaiting; onModuleDestroy stops it.
      bot
        .start({ onStart: () => this.logger.log('Telegram bot connected (long polling)') })
        .catch((err: unknown) => this.logger.error(`Telegram bot failed to start: ${this.errorMessage(err)}`));
    }
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
      // (required before handleUpdate() will process anything) without
      // opening a getUpdates long-polling loop — the two are mutually
      // exclusive on Telegram's side.
      await bot.init();
      await bot.api.setWebhook(webhookUrl, { secret_token: secret });
      this.logger.log(`Telegram bot connected (webhook: ${webhookUrl})`);
    } catch (err: unknown) {
      this.logger.error(`Telegram setWebhook failed: ${this.errorMessage(err)}`);
    }
  }

  /**
   * WHY the secret-token check lives here rather than a guard: this route
   * carries no Sentient JWT — Telegram sends none — so the shared auth
   * guards don't apply. The X-Telegram-Bot-Api-Secret-Token header, echoed
   * back on every webhook delivery once set via setWebhook, is the only
   * thing distinguishing a real Telegram delivery from anyone who finds
   * the URL. A mismatch (or webhook mode not actually running) is a 403
   * from the caller (TelegramController), never a silent accept.
   */
  verifyWebhookSecret(providedSecret: string | undefined): boolean {
    return this.mode === 'webhook' && this.webhookSecret !== null && providedSecret === this.webhookSecret;
  }

  async handleWebhookUpdate(update: Update): Promise<void> {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.bot) return;
    if (this.mode === 'webhook') {
      // WHY: a stale webhook pointed at a dead tunnel/instance means
      // Telegram silently drops every update until someone notices. Clearing
      // it on shutdown means the next boot's setWebhook is the only source
      // of truth, never a leftover from a previous dev session.
      await this.bot.api.deleteWebhook().catch((err: unknown) => {
        this.logger.warn(`Telegram deleteWebhook failed: ${this.errorMessage(err)}`);
      });
    } else {
      await this.bot.stop();
    }
  }

  private registerHandlers(bot: Bot): void {
    bot.command('start', async (ctx) => {
      await ctx.reply(
        "Hi, I'm Sentient. Get a link code from Settings > Linked Channels in the web app, " +
          'then send /link <code> here to connect this chat to your HR account.',
      );
    });

    bot.command('link', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const code = ctx.match.trim();
      if (!code) {
        await ctx.reply('Usage: /link <code> — get the code from Settings > Linked Channels in the web app.');
        return;
      }

      try {
        await this.hrCore.redeemLinkCode(ChannelType.TELEGRAM, chatId, code);
        this.sessionCache.delete(chatId);
        await ctx.reply("Linked! I'll recognize this chat from now on.");
      } catch (err: unknown) {
        this.logger.warn(`Link failed for chat ${chatId}: ${this.errorMessage(err)}`);
        await ctx.reply('That code is invalid or expired. Generate a new one from Settings and try again.');
      }
    });

    bot.command('unlink', async (ctx) => {
      const chatId = String(ctx.chat.id);
      this.sessionCache.delete(chatId);
      await ctx.reply('To unlink this chat, use Settings > Linked Channels in the Sentient web app.');
    });

    bot.command('whoami', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const session = await this.resolveSession(chatId);
      await ctx.reply(
        session ? "This chat is linked to your Sentient account." : "This chat isn't linked yet. Send /link <code>.",
      );
    });

    bot.on('message:text', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const session = await this.resolveSession(chatId);
      if (!session) {
        await ctx.reply("This chat isn't linked to a Sentient account yet. Send /link <code> to connect it.");
        return;
      }

      // WHY: The conversation/agent pipeline (Conversation, Message,
      // LangGraph) doesn't exist yet — apps/ai-agentic/prisma/schema.prisma
      // is still empty. This is the seam it plugs into once it lands;
      // nothing about the channel adapter above this line changes then.
      await ctx.reply(
        "I'm connected to your account, but full conversations aren't wired up yet — that part of Sentient is still being built.",
      );
    });
  }

  /**
   * WHY: Proactive push (HR Core calling in after a manager decision) is a
   * different failure surface than the inbound handlers above — there is no
   * ctx.reply to fall back on. Both "channel disabled" and "Telegram
   * rejected the send" (user blocked the bot, chat deleted) must resolve to
   * a quiet no-op rather than a thrown error: the caller only ever wanted
   * best-effort delivery, never a reason to fail its own request.
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

  private async resolveSession(chatId: string): Promise<CachedSession | null> {
    const cached = this.sessionCache.get(chatId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    try {
      const result = await this.hrCore.exchangeChannelIdentity(ChannelType.TELEGRAM, chatId);
      const session: CachedSession = {
        accessToken: result.accessToken,
        // Refresh 30s early so a cached token is never used right at expiry.
        expiresAt: Date.now() + Math.max(result.expiresIn - 30, 0) * 1_000,
      };
      this.sessionCache.set(chatId, session);
      return session;
    } catch (err: unknown) {
      this.logger.debug(`No linked session for chat ${chatId}: ${this.errorMessage(err)}`);
      return null;
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
