import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ChannelType,
  CurrentUser,
  JwtPayload,
  RbacGuard,
  RequireTaskType,
  Roles,
  SharedJwtGuard,
  SystemTaskGuard,
} from '@sentient/shared';
import { UserStatusGuard } from '../iam/guards/user-status.guard';
import { LoginResponseDto } from '../iam/dto/login-response.dto';
import { ChannelIdentitiesService } from './channel-identities.service';
import { ChannelIdentityResponseDto } from './dto/channel-identity-response.dto';
import { ExchangeChannelIdentityDto } from './dto/exchange-channel-identity.dto';
import { GenerateLinkCodeDto } from './dto/generate-link-code.dto';
import { LinkCodeResponseDto } from './dto/link-code-response.dto';
import { RedeemLinkCodeDto } from './dto/redeem-link-code.dto';

@ApiTags('Channel Identities')
@Controller('channel-identities')
export class ChannelIdentitiesController {
  constructor(private readonly channelIdentities: ChannelIdentitiesService) {}

  @Get()
  @UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
  @ApiOperation({ summary: 'List the calling user\'s linked chat channels' })
  @ApiResponse({ status: 200, type: [ChannelIdentityResponseDto] })
  async listOwn(@CurrentUser() user: JwtPayload): Promise<ChannelIdentityResponseDto[]> {
    return this.channelIdentities.listOwn(user.sub);
  }

  @Post('link-codes')
  @UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate a one-time code to pair a Telegram/Slack chat with this account' })
  @ApiResponse({ status: 201, type: LinkCodeResponseDto })
  async generateLinkCode(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateLinkCodeDto,
  ): Promise<LinkCodeResponseDto> {
    return this.channelIdentities.generateLinkCode(user.sub, dto.channel);
  }

  @Delete(':channel')
  @UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a chat channel from this account' })
  @ApiResponse({ status: 204 })
  async unlink(
    @CurrentUser() user: JwtPayload,
    @Param('channel', new ParseEnumPipe(ChannelType)) channel: ChannelType,
  ): Promise<void> {
    await this.channelIdentities.unlink(user.sub, channel);
  }

  // ============================================================
  // SYSTEM-only — called by AI Agentic's channel bots, never by the frontend.
  // Each endpoint is scoped to one taskType so a leaked SYSTEM token minted
  // for a different purpose can't be replayed here.
  // ============================================================

  @Post('redeem-link-code')
  @UseGuards(SharedJwtGuard, RbacGuard, SystemTaskGuard)
  @Roles('SYSTEM')
  @RequireTaskType('channel_link')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '[SYSTEM] Redeem a one-time link code to create a channel identity' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async redeemLinkCode(@Body() dto: RedeemLinkCodeDto): Promise<void> {
    await this.channelIdentities.redeemLinkCode(dto);
  }

  @Post('exchange')
  @UseGuards(SharedJwtGuard, RbacGuard, SystemTaskGuard)
  @Roles('SYSTEM')
  @RequireTaskType('channel_token_exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '[SYSTEM] Exchange a linked externalId for a real, RBAC-scoped session' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 404, description: 'Not linked' })
  async exchange(@Body() dto: ExchangeChannelIdentityDto): Promise<LoginResponseDto> {
    return this.channelIdentities.exchange(dto);
  }
}
