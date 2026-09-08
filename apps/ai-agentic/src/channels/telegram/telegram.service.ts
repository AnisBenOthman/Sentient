import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError } from 'grammy';
import { ChannelType } from '@sentient/shared';
import { HrCoreClient } from '../../common/clients/hr-core.client';

interface CachedSession {
  accessToken: string;
  expiresAt: number;
}

/**
 * WHY: Long polling (bot.start()) needs no public URL and no domain/TLS —
 * the whole reason Telegram is free-to-run at any scale for this project.
 * The tradeoff is exactly one poller per bot token: a second instance (or a
 * hot-reloaded dev process) makes Telegram's getUpdates return 409, which
 * onModuleInit's bot.catch() logs as a duplicate-poller conflict, not a
 * token problem.
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;
  private readonly sessionCache = new Map<string, CachedSession>();

  constructor(
    private readonly config: ConfigService,
    private readonly hrCore: HrCoreClient,
  ) {}

  onModuleInit(): void {
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

    // WHY: bot.start() resolves only when bot.stop() is called — it's a
    // long-polling loop. Awaiting it here would hang Nest's bootstrap
    // forever, so it's fired without awaiting; onModuleDestroy stops it.
    bot
      .start({ onStart: () => this.logger.log('Telegram bot connected (long polling)') })
      .catch((err: unknown) => this.logger.error(`Telegram bot failed to start: ${this.errorMessage(err)}`));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
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
