import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, RequireTaskType, Roles, SharedJwtGuard, SystemTaskGuard } from '@sentient/shared';
import type { Update } from 'grammy/types';
import { NotifyTelegramDto } from './dto/notify-telegram.dto';
import { TelegramService } from './telegram.service';

/**
 * WHY: SYSTEM-only relay — called by HR Core after a notification-worthy
 * decision (leave approved/rejected) when the recipient has a linked
 * Telegram chat. HR Core resolves the externalId itself from its own
 * channel_identities table; this endpoint never looks that up, so
 * channel_identities never has to leak into the ai_agent schema. Always
 * returns 204: a Telegram-side failure (bot disabled, chat blocked) is
 * this channel's problem, never the caller's.
 */
@ApiTags('Channels')
@Controller('channels/telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('notify')
  @UseGuards(SharedJwtGuard, RbacGuard, SystemTaskGuard)
  @Roles('SYSTEM')
  @RequireTaskType('channel_notify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[SYSTEM] Best-effort push of a plain-text message to a linked Telegram chat' })
  @ApiResponse({ status: 204 })
  async notify(@Body() dto: NotifyTelegramDto): Promise<void> {
    await this.telegram.sendMessage(dto.externalId, dto.text);
  }

  /**
   * WHY unauthenticated + no DTO: Telegram sends no Sentient JWT, so
   * SharedJwtGuard/RbacGuard don't apply here — the shared-secret header
   * (set once via bot.api.setWebhook, verified by TelegramService) is the
   * only gate. The body is typed loosely (not a class-validator DTO) so the
   * global ValidationPipe's forbidNonWhitelisted rule doesn't 400 a real
   * Telegram Update, which carries dozens of fields this DTO doesn't model.
   * ApiExcludeEndpoint: this route is for Telegram's servers, not Swagger
   * consumers, and it has no useful request/response shape to document.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async webhook(
    @Body() update: Update,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
  ): Promise<void> {
    if (!this.telegram.verifyWebhookSecret(secretToken)) {
      throw new ForbiddenException('Invalid webhook secret token');
    }
    await this.telegram.handleWebhookUpdate(update);
  }
}
