import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RbacGuard, RequireTaskType, Roles, SharedJwtGuard, SystemTaskGuard } from '@sentient/shared';
import type { Request } from 'express';
import { NotifySlackDto } from './dto/notify-slack.dto';
import { SlackEventsPayload, SlackService } from './slack.service';

/**
 * WHY: SYSTEM-only relay — called by HR Core after a notification-worthy
 * decision (leave approved/rejected) when the recipient has a linked Slack
 * account. HR Core resolves the externalId itself from its own
 * channel_identities table; this endpoint never looks that up. Always
 * returns 204: a Slack-side failure is this channel's problem, never the
 * caller's. Mirrors TelegramController one-for-one.
 */
@ApiTags('Channels')
@Controller('channels/slack')
export class SlackController {
  constructor(private readonly slack: SlackService) {}

  @Post('notify')
  @UseGuards(SharedJwtGuard, RbacGuard, SystemTaskGuard)
  @Roles('SYSTEM')
  @RequireTaskType('channel_notify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[SYSTEM] Best-effort push of a plain-text DM to a linked Slack user' })
  @ApiResponse({ status: 204 })
  async notify(@Body() dto: NotifySlackDto): Promise<void> {
    await this.slack.sendMessage(dto.externalId, dto.text);
  }

  /**
   * WHY unauthenticated + no DTO: Slack sends no Sentient JWT, so
   * SharedJwtGuard/RbacGuard don't apply here — the HMAC signature over the
   * raw body (verified by SlackService against SLACK_SIGNING_SECRET) is the
   * only gate, which is why main.ts enables `rawBody`. The body is typed
   * loosely (not a class-validator DTO) so the global ValidationPipe's
   * forbidNonWhitelisted rule doesn't 400 a real event envelope, which
   * carries dozens of fields this interface doesn't model.
   *
   * Retries: Slack redelivers when it doesn't get a 2xx within 3s. A retry
   * flagged http_timeout means the first delivery *was* received and merely
   * slow, so re-running it would double-reply; any other reason means the
   * first attempt never reached a handler and must be processed.
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async events(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: SlackEventsPayload,
    @Headers('x-slack-request-timestamp') timestamp: string | undefined,
    @Headers('x-slack-signature') signature: string | undefined,
    @Headers('x-slack-retry-reason') retryReason: string | undefined,
  ): Promise<{ challenge: string } | Record<string, never>> {
    const rawBody = req.rawBody?.toString('utf8');
    if (!this.slack.verifySignature(timestamp, signature, rawBody)) {
      throw new ForbiddenException('Invalid Slack request signature');
    }
    if (retryReason === 'http_timeout') {
      return {};
    }
    const result = await this.slack.handleEventsPayload(payload);
    return result ?? {};
  }
}
